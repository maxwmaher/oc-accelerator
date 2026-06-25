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
