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

namespace Accelerator.Functions
{
    public class OrderCheckout(
        ILogger<OrderCheckout> logger, 
        ShippingCommand shippingCommand, 
        TaxCommand taxCommand, 
        PaymentCommand paymentCommand,
        IOrderCloudClient oc)
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
        public async Task<IActionResult> AcceptPaymentAsync(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", "options", Route = "payments/accept")] HttpRequest req)
        {
            AddCorsHeaders(req);

            if (HttpMethods.IsOptions(req.Method))
            {
                logger.LogInformation("Demo payment preflight received for {Url}", req.GetDisplayUrl());
                return new StatusCodeResult(StatusCodes.Status204NoContent);
            }

            logger.LogInformation("Demo payment request received for {Url}", req.GetDisplayUrl());

            using var reader = new StreamReader(req.Body);
            var body = await reader.ReadToEndAsync();
            logger.LogDebug("Demo payment raw request body: {Body}", body);

            var request = JsonConvert.DeserializeObject<AcceptPaymentRequest>(body);

            if (request == null || string.IsNullOrWhiteSpace(request.OrderID) || string.IsNullOrWhiteSpace(request.PaymentID))
            {
                logger.LogWarning("Demo payment request missing orderID/paymentID");
                return JsonResponse(req, StatusCodes.Status400BadRequest, new
                {
                    error = "Request body must include orderID and paymentID."
                });
            }

            logger.LogInformation("Demo payment parsed IDs order={OrderID} payment={PaymentID}", request.OrderID, request.PaymentID);
            logger.LogInformation("Demo payment OC auth/config loaded and client available={ClientAvailable}", oc != null);

            try
            {
                logger.LogInformation("Demo payment fetch started");
                var existingPayment = await oc.Payments.GetAsync<Payment>(OrderDirection.Outgoing, request.OrderID, request.PaymentID);
                if (existingPayment == null)
                {
                    logger.LogWarning("Demo payment fetch returned null for order={OrderID} payment={PaymentID}", request.OrderID, request.PaymentID);
                    return JsonResponse(req, StatusCodes.Status404NotFound, new
                    {
                        error = $"Payment '{request.PaymentID}' was not found for order '{request.OrderID}'."
                    });
                }

                logger.LogInformation("Demo payment patch started");
                var response = await oc.Payments.PatchAsync<Payment>(OrderDirection.Outgoing, request.OrderID, request.PaymentID, new PartialPayment { Accepted = true });

                logger.LogInformation("Demo payment final response success for order={OrderID} payment={PaymentID}", request.OrderID, request.PaymentID);
                return JsonResponse(req, StatusCodes.Status200OK, response);
            }
            catch (OrderCloudException ex) when (ex.HttpStatus == HttpStatusCode.NotFound)
            {
                logger.LogWarning(ex, "Demo payment not found for order={OrderID} payment={PaymentID}", request.OrderID, request.PaymentID);
                return JsonResponse(req, StatusCodes.Status404NotFound, new
                {
                    error = $"Payment '{request.PaymentID}' was not found for order '{request.OrderID}'."
                });
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Demo payment unhandled error for order={OrderID} payment={PaymentID}", request.OrderID, request.PaymentID);
                return JsonResponse(req, StatusCodes.Status500InternalServerError, new
                {
                    error = "Internal server error during payment accept."
                });
            }
        }

        private static void AddCorsHeaders(HttpRequest req)
        {
            var headers = req.HttpContext.Response.Headers;
            headers["Access-Control-Allow-Origin"] = "*";
            headers["Access-Control-Allow-Methods"] = "POST,OPTIONS";
            headers["Access-Control-Allow-Headers"] = "Content-Type,Authorization,x-functions-key";
        }

        private IActionResult JsonResponse(HttpRequest req, int statusCode, object payload)
        {
            AddCorsHeaders(req);
            return new ContentResult
            {
                StatusCode = statusCode,
                Content = JsonConvert.SerializeObject(payload),
                ContentType = "application/json"
            };
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
