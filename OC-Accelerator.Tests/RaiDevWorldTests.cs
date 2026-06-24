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
