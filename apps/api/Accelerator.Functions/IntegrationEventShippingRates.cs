using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using System.Net;
using System.Text.Json;

namespace Accelerator.Functions;

public class IntegrationEventShippingRates(ILogger<IntegrationEventShippingRates> logger)
{
    private const string ShippingDebugVersion = "SHIPPING_DEBUG_REAL_ROUTE_2026_05_03";

    [Function("integrationevent_shippingrates")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "integrationevent/shippingrates")] HttpRequestData req)
    {
        logger.LogInformation("{DebugMessage}", "SHIPPING_DEBUG_REAL_ROUTE_2026_05_03: integrationevent/shippingrates handler entered.");

        var response = req.CreateResponse(HttpStatusCode.OK);
        response.Headers.Add("Content-Type", "application/json; charset=utf-8");
        response.Headers.Add("X-Shipping-Debug-Version", ShippingDebugVersion);

        var payload = new
        {
            ShipEstimates = new[]
            {
                new
                {
                    ID = "demo-shipment",
                    SelectedShipMethodID = (string?)null,
                    ShipEstimateItems = Array.Empty<object>(),
                    ShipMethods = new[]
                    {
                        new { ID = "standard", Name = "Standard Shipping", Cost = 24.95, EstimatedTransitDays = 5, xp = new { } },
                        new { ID = "express", Name = "Express Shipping", Cost = 49.95, EstimatedTransitDays = 2, xp = new { } },
                    },
                    xp = new { }
                }
            },
            xp = new { }
        };

        await response.WriteStringAsync(JsonSerializer.Serialize(payload));
        return response;
    }
}
