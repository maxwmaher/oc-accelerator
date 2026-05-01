using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using OrderCloud.Catalyst;

namespace Accelerator.MockServices
{
    public class ShippingServiceMock : IShippingRatesCalculator
    {
        public Task<List<List<ShippingRate>>> CalculateShippingRatesAsync(IEnumerable<ShippingPackage> shippingPackages, OCIntegrationConfig configOverride = null)
        {
            var packageCount = shippingPackages?.Count() ?? 0;
            var allRates = Enumerable.Range(0, Math.Max(1, packageCount)).Select(_ => new List<ShippingRate>
            {
                new()
                {
                    Cost = 34.95m,
                    EstimatedTransitDays = 1,
                    Carrier = "USPS",
                    ID = "MOCK_rate_f0fef73584ec4220b6358b7fbdda64e2",
                    Name = "Express Saver"
                },
                new()
                {
                    Cost = 24.95m,
                    EstimatedTransitDays = 3,
                    ID = "MOCK_rate_aef562aefcca4907944b55f152630af5",
                    Name = "Priority Ground"
                },
                new()
                {
                    Cost = 12.95m,
                    EstimatedTransitDays = 6,
                    ID = "MOCK_rate_cbc72eaa10ea4c6da0e8f55cc2aec106",
                    Name = "Economy Freight"
                }
            }).ToList();

            return Task.FromResult(allRates);
        }
    }
}
