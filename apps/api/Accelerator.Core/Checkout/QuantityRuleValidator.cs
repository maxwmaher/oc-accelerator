using System;
using System.Collections.Generic;
using System.Linq;

namespace Accelerator.Checkout;

public sealed record QuantityRule(string ProductID, decimal? MinQuantity, decimal? MaxQuantity,
    decimal? RestrictedQuantity, bool UseCumulativeQuantity);

public sealed record QuantityLine(string ProductID, decimal Quantity);

public sealed record QuantityValidationResult(bool IsValid, IReadOnlyList<string> Errors)
{
    public static QuantityValidationResult Success { get; } = new(true, Array.Empty<string>());
}

/// <summary>Pure, reusable validation for effective shopper PriceSchedule rules.</summary>
public static class QuantityRuleValidator
{
    public static QuantityValidationResult Validate(
        IEnumerable<QuantityLine> lines,
        IReadOnlyDictionary<string, QuantityRule> rules)
    {
        var materialized = lines.ToList();
        var errors = new List<string>();

        foreach (var line in materialized)
        {
            if (line.Quantity <= 0 || decimal.Truncate(line.Quantity) != line.Quantity)
                errors.Add($"{line.ProductID}: quantity must be a positive whole number.");
            if (!rules.ContainsKey(line.ProductID))
                errors.Add($"{line.ProductID}: no effective shopper PriceSchedule is available.");
        }

        foreach (var group in materialized.GroupBy(x => x.ProductID))
        {
            if (!rules.TryGetValue(group.Key, out var rule)) continue;
            var quantities = rule.UseCumulativeQuantity
                ? new[] { group.Sum(x => x.Quantity) }
                : group.Select(x => x.Quantity);

            foreach (var quantity in quantities)
            {
                if (rule.MinQuantity is > 0 && quantity < rule.MinQuantity)
                    errors.Add($"{group.Key}: quantity {quantity} is below the minimum {rule.MinQuantity}.");
                if (rule.MaxQuantity is > 0 && quantity > rule.MaxQuantity)
                    errors.Add($"{group.Key}: quantity {quantity} exceeds the maximum {rule.MaxQuantity}.");
                if (rule.RestrictedQuantity is > 0 && quantity % rule.RestrictedQuantity.Value != 0)
                    errors.Add($"{group.Key}: quantity {quantity} must be in increments of {rule.RestrictedQuantity}.");
            }
        }

        return errors.Count == 0 ? QuantityValidationResult.Success : new(false, errors.Distinct().ToList());
    }
}
