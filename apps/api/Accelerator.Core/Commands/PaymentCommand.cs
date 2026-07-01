using System;
using System.Threading.Tasks;
using OrderCloud.Catalyst;
using OrderCloud.SDK;

namespace Accelerator.Commands
{
    public class PaymentCommand(ICreditCardProcessor creditCardProcessor, ICreditCardSaver creditCardSaver, IOrderCloudClient oc)
    {
        private const string DemoAccountReference = "BRISTAN-ACCOUNT-ON-FILE";

        public async Task<Payment> AuthorizeCardPaymentAsync(string orderID, string paymentID)
        {
            var worksheet = await oc.IntegrationEvents.GetWorksheetAsync(OrderDirection.All, orderID);
            var payment = await oc.Payments.GetAsync(OrderDirection.All, orderID, paymentID);
            var authorizeRequest = new AuthorizeCCTransaction()
            {
                OrderID = worksheet.Order.ID,
                Amount = worksheet.Order.Total,
                Currency = worksheet.Order.Currency,
                AddressVerification = worksheet.Order.BillingAddress,
                CustomerIPAddress = "...",
                CardDetails = new PCISafeCardDetails()
            };
            var payWithSavedCard = payment?.xp?.SafeCardDetails?.SavedCardID != null;
            if (payWithSavedCard)
            {
                authorizeRequest.CardDetails.SavedCardID = payment.xp.SafeCardDetails.SavedCardID;
                authorizeRequest.ProcessorCustomerID = worksheet.Order.FromUser.xp.PaymentProcessorCustomerID;
            }
            else
            {
                authorizeRequest.CardDetails.Token = payment?.xp?.SafeCardDetails?.Token;
            }

            CCTransactionResult authorizationResult = await creditCardProcessor.AuthorizeOnlyAsync(authorizeRequest);

            Require.That(authorizationResult.Succeeded, new ErrorCode("Payment.AuthorizeDidNotSucceed", authorizationResult.Message), authorizationResult);

            await oc.Payments.PatchAsync<Payment>(OrderDirection.All, worksheet.Order.ID, payment.ID, new PartialPayment { Accepted = true, Amount = authorizeRequest.Amount });
            var updatedPayment = await oc.Payments.CreateTransactionAsync<Payment>(OrderDirection.All, worksheet.Order.ID, payment.ID, new PaymentTransaction()
            {
                ID = authorizationResult.TransactionID,
                Amount = authorizeRequest.Amount,
                DateExecuted = DateTime.Now,
                ResultCode = authorizationResult.AuthorizationCode,
                ResultMessage = authorizationResult.Message,
                Succeeded = authorizationResult.Succeeded,
                Type = "Authorization",
                xp = new
                {
                    TransactionDetails = authorizationResult,
                }
            });
            return updatedPayment;
        }

        public async Task<Payment> AcceptPurchaseOrderPaymentAsync(string orderID, string paymentID)
        {
            var worksheet = await oc.IntegrationEvents.GetWorksheetAsync(OrderDirection.All, orderID);
            var payment = await oc.Payments.GetAsync(OrderDirection.All, orderID, paymentID);

            return await oc.Payments.PatchAsync<Payment>(OrderDirection.All, worksheet.Order.ID, payment.ID, new PartialPayment
            {
                Accepted = true,
                Amount = worksheet.Order.Total,
                Type = "PurchaseOrder",
                xp = new
                {
                    DemoPayment = true,
                    PaymentMethodLabel = "Pay by account on file",
                    AccountReference = DemoAccountReference,
                    PurchaseOrderNumber = DemoAccountReference,
                }
            });
        }

        public async Task<string> GetIFrameCredentialsAsync()
        {
            return await creditCardProcessor.GetIFrameCredentialAsync();
        }
    }
}
