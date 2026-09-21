#nullable enable

using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json.Nodes;

namespace Accelerator.Checkout;

public sealed record QuantityRule(string ProductID, decimal? MinQuantity, decimal? MaxQuantity,
    bool RestrictedQuantity, bool UseCumulativeQuantity, IReadOnlyCollection<decimal> AllowedQuantities,
    string? Error = null)
{
    public static QuantityRule FromPriceSchedule(string productID, JsonObject schedule)
    {
        if (!TryDecimal(schedule, "MinQuantity", out var minimum, out var error) ||
            !TryDecimal(schedule, "MaxQuantity", out var maximum, out error) ||
            !TryBoolean(schedule, "RestrictedQuantity", required: true, out var restricted, out error) ||
            !TryBoolean(schedule, "UseCumulativeQuantity", required: false, out var cumulative, out error))
            return Invalid(productID, error!);

        if (minimum is < 0 || maximum is < 0 || (minimum.HasValue && maximum.HasValue && minimum > maximum))
            return Invalid(productID, "PriceSchedule has inconsistent minimum and maximum quantities.");

        var allowed = new List<decimal>();
        if (restricted)
        {
            if (schedule["PriceBreaks"] is not JsonArray breaks || breaks.Count == 0)
                return Invalid(productID, "Restricted PriceSchedule must contain PriceBreaks with quantities.");

            foreach (var node in breaks)
            {
                if (node is not JsonObject priceBreak ||
                    !TryDecimal(priceBreak, "Quantity", out var quantity, out _) ||
                    quantity is null or <= 0 || decimal.Truncate(quantity.Value) != quantity.Value)
                    return Invalid(productID, "Restricted PriceSchedule contains a missing or malformed PriceBreak quantity.");
                allowed.Add(quantity.Value);
            }
        }

        return new(productID, minimum, maximum, restricted, cumulative, allowed.Distinct().ToArray());
    }

    private static QuantityRule Invalid(string productID, string error) =>
        new(productID, null, null, false, false, Array.Empty<decimal>(), error);

    private static bool TryDecimal(JsonObject source, string name, out decimal? value, out string? error)
    {
        value = null;
        error = null;
        var node = source[name];
        if (node is null) return true;
        if (node is JsonValue jsonValue && jsonValue.TryGetValue<decimal>(out var parsed))
        {
            value = parsed;
            return true;
        }
        error = $"PriceSchedule {name} must be a number.";
        return false;
    }

    private static bool TryBoolean(JsonObject source, string name, bool required, out bool value, out string? error)
    {
        value = false;
        error = null;
        var node = source[name];
        if (node is JsonValue jsonValue && jsonValue.TryGetValue<bool>(out value)) return true;
        if (node is null && !required) return true;
        error = $"PriceSchedule {name} must be a boolean.";
        return false;
    }
}

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
            if (rule.Error is not null)
            {
                errors.Add($"{group.Key}: {rule.Error}");
                continue;
            }
            var quantities = rule.UseCumulativeQuantity
                ? new[] { group.Sum(x => x.Quantity) }
                : group.Select(x => x.Quantity);

            foreach (var quantity in quantities)
            {
                if (rule.RestrictedQuantity)
                {
                    if (!rule.AllowedQuantities.Contains(quantity))
                        errors.Add($"{group.Key}: quantity {quantity} must exactly match a PriceBreak quantity ({string.Join(", ", rule.AllowedQuantities)}).");
                }
                else
                {
                    if (rule.MinQuantity is > 0 && quantity < rule.MinQuantity)
                        errors.Add($"{group.Key}: quantity {quantity} is below the minimum {rule.MinQuantity}.");
                    if (rule.MaxQuantity is > 0 && quantity > rule.MaxQuantity)
                        errors.Add($"{group.Key}: quantity {quantity} exceeds the maximum {rule.MaxQuantity}.");
                }
            }
        }

        return errors.Count == 0 ? QuantityValidationResult.Success : new(false, errors.Distinct().ToList());
    }
}
