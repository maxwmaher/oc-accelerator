using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using OrderCloud.Catalyst;
using OrderCloud.SDK;

namespace Accelerator.Commands
{
    public class PaymentCommand(ICreditCardProcessor creditCardProcessor, ICreditCardSaver creditCardSaver, IOrderCloudClient oc, ILogger<PaymentCommand> logger)
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

            object? paymentXp = payment?.xp;
            var safeCardDetails = GetDynamicValue(paymentXp, "SafeCardDetails");
            var savedCardID = GetDynamicString(safeCardDetails, "SavedCardID");
            var token = GetDynamicString(safeCardDetails, "Token");
            var payWithSavedCard = !string.IsNullOrWhiteSpace(savedCardID);

            if (payWithSavedCard)
            {
                authorizeRequest.CardDetails.SavedCardID = savedCardID;

                object? fromUserXp = worksheet.Order.FromUser?.xp;
                var processorCustomerID = GetDynamicString(fromUserXp, "PaymentProcessorCustomerID");
                if (!string.IsNullOrWhiteSpace(processorCustomerID))
                {
                    authorizeRequest.ProcessorCustomerID = processorCustomerID;
                }
            }
            else
            {
                authorizeRequest.CardDetails.Token = token ?? $"BRISTAN-DEMO-TOKEN-{paymentID}";
            }

            CCTransactionResult authorizationResult = await creditCardProcessor.AuthorizeOnlyAsync(authorizeRequest);

            Require.That(
                authorizationResult.Succeeded,
                new ErrorCode("Payment.AuthorizeDidNotSucceed", authorizationResult.Message),
                authorizationResult);

            await oc.Payments.PatchAsync<Payment>(
                OrderDirection.All,
                worksheet.Order.ID,
                payment.ID,
                new PartialPayment
                {
                    Accepted = true,
                    Amount = authorizeRequest.Amount
                });

            var updatedPayment = await oc.Payments.CreateTransactionAsync<Payment>(
                OrderDirection.All,
                worksheet.Order.ID,
                payment.ID,
                new PaymentTransaction()
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
                        DemoPayment = true,
                        PaymentMethodLabel = "Pay by credit card",
                        TransactionDetails = authorizationResult,
                    }
                });

            return updatedPayment;
        }

        public async Task<Payment> AcceptPurchaseOrderPaymentAsync(string orderID, string paymentID)
        {
            var worksheet = await oc.IntegrationEvents.GetWorksheetAsync(OrderDirection.All, orderID);
            var payment = await oc.Payments.GetAsync(OrderDirection.All, orderID, paymentID);

            Require.That(
                payment != null,
                new ErrorCode("Payment.NotFound", "Payment was not found for the supplied order."),
                new { orderID, paymentID });

            Require.That(
                payment.Type == PaymentType.PurchaseOrder,
                new ErrorCode(
                    "Payment.NotPurchaseOrder",
                    "Only PurchaseOrder demo payments can be accepted as account-on-file payments."),
                payment);

            var isExpectedDemoAccountOnFilePayment = payment.ID.Equals(DemoAccountReference, StringComparison.OrdinalIgnoreCase)
                && (payment.xp?.DemoPayment == true
                    || string.Equals(
                        GetDynamicString(payment.xp, "AccountReference"),
                        DemoAccountReference,
                        StringComparison.OrdinalIgnoreCase)
                    || string.Equals(
                        GetDynamicString(payment.xp, "PurchaseOrderNumber"),
                        DemoAccountReference,
                        StringComparison.OrdinalIgnoreCase));

            Require.That(
                isExpectedDemoAccountOnFilePayment,
                new ErrorCode(
                    "Payment.NotDemoAccountOnFile",
                    "Only the Bristan demo account-on-file payment can be accepted by this endpoint."),
                payment);

            if (payment.Accepted == true)
            {
                return payment;
            }

            var patchPayload = new Dictionary<string, object>
            {
                ["Accepted"] = true,
                ["xp"] = new Dictionary<string, object>
                {
                    ["DemoPayment"] = true,
                    ["PaymentMethodLabel"] = "Pay by account on file",
                    ["AccountReference"] = DemoAccountReference,
                    ["PurchaseOrderNumber"] = DemoAccountReference,
                },
            };

            logger.LogInformation(
                "Patching Bristan demo account-on-file payment. OrderID: {OrderID}; PaymentID: {PaymentID}; PatchPayloadKeys: {PatchPayloadKeys}; PatchXpKeys: {PatchXpKeys}",
                orderID,
                paymentID,
                string.Join(",", patchPayload.Keys),
                string.Join(",", ((Dictionary<string, object>)patchPayload["xp"]).Keys));

            return await oc.Payments.PatchAsync<Payment>(
                OrderDirection.All,
                worksheet.Order.ID,
                payment.ID,
                patchPayload);
        }

        private static string? GetDynamicString(object? source, string propertyName)
        {
            return GetDynamicValue(source, propertyName)?.ToString();
        }

        private static object? GetDynamicValue(object? source, string propertyName)
        {
            if (source == null)
            {
                return null;
            }

            if (source is IDictionary<string, object> dictionary)
            {
                return dictionary.TryGetValue(propertyName, out var value) ? value : null;
            }

            var property = source.GetType().GetProperty(
                propertyName,
                BindingFlags.Instance | BindingFlags.Public | BindingFlags.IgnoreCase);

            return property?.GetValue(source);
        }

        public async Task<string> GetIFrameCredentialsAsync()
        {
            return await creditCardProcessor.GetIFrameCredentialAsync();
        }
    }
}