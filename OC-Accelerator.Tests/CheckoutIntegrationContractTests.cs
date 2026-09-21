using System.Net;
using System.Text;
using System.Text.Json;
using Accelerator.Checkout;
using Accelerator.Functions;
using Microsoft.Extensions.Options;

namespace OC_Accelerator.Tests;

public class CheckoutIntegrationContractTests
{
    private const string Marketplace = "_nfhvLBeikC2yF1a6f6v0w";
    private const string Saudi = "31FC66C6-15F6-49D4-86AE-B611ED584EB4";
    private const string Kuwait = "57D4DE3B-255E-44E2-B9B4-AEBED7DF70A2";

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

    [TestCase(Saudi)]
    [TestCase(Kuwait)]
    public async Task ActualLowercaseCidAuthenticatesAndOwnsOrder(string clientID)
    {
        var handler = new CheckoutHandler();
        var service = Service(handler);

        var order = await service.GetOwnedOrderAsync(Token(clientID.ToLowerInvariant()), "order-1", CancellationToken.None);

        Assert.That(order["ID"]!.GetValue<string>(), Is.EqualTo("order-1"));
        Assert.That(handler.Calls.Any(c => c.Path == "/v1/me" && c.Bearer != "middleware-token"), Is.True);
        Assert.That(handler.Calls.Count(c => c.Path.Contains("priceschedules")), Is.EqualTo(1));
        Assert.That(handler.Calls.Count(c => c.Path.Contains("apiclients")), Is.EqualTo(2));
    }

    [TestCase("other-client", "buyer", "shopper", false)]
    [TestCase("", "buyer", "shopper", false)]
    [TestCase(Saudi, "admin", "shopper", false)]
    [TestCase(Saudi, "supplier", "shopper", false)]
    [TestCase(Saudi, "buyer", "shopper", true)]
    public void InvalidCallerClaimsFailBeforePrivilegedActions(string cid, string userType, string user, bool anonymous)
    {
        var handler = new CheckoutHandler();
        var exception = Assert.ThrowsAsync<CheckoutException>(() => Service(handler).GetOwnedOrderAsync(
            Token(cid, userType, user, anonymous), "order-1", CancellationToken.None));

        Assert.That(exception!.StatusCode, Is.EqualTo(403));
        Assert.That(handler.PaymentWrites, Is.Zero);
    }

    [TestCase("{\"usrtype\":\"buyer\",\"usr\":\"shopper\"}")]
    [TestCase("{\"cid\":42,\"usrtype\":\"buyer\",\"usr\":\"shopper\"}")]
    public void MissingOrMalformedCidFails(string payload)
    {
        var handler = new CheckoutHandler();
        var token = $"{Encode("{\"alg\":\"none\"}")}.{Encode(payload)}.signature";
        var exception = Assert.ThrowsAsync<CheckoutException>(() => Service(handler).GetOwnedOrderAsync(token, "order-1", CancellationToken.None));
        Assert.That(exception!.StatusCode, Is.EqualTo(401).Or.EqualTo(403));
        Assert.That(handler.Calls, Is.Empty);
    }

    [TestCase(false)]
    [TestCase(true)]
    public void InvalidOrAlteredTokenCannotWritePayment(bool expired)
    {
        var handler = new CheckoutHandler { RejectShopperToken = true };
        var token = Token(Saudi, extra: expired ? ",\"exp\":1" : ",\"altered\":true");

        Assert.ThrowsAsync<CheckoutException>(() => Service(handler).ProcessDemoPaymentAsync(
            token, "order-1", new DemoPaymentRequest("approve", 10m, "SAR"), CancellationToken.None));
        Assert.That(handler.PaymentWrites, Is.Zero);
        Assert.That(handler.Calls.Any(c => c.Path.Contains("priceschedules") || c.Path.Contains("apiclients")), Is.False);
    }

    [TestCase(null)]
    [TestCase("wrong-marketplace")]
    public void MissingOrWrongMarketplaceConfigurationFailsBeforePaymentWrites(string? owner)
    {
        var handler = new CheckoutHandler { PriceScheduleOwner = owner };
        var exception = Assert.ThrowsAsync<CheckoutException>(() => Service(handler).ProcessDemoPaymentAsync(
            Token(Saudi), "order-1", new DemoPaymentRequest("approve", 10m, "SAR"), CancellationToken.None));
        Assert.That(exception!.StatusCode, Is.EqualTo(503));
        Assert.That(handler.PaymentWrites, Is.Zero);
    }

    [Test]
    public void ShopperCannotActOnAnotherShoppersOrder()
    {
        var handler = new CheckoutHandler { OrderOwner = "someone-else" };
        var exception = Assert.ThrowsAsync<CheckoutException>(() => Service(handler).GetOwnedOrderAsync(
            Token(Saudi), "order-1", CancellationToken.None));
        Assert.That(exception!.StatusCode, Is.EqualTo(403));
    }

    [Test]
    public async Task PaymentUsesOneAuthenticationPathAndMiddlewareForIncomingWrites()
    {
        var handler = new CheckoutHandler();
        var result = await Service(handler).ProcessDemoPaymentAsync(Token(Saudi), "order-1",
            new DemoPaymentRequest("approve", 10m, "SAR"), CancellationToken.None);

        Assert.That(result.Status, Is.EqualTo("approved"));
        Assert.That(handler.Calls.Count(c => c.Path == "/v1/me"), Is.EqualTo(1));
        Assert.That(handler.Calls.Where(c => c.Method is "POST" or "PATCH" && c.Path.Contains("/payments"))
            .All(c => c.Path.Contains("/orders/Incoming/") && c.Bearer == "middleware-token"), Is.True);
    }

    [Test]
    public async Task CartSubmissionValidationUsesSameAuthenticatedPath()
    {
        var handler = new CheckoutHandler();
        var result = await Service(handler).ValidateCartQuantitiesAsync(Token(Kuwait), CancellationToken.None);

        Assert.That(result.IsValid, Is.True);
        Assert.That(handler.Calls.Count(c => c.Path == "/v1/me"), Is.EqualTo(1));
        Assert.That(handler.Calls.Any(c => c.Path == "/v1/cart/worksheet"), Is.True);
        Assert.That(handler.Calls.Any(c => c.Path == "/v1/orders/Outgoing/order-1"), Is.True);
    }

    private static OrderCloudCheckoutService Service(CheckoutHandler handler) => new(
        new HttpClient(handler) { BaseAddress = new Uri("https://westeurope-sandbox.ordercloud.io/v1/") },
        Options.Create(new DemoCheckoutOptions
        {
            MarketplaceID = Marketplace, StorefrontClientIDs = [Saudi, Kuwait],
            MiddlewareClientID = "middleware", MiddlewareClientSecret = "server-secret"
        }));

    private static string Token(string client, string userType = "buyer", string user = "shopper", bool anonymous = false, string extra = "")
    {
        var anonymousClaim = anonymous ? ",\"orderid\":\"order-1\"" : "";
        var payload = $"{{\"cid\":\"{client}\",\"usrtype\":\"{userType}\",\"usr\":\"{user}\",\"aud\":\"https://westeurope-sandbox.ordercloud.io\"{anonymousClaim}{extra}}}";
        return $"{Encode("{\"alg\":\"RS256\"}")}.{Encode(payload)}.signature";
    }

    private static string Encode(string value) => Convert.ToBase64String(Encoding.UTF8.GetBytes(value))
        .TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private sealed class CheckoutHandler : HttpMessageHandler
    {
        public List<(string Method, string Path, string Bearer)> Calls { get; } = [];
        public bool RejectShopperToken { get; init; }
        public string? PriceScheduleOwner { get; init; } = Marketplace;
        public string OrderOwner { get; init; } = "shopper";
        public int PaymentWrites => Calls.Count(c => c.Method is "POST" or "PATCH" && c.Path.Contains("/payments"));

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var path = request.RequestUri!.AbsolutePath + request.RequestUri.Query;
            var bearer = request.Headers.Authorization?.Parameter ?? "";
            Calls.Add((request.Method.Method, path, bearer));
            if (path == "/oauth/token") return Task.FromResult(Json(HttpStatusCode.OK, new { access_token = "middleware-token" }));
            if (path == "/v1/me") return Task.FromResult(RejectShopperToken
                ? Json(HttpStatusCode.Unauthorized, new { Errors = new[] { new { Message = "Invalid or expired token." } } })
                : Json(HttpStatusCode.OK, new { ID = "shopper" }));
            if (path == "/v1/priceschedules/kfmb-demo-flour-sa-standard")
                return Task.FromResult(Json(HttpStatusCode.OK, new { OwnerID = PriceScheduleOwner }));
            if (path.StartsWith("/v1/apiclients/"))
                return Task.FromResult(Json(HttpStatusCode.OK, new { ID = Uri.UnescapeDataString(path.Split('/').Last()) }));
            if (path == "/v1/cart/worksheet") return Task.FromResult(Json(HttpStatusCode.OK, new { Order = new { ID = "order-1" } }));
            if (path == "/v1/orders/Outgoing/order-1") return Task.FromResult(Json(HttpStatusCode.OK,
                new { ID = "order-1", FromUser = new { ID = OrderOwner }, IsSubmitted = false, Currency = "SAR", Total = 10m, LastUpdated = "snapshot" }));
            if (path.Contains("/lineitems")) return Task.FromResult(Json(HttpStatusCode.OK,
                new { Items = new[] { new { ProductID = "P1", Quantity = 2m } }, Meta = new { TotalPages = 1 } }));
            if (path == "/v1/me/products/P1") return Task.FromResult(Json(HttpStatusCode.OK,
                new { PriceSchedule = new { RestrictedQuantity = false, MinQuantity = 1m, MaxQuantity = 10m, PriceBreaks = new[] { new { Quantity = 1m } } } }));
            if (request.Method == HttpMethod.Get && path.Contains("/payments"))
                return Task.FromResult(Json(HttpStatusCode.OK, new { Items = Array.Empty<object>() }));
            if (request.Method == HttpMethod.Post && path.EndsWith("/payments")) return Task.FromResult(Json(HttpStatusCode.OK,
                new { ID = "payment-1", Accepted = false, Transactions = Array.Empty<object>() }));
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.NoContent) { Content = new StringContent("") });
        }

        private static HttpResponseMessage Json(HttpStatusCode status, object body) => new(status)
        {
            Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json")
        };
    }
}
