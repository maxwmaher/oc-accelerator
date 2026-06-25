using OC_Accelerator.Services.RaiDevWorld;
namespace OC_Accelerator.Tests;
public class RaiDevWorldTests
{
    [Test]
    public void Ids_are_deterministic_and_truncated()
    {
        var id = RaiId.Create(new[] { new string('x', 200) }, 40);
        Assert.That(id, Is.EqualTo(RaiId.Create(new[] { new string('x', 200) }, 40)));
        Assert.That(id.Length, Is.LessThanOrEqualTo(40));
    }

    [Test]
    public void Dry_run_planning_refuses_missing_snapshot()
    {
        Assert.Throws<FileNotFoundException>(() => RaiSeeder.Load("missing.json"));
    }
}

public class RaiDevWorldCategorySeedTests
{
    [Test]
    public async Task Real_seed_category_path_calls_ordercloud_save_with_sdk_category_arguments()
    {
        var snapshot = new OC_Accelerator.Models.RaiDevWorld.RaiSnapshot(
            1,
            true,
            new OC_Accelerator.Models.RaiDevWorld.RaiSource("RAI", "DevWorld", "en", "EUR", "https://example.test", "2026-06-25T00:00:00Z", null),
            new List<OC_Accelerator.Models.RaiDevWorld.RaiCategory>
            {
                new(null, "Printing", new List<string> { "Printing" }, "https://example.test/printing", 1, null, "rai-devworld-cat-printing")
            },
            new List<OC_Accelerator.Models.RaiDevWorld.RaiProduct>());
        var options = new RaiSeedOptions("snapshot.json", false, false, "https://api.example.test", "client", "secret", "buyer", "catalog-1");
        var fake = new FakeOrderCloudClient();

        await new RaiSeeder().SaveCategoriesAsync(fake, snapshot, options);

        Assert.That(fake.Categories.Calls, Has.Count.EqualTo(1));
        var call = fake.Categories.Calls.Single();
        Assert.That(call.CatalogId, Is.EqualTo("catalog-1"));
        Assert.That(call.CategoryId, Is.EqualTo("rai-devworld-cat-printing"));
        Assert.That(call.Category, Is.TypeOf<OrderCloud.SDK.Category>());
        Assert.That(call.Category.ID, Is.EqualTo("rai-devworld-cat-printing"));
        Assert.That(call.Category.Name, Is.EqualTo("Printing"));
        Assert.That(call.Category.Active, Is.True);
        Assert.That(call.Category.ListOrder, Is.EqualTo(1));
    }

    private sealed class FakeOrderCloudClient
    {
        public FakeCategoriesResource Categories { get; } = new();
    }

    private sealed class FakeCategoriesResource
    {
        public List<(string CatalogId, string CategoryId, OrderCloud.SDK.Category Category, bool AccessToken, string? ImpersonatingUserId)> Calls { get; } = new();

        public Task SaveAsync(string catalogID, string categoryID, OrderCloud.SDK.Category category, bool accessToken = false, string? impersonatingUserID = null)
        {
            Calls.Add((catalogID, categoryID, category, accessToken, impersonatingUserID));
            return Task.CompletedTask;
        }
    }
}

public class RaiDevWorldXpTests
{
    [Test]
    public void Category_xp_is_compact_json_string()
    {
        var category = new OC_Accelerator.Models.RaiDevWorld.RaiCategory(null, "Food", new List<string> { "Food" }, "https://example.test/food", 1, null, "cat-food");

        var ocCategory = RaiSeeder.BuildCategory(category);

        Assert.That(ocCategory.xp, Is.TypeOf<string>());
        var json = (string)ocCategory.xp;
        Assert.That(json, Does.Not.Contain("\n"));
        Assert.That(json.Length, Is.LessThanOrEqualTo(8000));
        dynamic parsed = Newtonsoft.Json.JsonConvert.DeserializeObject(json)!;
        Assert.That((bool)parsed.RAI.Managed, Is.True);
        Assert.That((string)parsed.RAI.SourceUrl, Is.EqualTo("https://example.test/food"));
    }

    [Test]
    public void Product_xp_is_compact_json_string_with_storefront_fields_only()
    {
        var snapshot = BuildSnapshot(BuildProduct());

        var ocProduct = RaiSeeder.BuildProduct(snapshot.Products.Single(), snapshot);

        Assert.That(ocProduct.xp, Is.TypeOf<string>());
        var json = (string)ocProduct.xp;
        Assert.That(json, Does.Not.Contain("\n"));
        Assert.That(json.Length, Is.LessThanOrEqualTo(8000));
        dynamic parsed = Newtonsoft.Json.JsonConvert.DeserializeObject(json)!;
        Assert.That((string)parsed.Images[0].ThumbnailUrl, Is.EqualTo("https://example.test/thumb.jpg"));
        Assert.That((bool)parsed.RAI.Managed, Is.True);
        Assert.That((string)parsed.RAI.Event, Is.EqualTo("DevWorld"));
        Assert.That((string)parsed.RAI.SourceSKU, Is.EqualTo("sku-1"));
        Assert.That((string)parsed.RAI.SourceUrl, Is.EqualTo("https://example.test/product"));
        Assert.That((string)parsed.RAI.SourceHash, Is.EqualTo("hash-1"));
        Assert.That(json, Does.Not.Contain("SourceSystem"));
        Assert.That(json, Does.Not.Contain("SourceProductID"));
        Assert.That(json, Does.Not.Contain("SourceCategoryPaths"));
        Assert.That(json, Does.Not.Contain("ScrapedAtUtc"));
        Assert.That(json, Does.Not.Contain("Pricing"));
        Assert.That(json, Does.Not.Contain("Ordering"));
        Assert.That(json, Does.Not.Contain("Attributes"));
        Assert.That(json, Does.Not.Contain("Descriptions"));
    }

    [Test]
    public void Product_xp_limits_images_to_first_three()
    {
        var images = Enumerable.Range(1, 5)
            .Select(i => new OC_Accelerator.Models.RaiDevWorld.RaiImage($"https://example.test/thumb-{i}.jpg", $"https://example.test/image-{i}.jpg"))
            .ToList();
        var product = BuildProduct() with { Images = images };
        var snapshot = BuildSnapshot(product);

        var ocProduct = RaiSeeder.BuildProduct(product, snapshot);

        var json = (string)ocProduct.xp;
        dynamic parsed = Newtonsoft.Json.JsonConvert.DeserializeObject(json)!;
        Assert.That(parsed.Images.Count, Is.EqualTo(3));
        Assert.That((string)parsed.Images[0].Url, Is.EqualTo("https://example.test/image-1.jpg"));
        Assert.That((string)parsed.Images[2].Url, Is.EqualTo("https://example.test/image-3.jpg"));
        Assert.That(json, Does.Not.Contain("image-4.jpg"));
    }

    [Test]
    public void Largest_scraped_product_xp_stays_under_ordercloud_limit()
    {
        if (!TryFindRepoFile("tools/rai-devworld/data/rai-devworld.snapshot.json", out var snapshotPath))
            Assert.Ignore("The scraped RAI DevWorld snapshot is not present in this checkout.");
        var snapshot = RaiSeeder.Load(snapshotPath);

        var maxProductXpLength = snapshot.Products
            .Select(product => ((string)RaiSeeder.BuildProduct(product, snapshot).xp).Length)
            .Max();

        Assert.That(maxProductXpLength, Is.LessThanOrEqualTo(8000));
    }

    [Test]
    public void Product_xp_stays_under_ordercloud_limit_with_large_non_xp_fields()
    {
        var product = BuildProduct() with
        {
            FullDescription = new string('d', 12000),
            Attributes = Enumerable.Range(0, 100).Select(i => new OC_Accelerator.Models.RaiDevWorld.RaiAttribute($"attr-{i}", new string('x', 100))).ToList(),
            Ordering = new OC_Accelerator.Models.RaiDevWorld.RaiOrdering(new string('o', 1000), new string('l', 1000), new string('a', 1000), new List<string> { new string('n', 1000) })
        };
        var snapshot = BuildSnapshot(product);

        var ocProduct = RaiSeeder.BuildProduct(product, snapshot);

        Assert.That(((string)ocProduct.xp).Length, Is.LessThanOrEqualTo(8000));
    }

    [Test]
    public void Build_xp_string_reports_resource_and_length_when_too_large()
    {
        var ex = Assert.Throws<InvalidOperationException>(() => RaiSeeder.BuildXpString(new { Value = new string('x', 8001) }, "Product", "prod-large"));

        Assert.That(ex!.Message, Does.Contain("Product"));
        Assert.That(ex.Message, Does.Contain("prod-large"));
        Assert.That(ex.Message, Does.Contain("characters"));
    }

    private static bool TryFindRepoFile(string relativePath, out string path)
    {
        var directory = new DirectoryInfo(TestContext.CurrentContext.TestDirectory);
        while (directory != null)
        {
            var candidate = Path.Combine(directory.FullName, relativePath);
            if (File.Exists(candidate))
            {
                path = candidate;
                return true;
            }
            directory = directory.Parent;
        }

        path = string.Empty;
        return false;
    }

    private static OC_Accelerator.Models.RaiDevWorld.RaiSnapshot BuildSnapshot(OC_Accelerator.Models.RaiDevWorld.RaiProduct product) => new(
        1,
        true,
        new OC_Accelerator.Models.RaiDevWorld.RaiSource("RAI", "DevWorld", "en", "EUR", "https://example.test", "2026-06-25T00:00:00Z", null),
        new List<OC_Accelerator.Models.RaiDevWorld.RaiCategory>(),
        new List<OC_Accelerator.Models.RaiDevWorld.RaiProduct> { product });

    private static OC_Accelerator.Models.RaiDevWorld.RaiProduct BuildProduct() => new(
        "source-1",
        "sku-1",
        "Safe Croissteek",
        "Card description",
        "Full description",
        "https://example.test/product",
        new List<OC_Accelerator.Models.RaiDevWorld.RaiImage> { new("https://example.test/thumb.jpg", "https://example.test/image.jpg") },
        new OC_Accelerator.Models.RaiDevWorld.RaiPricing(new OC_Accelerator.Models.RaiDevWorld.RaiMoney(10, "EUR", "€10"), null, 1, null, 1, new List<OC_Accelerator.Models.RaiDevWorld.RaiPriceBreak>(), null, null, null, "€10", new List<OC_Accelerator.Models.RaiDevWorld.RaiOption>()),
        new OC_Accelerator.Models.RaiDevWorld.RaiOrdering(null, null, null, new List<string>()),
        new List<OC_Accelerator.Models.RaiDevWorld.RaiAttribute> { new("Color", "Red") },
        new List<string> { "Food" },
        new List<List<string>> { new() { "Food" } },
        "hash-1",
        "prod-safe-croissteek",
        "ps-safe-croissteek");
}

public class RaiDevWorldDistinctPayloadTests
{
    [Test]
    public void Duplicate_product_records_collapse_product_and_price_schedule_writes_while_preserving_assignments()
    {
        var productA = BuildProduct(new List<List<string>> { new() { "Food" } });
        var productB = BuildProduct(new List<List<string>> { new() { "Printing" } });
        var snapshot = BuildSnapshot(productA, productB);

        var payloads = RaiSeeder.BuildAndValidateTypedPayloads(snapshot, "catalog-1");

        Assert.That(payloads.SnapshotProductRecords, Is.EqualTo(2));
        Assert.That(payloads.DuplicateProductRecordsCollapsed, Is.EqualTo(1));
        Assert.That(payloads.Products, Has.Count.EqualTo(1));
        Assert.That(payloads.Products.Single().ID, Is.EqualTo("prod-duplicate"));
        Assert.That(payloads.PriceSchedules, Has.Count.EqualTo(1));
        Assert.That(payloads.PriceSchedules.Single().ID, Is.EqualTo("ps-duplicate"));
        Assert.That(payloads.CatalogAssignments, Has.Count.EqualTo(1));
        Assert.That(payloads.CategoryAssignments.Select(a => a.CategoryID), Is.EquivalentTo(new[] { "cat-food", "cat-printing" }));
    }

    [Test]
    public void Duplicate_category_assignments_collapse_by_category_and_product()
    {
        var productA = BuildProduct(new List<List<string>> { new() { "Food" } });
        var productB = BuildProduct(new List<List<string>> { new() { "Food" } });
        var snapshot = BuildSnapshot(productA, productB);

        var payloads = RaiSeeder.BuildAndValidateTypedPayloads(snapshot, "catalog-1");

        Assert.That(payloads.CategoryAssignments, Has.Count.EqualTo(1));
        Assert.That(payloads.CategoryAssignments.Single().CategoryID, Is.EqualTo("cat-food"));
        Assert.That(payloads.CategoryAssignments.Single().ProductID, Is.EqualTo("prod-duplicate"));
    }

    [Test]
    public void Dry_run_catches_conflicting_duplicate_product_data()
    {
        var productA = BuildProduct(new List<List<string>> { new() { "Food" } });
        var productB = BuildProduct(new List<List<string>> { new() { "Printing" } }) with { Name = "Conflicting Name" };
        var snapshot = BuildSnapshot(productA, productB);

        var ex = Assert.Throws<InvalidOperationException>(() => RaiSeeder.BuildAndValidateTypedPayloads(snapshot, "catalog-1"));

        Assert.That(ex!.Message, Does.Contain("Duplicate RAI product records"));
        Assert.That(ex.Message, Does.Contain("prod-duplicate"));
        Assert.That(ex.Message, Does.Contain("Name"));
    }

    [Test]
    public void Dry_run_catches_conflicting_duplicate_price_schedule_values()
    {
        var productA = BuildProduct(new List<List<string>> { new() { "Food" } });
        var productB = BuildProduct(new List<List<string>> { new() { "Printing" } }) with
        {
            Pricing = productA.Pricing with { BasePrice = new OC_Accelerator.Models.RaiDevWorld.RaiMoney(12, "EUR", "€12") }
        };
        var snapshot = BuildSnapshot(productA, productB);

        var ex = Assert.Throws<InvalidOperationException>(() => RaiSeeder.BuildAndValidateTypedPayloads(snapshot, "catalog-1"));

        Assert.That(ex!.Message, Does.Contain("price schedule"));
        Assert.That(ex.Message, Does.Contain("price break"));
    }

    [Test]
    public void OrderCloud_error_wrapping_includes_status_message_and_resource_context()
    {
        var exception = CreateOrderCloudException(System.Net.HttpStatusCode.BadRequest, "OrderCloud rejected the payload");

        var message = RaiSeeder.BuildOrderCloudFailureMessage("product", "prod-duplicate", exception);

        Assert.That(message, Does.Contain("product"));
        Assert.That(message, Does.Contain("prod-duplicate"));
        Assert.That(message, Does.Contain("400"));
        Assert.That(message, Does.Contain("BadRequest"));
        Assert.That(message, Does.Contain("OrderCloud rejected the payload"));
    }

    private static OrderCloud.SDK.OrderCloudException CreateOrderCloudException(System.Net.HttpStatusCode status, string message)
    {
        var type = typeof(OrderCloud.SDK.OrderCloudException);
        foreach (var ctor in type.GetConstructors())
        {
            var parameters = ctor.GetParameters();
            try
            {
                var args = parameters.Select(p =>
                    p.ParameterType == typeof(string) ? message :
                    p.ParameterType == typeof(System.Net.HttpStatusCode) ? status :
                    p.ParameterType == typeof(int) ? (int)status :
                    p.HasDefaultValue ? p.DefaultValue :
                    p.ParameterType.IsValueType ? Activator.CreateInstance(p.ParameterType) : null).ToArray();
                if (ctor.Invoke(args) is OrderCloud.SDK.OrderCloudException ex)
                    return WithStatusAndMessage(ex, status, message);
            }
            catch
            {
                // Try the next SDK constructor shape.
            }
        }

#pragma warning disable SYSLIB0050
        return WithStatusAndMessage((OrderCloud.SDK.OrderCloudException)System.Runtime.Serialization.FormatterServices.GetUninitializedObject(type), status, message);
#pragma warning restore SYSLIB0050
    }

    private static OrderCloud.SDK.OrderCloudException WithStatusAndMessage(OrderCloud.SDK.OrderCloudException ex, System.Net.HttpStatusCode status, string message)
    {
        SetPropertyOrField(ex, "HttpStatus", status);
        SetPropertyOrField(ex, "Message", message);
        return ex;
    }

    private static void SetPropertyOrField(object target, string name, object value)
    {
        var type = target.GetType();
        var property = type.GetProperty(name, System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.NonPublic);
        if (property?.CanWrite == true)
        {
            property.SetValue(target, value);
            return;
        }

        var field = type.GetField($"<{name}>k__BackingField", System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.NonPublic)
            ?? type.BaseType?.GetField($"_{char.ToLowerInvariant(name[0])}{name[1..]}", System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.NonPublic)
            ?? type.BaseType?.GetField(name, System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.NonPublic)
            ?? type.GetField($"_{char.ToLowerInvariant(name[0])}{name[1..]}", System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.NonPublic);
        field?.SetValue(target, value);
    }

    private static OC_Accelerator.Models.RaiDevWorld.RaiSnapshot BuildSnapshot(params OC_Accelerator.Models.RaiDevWorld.RaiProduct[] products) => new(
        1,
        true,
        new OC_Accelerator.Models.RaiDevWorld.RaiSource("RAI", "DevWorld", "en", "EUR", "https://example.test", "2026-06-25T00:00:00Z", null),
        new List<OC_Accelerator.Models.RaiDevWorld.RaiCategory>
        {
            new(null, "Food", new List<string> { "Food" }, "https://example.test/food", 1, null, "cat-food"),
            new(null, "Printing", new List<string> { "Printing" }, "https://example.test/printing", 2, null, "cat-printing")
        },
        products.ToList());

    private static OC_Accelerator.Models.RaiDevWorld.RaiProduct BuildProduct(List<List<string>> categoryPaths) => new(
        "source-1",
        "sku-1",
        "Duplicate Product",
        "Card description",
        "Full description",
        "https://example.test/product",
        new List<OC_Accelerator.Models.RaiDevWorld.RaiImage> { new("https://example.test/thumb.jpg", "https://example.test/image.jpg") },
        new OC_Accelerator.Models.RaiDevWorld.RaiPricing(new OC_Accelerator.Models.RaiDevWorld.RaiMoney(10, "EUR", "€10"), null, 1, null, 1, new List<OC_Accelerator.Models.RaiDevWorld.RaiPriceBreak>(), null, null, null, "€10", new List<OC_Accelerator.Models.RaiDevWorld.RaiOption>()),
        new OC_Accelerator.Models.RaiDevWorld.RaiOrdering(null, null, null, new List<string>()),
        new List<OC_Accelerator.Models.RaiDevWorld.RaiAttribute>(),
        categoryPaths.First(),
        categoryPaths,
        "hash-1",
        "prod-duplicate",
        "ps-duplicate");
}
