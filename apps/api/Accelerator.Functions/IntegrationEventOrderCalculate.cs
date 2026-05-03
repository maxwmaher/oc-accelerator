using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using System.Net;
using System.Text.Json;

namespace Accelerator.Functions;

public class IntegrationEventOrderCalculate(ILogger<IntegrationEventOrderCalculate> logger)
{
    private const string OrderCalculateDebugVersion = "ORDER_CALCULATE_DEBUG_2026_05_03";

    [Function("integrationevent_ordercalculate")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "integrationevent/ordercalculate")] HttpRequestData req)
    {
        logger.LogInformation("{DebugMessage}", "ORDER_CALCULATE_DEBUG_2026_05_03: integrationevent/ordercalculate handler entered.");

        var response = req.CreateResponse(HttpStatusCode.OK);
        response.Headers.Add("Content-Type", "application/json; charset=utf-8");
        response.Headers.Add("X-OrderCalculate-Debug-Version", OrderCalculateDebugVersion);

        var payload = new
        {
            ShippingTotal = 24.95,
            TaxTotal = 0,
            FeeTotal = 0,
            LineItemOverrides = Array.Empty<object>(),
            xp = new { }
        };

        await response.WriteStringAsync(JsonSerializer.Serialize(payload));
        return response;
    }
}
