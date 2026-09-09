using System.Globalization;

namespace Accelerator.Pelckmans;

public static class OfferEngine
{
    public static OfferPreview Preview(
        PelckmansOffer offer,
        IEnumerable<OfferComponent>? basket = null)
    {
        var items =
            (basket ?? offer.Components).ToList();

        if (
            items.Any(x => x.Quantity is < 1 or > 99) ||
            items.Any(x => x.UnitPrice < 0)
        )
        {
            throw new ArgumentException(
                "Quantities and resolved prices are invalid."
            );
        }

        var discounts =
            items
                .Select((x, i) => (x, i))
                .ToDictionary(
                    x => x.i,
                    _ => 0m
                );

        var qualifies =
            new HashSet<string>(
                StringComparer.OrdinalIgnoreCase
            );

        if (offer.Type == OfferType.Bundle)
        {
            for (var i = 0; i < items.Count; i++)
            {
                var item = items[i];

                qualifies.Add(
                    item.ProductId
                );

                if (item.IncludedFree)
                {
                    discounts[i] =
                        item.UnitPrice *
                        item.Quantity;
                }
            }
        }
        else
        {
            var rule =
                offer.Rule ??
                throw new ArgumentException(
                    "A typed eligibility rule is required."
                );

            var approvedIds =
                new HashSet<string>(
                    rule.ProductIds ?? [],
                    StringComparer.OrdinalIgnoreCase
                );

            var eligible =
                items
                    .Where(
                        x =>
                            approvedIds.Contains(
                                x.ProductId
                            )
                    )
                    .ToList();

            if (
                eligible.Sum(
                    x => x.Quantity
                ) >= rule.MinimumQuantity
            )
            {
                foreach (var item in eligible)
                {
                    qualifies.Add(
                        item.ProductId
                    );
                }

                if (
                    offer.Type ==
                    OfferType.BuyThreePayTwo
                )
                {
                    var cheapest =
                        eligible
                            .OrderBy(
                                x => x.UnitPrice
                            )
                            .First();

                    var index =
                        items.IndexOf(
                            cheapest
                        );

                    // Exactly one unit is free,
                    // even if the eligible line has
                    // a quantity greater than one.
                    discounts[index] =
                        cheapest.UnitPrice;
                }
                else
                {
                    foreach (
                        var item in eligible
                    )
                    {
                        var index =
                            items.IndexOf(
                                item
                            );

                        discounts[index] =
                            decimal.Round(
                                item.UnitPrice *
                                item.Quantity *
                                rule.DiscountPercent /
                                100m,
                                2
                            );
                    }
                }
            }
        }

        var lines =
            items
                .Select(
                    (x, i) =>
                        new PreviewLine(
                            x.ProductId,
                            x.Title ??
                                x.ProductId,
                            x.Quantity,
                            x.UnitPrice,
                            discounts[i],
                            qualifies.Contains(
                                x.ProductId
                            )
                        )
                )
                .ToList();

        var subtotal =
            lines.Sum(
                x =>
                    x.UnitPrice *
                    x.Quantity
            );

        var discount =
            lines.Sum(
                x => x.Discount
            );

        return new OfferPreview(
            lines,
            subtotal,
            discount,
            subtotal - discount
        );
    }

    public static (
        string EligibleExpression,
        string ValueExpression
    ) CompilePromotion(
        PelckmansOffer offer)
    {
        var rule =
            offer.Rule ??
            throw new ArgumentException(
                "Rule required."
            );

        if (
            rule.MinimumQuantity is < 1 or > 99 ||
            rule.DiscountPercent is < 0 or > 100
        )
        {
            throw new ArgumentException(
                "Rule values are outside supported bounds."
            );
        }

        _ = rule.SelectorType switch
        {
            "category" or
            "author" or
            "genre" or
            "books" => true,

            _ => throw new ArgumentException(
                "Unsupported selector."
            )
        };

        var ids =
            (rule.ProductIds ?? [])
                .Distinct(
                    StringComparer.OrdinalIgnoreCase
                )
                .ToList();

        if (ids.Count == 0)
        {
            throw new ArgumentException(
                "The reviewed eligibility snapshot is empty."
            );
        }

        var idList =
            string.Join(
                ", ",
                ids.Select(
                    id => $"'{Escape(id)}'"
                )
            );

        var quantityFilter =
            string.Join(
                " or ",
                ids.Select(
                    id =>
                        $"ProductID = '{Escape(id)}'"
                )
            );

        /*
         * OrderCloud line-item promotion logic:
         *
         * item.ProductID.in(...)
         *   Selects the current line item that may receive
         *   the promotion.
         *
         * items.quantity(ProductID = '...' or ProductID = '...')
         *   Counts the total quantity of qualifying products
         *   across the order using the collection predicate.
         *
         * Expressions are intentionally compact because
         * OrderCloud limits them to 400 characters.
         */
        var eligibleExpression =
            $"item.ProductID.in({idList}) and " +
            $"items.quantity({quantityFilter}) >= " +
            $"{rule.MinimumQuantity}";

        string valueExpression;

        switch (offer.Type)
        {
            case OfferType.BuyThreePayTwo:
                /*
                 * PelckmansCommerce publishes this with:
                 *
                 * QuantityLimitPerOrder = 1
                 * ItemSortBy = "UnitPrice"
                 *
                 * Therefore exactly one quantity of the
                 * cheapest eligible line receives a discount
                 * equal to its UnitPrice.
                 */
                valueExpression =
                    "item.UnitPrice";
                break;

            case OfferType.SegmentDiscount:
                var rate =
                    (
                        rule.DiscountPercent /
                        100m
                    )
                    .ToString(
                        "0.####",
                        CultureInfo.InvariantCulture
                    );

                valueExpression =
                    $"item.LineSubtotal * {rate}";
                break;

            default:
                throw new ArgumentException(
                    "Not a promotion."
                );
        }

        if (
            eligibleExpression.Length > 400 ||
            valueExpression.Length > 400
        )
        {
            throw new ArgumentException(
                "The eligible product snapshot exceeds " +
                "OrderCloud's 400-character promotion-expression " +
                "limit. Select fewer products."
            );
        }

        return (
            eligibleExpression,
            valueExpression
        );
    }

    static string Escape(
        string value)
    {
        if (value.Length > 100)
        {
            throw new ArgumentException(
                "Identifier too long."
            );
        }

        return value.Replace(
            "'",
            "''"
        );
    }

    public static void ValidateComplete(
        PelckmansOffer offer)
    {
        if (
            string.IsNullOrWhiteSpace(
                offer.Name
            )
        )
        {
            throw new ArgumentException(
                "An offer name is required."
            );
        }

        if (
            offer.Type ==
            OfferType.Bundle
        )
        {
            if (
                offer.Components.Count < 2
            )
            {
                throw new ArgumentException(
                    "A bundle requires at least two components."
                );
            }

            if (
                offer.Components.Any(
                    x =>
                        x.Quantity is < 1 or > 99 ||
                        x.UnitPrice < 0 ||
                        string.IsNullOrWhiteSpace(
                            x.ProductId
                        )
                )
            )
            {
                throw new ArgumentException(
                    "Bundle components contain invalid " +
                    "quantities or unresolved prices."
                );
            }

            if (
                offer.Components.Any(
                    x =>
                        !x.IncludedFree &&
                        x.UnitPrice <= 0
                )
            )
            {
                throw new ArgumentException(
                    "Every paid component requires a " +
                    "resolved positive shopper price."
                );
            }
        }
        else
        {
            var rule =
                offer.Rule ??
                throw new ArgumentException(
                    "An eligibility rule is required."
                );

            if (
                rule.ProductIds is null ||
                rule.ProductIds.Count == 0 ||
                string.IsNullOrWhiteSpace(
                    rule.SelectorId
                )
            )
            {
                throw new ArgumentException(
                    "Select at least one eligible book and " +
                    "an author, genre, or book set."
                );
            }

            if (
                rule.MinimumQuantity is < 2 or > 99 ||
                (
                    offer.Type ==
                        OfferType.SegmentDiscount &&
                    rule.DiscountPercent is <= 0 or > 100
                )
            )
            {
                throw new ArgumentException(
                    "Promotion conditions are outside " +
                    "the supported limits."
                );
            }
        }
    }
}
