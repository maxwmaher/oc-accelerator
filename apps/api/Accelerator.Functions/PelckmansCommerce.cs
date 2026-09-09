using System.Globalization;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Accelerator.Pelckmans;
using Microsoft.Extensions.Configuration;

namespace Accelerator.Functions;

/// <summary>
/// A deliberately small, typed REST adapter for OrderCloud operations
/// not exposed consistently by the pinned SDK.
/// </summary>
public sealed class PelckmansCommerce(
    IHttpClientFactory clients,
    IConfiguration config)
{
    static readonly JsonSerializerOptions Json =
        new(JsonSerializerDefaults.Web);

    readonly string api =
        (config["OrderCloudSettings:ApiUrl"] ?? "").TrimEnd('/');

    public async Task<CatalogPage> Discover(
        string? search,
        int page,
        int pageSize,
        CancellationToken ct)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 50);

        var token = await ShopperToken(ct);

        var query =
            $"page={page}" +
            $"&pageSize={pageSize}" +
            $"&search={Uri.EscapeDataString(search ?? "")}" +
            $"&searchOn=ID,Name,Description";

        using var doc = await Send(
            HttpMethod.Get,
            $"/v1/me/products?{query}",
            token,
            null,
            ct
        );

        var root = doc.RootElement;
        var list = new List<CatalogItem>();

        foreach (var p in Array(root, "Items"))
        {
            var xp = Property(p, "xp");
            var entity =
                String(xp, "EntityType") ?? "Product";

            var studio =
                Property(xp, "PelckmansStudio");

            // Do not allow studio-created bundles or allocations
            // to feed back into new offer creation.
            if (
                Bool(p, "IsBundle") ||
                entity.Contains(
                    "Bundle",
                    StringComparison.OrdinalIgnoreCase
                ) ||
                studio.ValueKind == JsonValueKind.Object
            )
            {
                continue;
            }

            var price = Decimal(p, "Price");

            if (price is null)
            {
                price = Decimal(
                    Property(p, "PriceSchedule"),
                    "PriceBreaks",
                    0,
                    "Price"
                );
            }

            var source = Property(xp, "Source");
            var enrichment = Property(xp, "Enrichment");

            list.Add(
                new CatalogItem(
                    String(p, "ID") ?? "",
                    String(p, "Name")
                        ?? String(enrichment, "Title")
                        ?? String(source, "Title")
                        ?? String(p, "ID")
                        ?? "",
                    entity,
                    price,
                    String(enrichment, "CoverImageUrl")
                        ?? String(source, "CoverImageUrl")
                        ?? String(p, "DefaultSupplierID"),
                    Strings(
                        Property(
                            Property(xp, "Relationships"),
                            "AuthorIDs"
                        )
                    ),
                    Strings(
                        Property(
                            Property(xp, "Relationships"),
                            "GenreIDs"
                        )
                    ),
                    String(
                        Property(xp, "Commerce"),
                        "Status"
                    )
                )
            );
        }

        var authors =
            Facets(list.SelectMany(x => x.AuthorIds));

        var genres =
            Facets(list.SelectMany(x => x.GenreIds));

        var meta = Property(root, "Meta");

        return new CatalogPage(
            list,
            authors,
            genres,
            Int(meta, "Page") ?? page,
            Int(meta, "PageSize") ?? pageSize,
            Int(meta, "TotalCount") ?? list.Count,
            Int(meta, "TotalPages") ?? 1
        );
    }

    public async Task<IReadOnlyDictionary<string, string>> Publish(
        PelckmansOffer offer,
        CancellationToken ct)
    {
        OfferEngine.ValidateComplete(offer);

        var token = await ServiceToken(ct);

        var refs =
            new Dictionary<string, string>();

        if (offer.Type == OfferType.Bundle)
        {
            var bundle =
                Id(offer.Id, "BUNDLE");

            var buyer =
                Required("Pelckmans:BuyerID");

            var catalog =
                Required("Pelckmans:CatalogID");

            // A native bundle must be created through the Bundles resource.
            // OrderCloud automatically creates its IsBundle product representation.
            await Put(
                $"/v1/bundles/{bundle}",
                token,
                new
                {
                    ID = bundle,
                    Name = offer.Name,
                    Active = false,
                    xp = new
                    {
                        PelckmansStudio = new
                        {
                            ParentOfferID = offer.Id,
                            Revision = offer.Revision,
                            ResourceType = "Bundle"
                        }
                    }
                },
                ct
            );

            refs["bundle"] = bundle;

            foreach (var c in offer.Components)
            {
                var allocation =
                    Id(
                        offer.Id,
                        "COMP",
                        c.ProductId
                    );

                var schedule =
                    Id(
                        offer.Id,
                        "PS",
                        c.ProductId
                    );

                var bundlePrice =
                    c.IncludedFree
                        ? 0m
                        : c.UnitPrice;

                // Dedicated schedule keeps bundle-specific pricing
                // isolated from the original Pelckmans source product.
                await Put(
                    $"/v1/priceschedules/{schedule}",
                    token,
                    new
                    {
                        ID = schedule,
                        Name =
                            $"{offer.Name}: {c.Title}",
                        ApplyTax = false,
                        ApplyShipping = false,
                        PriceBreaks = new[]
                        {
                            new
                            {
                                Quantity = 1,
                                Price = c.UnitPrice,
                                BundlePrice = bundlePrice
                            }
                        },
                        xp = new
                        {
                            PelckmansStudio = new
                            {
                                ParentOfferID = offer.Id,
                                SourceProductID =
                                    c.ProductId
                            }
                        }
                    },
                    ct
                );

                // DefaultPriceScheduleID is the native relationship
                // between this module-owned allocation product and price.
                await Put(
                    $"/v1/products/{allocation}",
                    token,
                    new
                    {
                        ID = allocation,
                        Name =
                            c.Title ?? c.ProductId,
                        Active = true,
                        DefaultPriceScheduleID =
                            schedule,
                        xp = new
                        {
                            PelckmansStudio = new
                            {
                                ParentOfferID = offer.Id,
                                SourceProductID =
                                    c.ProductId,
                                DemoAllocation = true
                            }
                        }
                    },
                    ct
                );

                // Component products must be visible to the
                // configured Individual Customers catalog.
                await Post(
                    "/v1/catalogs/productassignments",
                    token,
                    new
                    {
                        CatalogID = catalog,
                        ProductID = allocation
                    },
                    ct
                );

                // Native bundle/product relationship.
                await Post(
                    "/v1/bundles/productassignments",
                    token,
                    new
                    {
                        BundleID = bundle,
                        ProductID = allocation,
                        Required = c.Required,
                        DefaultQuantity = c.Quantity
                    },
                    ct
                );

                refs[
                    $"component:{c.ProductId}"
                ] = allocation;

                refs[
                    $"price:{c.ProductId}"
                ] = schedule;
            }

            // Make the native bundle visible in the
            // configured catalog.
            await Post(
                "/v1/catalogs/bundleassignments",
                token,
                new
                {
                    CatalogID = catalog,
                    BundleID = bundle
                },
                ct
            );

            // Assign bundle to the configured buyer.
            await Post(
                "/v1/bundles/assignments",
                token,
                new
                {
                    BundleID = bundle,
                    BuyerID = buyer
                },
                ct
            );

            // Activate only after all owned resources and
            // relationships have been successfully written.
            await Patch(
                $"/v1/bundles/{bundle}",
                token,
                new
                {
                    Active = true
                },
                ct
            );
        }
        else
        {
            var promotion =
                Id(offer.Id, "PROMO");

            var (eligible, value) =
                OfferEngine.CompilePromotion(offer);

            // OrderCloud requires a Code unless generated codes are requested.
            // Keep it short, deterministic, and stable across publication retries.
            var rawCode =
                offer.Id.StartsWith(
                    "PEL_STUDIO_",
                    StringComparison.OrdinalIgnoreCase
                )
                    ? offer.Id["PEL_STUDIO_".Length..]
                    : offer.Id;

            var code =
                $"PEL{rawCode[..Math.Min(16, rawCode.Length)]}";

            await Put(
                $"/v1/promotions/{promotion}",
                token,
                new
                {
                    ID = promotion,
                    Code = code,
                    Name = offer.Name,
                    Active = true,
                    AutoApply = true,
                    CanCombine = false,
                    LineItemLevel = true,

                    Priority =
                        offer.Type ==
                        OfferType.BuyThreePayTwo
                            ? 100
                            : 110,

                    QuantityLimitPerOrder =
                        offer.Type ==
                        OfferType.BuyThreePayTwo
                            ? 1
                            : (int?)null,

                    ItemSortBy =
                        offer.Type ==
                        OfferType.BuyThreePayTwo
                            ? "UnitPrice"
                            : null,

                    EligibleExpression = eligible,
                    ValueExpression = value,

                    xp = new
                    {
                        PelckmansStudio = new
                        {
                            ParentOfferID = offer.Id,
                            Revision = offer.Revision,
                            EligibilitySnapshot =
                                offer.Rule!.ProductIds
                        }
                    }
                },
                ct
            );

            var buyer =
                Required("Pelckmans:BuyerID");

            await Post(
                "/v1/promotions/assignments",
                token,
                new
                {
                    PromotionID = promotion,
                    BuyerID = buyer
                },
                ct
            );

            refs["promotion"] = promotion;
        }

        return refs;
    }

    public async Task<VerificationResult> Verify(
        PelckmansOffer offer,
        IReadOnlyList<OfferComponent>? basket,
        CancellationToken ct)
    {
        if (offer.Status != OfferStatus.Published)
        {
            throw new ArgumentException(
                "Only a published offer can be verified."
            );
        }

        var token =
            await ShopperToken(ct);

        var order =
            Id(
                offer.Id,
                "VERIFY",
                Guid.NewGuid()
                    .ToString("N")[..8]
            );

        // Create a disposable, unsubmitted shopper order.
        await Post(
            "/v1/orders/Outgoing",
            token,
            new
            {
                ID = order,
                xp = new
                {
                    PelckmansStudio = new
                    {
                        ParentOfferID = offer.Id,
                        DisposableTestOrder = true
                    }
                }
            },
            ct
        );

        if (offer.Type == OfferType.Bundle)
        {
            if (
                !offer.PublishedResources.TryGetValue(
                    "bundle",
                    out var bundle
                )
            )
            {
                throw new InvalidOperationException(
                    "The published bundle resource ID is missing."
                );
            }

            // DefaultQuantity is already configured on each
            // bundle product assignment, so no request body
            // is required here.
            await Post(
                $"/v1/orders/Outgoing/{order}/bundles/{bundle}",
                token,
                null,
                ct
            );
        }
        else
        {
            foreach (
                var x in basket ??
                offer.Components
            )
            {
                await Post(
                    $"/v1/orders/Outgoing/{order}/lineitems",
                    token,
                    new
                    {
                        ProductID = x.ProductId,
                        Quantity = x.Quantity
                    },
                    ct
                );
            }

            // Re-evaluate AutoApply promotions now that all
            // qualifying line items are present.
            await Post(
                $"/v1/orders/Outgoing/{order}/applypromotions",
                token,
                null,
                ct
            );
        }

        using var orderDoc =
            await Send(
                HttpMethod.Get,
                $"/v1/orders/Outgoing/{order}",
                token,
                null,
                ct
            );

        using var lineItemDoc =
            await Send(
                HttpMethod.Get,
                $"/v1/orders/Outgoing/{order}/lineitems?pageSize=100",
                token,
                null,
                ct
            );

        using var promotionDoc =
            await Send(
                HttpMethod.Get,
                $"/v1/orders/Outgoing/{order}/promotions",
                token,
                null,
                ct
            );

        // For bundle verification, map the module-owned
        // allocation Product IDs back to the approved
        // source components. This lets the verifier report
        // the real bundle savings even though OrderCloud
        // does not represent them as PromotionDiscount.
        var componentByAllocation =
            new Dictionary<
                string,
                OfferComponent
            >(
                StringComparer.OrdinalIgnoreCase
            );

        if (offer.Type == OfferType.Bundle)
        {
            foreach (var component in offer.Components)
            {
                if (
                    offer.PublishedResources.TryGetValue(
                        $"component:{component.ProductId}",
                        out var allocation
                    )
                )
                {
                    componentByAllocation[
                        allocation
                    ] = component;
                }
            }
        }

        var lines =
            Array(
                lineItemDoc.RootElement,
                "Items"
            )
            .Select(
                x =>
                {
                    var productId =
                        String(x, "ProductID")
                        ?? "";

                    var title =
                        String(
                            Property(x, "Product"),
                            "Name"
                        )
                        ?? productId;

                    var quantity =
                        Int(x, "Quantity")
                        ?? 0;

                    var unitPrice =
                        Decimal(x, "UnitPrice")
                        ?? 0;

                    var lineTotal =
                        Decimal(x, "LineTotal")
                        ?? 0;

                    var qualifies =
                        false;

                    var discount =
                        Decimal(
                            x,
                            "PromotionDiscount"
                        )
                        ?? 0;

                    if (
                        offer.Type ==
                            OfferType.Bundle &&
                        componentByAllocation
                            .TryGetValue(
                                productId,
                                out var approvedComponent
                            )
                    )
                    {
                        qualifies = true;

                        var ordinaryValue =
                            approvedComponent.UnitPrice *
                            quantity;

                        discount =
                            Math.Max(
                                0m,
                                ordinaryValue -
                                lineTotal
                            );
                    }
                    else if (
                        offer.Type !=
                            OfferType.Bundle &&
                        offer.Rule?.ProductIds
                            is not null
                    )
                    {
                        qualifies =
                            offer.Rule.ProductIds
                                .Contains(
                                    productId,
                                    StringComparer
                                        .OrdinalIgnoreCase
                                );
                    }

                    return new VerificationLine(
                        productId,
                        title,
                        quantity,
                        unitPrice,
                        lineTotal,
                        qualifies,
                        discount
                    );
                }
            )
            .ToList();

        var expected =
            OfferEngine.Preview(
                offer,
                basket
            );

        var orderSubtotal =
            Decimal(
                orderDoc.RootElement,
                "Subtotal"
            )
            ?? lines.Sum(
                x => x.LineTotal
            );

        decimal actualDiscount;

        if (offer.Type == OfferType.Bundle)
        {
            // BundlePrice is pricing, not an OrderCloud
            // PromotionDiscount, so calculate the approved
            // bundle savings from the actual line totals.
            actualDiscount =
                lines.Sum(x => x.Discount);
        }
        else
        {
            actualDiscount =
                Decimal(
                    orderDoc.RootElement,
                    "PromotionDiscount"
                )
                ?? lines.Sum(
                    x => x.Discount
                );
        }

        var total =
            Decimal(
                orderDoc.RootElement,
                "Total"
            )
            ?? (
                offer.Type == OfferType.Bundle
                    ? lines.Sum(
                        x => x.LineTotal
                    )
                    : orderSubtotal -
                      actualDiscount
            );

        var discrepancies =
            new List<string>();

        if (
            Math.Abs(
                total -
                expected.Payable
            ) > .01m
        )
        {
            discrepancies.Add(
                $"Expected " +
                $"{expected.Payable.ToString("0.00", CultureInfo.InvariantCulture)} " +
                $"EUR payable; OrderCloud returned " +
                $"{total.ToString("0.00", CultureInfo.InvariantCulture)} EUR."
            );
        }

        if (
            offer.Type != OfferType.Bundle &&
            Math.Abs(
                actualDiscount -
                expected.Discount
            ) > .01m
        )
        {
            discrepancies.Add(
                $"Expected " +
                $"{expected.Discount.ToString("0.00", CultureInfo.InvariantCulture)} " +
                $"EUR discount; OrderCloud returned " +
                $"{actualDiscount.ToString("0.00", CultureInfo.InvariantCulture)} EUR."
            );
        }

        var promotions =
            Strings(
                Property(
                    promotionDoc.RootElement,
                    "Items"
                )
            );

        var resourceIds =
            offer.PublishedResources
                .ToDictionary(
                    x => x.Key,
                    x => x.Value
                );

        resourceIds["testOrder"] =
            order;

        return new VerificationResult(
            order,
            lines,
            orderSubtotal,
            actualDiscount,
            total,
            promotions,
            discrepancies,
            resourceIds
        );
    }

    async Task<string> ServiceToken(
        CancellationToken ct)
    {
        return await Token(
            Required(
                "OrderCloudSettings:MiddlewareClientID"
            ),
            Required(
                "OrderCloudSettings:MiddlewareClientSecret"
            ),
            null,
            null,
            ct
        );
    }

    async Task<string> ShopperToken(
        CancellationToken ct)
    {
        return await Token(
            Required(
                "Pelckmans:StorefrontClientID"
            ),
            null,
            Required(
                "Pelckmans:TestShopperUsername"
            ),
            Required(
                "Pelckmans:TestShopperPassword"
            ),
            ct
        );
    }

    async Task<string> Token(
        string client,
        string? secret,
        string? username,
        string? password,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(api))
        {
            throw new InvalidOperationException(
                "OrderCloudSettings:ApiUrl is required."
            );
        }

        Dictionary<string, string> fields;

        if (username is null)
        {
            fields = new()
            {
                ["grant_type"] =
                    "client_credentials",
                ["client_id"] =
                    client,
                ["client_secret"] =
                    secret!,
                ["scope"] =
                    "FullAccess"
            };
        }
        else
        {
            fields = new()
            {
                ["grant_type"] =
                    "password",
                ["client_id"] =
                    client,
                ["username"] =
                    username,
                ["password"] =
                    password!,
                ["buyer_id"] =
                    Required(
                        "Pelckmans:BuyerID"
                    ),
                ["scope"] =
                    "Shopper"
            };
        }

        using var req =
            new HttpRequestMessage(
                HttpMethod.Post,
                $"{api}/oauth/token"
            )
            {
                Content =
                    new FormUrlEncodedContent(
                        fields
                    )
            };

        using var res =
            await clients
                .CreateClient()
                .SendAsync(
                    req,
                    ct
                );

        await Ensure(
            res,
            "authenticate"
        );

        using var doc =
            JsonDocument.Parse(
                await res.Content
                    .ReadAsStreamAsync(ct)
            );

        return String(
            doc.RootElement,
            "access_token"
        )
        ?? throw new InvalidOperationException(
            "OrderCloud authentication returned no access token."
        );
    }

    Task Put(
        string path,
        string token,
        object body,
        CancellationToken ct)
    {
        return Write(
            HttpMethod.Put,
            path,
            token,
            body,
            ct
        );
    }

    Task Patch(
        string path,
        string token,
        object body,
        CancellationToken ct)
    {
        return Write(
            HttpMethod.Patch,
            path,
            token,
            body,
            ct
        );
    }

    Task Post(
        string path,
        string token,
        object? body,
        CancellationToken ct)
    {
        return Write(
            HttpMethod.Post,
            path,
            token,
            body,
            ct
        );
    }

    async Task Write(
        HttpMethod method,
        string path,
        string token,
        object? body,
        CancellationToken ct)
    {
        using var _ =
            await Send(
                method,
                path,
                token,
                body,
                ct
            );
    }

    async Task<JsonDocument> Send(
        HttpMethod method,
        string path,
        string token,
        object? body,
        CancellationToken ct)
    {
        using var req =
            new HttpRequestMessage(
                method,
                $"{api}{path}"
            );

        req.Headers.Authorization =
            new AuthenticationHeaderValue(
                "Bearer",
                token
            );

        if (body is not null)
        {
            req.Content =
                new StringContent(
                    JsonSerializer.Serialize(
                        body,
                        Json
                    ),
                    Encoding.UTF8,
                    "application/json"
                );
        }

        using var res =
            await clients
                .CreateClient()
                .SendAsync(
                    req,
                    ct
                );

        await Ensure(
            res,
            path
        );

        var content =
            await res.Content
                .ReadAsStringAsync(ct);

        return JsonDocument.Parse(
            string.IsNullOrWhiteSpace(
                content
            )
                ? "{}"
                : content
        );
    }

    static async Task Ensure(
        HttpResponseMessage response,
        string operation)
    {
        if (response.IsSuccessStatusCode)
        {
            return;
        }

        var correlation =
            response.Headers
                .TryGetValues(
                    "x-oc-correlation-id",
                    out var values
                )
                ? values.FirstOrDefault()
                : null;

        var detail =
            await response.Content
                .ReadAsStringAsync();

        if (detail.Length > 500)
        {
            detail =
                detail[..500];
        }

        throw new InvalidOperationException(
            $"OrderCloud could not {operation} " +
            $"({(int)response.StatusCode}; " +
            $"correlation {correlation ?? "not supplied"}): " +
            detail
        );
    }

    string Required(
        string key)
    {
        return config[key]
            is { Length: > 0 } value
                ? value
                : throw new InvalidOperationException(
                    $"Server setting {key} is required."
                );
    }

    static string Id(
        params string[] values)
    {
        var value =
            string.Join(
                '_',
                values
            )
            .ToUpperInvariant()
            .Replace(
                "-",
                ""
            );

        return value[
            ..Math.Min(
                100,
                value.Length
            )
        ];
    }

    static JsonElement Property(
        JsonElement element,
        string name)
    {
        return
            element.ValueKind ==
                JsonValueKind.Object &&
            element.TryGetProperty(
                name,
                out var value
            )
                ? value
                : default;
    }

    static string? String(
        JsonElement element,
        string name)
    {
        var value =
            Property(
                element,
                name
            );

        return value.ValueKind ==
            JsonValueKind.String
                ? value.GetString()
                : null;
    }

    static bool Bool(
        JsonElement element,
        string name)
    {
        return Property(
            element,
            name
        ).ValueKind ==
        JsonValueKind.True;
    }

    static int? Int(
        JsonElement element,
        string name)
    {
        var value =
            Property(
                element,
                name
            );

        return
            value.ValueKind ==
                JsonValueKind.Number &&
            value.TryGetInt32(
                out var number
            )
                ? number
                : null;
    }

    static decimal? Decimal(
        JsonElement element,
        string name)
    {
        var value =
            Property(
                element,
                name
            );

        return
            value.ValueKind ==
                JsonValueKind.Number &&
            value.TryGetDecimal(
                out var number
            )
                ? number
                : null;
    }

    static decimal? Decimal(
        JsonElement element,
        string array,
        int index,
        string name)
    {
        var values =
            Property(
                element,
                array
            );

        return
            values.ValueKind ==
                JsonValueKind.Array &&
            values.GetArrayLength() >
                index
                ? Decimal(
                    values[index],
                    name
                )
                : null;
    }

    static IEnumerable<JsonElement> Array(
        JsonElement element,
        string name)
    {
        var array =
            Property(
                element,
                name
            );

        return
            array.ValueKind ==
                JsonValueKind.Array
                ? array.EnumerateArray()
                : [];
    }

    static IReadOnlyList<string> Strings(
        JsonElement element)
    {
        if (
            element.ValueKind !=
            JsonValueKind.Array
        )
        {
            return [];
        }

        return element
            .EnumerateArray()
            .Select(
                x =>
                    x.ValueKind ==
                        JsonValueKind.String
                        ? x.GetString()
                        : String(
                            x,
                            "ID"
                        )
            )
            .Where(
                x => x is not null
            )
            .Cast<string>()
            .ToList();
    }

    static IReadOnlyList<CatalogFacet> Facets(
        IEnumerable<string> ids)
    {
        return ids
            .GroupBy(
                x => x,
                StringComparer.OrdinalIgnoreCase
            )
            .Select(
                x =>
                    new CatalogFacet(
                        x.Key,
                        x.Key,
                        x.Count()
                    )
            )
            .OrderBy(
                x => x.Name
            )
            .ToList();
    }
}