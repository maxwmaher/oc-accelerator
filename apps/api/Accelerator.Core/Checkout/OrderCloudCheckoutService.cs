using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading;
using System.Threading.Tasks;

namespace Accelerator.Checkout;

public sealed class CheckoutException(string message, int statusCode = 400) : Exception(message)
{
    public int StatusCode { get; } = statusCode;
}

/// <summary>
/// Performs checkout reads in the shopper context. The bearer token is never logged and is used to
/// prove both identity and access to the outgoing order; browser-supplied buyer/user claims are ignored.
/// </summary>
public sealed class OrderCloudCheckoutService(HttpClient httpClient)
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task<JsonObject> GetOwnedOrderAsync(string token, string orderID, CancellationToken cancellationToken)
    {
        var me = await SendAsync(token, HttpMethod.Get, "me", null, cancellationToken);
        var order = await SendAsync(token, HttpMethod.Get, $"orders/Outgoing/{Uri.EscapeDataString(orderID)}", null, cancellationToken);
        var meID = me["ID"]?.GetValue<string>();
        var ownerID = order["FromUser"]?["ID"]?.GetValue<string>();
        if (string.IsNullOrWhiteSpace(meID) || !string.Equals(meID, ownerID, StringComparison.OrdinalIgnoreCase))
            throw new CheckoutException("The authenticated shopper does not own this order.", 403);
        if (order["IsSubmitted"]?.GetValue<bool>() == true)
            throw new CheckoutException("This order has already been submitted.", 409);
        return order;
    }

    public async Task<QuantityValidationResult> ValidateQuantitiesAsync(string token, string orderID, CancellationToken cancellationToken)
    {
        await GetOwnedOrderAsync(token, orderID, cancellationToken);
        var lines = new List<QuantityLine>();
        for (var page = 1; ; page++)
        {
            var response = await SendAsync(token, HttpMethod.Get,
                $"orders/Outgoing/{Uri.EscapeDataString(orderID)}/lineitems?page={page}&pageSize=100", null, cancellationToken);
            var items = response["Items"]?.AsArray() ?? [];
            foreach (var item in items.OfType<JsonObject>())
                lines.Add(new(item["ProductID"]?.GetValue<string>() ?? "unknown", item["Quantity"]?.GetValue<decimal>() ?? 0));
            var totalPages = response["Meta"]?["TotalPages"]?.GetValue<int>() ?? 1;
            if (page >= totalPages) break;
        }

        var rules = new Dictionary<string, QuantityRule>(StringComparer.OrdinalIgnoreCase);
        foreach (var productID in lines.Select(x => x.ProductID).Distinct(StringComparer.OrdinalIgnoreCase))
        {
            try
            {
                // Me.GetProduct resolves assignments and the effective PriceSchedule for this shopper.
                var product = await SendAsync(token, HttpMethod.Get, $"me/products/{Uri.EscapeDataString(productID)}", null, cancellationToken);
                var schedule = product["PriceSchedule"] as JsonObject;
                if (schedule is null) continue;
                rules[productID] = new(productID,
                    Decimal(schedule, "MinQuantity"), Decimal(schedule, "MaxQuantity"),
                    Decimal(schedule, "RestrictedQuantity"), schedule["UseCumulativeQuantity"]?.GetValue<bool>() == true);
            }
            catch (CheckoutException)
            {
                // Missing/inaccessible pricing is rejected by the pure validator rather than assumed valid.
            }
        }
        return QuantityRuleValidator.Validate(lines, rules);
    }

    public async Task<DemoPaymentResponse> ProcessDemoPaymentAsync(
        string token, string orderID, DemoPaymentRequest request, CancellationToken cancellationToken)
    {
        var order = await GetOwnedOrderAsync(token, orderID, cancellationToken);
        var validation = await ValidateQuantitiesAsync(token, orderID, cancellationToken);
        var currency = order["Currency"]?.GetValue<string>() ?? string.Empty;
        var total = order["Total"]?.GetValue<decimal>() ?? -1;
        if (!validation.IsValid) return new("rejected", null, total, currency, validation.Errors);
        if (total != request.Amount || !string.Equals(currency, request.Currency, StringComparison.OrdinalIgnoreCase))
            throw new CheckoutException("The order total changed. Review the refreshed total before approving payment.", 409);
        if (!string.Equals(request.Outcome, "approve", StringComparison.OrdinalIgnoreCase))
            return new(string.Equals(request.Outcome, "decline", StringComparison.OrdinalIgnoreCase) ? "declined" : "cancelled", null, total, currency);

        var snapshot = $"{orderID}|{order["LastUpdated"]}|{total:0.00}|{currency}";
        var payments = await SendAsync(token, HttpMethod.Get,
            $"orders/Outgoing/{Uri.EscapeDataString(orderID)}/payments?pageSize=100", null, cancellationToken);
        var existing = payments["Items"]?.AsArray().OfType<JsonObject>().FirstOrDefault(p =>
            p["xp"]?["KFMBCheckout"]?["Snapshot"]?.GetValue<string>() == snapshot);
        var payment = existing ?? await SendAsync(token, HttpMethod.Post,
            $"orders/Outgoing/{Uri.EscapeDataString(orderID)}/payments",
            new JsonObject {
                ["Type"] = "CreditCard", ["Description"] = "KFMB demo payment — no real charge",
                ["Amount"] = total, ["Accepted"] = false,
                ["xp"] = new JsonObject { ["KFMBCheckout"] = new JsonObject { ["Mode"] = "Demo", ["Snapshot"] = snapshot } }
            }, cancellationToken);
        var paymentID = payment["ID"]?.GetValue<string>() ?? throw new CheckoutException("OrderCloud did not return a payment ID.", 502);
        var hasAuthorization = payment["Transactions"]?.AsArray().OfType<JsonObject>().Any(t =>
            t["ResultCode"]?.GetValue<string>() == "KFMB_DEMO_APPROVED" && t["Succeeded"]?.GetValue<bool>() == true) == true;
        if (!hasAuthorization)
            await SendAsync(token, HttpMethod.Post,
                $"orders/Outgoing/{Uri.EscapeDataString(orderID)}/payments/{Uri.EscapeDataString(paymentID)}/transactions",
                new JsonObject {
                    ["Type"] = "Authorization", ["DateExecuted"] = DateTimeOffset.UtcNow,
                    ["Amount"] = total, ["Currency"] = currency, ["Succeeded"] = true,
                    ["ResultCode"] = "KFMB_DEMO_APPROVED", ["ResultMessage"] = "Demo payment — no real charge"
                }, cancellationToken);
        if (payment["Accepted"]?.GetValue<bool>() != true)
            await SendAsync(token, HttpMethod.Patch,
                $"orders/Outgoing/{Uri.EscapeDataString(orderID)}/payments/{Uri.EscapeDataString(paymentID)}",
                new JsonObject { ["Accepted"] = true, ["Amount"] = total }, cancellationToken);
        return new("approved", paymentID, total, currency);
    }

    public async Task<string> GetCartOrderIDAsync(string token, CancellationToken cancellationToken)
    {
        var worksheet = await SendAsync(token, HttpMethod.Get, "cart/worksheet", null, cancellationToken);
        return worksheet["Order"]?["ID"]?.GetValue<string>()
            ?? throw new CheckoutException("The shopper cart does not contain an order.", 404);
    }

    private async Task<JsonObject> SendAsync(string token, HttpMethod method, string path, JsonNode? body, CancellationToken cancellationToken)
    {
        using var message = new HttpRequestMessage(method, path);
        message.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        if (body is not null) message.Content = JsonContent.Create(body, options: JsonOptions);
        using var response = await httpClient.SendAsync(message, cancellationToken);
        var text = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            var detail = "OrderCloud rejected the checkout request.";
            try { detail = JsonNode.Parse(text)?["Errors"]?[0]?["Message"]?.GetValue<string>() ?? detail; } catch (JsonException) { }
            throw new CheckoutException(detail, (int)response.StatusCode);
        }
        return JsonNode.Parse(text)?.AsObject() ?? new JsonObject();
    }

    private static decimal? Decimal(JsonObject source, string name) =>
        source[name] is null ? null : source[name]!.GetValue<decimal>();
}
