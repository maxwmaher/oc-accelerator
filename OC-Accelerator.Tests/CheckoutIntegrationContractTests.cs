using System.Net;
using System.Text;
using System.Text.Json;
using Accelerator.Checkout;
using Accelerator.Functions;
using Microsoft.Extensions.Options;

namespace OC_Accelerator.Tests;

public class CheckoutIntegrationContractTests
{
    [Test]
    public void CallbackHashAcceptsExactRawBodyAndRejectsTampering()
    {
        const string body = "{\"OrderID\":\"o-1\"}";
        const string key = "test-hash-key";
        var hash = Convert.ToBase64String(System.Security.Cryptography.HMACSHA256.HashData(
            Encoding.UTF8.GetBytes(key), Encoding.UTF8.GetBytes(body)));

        Assert.Multiple(() =>
        {
            Assert.That(DemoCheckout.ValidHash(body, hash, key), Is.True);
            Assert.That(DemoCheckout.ValidHash(body + " ", hash, key), Is.False);
            Assert.That(DemoCheckout.ValidHash(body, "not-base64", key), Is.False);
        });
    }

    [Test]
    public void RejectedPreWebhookHasDocumentedBodyWithUsefulDetails()
    {
        var response = DemoCheckout.RejectWebhook("Quantity is invalid.", new[] { "P1 requires at least 2." });
        var json = JsonSerializer.Serialize(response);
        Assert.Multiple(() =>
        {
            Assert.That(json, Does.Contain("\"proceed\":false"));
            Assert.That(json, Does.Contain("\"body\""));
            Assert.That(json, Does.Contain("Quantity is invalid."));
            Assert.That(json, Does.Contain("P1 requires at least 2."));
        });
    }

    [Test]
    public async Task PaymentUsesShopperForReadsAndMiddlewareForIncomingWrites()
    {
        var handler = new CheckoutHandler();
        var client = new HttpClient(handler) { BaseAddress = new Uri("https://sandbox.ordercloud.io/v1/") };
        var options = Options.Create(new DemoCheckoutOptions
        {
            MarketplaceID = "marketplace", StorefrontClientIDs = ["storefront"],
            MiddlewareClientID = "middleware", MiddlewareClientSecret = "server-secret"
        });
        var service = new OrderCloudCheckoutService(client, options);

        var result = await service.ProcessDemoPaymentAsync(Token("marketplace", "storefront"), "order-1",
            new DemoPaymentRequest("approve", 10m, "SAR"), CancellationToken.None);

        Assert.That(result.Status, Is.EqualTo("approved"));
        Assert.That(handler.Calls.Where(c => c.Path.StartsWith("/v1/") && c.Method == "GET").All(c => c.Bearer.StartsWith("eyJ")), Is.True,
            "identity, ownership, pricing, and existing-payment reads remain in shopper context");
        Assert.That(handler.Calls.Where(c => c.Method is "POST" or "PATCH" && c.Path.Contains("/payments"))
            .All(c => c.Path.Contains("/orders/Incoming/") && c.Bearer == "middleware-token"), Is.True,
            "payment writes use middleware authorization and seller-side direction");
    }

    [Test]
    public void UnrelatedStorefrontIsRejectedBeforeAnyOrderCloudRequest()
    {
        var handler = new CheckoutHandler();
        var service = new OrderCloudCheckoutService(
            new HttpClient(handler) { BaseAddress = new Uri("https://sandbox.ordercloud.io/v1/") },
            Options.Create(new DemoCheckoutOptions { MarketplaceID = "marketplace", StorefrontClientIDs = ["storefront"] }));

        var exception = Assert.ThrowsAsync<CheckoutException>(() => service.GetOwnedOrderAsync(
            Token("marketplace", "unrelated"), "order-1", CancellationToken.None));
        Assert.That(exception!.StatusCode, Is.EqualTo(403));
        Assert.That(handler.Calls, Is.Empty);
    }

    private static string Token(string marketplace, string client) =>
        $"{Encode("{\"alg\":\"none\"}")}.{Encode($"{{\"marketplace_id\":\"{marketplace}\",\"client_id\":\"{client}\"}}")}.signature";

    private static string Encode(string value) => Convert.ToBase64String(Encoding.UTF8.GetBytes(value))
        .TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private sealed class CheckoutHandler : HttpMessageHandler
    {
        public List<(string Method, string Path, string Bearer)> Calls { get; } = [];

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var path = request.RequestUri!.AbsolutePath + request.RequestUri.Query;
            var bearer = request.Headers.Authorization?.Parameter ?? "";
            Calls.Add((request.Method.Method, path, bearer));
            if (path == "/oauth/token") return Json(HttpStatusCode.OK, new { access_token = "middleware-token" });
            if (path == "/v1/me") return Json(HttpStatusCode.OK, new { ID = "shopper" });
            if (path == "/v1/orders/Outgoing/order-1") return Json(HttpStatusCode.OK,
                new { ID = "order-1", FromUser = new { ID = "shopper" }, IsSubmitted = false, Currency = "SAR", Total = 10m, LastUpdated = "snapshot" });
            if (path.Contains("/lineitems")) return Json(HttpStatusCode.OK,
                new { Items = new[] { new { ProductID = "P1", Quantity = 2m } }, Meta = new { TotalPages = 1 } });
            if (path == "/v1/me/products/P1") return Json(HttpStatusCode.OK,
                new { PriceSchedule = new { RestrictedQuantity = false, MinQuantity = 1m, MaxQuantity = 10m, PriceBreaks = new[] { new { Quantity = 1m } } } });
            if (request.Method == HttpMethod.Get && path.Contains("/payments")) return Json(HttpStatusCode.OK, new { Items = Array.Empty<object>() });
            if (request.Method == HttpMethod.Post && path.EndsWith("/payments")) return Json(HttpStatusCode.OK,
                new { ID = "payment-1", Accepted = false, Transactions = Array.Empty<object>() });
            // Exercise successful empty bodies for transaction and acceptance writes.
            return new HttpResponseMessage(HttpStatusCode.NoContent) { Content = new StringContent("") };
        }

        private static HttpResponseMessage Json(HttpStatusCode status, object body) => new(status)
        {
            Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json")
        };
    }
}
