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

        private static readonly HashSet<string> AccountOnFileUsernames = new(StringComparer.OrdinalIgnoreCase)
        {
            "bristan-demo-supplier-north-buyer-user",
            "bristan-demo-supplier-south-buyer-user",
        };

        [Function("acceptdemopayment")]
        public async Task<IActionResult> AcceptDemoPaymentAsync(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "demo/payments/{orderID}/{paymentID}/accept")] HttpRequest req,
            string orderID,
            string paymentID)
        {
            if (string.IsNullOrWhiteSpace(orderID) || string.IsNullOrWhiteSpace(paymentID))
            {
                logger.LogWarning("Demo payment acceptance request is missing route values. OrderID: {OrderID}; PaymentID: {PaymentID}", orderID, paymentID);
                return new BadRequestObjectResult(new DemoPaymentErrorResponse("MissingRouteValue", "Order ID and payment ID are required."));
            }

            DemoPaymentAcceptRequest request;
            try
            {
                var body = await new StreamReader(req.Body).ReadToEndAsync();
                request = string.IsNullOrWhiteSpace(body)
                    ? new DemoPaymentAcceptRequest()
                    : JsonConvert.DeserializeObject<DemoPaymentAcceptRequest>(body) ?? new DemoPaymentAcceptRequest();
            }
            catch (JsonException ex)
            {
                logger.LogWarning(ex, "Demo payment acceptance request contained invalid JSON. OrderID: {OrderID}; PaymentID: {PaymentID}", orderID, paymentID);
                return new BadRequestObjectResult(new DemoPaymentErrorResponse("InvalidJson", "Request body must be valid JSON."));
            }

            if (string.IsNullOrWhiteSpace(request.PaymentMethod) || !SupportedPaymentMethods.Contains(request.PaymentMethod))
            {
                return new BadRequestObjectResult(new DemoPaymentErrorResponse("UnsupportedPaymentMethod", "Demo payment acceptance supports only CreditCard and PurchaseOrder."));
            }

            OrderWorksheet worksheet;
            Payment payment;

            try
            {
                worksheet = await oc.IntegrationEvents.GetWorksheetAsync(OrderDirection.All, orderID);
                payment = await oc.Payments.GetAsync(OrderDirection.All, orderID, paymentID);
            }
            catch (OrderCloudException ex)
            {
                logger.LogWarning(ex, "Demo payment lookup failed in OrderCloud. OrderID: {OrderID}; PaymentID: {PaymentID}", orderID, paymentID);
                return new NotFoundObjectResult(new DemoPaymentErrorResponse("PaymentNotFound", "Payment was not found for the supplied order."));
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Demo payment lookup failed. OrderID: {OrderID}; PaymentID: {PaymentID}", orderID, paymentID);
                return new NotFoundObjectResult(new DemoPaymentErrorResponse("PaymentNotFound", "Payment was not found for the supplied order."));
            }

            if (worksheet?.Order?.ID != orderID || payment?.ID != paymentID)
            {
                return new NotFoundObjectResult(new DemoPaymentErrorResponse("PaymentNotFound", "Payment was not found for the supplied order."));
            }

            var isDemoPayment = payment.xp?.DemoPayment == true
                || payment.ID.StartsWith("BRISTAN-DEMO-", StringComparison.OrdinalIgnoreCase)
                || payment.ID.Equals("BRISTAN-ACCOUNT-ON-FILE", StringComparison.OrdinalIgnoreCase);

            if (!isDemoPayment)
            {
                logger.LogWarning("Rejected non-demo payment acceptance request. OrderID: {OrderID}; PaymentID: {PaymentID}; Type: {PaymentType}", orderID, paymentID, payment.Type);
                return new BadRequestObjectResult(new DemoPaymentErrorResponse("NotDemoPayment", "Only demo checkout payments can be accepted by this endpoint."));
            }

            if (!Enum.TryParse<PaymentType>(request.PaymentMethod, ignoreCase: true, out var requestedPaymentType)
                || payment.Type != requestedPaymentType)
            {
                return new BadRequestObjectResult(new DemoPaymentErrorResponse("PaymentMethodMismatch", "Payment method does not match the OrderCloud payment type."));
            }

            var buyerUsername = worksheet.Order.FromUser?.Username;
            var buyerID = worksheet.Order.FromCompanyID;

            if (requestedPaymentType == PaymentType.PurchaseOrder && !AccountOnFileUsernames.Contains(buyerUsername ?? string.Empty))
            {
                logger.LogWarning(
                    "Rejected account-on-file demo payment for ineligible buyer. OrderID: {OrderID}; PaymentID: {PaymentID}; BuyerID: {BuyerID}; BuyerUsername: {BuyerUsername}",
                    orderID,
                    paymentID,
                    buyerID,
                    buyerUsername);
                return new BadRequestObjectResult(new DemoPaymentErrorResponse("AccountOnFileUnavailable", "Pay by account on file is not available for this buyer."));
            }

            var amount = worksheet.Order.Total;
            var alreadyAccepted = payment.Accepted == true;
            logger.LogInformation(
                "Demo payment acceptance requested. OrderID: {OrderID}; PaymentID: {PaymentID}; PaymentType: {PaymentType}; Amount: {Amount}; AlreadyAccepted: {AlreadyAccepted}; BuyerID: {BuyerID}; BuyerUsername: {BuyerUsername}",
                orderID,
                paymentID,
                payment.Type,
                amount,
                alreadyAccepted,
                buyerID,
                buyerUsername);

            if (alreadyAccepted)
            {
                return new OkObjectResult(new DemoPaymentAcceptResponse(payment, true));
            }

            try
            {
                var acceptedPayment = string.Equals(request.PaymentMethod, "CreditCard", StringComparison.OrdinalIgnoreCase)
                    ? await paymentCommand.AuthorizeCardPaymentAsync(orderID, paymentID)
                    : await paymentCommand.AcceptPurchaseOrderPaymentAsync(orderID, paymentID);

                return new OkObjectResult(new DemoPaymentAcceptResponse(acceptedPayment, false));
            }
            catch (OrderCloudException ex)
            {
                logger.LogWarning(
                    ex,
                    "OrderCloud rejected demo payment acceptance. OrderID: {OrderID}; PaymentID: {PaymentID}; PaymentType: {PaymentType}; BuyerID: {BuyerID}; BuyerUsername: {BuyerUsername}",
                    orderID,
                    paymentID,
                    payment.Type,
                    buyerID,
                    buyerUsername);
                return new BadRequestObjectResult(new DemoPaymentErrorResponse("OrderCloudPaymentRejected", "OrderCloud rejected the demo payment update. Please verify the payment details and try again."));
            }
            catch (Exception ex)
            {
                logger.LogError(
                    ex,
                    "Demo payment acceptance failed. OrderID: {OrderID}; PaymentID: {PaymentID}; PaymentType: {PaymentType}; BuyerID: {BuyerID}; BuyerUsername: {BuyerUsername}",
                    orderID,
                    paymentID,
                    payment.Type,
                    buyerID,
                    buyerUsername);
                return new BadRequestObjectResult(new DemoPaymentErrorResponse("DemoPaymentAcceptFailed", "Demo payment could not be accepted. Please verify the payment details and try again."));
            }
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

    public record DemoPaymentErrorResponse(string Code, string Message);
}
