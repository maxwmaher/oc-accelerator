using System.Threading.Tasks;
using OrderCloud.Catalyst;
using OrderCloud.SDK;

namespace Accelerator.Commands
{
    public class TaxCommand
    {
        public Task<OrderCalculateResponse> CalculateOrderAsync(OrderCheckoutIEPayload payload)
        {
            // KFMB pickup demo: tax integration is intentionally out of scope. Persist zero so
            // the OrderCloud worksheet and storefront agree; this is not a tax exemption policy.
            return Task.FromResult(new OrderCalculateResponse { TaxTotal = 0m });
        }
    }
}
