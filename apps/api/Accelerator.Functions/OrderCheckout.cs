using Accelerator.Commands;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
using OrderCloud.Catalyst;
using OrderCloud.SDK;

namespace Accelerator.Functions
{
    public class OrderCheckout(
        ILogger<OrderCheckout> logger,
        IConfiguration configuration,
        ShippingCommand shippingCommand,
        TaxCommand taxCommand,
        PaymentCommand paymentCommand)
    {

        [Function("estimateshipping")]
        [OrderCloudWebhookAuth]
        public Task<IActionResult> EstimateShippingAsync(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "estimateshipping")] HttpRequest req,
            [Microsoft.Azure.Functions.Worker.Http.FromBody] dynamic payload)
        {
            return EstimateShippingInternalAsync(req, payload);
        }

        [Function("shippingrates")]
        [OrderCloudWebhookAuth]
        public Task<IActionResult> EstimateShippingLegacyAsync(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "shippingrates")] HttpRequest req,
            [Microsoft.Azure.Functions.Worker.Http.FromBody] dynamic payload)
        {
            return EstimateShippingInternalAsync(req, payload);
        }

        private async Task<IActionResult> EstimateShippingInternalAsync(HttpRequest req, dynamic payload)
        {
            var deserializedPayload = JsonConvert.DeserializeObject<OrderCheckoutIEPayload>(payload.ToString());
            var useDemoSubtotalFallback = bool.TryParse(configuration["ShippingSettings:UseDemoSubtotalFallback"], out var configuredDemoFallback) && configuredDemoFallback;
            var response = await shippingCommand.EstimateShippingRatesAsync(deserializedPayload, useDemoSubtotalFallback);
            var orderID = deserializedPayload?.OrderWorksheet?.Order?.ID;
            var lineItemCount = deserializedPayload?.OrderWorksheet?.LineItems?.Count ?? 0;

            if (response.SubtotalUnavailable)
            {
                logger.LogWarning("Shipping estimate subtotal was unavailable for OrderID {OrderID}; demo fallback subtotal defaulted to 0.", orderID);
            }

            logger.LogInformation(
                "OrderCheckout shipping estimate request. Path: {Path}; OrderID: {OrderID}; LineItemCount: {LineItemCount}; DemoFallbackUsed: {DemoFallbackUsed}; ReturnedMethodCount: {ReturnedMethodCount}; Succeeded: {Succeeded}; HttpStatusCode: {HttpStatusCode}",
                req.Path,
                orderID,
                lineItemCount,
                response.DemoFallbackUsed,
                response.ReturnedMethodCount,
                response.Response.Succeeded,
                response.Response.HttpStatusCode);

            return new OkObjectResult(response.Response);
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
    }
}
