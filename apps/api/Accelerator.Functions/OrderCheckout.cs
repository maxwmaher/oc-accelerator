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
                LogConfigPresence();
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

                logger.LogInformation(
                    "Demo payment auth intent clientIdPresent={ClientIdPresent} clientSecretPresent={ClientSecretPresent} rolesIncludeFullAccess={RolesIncludeFullAccess}",
                    hasClientId,
                    hasClientSecret,
                    hasFullAccess);

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

                var worksheet = await adminClient.IntegrationEvents.GetWorksheetAsync(OrderDirection.All, request.OrderID);
                var latestOrder = worksheet?.Order;
                if (latestOrder == null || latestOrder.Total <= 0)
                {
                    logger.LogError("Demo payment latest order total is invalid for order={OrderID} total={Total}", request.OrderID, latestOrder?.Total);
                    await WriteJsonResponseAsync(req, StatusCodes.Status500InternalServerError, new
                    {
                        error = "Latest order total is invalid; cannot accept payment.",
                        orderID = request.OrderID
                    });
                    return;
                }

                var selectedPaymentAmount = latestOrder.Total;
                logger.LogInformation(
                    "Demo payment amount selection orderID={OrderID} total={Total} subtotal={Subtotal} shipping={Shipping} tax={Tax} selectedAmount={SelectedAmount}",
                    request.OrderID,
                    latestOrder.Total,
                    latestOrder.Subtotal,
                    latestOrder.ShippingCost,
                    latestOrder.TaxCost,
                    selectedPaymentAmount);
                logger.LogInformation("payment amount before patch = {Amount}", existingPayment.Amount);

                if (existingPayment.Accepted == true && existingPayment.Amount == selectedPaymentAmount)
                {
                    logger.LogInformation("Demo payment already accepted with reconciled amount for order={OrderID} payment={PaymentID}", request.OrderID, request.PaymentID);
                    await WriteJsonResponseAsync(req, StatusCodes.Status200OK, existingPayment);
                    return;
                }

                var patchPayload = new PartialPayment { Accepted = true, Amount = selectedPaymentAmount };
                logger.LogInformation(
                    "Demo payment step=Payments.PatchAsync(All) started payload={Payload}",
                    JsonConvert.SerializeObject(patchPayload));
                logger.LogInformation("Demo payment step=Payments.PatchAsync(All) call starting");
                var response = await adminClient.Payments.PatchAsync<Payment>(OrderDirection.All, request.OrderID, request.PaymentID, patchPayload);
                logger.LogInformation("Demo payment step=Payments.PatchAsync(All) succeeded");

                logger.LogInformation("payment amount after patch = {Amount}", response.Amount);
                logger.LogInformation("payment accepted = {Accepted}", response.Accepted);
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


        private void LogConfigPresence()
        {
            logger.LogInformation(
                "Demo payment startup diagnostics: OrderCloudSettings__ClientID present={ClientIdPresent} OrderCloudSettings__ClientSecret present={ClientSecretPresent} OrderCloudSettings__ApiUrl present={ApiUrlPresent} OrderCloudSettings__Roles present={RolesPresent} FullAccess included={FullAccessIncluded}",
                HasValue("OrderCloudSettings__ClientID"),
                HasValue("OrderCloudSettings__ClientSecret"),
                HasValue("OrderCloudSettings__ApiUrl"),
                HasValue("OrderCloudSettings__Roles"),
                RolesIncludeFullAccess());
        }

        private bool HasValue(string key) => !string.IsNullOrWhiteSpace(configuration.GetValue<string>(key));
        private bool RolesIncludeFullAccess() => (configuration.GetValue<string>("OrderCloudSettings__Roles") ?? string.Empty)
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Contains(nameof(ApiRole.FullAccess), StringComparer.OrdinalIgnoreCase);

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
