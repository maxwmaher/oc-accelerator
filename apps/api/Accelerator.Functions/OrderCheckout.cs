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
using System.IdentityModel.Tokens.Jwt;
using System.Text;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Linq;

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

            using var reader = new StreamReader(req.Body);
            var body = await reader.ReadToEndAsync();
            logger.LogDebug("Demo payment raw request body: {Body}", body);

            var request = JsonConvert.DeserializeObject<AcceptPaymentRequest>(body);

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

            var adminClient = await CreateAdminOrderCloudClientAsync();
            var tokenContext = GetTokenContext(adminClient?.Config?.AccessToken);
            logger.LogInformation(
                "Demo payment token claims roles={Roles} client_id={ClientID} usr={Usr} scope={Scope}",
                tokenContext.Roles,
                tokenContext.ClientID,
                tokenContext.UserID,
                tokenContext.Scope);

            var isFullAccess = tokenContext.RoleList.Contains(FullAccessRole, StringComparer.OrdinalIgnoreCase);
            var isBuyerToken = !string.IsNullOrWhiteSpace(tokenContext.UserID);
            logger.LogInformation(
                "Demo payment token context hasFullAccess={HasFullAccess} tokenType={TokenType}",
                isFullAccess,
                isBuyerToken ? "buyer" : "client_credentials");

            if (!isFullAccess)
            {
                logger.LogWarning("Demo payment forbidden: token missing FullAccess role");
                await WriteJsonResponseAsync(req, StatusCodes.Status403Forbidden, new
                {
                    error = "Payment accept requires FullAccess role."
                });
                return;
            }

            try
            {
                logger.LogInformation("Demo payment fetch started");
                var existingPayment = await adminClient.Payments.GetAsync<Payment>(OrderDirection.Outgoing, request.OrderID, request.PaymentID);
                if (existingPayment == null)
                {
                    logger.LogWarning("Demo payment fetch returned null for order={OrderID} payment={PaymentID}", request.OrderID, request.PaymentID);
                    await WriteJsonResponseAsync(req, StatusCodes.Status404NotFound, new
                    {
                        error = $"Payment '{request.PaymentID}' was not found for order '{request.OrderID}'."
                    });
                    return;
                }

                logger.LogInformation("Demo payment patch started");
                var response = await adminClient.Payments.PatchAsync<Payment>(OrderDirection.Outgoing, request.OrderID, request.PaymentID, new PartialPayment { Accepted = true });

                logger.LogInformation("Demo payment final response success for order={OrderID} payment={PaymentID}", request.OrderID, request.PaymentID);
                await WriteJsonResponseAsync(req, StatusCodes.Status200OK, response);
                return;
            }
            catch (OrderCloudException ex) when (ex.HttpStatus == HttpStatusCode.NotFound)
            {
                logger.LogWarning(ex, "Demo payment not found for order={OrderID} payment={PaymentID}", request.OrderID, request.PaymentID);
                await WriteJsonResponseAsync(req, StatusCodes.Status404NotFound, new
                {
                    error = $"Payment '{request.PaymentID}' was not found for order '{request.OrderID}'."
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

        private async Task<OrderCloudClient> CreateAdminOrderCloudClientAsync()
        {
            var config = oc.Config;
            var token = await RequestClientCredentialsTokenAsync(config.AuthUrl, config.ClientId, config.ClientSecret, FullAccessRole);
            return new OrderCloudClient(new OrderCloudClientConfig
            {
                ApiUrl = config.ApiUrl,
                AuthUrl = config.AuthUrl,
                ClientId = config.ClientId,
                ClientSecret = config.ClientSecret,
                AccessToken = token
            });
        }

        private static async Task<string> RequestClientCredentialsTokenAsync(string authUrl, string clientId, string clientSecret, string role)
        {
            using var httpClient = new HttpClient();
            var tokenEndpoint = $"{authUrl.TrimEnd('/')}/oauth/token";
            var encodedCredentials = Convert.ToBase64String(Encoding.UTF8.GetBytes($"{clientId}:{clientSecret}"));
            httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", encodedCredentials);

            using var content = new FormUrlEncodedContent(new[]
            {
                new KeyValuePair<string, string>("grant_type", "client_credentials"),
                new KeyValuePair<string, string>("scope", role)
            });

            var tokenResponse = await httpClient.PostAsync(tokenEndpoint, content);
            tokenResponse.EnsureSuccessStatusCode();

            var body = await tokenResponse.Content.ReadAsStringAsync();
            var parsed = JsonConvert.DeserializeObject<dynamic>(body);
            return parsed?.access_token?.ToString();
        }

        private static TokenContext GetTokenContext(string accessToken)
        {
            if (string.IsNullOrWhiteSpace(accessToken))
            {
                return new TokenContext();
            }

            var token = new JwtSecurityTokenHandler().ReadJwtToken(accessToken);
            var roles = token.Claims.Where(c => c.Type == "role" || c.Type == "roles").Select(c => c.Value).ToList();

            return new TokenContext
            {
                RoleList = roles,
                Roles = string.Join(",", roles),
                ClientID = token.Claims.FirstOrDefault(c => c.Type == "client_id")?.Value,
                UserID = token.Claims.FirstOrDefault(c => c.Type == "usr")?.Value,
                Scope = token.Claims.FirstOrDefault(c => c.Type == "scope")?.Value
            };
        }

        private class TokenContext
        {
            public List<string> RoleList { get; set; } = new();
            public string Roles { get; set; }
            public string ClientID { get; set; }
            public string UserID { get; set; }
            public string Scope { get; set; }
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

        private class AcceptPaymentRequest
        {
            [JsonProperty("orderID")]
            public string OrderID { get; set; }

            [JsonProperty("paymentID")]
            public string PaymentID { get; set; }
        }
    }
}
