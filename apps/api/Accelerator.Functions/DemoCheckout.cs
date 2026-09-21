using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Accelerator.Checkout;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Options;

namespace Accelerator.Functions;

public sealed class DemoCheckout(OrderCloudCheckoutService checkout, IOptions<DemoCheckoutOptions> options)
{
    [Function("integrationevent")]
    public async Task<IActionResult> IntegrationEventAsync(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "integrationevent")] HttpRequest request,
        CancellationToken cancellationToken)
    {
        using var reader = new StreamReader(request.Body, Encoding.UTF8);
        var raw = await reader.ReadToEndAsync(cancellationToken);
        if (!ValidHash(raw, request.Headers["X-oc-hash"].FirstOrDefault(), options.Value.HashKey))
            return new UnauthorizedObjectResult(new { message = "Missing or invalid OrderCloud integration signature." });
        // One OrderCheckout URL receives calculate and submit callbacks. Zero shipping/tax is an
        // intentional pickup-demo response; Succeeded allows native payment validation/submission.
        return new OkObjectResult(new { ShippingTotal = 0m, TaxTotal = 0m, Succeeded = true });
    }

    [Function("demo-payment")]
    public async Task<IActionResult> PaymentAsync(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "demo-checkout/{orderID}/payment")] HttpRequest request,
        string orderID, CancellationToken cancellationToken)
    {
        if (!options.Value.Enabled)
            return new ObjectResult(new { message = "Demo payment is disabled." }) { StatusCode = 503 };
        var token = Bearer(request);
        if (token is null) return new UnauthorizedObjectResult(new { message = "Sign in before checkout." });
        try
        {
            var input = await request.ReadFromJsonAsync<DemoPaymentRequest>(cancellationToken) ??
                        throw new CheckoutException("A payment outcome, amount, and currency are required.");
            return new OkObjectResult(await checkout.ProcessDemoPaymentAsync(token, orderID, input, cancellationToken));
        }
        catch (CheckoutException ex)
        {
            return new ObjectResult(new { message = ex.Message }) { StatusCode = ex.StatusCode };
        }
    }

    [Function("validate-order-submit")]
    public async Task<IActionResult> ValidateSubmitAsync(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "webhooks/validate-order-submit")] HttpRequest request,
        CancellationToken cancellationToken)
    {
        request.EnableBuffering();
        using var reader = new StreamReader(request.Body, Encoding.UTF8, leaveOpen: true);
        var raw = await reader.ReadToEndAsync(cancellationToken);
        request.Body.Position = 0;
        if (!ValidHash(raw, request.Headers["X-oc-hash"].FirstOrDefault(), options.Value.HashKey))
            return new UnauthorizedObjectResult(new { proceed = false, message = "Missing or invalid OrderCloud webhook signature." });

        try
        {
            var payload = JsonNode.Parse(raw)?.AsObject() ?? throw new CheckoutException("Invalid webhook payload.");
            var token = FindString(payload, "UserToken") ?? FindString(payload, "Token");
            var orderID = FindString(payload, "OrderID") ?? FindString(payload, "orderID");
            if (string.IsNullOrWhiteSpace(token))
                return new BadRequestObjectResult(new { proceed = false, message = "Webhook did not include shopper context." });
            // Cart submit has no order ID in its route/body. Resolve it from the authenticated
            // shopper's real cart instead of trusting a browser-supplied ownership claim.
            orderID ??= await checkout.GetCartOrderIDAsync(token, cancellationToken);
            var result = await checkout.ValidateQuantitiesAsync(token, orderID, cancellationToken);
            return new OkObjectResult(result.IsValid
                ? new { proceed = true }
                : new { proceed = false, message = string.Join(" ", result.Errors), errors = result.Errors });
        }
        catch (CheckoutException ex)
        {
            return new OkObjectResult(new { proceed = false, message = ex.Message });
        }
    }

    private static string? Bearer(HttpRequest request)
    {
        var value = request.Headers.Authorization.FirstOrDefault();
        return value?.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase) == true ? value[7..].Trim() : null;
    }

    internal static bool ValidHash(string body, string? supplied, string key)
    {
        if (string.IsNullOrWhiteSpace(supplied) || string.IsNullOrWhiteSpace(key)) return false;
        var expected = Convert.ToBase64String(HMACSHA256.HashData(Encoding.UTF8.GetBytes(key), Encoding.UTF8.GetBytes(body)));
        try { return CryptographicOperations.FixedTimeEquals(Convert.FromBase64String(expected), Convert.FromBase64String(supplied)); }
        catch (FormatException) { return false; }
    }

    private static string? FindString(JsonNode? node, string name)
    {
        if (node is JsonObject obj)
        {
            foreach (var pair in obj)
            {
                if (string.Equals(pair.Key, name, StringComparison.OrdinalIgnoreCase) && pair.Value is JsonValue value &&
                    value.TryGetValue<string>(out var found)) return found;
                var nested = FindString(pair.Value, name);
                if (nested is not null) return nested;
            }
        }
        else if (node is JsonArray array)
            foreach (var item in array) { var nested = FindString(item, name); if (nested is not null) return nested; }
        return null;
    }
}
