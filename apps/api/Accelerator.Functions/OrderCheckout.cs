using Accelerator.Commands;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;
using System.IO;
using Newtonsoft.Json;
using OrderCloud.Catalyst;
using OrderCloud.SDK;
using System.Net;
using Microsoft.AspNetCore.Http.Extensions;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Globalization;

namespace Accelerator.Functions
{
    public class OrderCheckout(
        ILogger<OrderCheckout> logger, 
        ShippingCommand shippingCommand, 
        TaxCommand taxCommand, 
        PaymentCommand paymentCommand,
        IOrderCloudClient oc)
    {
        private const string FullAccessRole = "FullAccess";

        [Function("shippingrates")]
        [OrderCloudWebhookAuth]
        public async Task<IActionResult> EstimateShippingAsync([HttpTrigger(AuthorizationLevel.Anonymous, "post")] HttpRequest req, [Microsoft.Azure.Functions.Worker.Http.FromBody] dynamic payload)
        {
            logger.LogInformation("C# HTTP trigger function processed a request.");
            var deserializedPayload = JsonConvert.DeserializeObject<OrderCheckoutIEPayload>(payload.ToString());
            var response = await shippingCommand.EstimateShippingRatesAsync(deserializedPayload);

            return new OkObjectResult(response);
        }

        [Function("ordercalculate")]
        [OrderCloudWebhookAuth]
        public async Task<IActionResult> CalculateOrderAsync(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post")] HttpRequest req,
            [Microsoft.Azure.Functions.Worker.Http.FromBody] dynamic payload)
        {
            logger.LogInformation("C# HTTP trigger function processed a request.");
            var deserializedPayload = JsonConvert.DeserializeObject<OrderCheckoutIEPayload>(payload.ToString());
            var response = await taxCommand.CalculateOrderAsync(deserializedPayload);

            return new OkObjectResult(response);
        }

        [Function("authorizepayment")]
        [OrderCloudWebhookAuth]
        public async Task<IActionResult> AuthorizePaymentAsync(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "{orderID}/payments/{paymentID}/authorize")] HttpRequest req,
            string orderID, string paymentID)
        {
            logger.LogInformation("C# HTTP trigger function processed a request.");
            var response = await paymentCommand.AuthorizeCardPaymentAsync(orderID, paymentID);

            return new OkObjectResult(response);
        }

        [Function("getiframecredentials")]
        [OrderCloudWebhookAuth]
        public async Task<IActionResult> GetIFrameCredentialsAsync([HttpTrigger(AuthorizationLevel.Anonymous, "get")] HttpRequest req)
        {
            logger.LogInformation("C# HTTP trigger function processed a request.");
            var response = await paymentCommand.GetIFrameCredentialsAsync() ?? "sk_test_BQokikJOvBiI2HlWgH4olfQ2";
            return new OkObjectResult(response);
        }

        [Function("acceptpayment")]
        public async Task AcceptPaymentAsync(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", "options", Route = "payments/accept")] HttpRequest req)
        {
            logger.LogInformation(
                "Demo payment request start method={Method} origin={Origin} url={Url}",
                req.Method,
                req.Headers["Origin"].ToString(),
                req.GetDisplayUrl());

            AddCorsHeaders(req);

            if (HttpMethods.IsOptions(req.Method))
            {
                logger.LogInformation("Demo payment preflight received (OPTIONS path hit=true)");
                await WriteJsonResponseAsync(req, StatusCodes.Status204NoContent);
                return;
            }

            logger.LogInformation("Demo payment request received for {Url}", req.GetDisplayUrl());

            logger.LogInformation("Demo payment step=request parsing started");
            using var reader = new StreamReader(req.Body);
            var body = await reader.ReadToEndAsync();
            logger.LogDebug("Demo payment raw request body: {Body}", body);

            var request = JsonConvert.DeserializeObject<AcceptPaymentRequest>(body);
            logger.LogInformation("Demo payment step=request parsing completed parsed={Parsed}", request != null);

            TokenDebug tokenDebug = null;

            try
            {
                if (request == null || string.IsNullOrWhiteSpace(request.OrderID) || string.IsNullOrWhiteSpace(request.PaymentID))
                {
                    logger.LogWarning("Demo payment request missing orderID/paymentID");
                    await WriteJsonResponseAsync(req, StatusCodes.Status400BadRequest, new
                    {
                        error = "Request body must include orderID and paymentID."
                    });
                    return;
                }

                logger.LogInformation("Demo payment parsed IDs order={OrderID} payment={PaymentID}", request.OrderID, request.PaymentID);
                logger.LogInformation("Demo payment OC auth/config loaded and client available={ClientAvailable}", oc != null);

                logger.LogInformation("Demo payment step=admin OC client creation/auth readiness started");
                var adminClient = CreateAdminOrderCloudClient();
                try
                {
                    var configuredRoles = adminClient.Config.Roles?.Select(r => r.ToString()).ToList() ?? new List<string>();
                    var hasClientId = !string.IsNullOrWhiteSpace(adminClient.Config.ClientId);
                    var hasClientSecret = !string.IsNullOrWhiteSpace(adminClient.Config.ClientSecret);
                    var tokenResponse = await adminClient.AuthenticateAsync();
                    var accessToken = tokenResponse?.AccessToken;

                    if (!string.IsNullOrEmpty(accessToken))
                    {
                        tokenDebug = BuildTokenDebug(accessToken);
                    }

                    logger.LogInformation(
                        "Demo payment auth intent clientIdPresent={ClientIdPresent} clientSecretPresent={ClientSecretPresent} configuredRoles={ConfiguredRoles}",
                        hasClientId,
                        hasClientSecret,
                        configuredRoles);
                    logger.LogInformation(
                        "Demo payment token diagnostics hasToken={HasToken} tokenLast8={TokenLast8} clientID={ClientID} userID={UserID} roles={Roles} scope={Scope} expiresUtc={ExpiresUtc} aud={Audience} iss={Issuer} hasFullAccess={HasFullAccess}",
                        tokenDebug?.HasToken,
                        tokenDebug?.TokenLast8,
                        tokenDebug?.ClientID,
                        tokenDebug?.UserID,
                        tokenDebug?.Roles,
                        tokenDebug?.Scope,
                        tokenDebug?.ExpiresUtc,
                        tokenDebug?.Audience,
                        tokenDebug?.Issuer,
                        tokenDebug?.HasFullAccess);
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, "Demo payment token debug failed message={Message} stackTrace={StackTrace}", ex.Message, ex.StackTrace);
                }

                logger.LogInformation("Demo payment step=admin OC client creation/auth readiness completed");

                logger.LogInformation("Demo payment step=Payments.GetAsync(All) started");
                logger.LogInformation("Demo payment step=Payments.GetAsync(All) call starting");
                var existingPayment = await adminClient.Payments.GetAsync<Payment>(OrderDirection.All, request.OrderID, request.PaymentID);
                if (existingPayment == null)
                {
                    logger.LogWarning("Demo payment fetch returned null for order={OrderID} payment={PaymentID}", request.OrderID, request.PaymentID);
                    await WriteJsonResponseAsync(req, StatusCodes.Status404NotFound, new
                    {
                        error = $"Payment '{request.PaymentID}' was not found for order '{request.OrderID}'."
                    });
                    return;
                }

                logger.LogInformation(
                    "Demo payment existing details id={PaymentID} accepted={Accepted} amount={Amount} type={Type} spendingAccountID={SpendingAccountID} creditCardID={CreditCardID}",
                    existingPayment.ID,
                    existingPayment.Accepted,
                    existingPayment.Amount,
                    existingPayment.Type,
                    existingPayment.SpendingAccountID,
                    existingPayment.CreditCardID);

                if (existingPayment.Accepted == true)
                {
                    logger.LogInformation("Demo payment already accepted for order={OrderID} payment={PaymentID}", request.OrderID, request.PaymentID);
                    await WriteJsonResponseAsync(req, StatusCodes.Status200OK, existingPayment);
                    return;
                }

                var patchPayload = new PartialPayment { Accepted = true };
                logger.LogInformation(
                    "Demo payment step=Payments.PatchAsync(All) started payload={Payload}",
                    JsonConvert.SerializeObject(patchPayload));
                logger.LogInformation("Demo payment step=Payments.PatchAsync(All) call starting");
                Payment response;
                var sdkPatchSucceeded = false;
                try
                {
                    response = await adminClient.Payments.PatchAsync<Payment>(OrderDirection.All, request.OrderID, request.PaymentID, patchPayload);
                    sdkPatchSucceeded = true;
                    logger.LogInformation("Demo payment step=Payments.PatchAsync(All) succeeded");
                }
                catch (OrderCloudException sdkEx)
                {
                    logger.LogWarning(
                        sdkEx,
                        "Demo payment step=Payments.PatchAsync(All) failed status={HttpStatus} message={Message} errors={Errors}",
                        sdkEx.HttpStatus,
                        sdkEx.Message,
                        sdkEx.Errors != null ? JsonConvert.SerializeObject(sdkEx.Errors) : null);

                    logger.LogInformation("Demo payment step=DirectREST PATCH(All) started after SDK failure");
                    var directResult = await RunDirectPatchDiagnosticAsync(adminClient, request.OrderID, request.PaymentID);
                    logger.LogInformation(
                        "Demo payment step=DirectREST PATCH(All) completed status={StatusCode} success={Success}",
                        directResult.StatusCode,
                        directResult.Success);

                    await WriteJsonResponseAsync(req, (int)sdkEx.HttpStatus, new
                    {
                        error = "OrderCloud payment accept failed.",
                        sdkPatchSucceeded,
                        directRestPatchSucceeded = directResult.Success,
                        sdk = new
                        {
                            status = sdkEx.HttpStatus,
                            message = sdkEx.Message,
                            errors = sdkEx.Errors
                        },
                        directRest = new
                        {
                            status = directResult.StatusCode,
                            body = directResult.Body
                        },
                        orderID = request.OrderID,
                        paymentID = request.PaymentID,
                        tokenDebug = tokenDebug ?? new { hasToken = false }
                    });
                    return;
                }

                logger.LogInformation("Demo payment final response success for order={OrderID} payment={PaymentID}", request.OrderID, request.PaymentID);
                logger.LogInformation("Demo payment step=response serialization started");
                await WriteJsonResponseAsync(req, StatusCodes.Status200OK, response);
                return;
            }
            catch (OrderCloudException ex)
            {
                logger.LogError(
                    ex,
                    "Demo payment OrderCloud error status={HttpStatus} message={Message} errors={Errors} order={OrderID} payment={PaymentID}",
                    ex.HttpStatus,
                    ex.Message,
                    ex.Errors != null ? JsonConvert.SerializeObject(ex.Errors) : null,
                    request.OrderID,
                    request.PaymentID);

                await WriteJsonResponseAsync(req, (int)ex.HttpStatus, new
                {
                    error = "OrderCloud payment accept failed.",
                    status = ex.HttpStatus,
                    message = ex.Message,
                    errors = ex.Errors,
                    orderID = request.OrderID,
                    paymentID = request.PaymentID,
                    tokenDebug = tokenDebug ?? new { hasToken = false }
                });
                return;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Demo payment unhandled error for order={OrderID} payment={PaymentID}", request.OrderID, request.PaymentID);
                await WriteJsonResponseAsync(req, StatusCodes.Status500InternalServerError, new
                {
                    error = "Internal server error during payment accept."
                });
                return;
            }
        }

        private static void AddCorsHeaders(HttpRequest req)
        {
            var headers = req.HttpContext.Response.Headers;
            headers["Access-Control-Allow-Origin"] = "*";
            headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
            headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization";
            headers["Access-Control-Max-Age"] = "86400";
        }

        private OrderCloudClient CreateAdminOrderCloudClient()
        {
            var config = oc.Config;
            return new OrderCloudClient(new OrderCloudClientConfig
            {
                ApiUrl = config.ApiUrl,
                AuthUrl = config.AuthUrl,
                ClientId = config.ClientId,
                ClientSecret = config.ClientSecret,
                Roles = config.Roles
            });
        }

        private async Task WriteJsonResponseAsync(HttpRequest req, int statusCode, object payload = null)
        {
            AddCorsHeaders(req);

            req.HttpContext.Response.StatusCode = statusCode;
            logger.LogInformation("Demo payment response status={StatusCode}", statusCode);

            if (payload == null)
            {
                return;
            }

            req.HttpContext.Response.ContentType = "application/json";
            await req.HttpContext.Response.WriteAsync(JsonConvert.SerializeObject(payload));
        }

        private async Task<DirectPatchDiagnosticResult> RunDirectPatchDiagnosticAsync(OrderCloudClient adminClient, string orderID, string paymentID)
        {
            var accessToken = (await adminClient.AuthenticateAsync())?.AccessToken;
            using var httpClient = new HttpClient();
            httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

            var apiUrl = adminClient.Config.ApiUrl?.TrimEnd('/') ?? "https://api.ordercloud.io";
            var uri = $"{apiUrl}/v1/orders/All/{WebUtility.UrlEncode(orderID)}/payments/{WebUtility.UrlEncode(paymentID)}";
            var body = "{\"Accepted\":true}";
            using var content = new StringContent(body, Encoding.UTF8, "application/json");

            var response = await httpClient.PatchAsync(uri, content);
            var responseBody = await response.Content.ReadAsStringAsync();

            return new DirectPatchDiagnosticResult
            {
                Success = response.IsSuccessStatusCode,
                StatusCode = (int)response.StatusCode,
                Body = responseBody
            };
        }


        private TokenDebug BuildTokenDebug(string accessToken)
        {
            var debug = new TokenDebug
            {
                HasToken = !string.IsNullOrWhiteSpace(accessToken),
                TokenLast8 = Last8(accessToken)
            };

            if (string.IsNullOrWhiteSpace(accessToken)) return debug;

            try
            {
                var claims = DecodeJwtPayload(accessToken);
                debug.ClientID = ClaimValue(claims, "client_id", "cid");
                debug.UserID = ClaimValue(claims, "usr", "user_id", "sub");
                debug.Scope = ClaimValue(claims, "scope", "scp");
                debug.Roles = ClaimValues(claims, "roles", "role");
                debug.ExpiresUtc = ExpUtc(claims);
                debug.Audience = ClaimValue(claims, "aud");
                debug.Issuer = ClaimValue(claims, "iss");
                debug.HasFullAccess = debug.Roles?.Contains(FullAccessRole, StringComparer.OrdinalIgnoreCase) == true;
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Demo payment token diagnostics decode failed");
            }

            return debug;
        }

        private static Dictionary<string, object> DecodeJwtPayload(string jwt)
        {
            var parts = jwt.Split('.');
            if (parts.Length < 2) return new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);
            var payload = parts[1].Replace('-', '+').Replace('_', '/');
            payload = payload.PadRight(payload.Length + (4 - payload.Length % 4) % 4, '=');
            var bytes = Convert.FromBase64String(payload);
            var json = Encoding.UTF8.GetString(bytes);
            return JsonConvert.DeserializeObject<Dictionary<string, object>>(json)
                   ?? new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);
        }

        private static string ClaimValue(Dictionary<string, object> claims, params string[] names)
        {
            foreach (var name in names)
            {
                if (!claims.TryGetValue(name, out var value) || value == null) continue;
                var token = value is Newtonsoft.Json.Linq.JToken jt ? jt : Newtonsoft.Json.Linq.JToken.FromObject(value);
                if (token.Type == Newtonsoft.Json.Linq.JTokenType.Array)
                {
                    var first = token.Values<string>().FirstOrDefault();
                    if (!string.IsNullOrWhiteSpace(first)) return first;
                }
                else
                {
                    var str = token.ToString();
                    if (!string.IsNullOrWhiteSpace(str)) return str;
                }
            }
            return null;
        }

        private static List<string> ClaimValues(Dictionary<string, object> claims, params string[] names)
        {
            foreach (var name in names)
            {
                if (!claims.TryGetValue(name, out var value) || value == null) continue;
                var token = value is Newtonsoft.Json.Linq.JToken jt ? jt : Newtonsoft.Json.Linq.JToken.FromObject(value);
                if (token.Type == Newtonsoft.Json.Linq.JTokenType.Array)
                {
                    var arr = token.Values<string>().Where(v => !string.IsNullOrWhiteSpace(v)).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
                    if (arr.Count > 0) return arr;
                }
                else
                {
                    var str = token.ToString();
                    if (!string.IsNullOrWhiteSpace(str))
                    {
                        var vals = str.Split(' ', StringSplitOptions.RemoveEmptyEntries).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
                        if (vals.Count > 0) return vals;
                    }
                }
            }
            return new List<string>();
        }

        private static string ExpUtc(Dictionary<string, object> claims)
        {
            var exp = ClaimValue(claims, "exp");
            if (!long.TryParse(exp, out var expSeconds)) return null;
            return DateTimeOffset.FromUnixTimeSeconds(expSeconds).UtcDateTime.ToString("O", CultureInfo.InvariantCulture);
        }

        private static string Last8(string token) =>
            string.IsNullOrWhiteSpace(token) ? null : token.Length <= 8 ? token : token.Substring(token.Length - 8, 8);

        private class AcceptPaymentRequest
        {
            [JsonProperty("orderID")]
            public string OrderID { get; set; }

            [JsonProperty("paymentID")]
            public string PaymentID { get; set; }
        }

        private class TokenDebug
        {
            [JsonProperty("hasToken")]
            public bool HasToken { get; set; }
            [JsonProperty("tokenLast8")]
            public string TokenLast8 { get; set; }
            [JsonProperty("clientID")]
            public string ClientID { get; set; }
            [JsonProperty("userID")]
            public string UserID { get; set; }
            [JsonProperty("roles")]
            public List<string> Roles { get; set; } = new();
            [JsonProperty("scope")]
            public string Scope { get; set; }
            [JsonProperty("expiresUtc")]
            public string ExpiresUtc { get; set; }
            [JsonProperty("aud")]
            public string Audience { get; set; }
            [JsonProperty("iss")]
            public string Issuer { get; set; }
            [JsonProperty("hasFullAccess")]
            public bool HasFullAccess { get; set; }
        }

        private class DirectPatchDiagnosticResult
        {
            public bool Success { get; set; }
            public int StatusCode { get; set; }
            public string Body { get; set; }
        }
    }
}
