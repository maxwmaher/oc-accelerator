using System.Text.Json.Nodes;
using Accelerator.Checkout;

namespace OC_Accelerator.Tests;

public class QuantityRuleValidatorTests
{
    [Test]
    public void RealShapedUnrestrictedScheduleDeserializesAndAllowsBoundaries()
    {
        var rule = Parse("""{"MinQuantity":2,"MaxQuantity":5,"RestrictedQuantity":false,"UseCumulativeQuantity":false,"PriceBreaks":[{"Quantity":2,"Price":10.0}]}""");

        Assert.Multiple(() =>
        {
            Assert.That(rule.RestrictedQuantity, Is.False);
            Assert.That(Validate(rule, 2).IsValid, Is.True);
            Assert.That(Validate(rule, 5).IsValid, Is.True);
            Assert.That(Validate(rule, 1).IsValid, Is.False);
            Assert.That(Validate(rule, 6).IsValid, Is.False);
        });
    }

    [TestCase(1)]
    [TestCase(5)]
    [TestCase(12)]
    public void RestrictedScheduleAllowsExactPriceBreakQuantities(decimal quantity)
    {
        var rule = Parse("""{"RestrictedQuantity":true,"UseCumulativeQuantity":false,"PriceBreaks":[{"Quantity":1},{"Quantity":5},{"Quantity":12}]}""");
        Assert.That(Validate(rule, quantity).IsValid, Is.True);
    }

    [Test]
    public void RestrictedScheduleRejectsNonmatchingQuantity()
    {
        var rule = Parse("""{"RestrictedQuantity":true,"PriceBreaks":[{"Quantity":2},{"Quantity":4}]}""");
        var result = Validate(rule, 3);
        Assert.That(result.IsValid, Is.False);
        Assert.That(result.Errors.Single(), Does.Contain("exactly match"));
    }

    [Test]
    public void CumulativeScheduleUsesAggregateAcrossDuplicateProductLines()
    {
        var rule = Parse("""{"RestrictedQuantity":true,"UseCumulativeQuantity":true,"PriceBreaks":[{"Quantity":5}]}""");
        var rules = new Dictionary<string, QuantityRule> { [rule.ProductID] = rule };
        var result = QuantityRuleValidator.Validate(
            new[] { new QuantityLine("P1", 2), new QuantityLine("P1", 3) }, rules);
        Assert.That(result.IsValid, Is.True);
    }

    [TestCase("{\"PriceBreaks\":[]}", "RestrictedQuantity")]
    [TestCase("{\"RestrictedQuantity\":\"yes\",\"PriceBreaks\":[]}", "boolean")]
    [TestCase("{\"RestrictedQuantity\":true,\"PriceBreaks\":[]}", "must contain")]
    [TestCase("{\"RestrictedQuantity\":true,\"PriceBreaks\":[{\"Quantity\":\"many\"}]}", "malformed")]
    [TestCase("{\"MinQuantity\":10,\"MaxQuantity\":2,\"RestrictedQuantity\":false}", "inconsistent")]
    public void MissingOrMalformedRulesAreRejectedWithUsefulMessage(string json, string expected)
    {
        var result = Validate(Parse(json), 2);
        Assert.That(result.IsValid, Is.False);
        Assert.That(result.Errors.Single(), Does.Contain(expected).IgnoreCase);
    }

    private static QuantityRule Parse(string json) =>
        QuantityRule.FromPriceSchedule("P1", JsonNode.Parse(json)!.AsObject());

    private static QuantityValidationResult Validate(QuantityRule rule, decimal quantity) =>
        QuantityRuleValidator.Validate(new[] { new QuantityLine("P1", quantity) },
            new Dictionary<string, QuantityRule> { [rule.ProductID] = rule });
}
