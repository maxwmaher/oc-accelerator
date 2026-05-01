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
        [Function("estimateshipping")]
        [OrderCloudWebhookAuth]
        public async Task<IActionResult> EstimateShippingAsync([HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "estimateshipping")] HttpRequest req, [Microsoft.Azure.Functions.Worker.Http.FromBody] dynamic payload)
        {
            string estimateRequestPath = Convert.ToString(req.Path) ?? string.Empty;
            logger.LogInformation("Shipping estimate request received path={Path}", estimateRequestPath);
            var deserializedPayload = JsonConvert.DeserializeObject<OrderCheckoutIEPayload>(payload.ToString());
            string orderID = Convert.ToString(deserializedPayload?.OrderWorksheet?.Order?.ID) ?? string.Empty;
            int lineItemCount = deserializedPayload?.OrderWorksheet?.LineItems?.Count ?? 0;
            logger.LogInformation("Shipping estimate orderID={OrderID} lineItemCount={LineItemCount}", orderID, lineItemCount);
            var response = await shippingCommand.EstimateShippingRatesAsync(deserializedPayload);
            bool succeeded = response?.Succeeded ?? false;
            int statusCode = (int?)(response?.HttpStatusCode) ?? 0;
            int methodCount = response?.ShipEstimates?.FirstOrDefault()?.ShipMethods?.Count ?? 0;
            logger.LogInformation(
                "Shipping estimate success={Succeeded} statusCode={StatusCode} methodCount={MethodCount}",
                succeeded,
                statusCode,
                methodCount);

            return new OkObjectResult(response);
        }

        [Function("shippingrates")]
        [OrderCloudWebhookAuth]
        public async Task<IActionResult> EstimateShippingLegacyAsync([HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "shippingrates")] HttpRequest req, [Microsoft.Azure.Functions.Worker.Http.FromBody] dynamic payload)
        {
            return await EstimateShippingAsync(req, payload);
        }

        [Function("integrationevent")]
        [OrderCloudWebhookAuth]
        public async Task<IActionResult> IntegrationEventAsync(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "integrationevent/{eventName?}")] HttpRequest req,
            string? eventName,
            [Microsoft.Azure.Functions.Worker.Http.FromBody] dynamic payload)
        {
            var payloadObject = JObject.Parse(payload?.ToString() ?? "{}");
            var payloadEventType = payloadObject.SelectToken("EventType")?.ToString();
            var normalizedRouteEvent = eventName?.Trim();
            var derivedEventName = normalizedRouteEvent ?? payloadEventType ?? string.Empty;
            var isShippingRates = string.Equals(derivedEventName, "ShippingRates", StringComparison.OrdinalIgnoreCase)
                || string.Equals(payloadEventType, "ShippingRates", StringComparison.OrdinalIgnoreCase);
            if (!isShippingRates)
            {
                return new NotFoundObjectResult(new
                {
                    Message = $"Unsupported integration event '{derivedEventName}'.",
                });
            }

            var response = BuildShippingRatesResponse(payloadObject);
            logger.LogInformation("ShippingRates invoked");
            return new OkObjectResult(response);
        }

        [Function("integrationevent-shippingrates")]
        [OrderCloudWebhookAuth]
        public IActionResult IntegrationEventShippingRatesAsync(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "integrationevent/ShippingRates")] HttpRequest req,
            [Microsoft.Azure.Functions.Worker.Http.FromBody] dynamic payload)
        {
            var payloadObject = JObject.Parse(payload?.ToString() ?? "{}");
            var response = BuildShippingRatesResponse(payloadObject);
            logger.LogInformation("ShippingRates invoked");
            return new OkObjectResult(response);
        }

        [Function("integrationevent-shippingrates-lower")]
        [OrderCloudWebhookAuth]
        public IActionResult IntegrationEventShippingRatesLowerAsync(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "integrationevent/shippingrates")] HttpRequest req,
            [Microsoft.Azure.Functions.Worker.Http.FromBody] dynamic payload)
        {
            var payloadObject = JObject.Parse(payload?.ToString() ?? "{}");
            var response = BuildShippingRatesResponse(payloadObject);
            logger.LogInformation("ShippingRates invoked");
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
            string requestMethod = Convert.ToString(req.Method) ?? string.Empty;
            string requestOrigin = Convert.ToString(req.Headers["Origin"]) ?? string.Empty;
            string requestUrl = Convert.ToString(req.GetDisplayUrl()) ?? string.Empty;
            AddCorsHeaders(req);

            if (HttpMethods.IsOptions(req.Method))
            {
                await WriteJsonResponseAsync(req, StatusCodes.Status204NoContent);
                return;
            }
            using var reader = new StreamReader(req.Body);
            var body = await reader.ReadToEndAsync();
            var request = JsonConvert.DeserializeObject<AcceptPaymentRequest>(body);

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

                var adminClient = CreateAdminOrderCloudClient();
                var hasClientId = !string.IsNullOrWhiteSpace(adminClient.Config.ClientId);
                var hasClientSecret = !string.IsNullOrWhiteSpace(adminClient.Config.ClientSecret);
                var hasApiUrl = !string.IsNullOrWhiteSpace(adminClient.Config.ApiUrl);
                var hasFullAccess = adminClient.Config.Roles?.Contains(ApiRole.FullAccess) == true;
                if (!hasClientId)
                {
                    logger.LogError("Demo payment missing required OrderCloud clientID configuration");
                    await WriteJsonResponseAsync(req, StatusCodes.Status500InternalServerError, new
                    {
                        error = "OrderCloud client is missing clientID configuration."
                    });
                    return;
                }

                if (!hasClientSecret)
                {
                    logger.LogError("Demo payment missing required OrderCloud clientSecret configuration");
                    await WriteJsonResponseAsync(req, StatusCodes.Status500InternalServerError, new
                    {
                        error = "OrderCloud client is missing clientSecret configuration."
                    });
                    return;
                }
                if (!hasApiUrl)
                {
                    logger.LogError("Demo payment missing required OrderCloud apiUrl configuration");
                    await WriteJsonResponseAsync(req, StatusCodes.Status500InternalServerError, new
                    {
                        error = "OrderCloud client is missing apiUrl configuration."
                    });
                    return;
                }
                if (!hasFullAccess)
                {
                    logger.LogError("Demo payment missing required OrderCloud FullAccess role on server-side client credentials");
                    await WriteJsonResponseAsync(req, StatusCodes.Status500InternalServerError, new
                    {
                        error = "OrderCloud client credentials must include FullAccess role."
                    });
                    return;
                }

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

                var latestOrder = await adminClient.Orders.GetAsync<Order>(OrderDirection.All, request.OrderID);
                var selectedPaymentAmount = latestOrder?.Total ?? 0m;
                var existingPaymentAmount = existingPayment.Amount ?? 0m;
                var wasAmountCorrected = false;

                if (existingPayment.Accepted == true && existingPaymentAmount == selectedPaymentAmount)
                {
                    await WriteJsonResponseAsync(req, StatusCodes.Status200OK, existingPayment);
                    return;
                }

                if (existingPaymentAmount != selectedPaymentAmount)
                {
                    var amountOnlyPatchPayload = new PartialPayment { Amount = selectedPaymentAmount };
                    existingPayment = await adminClient.Payments.PatchAsync<Payment>(OrderDirection.All, request.OrderID, request.PaymentID, amountOnlyPatchPayload);
                    wasAmountCorrected = true;
                }

                var patchPayload = new PartialPayment { Accepted = true, Amount = selectedPaymentAmount };
                var response = await adminClient.Payments.PatchAsync<Payment>(OrderDirection.All, request.OrderID, request.PaymentID, patchPayload);
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
                    paymentID = request.PaymentID
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

        private static object BuildShippingRatesResponse(JObject payloadObject)
        {
            var lineItems = payloadObject.SelectToken("OrderWorksheet.LineItems") as JArray ?? new JArray();
            var shipEstimateItems = lineItems
                .Select(li => new
                {
                    LineItemID = li["ID"]?.ToString(),
                    Quantity = li["Quantity"]?.Value<int>() ?? 0
                })
                .Where(item => !string.IsNullOrWhiteSpace(item.LineItemID))
                .ToList();

            return new
            {
                ShipEstimates = new[]
                {
                    new
                    {
                        ID = "demo-shipment-1",
                        SelectedShipMethodID = (string?)null,
                        ShipEstimateItems = shipEstimateItems,
                        ShipMethods = new[]
                        {
                            new { ID = "standard-ground", Name = "Standard Ground", Cost = 24.95m, EstimatedTransitDays = 5, xp = new { } },
                            new { ID = "expedited-freight", Name = "Expedited Freight", Cost = 49.95m, EstimatedTransitDays = 2, xp = new { } }
                        },
                        xp = new { }
                    }
                },
                xp = new { }
            };
        }


        private class AcceptPaymentRequest
        {
            [JsonProperty("orderID")]
            public string OrderID { get; set; }

            [JsonProperty("paymentID")]
            public string PaymentID { get; set; }

            [JsonProperty("amount")]
            public decimal? Amount { get; set; }
        }

    }
}
