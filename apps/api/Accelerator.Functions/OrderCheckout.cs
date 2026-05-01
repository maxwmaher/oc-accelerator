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

                logger.LogInformation(
                    "Demo payment auth intent clientIdPresent={ClientIdPresent} clientSecretPresent={ClientSecretPresent} rolesIncludeFullAccess={RolesIncludeFullAccess}",
                    hasClientId,
                    hasClientSecret,
                    adminClient.Config.Roles?.Contains(ApiRole.FullAccess) == true);

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
                        paymentID = request.PaymentID
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
                "Demo payment clientID presence OrderCloudSettings:ClientID={Path1} OrderCloudSettings__ClientID={Path2} ClientID={Path3} OrderCloudSettings:MiddlewareClientID={Path4} OrderCloudSettings__MiddlewareClientID={Path5}",
                HasValue("OrderCloudSettings:ClientID"),
                HasValue("OrderCloudSettings__ClientID"),
                HasValue("ClientID"),
                HasValue("OrderCloudSettings:MiddlewareClientID"),
                HasValue("OrderCloudSettings__MiddlewareClientID"));

            logger.LogInformation(
                "Demo payment clientSecret presence OrderCloudSettings:ClientSecret={Path1} OrderCloudSettings__ClientSecret={Path2} ClientSecret={Path3} OrderCloudSettings:MiddlewareClientSecret={Path4} OrderCloudSettings__MiddlewareClientSecret={Path5}",
                HasValue("OrderCloudSettings:ClientSecret"),
                HasValue("OrderCloudSettings__ClientSecret"),
                HasValue("ClientSecret"),
                HasValue("OrderCloudSettings:MiddlewareClientSecret"),
                HasValue("OrderCloudSettings__MiddlewareClientSecret"));

            logger.LogInformation(
                "Demo payment apiUrl presence OrderCloudSettings:ApiUrl={Path1} OrderCloudSettings__ApiUrl={Path2} ApiUrl={Path3}",
                HasValue("OrderCloudSettings:ApiUrl"),
                HasValue("OrderCloudSettings__ApiUrl"),
                HasValue("ApiUrl"));
        }

        private bool HasValue(string key) => !string.IsNullOrWhiteSpace(configuration.GetValue<string>(key));

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
            var apiUrl = FirstNonEmpty(
                "OrderCloudSettings:ApiUrl",
                "OrderCloudSettings__ApiUrl",
                "ApiUrl") ?? config.ApiUrl;
            var clientId = FirstNonEmpty(
                "OrderCloudSettings:ClientID",
                "OrderCloudSettings__ClientID",
                "ClientID",
                "OrderCloudSettings:MiddlewareClientID",
                "OrderCloudSettings__MiddlewareClientID") ?? config.ClientId;
            var clientSecret = FirstNonEmpty(
                "OrderCloudSettings:ClientSecret",
                "OrderCloudSettings__ClientSecret",
                "ClientSecret",
                "OrderCloudSettings:MiddlewareClientSecret",
                "OrderCloudSettings__MiddlewareClientSecret") ?? config.ClientSecret;

            return new OrderCloudClient(new OrderCloudClientConfig
            {
                ApiUrl = apiUrl,
                AuthUrl = apiUrl,
                ClientId = clientId,
                ClientSecret = clientSecret,
                Roles = config.Roles
            });
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


        private class AcceptPaymentRequest
        {
            [JsonProperty("orderID")]
            public string OrderID { get; set; }

            [JsonProperty("paymentID")]
            public string PaymentID { get; set; }
        }

        private class DirectPatchDiagnosticResult
        {
            public bool Success { get; set; }
            public int StatusCode { get; set; }
            public string Body { get; set; }
        }
    }
}
