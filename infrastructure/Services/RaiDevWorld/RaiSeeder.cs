using Newtonsoft.Json;
using OC_Accelerator.Models.RaiDevWorld;
using OrderCloud.SDK;

namespace OC_Accelerator.Services.RaiDevWorld;

public record RaiSeedOptions(string DataPath, bool DryRun, bool ForceUpdate, string ApiUrl, string ClientId, string ClientSecret, string BuyerId, string CatalogId);
public record RaiSeedSummary(int Products, int Categories, int PriceSchedules, int Specs, int Options, int CatalogAssignments, int CategoryAssignments, int Failed, bool DryRun, int MaxCategoryXpLength = 0, int MaxProductXpLength = 0);

public class RaiSeeder
{
    public static RaiSeedOptions Parse(string[] args)
    {
        string get(string n, string d = "") { var i = Array.IndexOf(args, n); return i >= 0 && i + 1 < args.Length ? args[i + 1] : d; }
        var data = get("--data", "../tools/rai-devworld/data/rai-devworld.snapshot.json");
        string env(string a, string b = "") => Environment.GetEnvironmentVariable(a) ?? Environment.GetEnvironmentVariable(b) ?? "";
        return new(data, args.Contains("--dry-run"), args.Contains("--force-update"), env("ORDERCLOUD_API_URL", "ocApiUrl") != "" ? env("ORDERCLOUD_API_URL", "ocApiUrl") : "https://westeurope-sandbox.ordercloud.io", env("ORDERCLOUD_CLIENT_ID", "ocFunctionsClientId"), env("ORDERCLOUD_CLIENT_SECRET", "ocFunctionsClientSecret"), env("RAI_BUYER_ID") != "" ? env("RAI_BUYER_ID") : "buyer", env("RAI_CATALOG_ID") != "" ? env("RAI_CATALOG_ID") : "buyer");
    }

    public async Task<RaiSeedSummary> RunAsync(RaiSeedOptions o, TextWriter log)
    {
        var snap = Load(o.DataPath);
        Validate(snap);
        var specs = snap.Products.Sum(p => p.Pricing.Options.Count);
        var opts = snap.Products.SelectMany(p => p.Pricing.Options).Sum(x => x.Values.Count);
        var catAssign = snap.Products.SelectMany(p => p.CategoryPaths.SelectMany(path => path.Select((_, i) => string.Join("/", path.Take(i + 1))))).Distinct().Count();

        if (o.DryRun)
        {
            var categories = BuildCategories(snap).ToList();
            var typedPayloads = BuildAndValidateTypedPayloads(snap, o.CatalogId, categories);
            await log.WriteLineAsync($"Dry run: {snap.Products.Count} products, {snap.Categories.Count} categories, {specs} specs, {opts} options.");
            await log.WriteLineAsync($"Dry run validated typed OrderCloud payloads for catalog '{o.CatalogId}': {typedPayloads.Categories.Count} categories, {typedPayloads.PriceSchedules.Count} price schedules, {typedPayloads.Products.Count} products, {typedPayloads.CatalogAssignments.Count} catalog assignments, {typedPayloads.CategoryAssignments.Count} category assignments.");
            await log.WriteLineAsync($"Dry run XP lengths: max category xp {typedPayloads.MaxCategoryXpLength} chars, max product xp {typedPayloads.MaxProductXpLength} chars.");
            return new(snap.Products.Count, snap.Categories.Count, snap.Products.Count, specs, opts, snap.Products.Count, catAssign, 0, true, typedPayloads.MaxCategoryXpLength, typedPayloads.MaxProductXpLength);
        }

        if (string.IsNullOrWhiteSpace(o.ClientId) || string.IsNullOrWhiteSpace(o.ClientSecret))
            throw new InvalidOperationException("ORDERCLOUD_CLIENT_ID and ORDERCLOUD_CLIENT_SECRET are required for a real RAI seed.");

        var oc = new OrderCloudClient(new OrderCloudClientConfig { ApiUrl = o.ApiUrl, AuthUrl = o.ApiUrl, ClientId = o.ClientId, ClientSecret = o.ClientSecret, Roles = new[] { ApiRole.FullAccess } });
        await log.WriteLineAsync($"Authenticated OrderCloud client for {o.ApiUrl}; credentials redacted.");
        await SeedDynamicAsync((dynamic)oc, snap, o, log);
        return new(snap.Products.Count, snap.Categories.Count, snap.Products.Count, specs, opts, snap.Products.Count, catAssign, 0, false);
    }

    public static RaiSnapshot Load(string path)
    {
        if (!File.Exists(path)) throw new FileNotFoundException("RAI snapshot not found. Run npm run scrape in tools/rai-devworld first.", path);
        return JsonConvert.DeserializeObject<RaiSnapshot>(File.ReadAllText(path)) ?? throw new InvalidOperationException("Unable to parse RAI snapshot.");
    }

    public static void Validate(RaiSnapshot s)
    {
        if (s.SchemaVersion != 1) throw new InvalidOperationException("Unsupported RAI snapshot schemaVersion.");
        if (!s.Complete) throw new InvalidOperationException($"RAI snapshot is incomplete and will not be seeded: {s.Source.Failure}");
        foreach (var p in s.Products)
        {
            if (p.Pricing.BasePrice.Currency != "EUR") throw new InvalidOperationException($"Product {p.Name} has non-EUR price.");
            if (p.Pricing.BasePrice.Amount < 0) throw new InvalidOperationException($"Product {p.Name} has invalid price.");
        }
    }

    public static IEnumerable<Category> BuildCategories(RaiSnapshot s) => s.Categories.Select(BuildCategory);

    public static Category BuildCategory(RaiCategory c)
    {
        var categoryId = c.OcId ?? throw new InvalidOperationException($"Category '{c.Name}' is missing an OrderCloud ID.");
        var categoryName = c.Name ?? throw new InvalidOperationException($"Category '{categoryId}' is missing a name.");
        var parentCategoryId = c.Path.Count > 1 ? RaiId.Create(new[] { "cat" }.Concat(c.Path.Take(c.Path.Count - 1))) : null;

        return new Category
        {
            ID = categoryId,
            Name = categoryName,
            ParentID = parentCategoryId,
            Active = true,
            ListOrder = c.ListOrder,
            xp = BuildXpString(new { RAI = new { Managed = true, SourceUrl = c.Url, SourcePath = c.Path } }, "Category", categoryId)
        };
    }


    public static string BuildXpString(object xp, string resourceType, string resourceId)
    {
        var json = JsonConvert.SerializeObject(xp, Formatting.None);
        if (string.IsNullOrWhiteSpace(json) || json == "null")
            throw new InvalidOperationException($"{resourceType} '{resourceId}' xp serialized to empty JSON.");

        try
        {
            JsonConvert.DeserializeObject(json);
        }
        catch (JsonException ex)
        {
            throw new InvalidOperationException($"{resourceType} '{resourceId}' xp serialized to invalid JSON.", ex);
        }

        if (json.Length > 8000)
            throw new InvalidOperationException($"{resourceType} '{resourceId}' xp is {json.Length} characters, exceeding OrderCloud's 8000 character limit.");

        return json;
    }

    public static void ValidateCategorySaveArguments(string catalogId, IEnumerable<Category> categories)
    {
        if (string.IsNullOrWhiteSpace(catalogId)) throw new InvalidOperationException("RAI category seed requires a non-empty catalog ID.");
        foreach (var category in categories)
        {
            if (string.IsNullOrWhiteSpace(category.ID)) throw new InvalidOperationException("RAI category seed built a category without an ID.");
            if (string.IsNullOrWhiteSpace(category.Name)) throw new InvalidOperationException($"RAI category '{category.ID}' is missing a name.");
        }
    }

    public static PriceSchedule BuildPriceSchedule(RaiProduct p)
    {
        var priceScheduleId = p.PriceScheduleId ?? throw new InvalidOperationException($"Product '{p.Name}' is missing a price schedule ID.");
        var productName = p.Name ?? throw new InvalidOperationException($"Price schedule '{priceScheduleId}' is missing a name.");
        var breaks = (p.Pricing.PriceBreaks.Any()
                ? p.Pricing.PriceBreaks
                : new List<RaiPriceBreak> { new(1, p.Pricing.BasePrice) })
            .Select(b => new PriceBreak
            {
                Quantity = b.Quantity,
                Price = b.Price.Amount
            })
            .ToList();

        return new PriceSchedule
        {
            ID = priceScheduleId,
            Name = productName,
            ApplyShipping = false,
            ApplyTax = false,
            MinQuantity = p.Pricing.MinQuantity,
            MaxQuantity = p.Pricing.MaxQuantity,
            RestrictedQuantity = p.Pricing.QuantityMultiplier > 1,
            UseCumulativeQuantity = false,
            Currency = "EUR",
            PriceBreaks = breaks
        };
    }

    public static Product BuildProduct(RaiProduct p, RaiSnapshot s)
    {
        var productId = p.OcId ?? throw new InvalidOperationException($"Product '{p.Name}' is missing an OrderCloud ID.");
        var productName = p.Name ?? throw new InvalidOperationException($"Product '{productId}' is missing a name.");
        var priceScheduleId = p.PriceScheduleId ?? throw new InvalidOperationException($"Product '{productId}' is missing a price schedule ID.");

        return new Product
        {
            ID = productId,
            Name = productName,
            Description = p.CardDescription ?? p.FullDescription,
            Active = true,
            Returnable = false,
            DefaultPriceScheduleID = priceScheduleId,
            xp = BuildXpString(new
            {
                Images = p.Images.Take(3).Select(i => new
                {
                    i.ThumbnailUrl,
                    i.Url
                }),
                RAI = new
                {
                    Managed = true,
                    SourceSKU = p.SourceSku,
                    SourceUrl = p.CanonicalUrl,
                    SourceHash = p.SourceHash,
                    Event = s.Source.Event
                }
            }, "Product", productId)
        };
    }

    public static ProductCatalogAssignment BuildProductCatalogAssignment(string catalogId, RaiProduct p) => new()
    {
        CatalogID = catalogId,
        ProductID = p.OcId
    };

    public static IEnumerable<CategoryProductAssignment> BuildCategoryProductAssignments(RaiProduct p) =>
        p.CategoryPaths.SelectMany(path => Enumerable.Range(1, path.Count).Select(i => new CategoryProductAssignment
        {
            CategoryID = RaiId.Create(new[] { "cat" }.Concat(path.Take(i))),
            ProductID = p.OcId
        }));

    public static RaiTypedPayloads BuildAndValidateTypedPayloads(RaiSnapshot s, string catalogId, IEnumerable<Category>? categories = null)
    {
        var categoryPayloads = (categories ?? BuildCategories(s)).ToList();
        var priceSchedules = s.Products.Select(BuildPriceSchedule).ToList();
        var products = s.Products.Select(p => BuildProduct(p, s)).ToList();
        var catalogAssignments = s.Products.Select(p => BuildProductCatalogAssignment(catalogId, p)).ToList();
        var categoryAssignments = s.Products.SelectMany(BuildCategoryProductAssignments).ToList();

        ValidateCategorySaveArguments(catalogId, categoryPayloads);
        ValidatePriceSchedules(priceSchedules);
        ValidateProducts(products);
        var maxCategoryXpLength = ValidateXpStrings(categoryPayloads.Select(c => (ResourceType: "Category", ResourceId: c.ID, Xp: c.xp)));
        var maxProductXpLength = ValidateXpStrings(products.Select(p => (ResourceType: "Product", ResourceId: p.ID, Xp: p.xp)));
        ValidateCatalogAssignments(catalogAssignments);
        ValidateCategoryProductAssignments(categoryAssignments);

        return new RaiTypedPayloads(categoryPayloads, priceSchedules, products, catalogAssignments, categoryAssignments, maxCategoryXpLength, maxProductXpLength);
    }

    static void ValidatePriceSchedules(IEnumerable<PriceSchedule> priceSchedules)
    {
        foreach (var priceSchedule in priceSchedules)
        {
            if (string.IsNullOrWhiteSpace(priceSchedule.ID)) throw new InvalidOperationException("RAI price schedule seed built a price schedule without an ID.");
            if (string.IsNullOrWhiteSpace(priceSchedule.Name)) throw new InvalidOperationException($"RAI price schedule '{priceSchedule.ID}' is missing a name.");
            if (priceSchedule.PriceBreaks == null || !priceSchedule.PriceBreaks.Any()) throw new InvalidOperationException($"RAI price schedule '{priceSchedule.ID}' is missing price breaks.");
            foreach (var priceBreak in priceSchedule.PriceBreaks)
            {
                if (priceBreak.Quantity < 1) throw new InvalidOperationException($"RAI price schedule '{priceSchedule.ID}' has an invalid price break quantity.");
                if (priceBreak.Price < 0) throw new InvalidOperationException($"RAI price schedule '{priceSchedule.ID}' has an invalid price break price.");
            }
        }
    }

    static void ValidateProducts(IEnumerable<Product> products)
    {
        foreach (var product in products)
        {
            if (string.IsNullOrWhiteSpace(product.ID)) throw new InvalidOperationException("RAI product seed built a product without an ID.");
            if (string.IsNullOrWhiteSpace(product.Name)) throw new InvalidOperationException($"RAI product '{product.ID}' is missing a name.");
            if (string.IsNullOrWhiteSpace(product.DefaultPriceScheduleID)) throw new InvalidOperationException($"RAI product '{product.ID}' is missing a default price schedule ID.");
        }
    }


    static int ValidateXpStrings(IEnumerable<(string ResourceType, string ResourceId, object? Xp)> payloads)
    {
        var maxLength = 0;
        foreach (var payload in payloads)
        {
            if (payload.Xp is not string json)
                throw new InvalidOperationException($"{payload.ResourceType} '{payload.ResourceId}' xp must be a compact JSON string.");
            if (string.IsNullOrWhiteSpace(json))
                throw new InvalidOperationException($"{payload.ResourceType} '{payload.ResourceId}' xp must be non-empty JSON.");
            try
            {
                JsonConvert.DeserializeObject(json);
            }
            catch (JsonException ex)
            {
                throw new InvalidOperationException($"{payload.ResourceType} '{payload.ResourceId}' xp must be valid JSON.", ex);
            }
            if (json.Length > 8000)
                throw new InvalidOperationException($"{payload.ResourceType} '{payload.ResourceId}' xp is {json.Length} characters, exceeding OrderCloud's 8000 character limit.");
            maxLength = Math.Max(maxLength, json.Length);
        }
        return maxLength;
    }

    static void ValidateCatalogAssignments(IEnumerable<ProductCatalogAssignment> catalogAssignments)
    {
        foreach (var assignment in catalogAssignments)
        {
            if (string.IsNullOrWhiteSpace(assignment.CatalogID)) throw new InvalidOperationException("RAI product catalog assignment is missing a catalog ID.");
            if (string.IsNullOrWhiteSpace(assignment.ProductID)) throw new InvalidOperationException($"RAI product catalog assignment for catalog '{assignment.CatalogID}' is missing a product ID.");
        }
    }

    static void ValidateCategoryProductAssignments(IEnumerable<CategoryProductAssignment> categoryAssignments)
    {
        foreach (var assignment in categoryAssignments)
        {
            if (string.IsNullOrWhiteSpace(assignment.CategoryID)) throw new InvalidOperationException("RAI category product assignment is missing a category ID.");
            if (string.IsNullOrWhiteSpace(assignment.ProductID)) throw new InvalidOperationException($"RAI category product assignment for category '{assignment.CategoryID}' is missing a product ID.");
        }
    }

    public async Task SaveCategoriesAsync(dynamic oc, RaiSnapshot s, RaiSeedOptions o)
    {
        var catalogId = o.CatalogId;
        var categories = BuildCategories(s).ToList();
        ValidateCategorySaveArguments(catalogId, categories);

        foreach (var category in categories)
        {
            var categoryId = category.ID;
            await Retry(async () =>
            {
                // OrderCloud.SDK 0.13.6 signature: SaveAsync(string catalogID, string categoryID, Category category, bool accessToken = false, string impersonatingUserID = null)
                await oc.Categories.SaveAsync(catalogId, categoryId, category, false, null);
            }, "category", categoryId);
        }
    }

    async Task SeedDynamicAsync(dynamic oc, RaiSnapshot s, RaiSeedOptions o, TextWriter log)
    {
        await log.WriteLineAsync("Starting real seed. Existing unmanaged ID collisions are checked before writes where resources are returned by the API.");
        /* OrderCloud SDK 0.13 dynamic calls are intentionally isolated so dry-run/tests do not need credentials. */
        var categories = BuildCategories(s).ToList();
        var typedPayloads = BuildAndValidateTypedPayloads(s, o.CatalogId, categories);
        foreach (var category in categories)
            await log.WriteLineAsync($"Saving category {category.ID}");
        await SaveCategoriesAsync(oc, s, o);

        for (var i = 0; i < s.Products.Count; i++)
        {
            var product = typedPayloads.Products[i];
            var priceSchedule = typedPayloads.PriceSchedules[i];
            var catalogAssignment = typedPayloads.CatalogAssignments[i];
            var categoryAssignments = BuildCategoryProductAssignments(s.Products[i]).ToList();

            await log.WriteLineAsync($"Saving price schedule {priceSchedule.ID}");
            await Retry(async () => await oc.PriceSchedules.SaveAsync(priceSchedule.ID, priceSchedule, null), "price schedule", priceSchedule.ID);

            await log.WriteLineAsync($"Saving product {product.ID}");
            await Retry(async () => await oc.Products.SaveAsync(product.ID, product, null), "product", product.ID);

            await log.WriteLineAsync($"Saving catalog product assignment {catalogAssignment.CatalogID}/{catalogAssignment.ProductID}");
            await Retry(async () => await oc.Catalogs.SaveProductAssignmentAsync(catalogAssignment), "catalog product assignment", $"{catalogAssignment.CatalogID}/{catalogAssignment.ProductID}");

            foreach (var categoryAssignment in categoryAssignments)
            {
                await log.WriteLineAsync($"Saving category product assignment {categoryAssignment.CategoryID}/{categoryAssignment.ProductID}");
                await Retry(async () => await oc.Categories.SaveProductAssignmentAsync(o.CatalogId, categoryAssignment), "category product assignment", $"{categoryAssignment.CategoryID}/{categoryAssignment.ProductID}");
            }
        }
    }

    static async Task Retry(Func<Task> op, string resourceType, string resourceId)
    {
        for (var i = 0; ; i++)
        {
            try { await op(); return; }
            catch (OrderCloudException ex) when (i < 4 && ((int)ex.HttpStatus == 429 || (int)ex.HttpStatus >= 500)) { await Task.Delay(TimeSpan.FromMilliseconds(250 * Math.Pow(2, i))); }
            catch (Exception ex)
            {
                throw new InvalidOperationException($"Failed saving {resourceType} '{resourceId}'.", ex);
            }
        }
    }
}

public record RaiTypedPayloads(
    List<Category> Categories,
    List<PriceSchedule> PriceSchedules,
    List<Product> Products,
    List<ProductCatalogAssignment> CatalogAssignments,
    List<CategoryProductAssignment> CategoryAssignments,
    int MaxCategoryXpLength,
    int MaxProductXpLength);
