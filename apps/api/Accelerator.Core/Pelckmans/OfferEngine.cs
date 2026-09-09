namespace Accelerator.Pelckmans;

public static class OfferEngine {
    public static OfferPreview Preview(PelckmansOffer offer, IEnumerable<OfferComponent>? basket = null) {
        var items = (basket ?? offer.Components).ToList();
        if (items.Any(x => x.Quantity is < 1 or > 99) || items.Any(x => x.UnitPrice < 0)) throw new ArgumentException("Quantities and resolved prices are invalid.");
        var discounts = items.ToDictionary(x => x.ProductId, _ => 0m);
        var qualifies = new HashSet<string>();
        if (offer.Type == OfferType.Bundle) foreach (var x in items) { qualifies.Add(x.ProductId); if (x.IncludedFree) discounts[x.ProductId] = x.UnitPrice * x.Quantity; }
        else {
            var rule = offer.Rule ?? throw new ArgumentException("A typed eligibility rule is required.");
            var eligible = items.Where(x => (rule.ProductIds ?? []).Contains(x.ProductId)).ToList();
            if (eligible.Sum(x => x.Quantity) >= rule.MinimumQuantity) {
                foreach (var x in eligible) qualifies.Add(x.ProductId);
                if (offer.Type == OfferType.BuyThreePayTwo) {
                    var cheapest = eligible.OrderBy(x => x.UnitPrice).First();
                    discounts[cheapest.ProductId] = cheapest.UnitPrice; // exactly one unit, even when line quantity > 1
                } else foreach (var x in eligible) discounts[x.ProductId] = decimal.Round(x.UnitPrice * x.Quantity * rule.DiscountPercent / 100m, 2);
            }
        }
        var lines = items.Select(x => new PreviewLine(x.ProductId, x.Title ?? x.ProductId, x.Quantity, x.UnitPrice, discounts[x.ProductId], qualifies.Contains(x.ProductId))).ToList();
        var subtotal = lines.Sum(x => x.UnitPrice * x.Quantity); var discount = lines.Sum(x => x.Discount);
        return new(lines, subtotal, discount, subtotal - discount);
    }

    public static (string EligibleExpression, string ValueExpression) CompilePromotion(PelckmansOffer offer) {
        var r = offer.Rule ?? throw new ArgumentException("Rule required");
        if (r.MinimumQuantity is < 1 or > 99 || r.DiscountPercent is < 0 or > 100) throw new ArgumentException("Rule values are outside supported bounds.");
        var id = Escape(r.SelectorId);
        var selector = r.SelectorType switch { "category" => $"product.incategory('{id}')", "author" => $"product.xp.Relationships.AuthorIDs.contains('{id}')", "genre" => $"product.xp.Relationships.GenreIDs.contains('{id}')", _ => throw new ArgumentException("Unsupported selector") };
        var eligible = $"{selector} & product.xp.EntityType = 'Book' & product.xp.PelckmansStudio.ParentOfferID = null";
        var condition = $"items.any({eligible}) & items.where({eligible}).quantity() >= {r.MinimumQuantity}";
        return offer.Type switch {
            OfferType.BuyThreePayTwo => (condition, "item.unitprice"),
            OfferType.SegmentDiscount => (condition, $"item.lineSubtotal * {r.DiscountPercent / 100m:0.####}"),
            _ => throw new ArgumentException("Not a promotion")
        };
    }
    static string Escape(string value) => value.Length is > 100 ? throw new ArgumentException("Identifier too long") : value.Replace("'", "''");
}
