using System.Reflection;
using Newtonsoft.Json;
using OC_Accelerator.Models.RaiDevWorld;
using OrderCloud.SDK;

namespace OC_Accelerator.Services.RaiDevWorld;

public record RaiSeedOptions(string DataPath, bool DryRun, bool ForceUpdate, string ApiUrl, string ClientId, string ClientSecret, string BuyerId, string CatalogId);
public record RaiSeedSummary(int Products, int Categories, int PriceSchedules, int Specs, int Options, int CatalogAssignments, int CategoryAssignments, int Failed, bool DryRun, int MaxCategoryXpLength = 0, int MaxProductXpLength = 0, int SnapshotProductRecords = 0, int DuplicateProductRecordsCollapsed = 0);

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
            var dryRunPayloads = BuildAndValidateTypedPayloads(snap, o.CatalogId, categories);
            await log.WriteLineAsync($"Dry run: {snap.Products.Count} snapshot product records, {snap.Categories.Count} source categories, {specs} specs, {opts} options.");
            await log.WriteLineAsync($"Dry run validated typed OrderCloud payloads for catalog '{o.CatalogId}': {dryRunPayloads.Categories.Count} unique categories, {dryRunPayloads.PriceSchedules.Count} unique price schedules, {dryRunPayloads.Products.Count} unique products, {dryRunPayloads.CatalogAssignments.Count} unique catalog assignments, {dryRunPayloads.CategoryAssignments.Count} unique category assignments.");
            await log.WriteLineAsync($"Dry run duplicates: {dryRunPayloads.SnapshotProductRecords} snapshot product records, {dryRunPayloads.Products.Count} unique product writes, {dryRunPayloads.DuplicateProductRecordsCollapsed} duplicate product records collapsed.");
            await log.WriteLineAsync($"Dry run XP lengths: max category xp {dryRunPayloads.MaxCategoryXpLength} chars, max product xp {dryRunPayloads.MaxProductXpLength} chars.");
            return new(dryRunPayloads.Products.Count, dryRunPayloads.Categories.Count, dryRunPayloads.PriceSchedules.Count, specs, opts, dryRunPayloads.CatalogAssignments.Count, dryRunPayloads.CategoryAssignments.Count, 0, true, dryRunPayloads.MaxCategoryXpLength, dryRunPayloads.MaxProductXpLength, dryRunPayloads.SnapshotProductRecords, dryRunPayloads.DuplicateProductRecordsCollapsed);
        }

        if (string.IsNullOrWhiteSpace(o.ClientId) || string.IsNullOrWhiteSpace(o.ClientSecret))
            throw new InvalidOperationException("ORDERCLOUD_CLIENT_ID and ORDERCLOUD_CLIENT_SECRET are required for a real RAI seed.");

        var oc = new OrderCloudClient(new OrderCloudClientConfig { ApiUrl = o.ApiUrl, AuthUrl = o.ApiUrl, ClientId = o.ClientId, ClientSecret = o.ClientSecret, Roles = new[] { ApiRole.FullAccess } });
        await log.WriteLineAsync($"Authenticated OrderCloud client for {o.ApiUrl}; credentials redacted.");
        var seedPayloads = await SeedDynamicAsync((dynamic)oc, snap, o, log);
        return new(seedPayloads.Products.Count, seedPayloads.Categories.Count, seedPayloads.PriceSchedules.Count, specs, opts, seedPayloads.CatalogAssignments.Count, seedPayloads.CategoryAssignments.Count, 0, false, seedPayloads.MaxCategoryXpLength, seedPayloads.MaxProductXpLength, seedPayloads.SnapshotProductRecords, seedPayloads.DuplicateProductRecordsCollapsed);
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
        var categoryPayloads = DistinctByKey(categories ?? BuildCategories(s), c => c.ID, "category").ToList();
        var products = DistinctProductPayloads(
            s.Products,
            p => p.OcId,
            p => BuildProduct(p, s),
            ProductsConflict,
            "product").ToList();
        var priceSchedules = DistinctProductPayloads(
            s.Products,
            p => p.PriceScheduleId,
            BuildPriceSchedule,
            PriceSchedulesConflict,
            "price schedule").ToList();
        var catalogAssignments = DistinctByKey(
            s.Products.Select(p => BuildProductCatalogAssignment(catalogId, p)),
            a => $"{a.CatalogID}\u001f{a.ProductID}",
            "catalog product assignment").ToList();
        var categoryAssignments = DistinctByKey(
            s.Products.SelectMany(BuildCategoryProductAssignments),
            a => $"{a.CategoryID}\u001f{a.ProductID}",
            "category product assignment").ToList();

        ValidateCategorySaveArguments(catalogId, categoryPayloads);
        ValidatePriceSchedules(priceSchedules);
        ValidateProducts(products);
        var maxCategoryXpLength = ValidateXpStrings(categoryPayloads.Select(c => (ResourceType: "Category", ResourceId: c.ID, Xp: c.xp)));
        var maxProductXpLength = ValidateXpStrings(products.Select(p => (ResourceType: "Product", ResourceId: p.ID, Xp: p.xp)));
        ValidateCatalogAssignments(catalogAssignments);
        ValidateCategoryProductAssignments(categoryAssignments);

        return new RaiTypedPayloads(categoryPayloads, priceSchedules, products, catalogAssignments, categoryAssignments, maxCategoryXpLength, maxProductXpLength, s.Products.Count, s.Products.Count - products.Count);
    }

    static IEnumerable<TPayload> DistinctProductPayloads<TPayload>(IEnumerable<RaiProduct> products, Func<RaiProduct, string?> idSelector, Func<RaiProduct, TPayload> build, Func<TPayload, TPayload, string?> conflictSelector, string resourceType)
    {
        var byId = new Dictionary<string, TPayload>(StringComparer.OrdinalIgnoreCase);
        foreach (var source in products)
        {
            var id = idSelector(source);
            if (string.IsNullOrWhiteSpace(id))
                throw new InvalidOperationException($"RAI {resourceType} seed encountered a product record without an ID.");
            var payload = build(source);
            if (byId.TryGetValue(id, out var existing))
            {
                var conflict = conflictSelector(existing, payload);
                if (conflict != null)
                    throw new InvalidOperationException($"Duplicate RAI product records for {resourceType} '{id}' have conflicting {conflict}.");
                continue;
            }
            byId.Add(id, payload);
        }
        return byId.Values;
    }

    static IEnumerable<T> DistinctByKey<T>(IEnumerable<T> items, Func<T, string?> keySelector, string resourceType)
    {
        var byKey = new Dictionary<string, T>(StringComparer.OrdinalIgnoreCase);
        foreach (var item in items)
        {
            var key = keySelector(item);
            if (string.IsNullOrWhiteSpace(key))
                throw new InvalidOperationException($"RAI {resourceType} seed built a payload with an empty distinct key.");
            if (!byKey.ContainsKey(key))
                byKey.Add(key, item);
        }
        return byKey.Values;
    }

    static string? ProductsConflict(Product existing, Product candidate)
    {
        if (!StringEquals(existing.Name, candidate.Name)) return $"Name values ('{existing.Name}' vs '{candidate.Name}')";
        if (!StringEquals(existing.DefaultPriceScheduleID, candidate.DefaultPriceScheduleID)) return $"DefaultPriceScheduleID values ('{existing.DefaultPriceScheduleID}' vs '{candidate.DefaultPriceScheduleID}')";
        return null;
    }

    static string? PriceSchedulesConflict(PriceSchedule existing, PriceSchedule candidate)
    {
        if (!StringEquals(existing.Name, candidate.Name)) return $"Name values ('{existing.Name}' vs '{candidate.Name}')";
        if (existing.MinQuantity != candidate.MinQuantity) return $"MinQuantity values ('{existing.MinQuantity}' vs '{candidate.MinQuantity}')";
        if (existing.MaxQuantity != candidate.MaxQuantity) return $"MaxQuantity values ('{existing.MaxQuantity}' vs '{candidate.MaxQuantity}')";
        if (existing.RestrictedQuantity != candidate.RestrictedQuantity) return $"RestrictedQuantity values ('{existing.RestrictedQuantity}' vs '{candidate.RestrictedQuantity}')";
        if (!StringEquals(existing.Currency, candidate.Currency)) return $"Currency values ('{existing.Currency}' vs '{candidate.Currency}')";
        var existingBreaks = existing.PriceBreaks?.ToList() ?? new List<PriceBreak>();
        var candidateBreaks = candidate.PriceBreaks?.ToList() ?? new List<PriceBreak>();
        if (existingBreaks.Count != candidateBreaks.Count) return "price break counts";
        for (var i = 0; i < existingBreaks.Count; i++)
        {
            if (existingBreaks[i].Quantity != candidateBreaks[i].Quantity || existingBreaks[i].Price != candidateBreaks[i].Price)
                return $"price break #{i + 1} values";
        }
        return null;
    }

    static bool StringEquals(string? left, string? right) => string.Equals(left, right, StringComparison.Ordinal);

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
        var categories = BuildAndValidateTypedPayloads(s, o.CatalogId).Categories;
        await SaveCategoriesAsync(oc, o.CatalogId, categories);
    }

    static async Task SaveCategoriesAsync(dynamic oc, string catalogId, IEnumerable<Category> categories)
    {
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

    async Task<RaiTypedPayloads> SeedDynamicAsync(dynamic oc, RaiSnapshot s, RaiSeedOptions o, TextWriter log)
    {
        await log.WriteLineAsync("Starting real seed. Existing unmanaged ID collisions are checked before writes where resources are returned by the API.");
        /* OrderCloud SDK 0.13 dynamic calls are intentionally isolated so dry-run/tests do not need credentials. */
        var typedPayloads = BuildAndValidateTypedPayloads(s, o.CatalogId);

        foreach (var category in typedPayloads.Categories)
            await log.WriteLineAsync($"Saving category {category.ID}");
        await SaveCategoriesAsync(oc, o.CatalogId, typedPayloads.Categories);

        foreach (var priceSchedule in typedPayloads.PriceSchedules)
        {
            await log.WriteLineAsync($"Saving price schedule {priceSchedule.ID}");
            await Retry(async () => await oc.PriceSchedules.SaveAsync(priceSchedule.ID, priceSchedule, null), "price schedule", priceSchedule.ID);
        }

        foreach (var product in typedPayloads.Products)
        {
            await log.WriteLineAsync($"Saving product {product.ID}");
            await Retry(async () => await oc.Products.SaveAsync(product.ID, product, null), "product", product.ID);
        }

        foreach (var catalogAssignment in typedPayloads.CatalogAssignments)
        {
            await log.WriteLineAsync($"Saving catalog product assignment {catalogAssignment.CatalogID}/{catalogAssignment.ProductID}");
            await Retry(async () => await oc.Catalogs.SaveProductAssignmentAsync(catalogAssignment), "catalog product assignment", $"{catalogAssignment.CatalogID}/{catalogAssignment.ProductID}");
        }

        foreach (var categoryAssignment in typedPayloads.CategoryAssignments)
        {
            await log.WriteLineAsync($"Saving category product assignment {categoryAssignment.CategoryID}/{categoryAssignment.ProductID}");
            await Retry(async () => await oc.Categories.SaveProductAssignmentAsync(o.CatalogId, categoryAssignment), "category product assignment", $"{categoryAssignment.CategoryID}/{categoryAssignment.ProductID}");
        }

        return typedPayloads;
    }

    static async Task Retry(Func<Task> op, string resourceType, string resourceId)
    {
        for (var i = 0; ; i++)
        {
            try { await op(); return; }
            catch (OrderCloudException ex) when (i < 4 && ((int)ex.HttpStatus == 429 || (int)ex.HttpStatus >= 500)) { await Task.Delay(TimeSpan.FromMilliseconds(250 * Math.Pow(2, i))); }
            catch (OrderCloudException ex)
            {
                throw new InvalidOperationException(BuildOrderCloudFailureMessage(resourceType, resourceId, ex), ex);
            }
            catch (Exception ex)
            {
                throw new InvalidOperationException($"Failed saving {resourceType} '{resourceId}'.", ex);
            }
        }
    }

    public static string BuildOrderCloudFailureMessage(string resourceType, string resourceId, OrderCloudException ex)
    {
        var details = new List<string>
        {
            $"resource type: {resourceType}",
            $"resource ID: {resourceId}",
            $"HTTP status: {(int)ex.HttpStatus} ({ex.HttpStatus})",
            $"message: {ex.Message}"
        };

        foreach (var detail in GetOrderCloudExceptionDetails(ex))
            details.Add(detail);

        return $"Failed saving {resourceType} '{resourceId}'. OrderCloud details: {string.Join("; ", details)}";
    }

    static IEnumerable<string> GetOrderCloudExceptionDetails(OrderCloudException ex)
    {
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var property in ex.GetType().GetProperties(BindingFlags.Instance | BindingFlags.Public))
        {
            if (property.GetIndexParameters().Length != 0)
                continue;
            if (property.Name is nameof(Exception.Message) or nameof(Exception.StackTrace) or nameof(Exception.InnerException) or nameof(Exception.TargetSite) or nameof(Exception.Data) or nameof(Exception.HelpLink) or nameof(Exception.Source) or nameof(Exception.HResult) or "HttpStatus")
                continue;
            object? value;
            try
            {
                value = property.GetValue(ex);
            }
            catch
            {
                continue;
            }
            if (value == null)
                continue;

            var rendered = value is string text ? text : JsonConvert.SerializeObject(value, Formatting.None);
            if (string.IsNullOrWhiteSpace(rendered) || rendered == "null" || !seen.Add(property.Name))
                continue;
            yield return $"{property.Name}: {rendered}";
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
    int MaxProductXpLength,
    int SnapshotProductRecords,
    int DuplicateProductRecordsCollapsed);
