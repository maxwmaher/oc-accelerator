using Accelerator.Commands;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
using OrderCloud.SDK;

namespace Accelerator.Functions
{
    public class DemoPayments(
        ILogger<DemoPayments> logger,
        PaymentCommand paymentCommand,
        IOrderCloudClient oc)
    {
        private static readonly HashSet<string> SupportedPaymentMethods = new(StringComparer.OrdinalIgnoreCase)
        {
            "CreditCard",
            "PurchaseOrder",
        };

        [Function("acceptdemopayment")]
        public async Task<IActionResult> AcceptDemoPaymentAsync(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "demo/payments/{orderID}/{paymentID}/accept")] HttpRequest req,
            string orderID,
            string paymentID)
        {
            var body = await new StreamReader(req.Body).ReadToEndAsync();
            var request = string.IsNullOrWhiteSpace(body)
                ? new DemoPaymentAcceptRequest()
                : JsonConvert.DeserializeObject<DemoPaymentAcceptRequest>(body) ?? new DemoPaymentAcceptRequest();

            if (string.IsNullOrWhiteSpace(request.PaymentMethod) || !SupportedPaymentMethods.Contains(request.PaymentMethod))
            {
                return new BadRequestObjectResult("Demo payment acceptance supports only CreditCard and PurchaseOrder.");
            }

            var worksheet = await oc.IntegrationEvents.GetWorksheetAsync(OrderDirection.All, orderID);
            var payment = await oc.Payments.GetAsync(OrderDirection.All, orderID, paymentID);

            if (worksheet?.Order?.ID != orderID || payment?.ID != paymentID)
            {
                return new NotFoundObjectResult("Payment was not found for the supplied order.");
            }

            var isDemoPayment = payment.xp?.DemoPayment == true
                || payment.ID.StartsWith("BRISTAN-DEMO-", StringComparison.OrdinalIgnoreCase)
                || payment.ID.Equals("BRISTAN-ACCOUNT-ON-FILE", StringComparison.OrdinalIgnoreCase);

            if (!isDemoPayment)
            {
                logger.LogWarning("Rejected non-demo payment acceptance request. OrderID: {OrderID}; PaymentID: {PaymentID}; Type: {PaymentType}", orderID, paymentID, payment.Type);
                return new BadRequestObjectResult("Only demo checkout payments can be accepted by this endpoint.");
            }

            if (!string.Equals(payment.Type, request.PaymentMethod, StringComparison.OrdinalIgnoreCase))
            {
                return new BadRequestObjectResult("Payment method does not match the OrderCloud payment type.");
            }

            var amount = worksheet.Order.Total;
            var alreadyAccepted = payment.Accepted == true;
            logger.LogInformation(
                "Demo payment acceptance requested. OrderID: {OrderID}; PaymentID: {PaymentID}; PaymentType: {PaymentType}; Amount: {Amount}; AlreadyAccepted: {AlreadyAccepted}",
                orderID,
                paymentID,
                payment.Type,
                amount,
                alreadyAccepted);

            if (alreadyAccepted)
            {
                return new OkObjectResult(new DemoPaymentAcceptResponse(payment, true));
            }

            var acceptedPayment = string.Equals(request.PaymentMethod, "CreditCard", StringComparison.OrdinalIgnoreCase)
                ? await paymentCommand.AuthorizeCardPaymentAsync(orderID, paymentID)
                : await paymentCommand.AcceptPurchaseOrderPaymentAsync(orderID, paymentID);

            return new OkObjectResult(new DemoPaymentAcceptResponse(acceptedPayment, false));
        }
    }

    public class DemoPaymentAcceptRequest
    {
        public string PaymentMethod { get; set; }
        public string CardholderName { get; set; }
        public string Last4 { get; set; }
        public string Brand { get; set; }
    }

    public record DemoPaymentAcceptResponse(Payment Payment, bool AlreadyAccepted);
}
