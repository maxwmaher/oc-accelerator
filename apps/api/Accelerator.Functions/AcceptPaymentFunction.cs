using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
using OrderCloud.SDK;
using System.Net;

namespace Accelerator.Functions;

public class AcceptPaymentFunction(
    ILogger<AcceptPaymentFunction> logger,
    IOrderCloudClient oc,
    IConfiguration configuration)
{
    [Function("acceptpayment")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", "options", Route = "payments/accept")] HttpRequestData req)
    {
        logger.LogInformation("PAYMENT_ACCEPT_DEBUG_2026_05_12: payments/accept handler entered method={Method} url={Url}", req.Method, req.Url);

        if (string.Equals(req.Method, "OPTIONS", StringComparison.OrdinalIgnoreCase))
        {
            return await WriteJsonResponseAsync(req, HttpStatusCode.NoContent);
        }

        var body = await new StreamReader(req.Body).ReadToEndAsync();
        var request = JsonConvert.DeserializeObject<AcceptPaymentRequest>(body);
        var direction = ParseDirection(request?.Direction);

        try
        {
            if (request == null || string.IsNullOrWhiteSpace(request.OrderID) || string.IsNullOrWhiteSpace(request.PaymentID))
            {
                logger.LogWarning("Demo payment acceptance request missing orderID/paymentID direction={Direction} body={Body}", request?.Direction, body);
                return await WriteJsonResponseAsync(req, HttpStatusCode.BadRequest, new
                {
                    error = "Request body must include orderID and paymentID.",
                    receivedDirection = request?.Direction
                });
            }

            logger.LogInformation(
                "Demo payment acceptance request received order={OrderID} payment={PaymentID} direction={Direction}",
                request.OrderID,
                request.PaymentID,
                direction);

            var adminClient = CreateAdminOrderCloudClient();
            var hasClientId = !string.IsNullOrWhiteSpace(adminClient.Config.ClientId);
            var hasClientSecret = !string.IsNullOrWhiteSpace(adminClient.Config.ClientSecret);
            var hasApiUrl = !string.IsNullOrWhiteSpace(adminClient.Config.ApiUrl);
            var hasFullAccess = adminClient.Config.Roles?.Contains(ApiRole.FullAccess) == true;

            if (!hasClientId || !hasClientSecret || !hasApiUrl || !hasFullAccess)
            {
                logger.LogError(
                    "Demo payment elevated OrderCloud credential check failed clientIDPresent={ClientIDPresent} clientSecretPresent={ClientSecretPresent} apiUrlPresent={ApiUrlPresent} rolesIncludeFullAccess={RolesIncludeFullAccess}",
                    hasClientId,
                    hasClientSecret,
                    hasApiUrl,
                    hasFullAccess);

                return await WriteJsonResponseAsync(req, HttpStatusCode.InternalServerError, new
                {
                    error = "OrderCloud server-side credentials are not configured for payment acceptance.",
                    clientIDPresent = hasClientId,
                    clientSecretPresent = hasClientSecret,
                    apiUrlPresent = hasApiUrl,
                    rolesIncludeFullAccess = hasFullAccess
                });
            }

            logger.LogInformation("Demo payment elevated OrderCloud client configured successfully for payment acceptance.");

            var existingPayment = await adminClient.Payments.GetAsync<Payment>(direction, request.OrderID, request.PaymentID);
            if (existingPayment == null)
            {
                logger.LogWarning("Demo payment fetch returned null order={OrderID} payment={PaymentID} direction={Direction}", request.OrderID, request.PaymentID, direction);
                return await WriteJsonResponseAsync(req, HttpStatusCode.NotFound, new
                {
                    error = $"Payment '{request.PaymentID}' was not found for order '{request.OrderID}'.",
                    orderID = request.OrderID,
                    paymentID = request.PaymentID,
                    direction = direction.ToString()
                });
            }

            var latestOrder = await adminClient.Orders.GetAsync<Order>(direction, request.OrderID);
            var selectedPaymentAmount = request.Amount ?? latestOrder?.Total ?? existingPayment.Amount ?? 0m;
            var existingPaymentAmount = existingPayment.Amount ?? 0m;

            logger.LogInformation(
                "Demo payment before acceptance order={OrderID} payment={PaymentID} direction={Direction} accepted={Accepted} currentAmount={CurrentAmount} targetAmount={TargetAmount}",
                request.OrderID,
                request.PaymentID,
                direction,
                existingPayment.Accepted,
                existingPaymentAmount,
                selectedPaymentAmount);

            if (existingPayment.Accepted == true && existingPaymentAmount == selectedPaymentAmount)
            {
                logger.LogInformation("Demo payment already accepted order={OrderID} payment={PaymentID} direction={Direction}", request.OrderID, request.PaymentID, direction);
                return await WriteJsonResponseAsync(req, HttpStatusCode.OK, existingPayment);
            }

            if (existingPaymentAmount != selectedPaymentAmount)
            {
                logger.LogInformation(
                    "Demo payment amount correction order={OrderID} payment={PaymentID} direction={Direction} from={CurrentAmount} to={TargetAmount}",
                    request.OrderID,
                    request.PaymentID,
                    direction,
                    existingPaymentAmount,
                    selectedPaymentAmount);

                existingPayment = await adminClient.Payments.PatchAsync<Payment>(
                    direction,
                    request.OrderID,
                    request.PaymentID,
                    new PartialPayment { Amount = selectedPaymentAmount });
            }

            var acceptedPayment = await adminClient.Payments.PatchAsync<Payment>(
                direction,
                request.OrderID,
                request.PaymentID,
                new PartialPayment { Accepted = true, Amount = selectedPaymentAmount });

            logger.LogInformation(
                "Demo payment accepted response order={OrderID} payment={PaymentID} direction={Direction} accepted={Accepted} amount={Amount}",
                request.OrderID,
                request.PaymentID,
                direction,
                acceptedPayment.Accepted,
                acceptedPayment.Amount);

            return await WriteJsonResponseAsync(req, HttpStatusCode.OK, acceptedPayment);
        }
        catch (OrderCloudException ex)
        {
            logger.LogError(
                ex,
                "Demo payment OrderCloud error status={HttpStatus} message={Message} errors={Errors} order={OrderID} payment={PaymentID} direction={Direction}",
                ex.HttpStatus,
                ex.Message,
                ex.Errors != null ? JsonConvert.SerializeObject(ex.Errors) : null,
                request?.OrderID,
                request?.PaymentID,
                direction);

            return await WriteJsonResponseAsync(req, (HttpStatusCode)ex.HttpStatus, new
            {
                error = "OrderCloud payment accept failed.",
                status = ex.HttpStatus,
                message = ex.Message,
                errors = ex.Errors,
                orderID = request?.OrderID,
                paymentID = request?.PaymentID,
                direction = direction.ToString()
            });
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Demo payment unhandled error order={OrderID} payment={PaymentID} direction={Direction}", request?.OrderID, request?.PaymentID, direction);
            return await WriteJsonResponseAsync(req, HttpStatusCode.InternalServerError, new
            {
                error = "Internal server error during payment accept.",
                orderID = request?.OrderID,
                paymentID = request?.PaymentID,
                direction = direction.ToString()
            });
        }
    }

    private OrderCloudClient CreateAdminOrderCloudClient()
    {
        var config = oc.Config;
        var apiUrl = FirstNonEmpty("OrderCloudSettings:ApiUrl", "OrderCloudSettings__ApiUrl", "ApiUrl") ?? config.ApiUrl;
        var clientId = FirstNonEmpty(
            "OrderCloudSettings:MiddlewareClientID",
            "OrderCloudSettings__MiddlewareClientID",
            "OrderCloudSettings:ClientID",
            "OrderCloudSettings__ClientID",
            "ClientID") ?? config.ClientId;
        var clientSecret = FirstNonEmpty(
            "OrderCloudSettings:MiddlewareClientSecret",
            "OrderCloudSettings__MiddlewareClientSecret",
            "OrderCloudSettings:ClientSecret",
            "OrderCloudSettings__ClientSecret",
            "ClientSecret") ?? config.ClientSecret;
        var roles = ParseRoles(FirstNonEmpty("OrderCloudSettings:MiddlewareRoles", "OrderCloudSettings__MiddlewareRoles", "OrderCloudSettings:Roles", "OrderCloudSettings__Roles")) ?? config.Roles;

        return new OrderCloudClient(new OrderCloudClientConfig
        {
            ApiUrl = apiUrl,
            AuthUrl = apiUrl,
            ClientId = clientId,
            ClientSecret = clientSecret,
            Roles = roles
        });
    }

    private ApiRole[]? ParseRoles(string? rawRoles)
    {
        if (string.IsNullOrWhiteSpace(rawRoles)) return null;
        var roles = rawRoles
            .Split(new[] { ',', ' ' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(role => Enum.TryParse<ApiRole>(role, true, out var parsed) ? (ApiRole?)parsed : null)
            .Where(role => role.HasValue)
            .Select(role => role!.Value)
            .Distinct()
            .ToList();

        if (!roles.Contains(ApiRole.FullAccess))
        {
            roles.Add(ApiRole.FullAccess);
        }

        return roles.ToArray();
    }

    private string? FirstNonEmpty(params string[] keys)
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

    private static OrderDirection ParseDirection(string? rawDirection)
    {
        if (Enum.TryParse<OrderDirection>(rawDirection, true, out var parsed))
        {
            return parsed;
        }

        return OrderDirection.All;
    }

    private static async Task<HttpResponseData> WriteJsonResponseAsync(HttpRequestData req, HttpStatusCode statusCode, object? payload = null)
    {
        var response = req.CreateResponse(statusCode);
        AddCorsHeaders(response);
        if (payload != null)
        {
            response.Headers.Add("Content-Type", "application/json; charset=utf-8");
            await response.WriteStringAsync(JsonConvert.SerializeObject(payload));
        }

        return response;
    }

    private static void AddCorsHeaders(HttpResponseData response)
    {
        response.Headers.Add("Access-Control-Allow-Origin", "*");
        response.Headers.Add("Access-Control-Allow-Methods", "POST, OPTIONS");
        response.Headers.Add("Access-Control-Allow-Headers", "Content-Type, Authorization");
        response.Headers.Add("Access-Control-Max-Age", "86400");
    }

    private class AcceptPaymentRequest
    {
        [JsonProperty("orderID")]
        public string? OrderID { get; set; }

        [JsonProperty("paymentID")]
        public string? PaymentID { get; set; }

        [JsonProperty("direction")]
        public string? Direction { get; set; }

        [JsonProperty("amount")]
        public decimal? Amount { get; set; }
    }
}
