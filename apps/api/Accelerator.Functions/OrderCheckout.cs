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
using Microsoft.Extensions.Configuration;
using Newtonsoft.Json.Linq;
using System.Diagnostics;

namespace Accelerator.Functions
{
    public class OrderCheckout(
        ILogger<OrderCheckout> logger, 
        ShippingCommand shippingCommand, 
        TaxCommand taxCommand, 
        PaymentCommand paymentCommand,
        IOrderCloudClient oc,
        IConfiguration configuration)
    {
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

        private static int GetShipEstimateCount(object responseObject)
        {
            var token = JToken.FromObject(responseObject);
            return token.SelectToken("ShipEstimates") is JArray estimates ? estimates.Count : 0;
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
            var apiUrl = FirstNonEmpty("OrderCloudSettings__ApiUrl") ?? config.ApiUrl;
            var clientId = FirstNonEmpty(
                "OrderCloudSettings__ClientID",
                "ClientID") ?? config.ClientId;
            var clientSecret = FirstNonEmpty(
                "OrderCloudSettings__ClientSecret",
                "ClientSecret") ?? config.ClientSecret;
            var configuredRoles = configuration.GetValue<string>("OrderCloudSettings__Roles");
            var roles = ParseRoles(configuredRoles) ?? config.Roles;

            return new OrderCloudClient(new OrderCloudClientConfig
            {
                ApiUrl = apiUrl,
                AuthUrl = apiUrl,
                ClientId = clientId,
                ClientSecret = clientSecret,
                Roles = roles
            });
        }
        private ApiRole[] ParseRoles(string rawRoles)
        {
            if (string.IsNullOrWhiteSpace(rawRoles)) return null;
            return rawRoles
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Select(role => Enum.TryParse<ApiRole>(role, true, out var parsed) ? (ApiRole?)parsed : null)
                .Where(role => role.HasValue)
                .Select(role => role.Value)
                .Distinct()
                .ToArray();
        }

        private string FirstNonEmpty(params string[] keys)
        {
            foreach (var key in keys)
            {
                var value = configuration.GetValue<string>(key);
                if (!string.IsNullOrWhiteSpace(value))
                {
                    return value;
                }
            }

            return null;
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

        private static object BuildShippingRatesResponse()
        {
            return new
            {
                ShipEstimates = new[]
                {
                    new
                    {
                        ID = "demo-shipment",
                        SelectedShipMethodID = (string?)null,
                        ShipEstimateItems = Array.Empty<object>(),
                        ShipMethods = new[]
                        {
                            new { ID = "standard", Name = "Standard Shipping", Cost = 24.95m, EstimatedTransitDays = 5, xp = new { } },
                            new { ID = "express", Name = "Express Shipping", Cost = 49.95m, EstimatedTransitDays = 2, xp = new { } }
                        },
                        xp = new { }
                    }
                },
                xp = new { }
            };
        }




    }

    public class IntegrationEventPing
    {
        private const string ShippingDebugVersion = "SHIPPING_DEBUG_2026_05_01_2127";

        [Function("integrationevent_ping")]
        public IActionResult Run(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", "post", Route = "integrationevent-ping")] HttpRequest req)
        {
            req.HttpContext.Response.Headers["X-Shipping-Debug-Version"] = ShippingDebugVersion;
            return new OkObjectResult($"pong {ShippingDebugVersion}");
        }
    }
}
