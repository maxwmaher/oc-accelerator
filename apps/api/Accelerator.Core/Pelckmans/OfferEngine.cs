namespace Accelerator.Pelckmans;

public static class OfferEngine {
    public static OfferPreview Preview(PelckmansOffer offer, IEnumerable<OfferComponent>? basket = null) {
        var items = (basket ?? offer.Components).ToList();
        if (items.Any(x => x.Quantity is < 1 or > 99) || items.Any(x => x.UnitPrice < 0)) throw new ArgumentException("Quantities and resolved prices are invalid.");
        var discounts = items.Select((x,i)=>(x,i)).ToDictionary(x => x.i, _ => 0m);
        var qualifies = new HashSet<string>();
        if (offer.Type == OfferType.Bundle) for(var i=0;i<items.Count;i++) { var x=items[i]; qualifies.Add(x.ProductId); if (x.IncludedFree) discounts[i] = x.UnitPrice * x.Quantity; }
        else {
            var rule = offer.Rule ?? throw new ArgumentException("A typed eligibility rule is required.");
            var eligible = items.Where(x => (rule.ProductIds ?? []).Contains(x.ProductId)).ToList();
            if (eligible.Sum(x => x.Quantity) >= rule.MinimumQuantity) {
                foreach (var x in eligible) qualifies.Add(x.ProductId);
                if (offer.Type == OfferType.BuyThreePayTwo) {
                    var cheapest = eligible.OrderBy(x => x.UnitPrice).First();
                    discounts[items.IndexOf(cheapest)] = cheapest.UnitPrice; // exactly one unit, even when line quantity > 1
                } else foreach (var x in eligible) discounts[items.IndexOf(x)] = decimal.Round(x.UnitPrice * x.Quantity * rule.DiscountPercent / 100m, 2);
            }
        }
        var lines = items.Select((x,i) => new PreviewLine(x.ProductId, x.Title ?? x.ProductId, x.Quantity, x.UnitPrice, discounts[i], qualifies.Contains(x.ProductId))).ToList();
        var subtotal = lines.Sum(x => x.UnitPrice * x.Quantity); var discount = lines.Sum(x => x.Discount);
        return new(lines, subtotal, discount, subtotal - discount);
    }

    public static (string EligibleExpression, string ValueExpression) CompilePromotion(PelckmansOffer offer) {
        var r = offer.Rule ?? throw new ArgumentException("Rule required");
        if (r.MinimumQuantity is < 1 or > 99 || r.DiscountPercent is < 0 or > 100) throw new ArgumentException("Rule values are outside supported bounds.");
        _ = r.SelectorType switch { "category" or "author" or "genre" or "books" => true, _ => throw new ArgumentException("Unsupported selector") };
        var ids=(r.ProductIds??[]).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        if(ids.Count==0) throw new ArgumentException("The reviewed eligibility snapshot is empty.");
        var selector=$"({string.Join(" | ",ids.Select(x=>$"product.id = '{Escape(x)}'"))})";
        var eligible = $"{selector} & product.xp.EntityType = 'Book' & product.xp.PelckmansStudio.ParentOfferID = null";
        // Line-item promotions must qualify the current item as well as the basket.
        // OrderCloud's collection aggregate is items.quantity(predicate), not where().quantity().
        var condition = $"{eligible} & items.quantity({eligible}) >= {r.MinimumQuantity}";
        var result=offer.Type switch {
            OfferType.BuyThreePayTwo => (condition, "item.unitprice"),
            OfferType.SegmentDiscount => (condition, $"item.lineSubtotal * {(r.DiscountPercent / 100m).ToString("0.####",System.Globalization.CultureInfo.InvariantCulture)}"),
            _ => throw new ArgumentException("Not a promotion")
        };
        if(result.Item1.Length>4000||result.Item2.Length>4000) throw new ArgumentException("The eligible product snapshot exceeds OrderCloud's expression length limit. Select fewer products.");
        return result;
    }
    static string Escape(string value) => value.Length is > 100 ? throw new ArgumentException("Identifier too long") : value.Replace("'", "''");

    public static void ValidateComplete(PelckmansOffer offer) {
        if (string.IsNullOrWhiteSpace(offer.Name)) throw new ArgumentException("An offer name is required.");
        if (offer.Type == OfferType.Bundle) {
            if (offer.Components.Count < 2) throw new ArgumentException("A bundle requires at least two components.");
            if (offer.Components.Any(x=>x.Quantity is < 1 or > 99 || x.UnitPrice < 0 || string.IsNullOrWhiteSpace(x.ProductId))) throw new ArgumentException("Bundle components contain invalid quantities or unresolved prices.");
            if (offer.Components.Any(x=>!x.IncludedFree && x.UnitPrice<=0)) throw new ArgumentException("Every paid component requires a resolved positive shopper price.");
        } else {
            var r=offer.Rule ?? throw new ArgumentException("An eligibility rule is required.");
            if (r.ProductIds is null || r.ProductIds.Count==0 || string.IsNullOrWhiteSpace(r.SelectorId)) throw new ArgumentException("Select at least one eligible book and an author, genre, or book set.");
            if (r.MinimumQuantity is < 2 or > 99 || (offer.Type==OfferType.SegmentDiscount && r.DiscountPercent is <=0 or >100)) throw new ArgumentException("Promotion conditions are outside the supported limits.");
        }
    }
}
