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
        Assert.That((string)parsed.RAI.SourceSystem, Is.EqualTo("RAI"));
        Assert.That((string)parsed.RAI.Event, Is.EqualTo("DevWorld"));
        Assert.That((string)parsed.RAI.SourceProductID, Is.EqualTo("source-1"));
        Assert.That((string)parsed.RAI.SourceSKU, Is.EqualTo("sku-1"));
        Assert.That((string)parsed.RAI.SourceUrl, Is.EqualTo("https://example.test/product"));
        Assert.That((string)parsed.RAI.ScrapedAtUtc, Is.EqualTo("2026-06-25T00:00:00Z"));
        Assert.That((string)parsed.RAI.SourceHash, Is.EqualTo("hash-1"));
        Assert.That(json, Does.Not.Contain("Pricing"));
        Assert.That(json, Does.Not.Contain("Ordering"));
        Assert.That(json, Does.Not.Contain("Attributes"));
        Assert.That(json, Does.Not.Contain("Descriptions"));
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
