using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Threading.Tasks;
using Accelerator.Mappers;
using OrderCloud.Catalyst;
using OrderCloud.SDK;

namespace Accelerator.Commands
{
    public class ShippingCommand(IShippingRatesCalculator shippingRatesCalculator, IOrderCloudClient oc)
    {
        public async Task<ShippingEstimateResult> EstimateShippingRatesAsync(OrderCheckoutIEPayload payload, bool useDemoSubtotalFallback = false)
        {
            var lineItems = payload?.OrderWorksheet?.LineItems ?? new List<LineItem>();
            var orderID = payload?.OrderWorksheet?.Order?.ID;
            var shipEstimateResponse = new ShipEstimateResponse()
            {
                Succeeded = true,
                HttpStatusCode = 200,
                ShipEstimates = new List<ShipEstimate>()
                {
                    new ()
                    {
                        ID = BuildEstimateID(orderID),
                        ShipEstimateItems = lineItems.Select(li => new ShipEstimateItem() {LineItemID = li.ID, Quantity = li.Quantity}).ToList(),
                    }
                }
            };

            var subtotalResult = CalculateSubtotal(payload);
            var demoMethods = BuildDemoShipMethods(subtotalResult.Subtotal);
            var demoFallbackUsed = useDemoSubtotalFallback;

            if (!useDemoSubtotalFallback)
            {
                try
                {
                    var packages = await ShippingMapper.MapToPackagesAsync(payload, shipEstimateResponse.ShipEstimates, oc);
                    var rates = await shippingRatesCalculator.CalculateShippingRatesAsync(packages);
                    if (HasUsableRates(rates, shipEstimateResponse.ShipEstimates.Count))
                    {
                        for (var i = 0; i < shipEstimateResponse.ShipEstimates.Count; i++)
                        {
                            shipEstimateResponse.ShipEstimates[i].ShipMethods = rates[i].Select(rate => new ShipMethod()
                            {
                                ID = rate.ID,
                                Name = rate.Name,
                                Cost = rate.Cost,
                                EstimatedTransitDays = rate.EstimatedTransitDays,
                            }).ToList();
                        }
                    }
                    else
                    {
                        demoFallbackUsed = true;
                    }
                }
                catch
                {
                    demoFallbackUsed = true;
                }
            }

            if (demoFallbackUsed)
            {
                foreach (var estimate in shipEstimateResponse.ShipEstimates)
                {
                    estimate.ShipMethods = demoMethods;
                }
            }

            return new ShippingEstimateResult(
                shipEstimateResponse,
                demoFallbackUsed,
                shipEstimateResponse.ShipEstimates.Sum(se => se.ShipMethods?.Count ?? 0),
                subtotalResult.SubtotalUnavailable);
        }

        private static string BuildEstimateID(string orderID)
        {
            return string.IsNullOrWhiteSpace(orderID) ? "estimate-shipping" : orderID;
        }

        private static bool HasUsableRates(List<List<ShippingRate>> rates, int expectedEstimateCount)
        {
            return rates != null
                && rates.Count >= expectedEstimateCount
                && rates.Take(expectedEstimateCount).All(group => group != null && group.Any());
        }

        private static List<ShipMethod> BuildDemoShipMethods(decimal subtotal)
        {
            return new List<ShipMethod>()
            {
                new ()
                {
                    ID = "standard",
                    Name = "Standard Shipping",
                    Cost = CalculatePercentageCost(subtotal, 0.05m),
                    EstimatedTransitDays = 7,
                },
                new ()
                {
                    ID = "expedited",
                    Name = "Expedited Shipping",
                    Cost = CalculatePercentageCost(subtotal, 0.10m),
                    EstimatedTransitDays = 3,
                },
                new ()
                {
                    ID = "one-day",
                    Name = "One-Day Shipping",
                    Cost = CalculatePercentageCost(subtotal, 0.20m),
                    EstimatedTransitDays = 1,
                },
            };
        }

        private static decimal CalculatePercentageCost(decimal subtotal, decimal percentage)
        {
            return Math.Round(subtotal * percentage, 2, MidpointRounding.AwayFromZero);
        }

        private sealed class SubtotalResult
        {
            public SubtotalResult(decimal subtotal, bool usedFallback)
            {
                Subtotal = subtotal;
                Value = subtotal;
                UsedFallback = usedFallback;
                UsedLineItemFallback = usedFallback;
                SubtotalUnavailable = usedFallback;
            }

            public decimal Subtotal { get; }
            public decimal Value { get; }
            public bool UsedFallback { get; }
            public bool UsedLineItemFallback { get; }
            public bool SubtotalUnavailable { get; }

            public void Deconstruct(out decimal subtotal, out bool usedFallback)
            {
                subtotal = Subtotal;
                usedFallback = UsedFallback;
            }
        }
        private static SubtotalResult CalculateSubtotal(OrderCheckoutIEPayload payload)
        {
            var orderSubtotal = GetDecimalValue(payload?.OrderWorksheet?.Order, "Subtotal");
            if (orderSubtotal.HasValue && orderSubtotal.Value >= 0)
            {
                return new SubtotalResult(orderSubtotal.Value, false);
            }

            var lineItems = payload?.OrderWorksheet?.LineItems ?? new List<LineItem>();
            var subtotal = 0m;
            var foundLineSubtotal = false;
            foreach (var lineItem in lineItems)
            {
                var lineTotal = GetFirstDecimalValue(lineItem, "LineTotal", "Subtotal", "Total");
                if (lineTotal.HasValue)
                {
                    subtotal += lineTotal.Value;
                    foundLineSubtotal = true;
                    continue;
                }

                var unitPrice = GetFirstDecimalValue(lineItem, "UnitPrice", "Price");
                if (unitPrice.HasValue)
                {
                    subtotal += unitPrice.Value * lineItem.Quantity;
                    foundLineSubtotal = true;
                }
            }

            return foundLineSubtotal ? new SubtotalResult(subtotal, false) : new SubtotalResult(0m, true);
        }

        private static decimal? GetFirstDecimalValue(object source, params string[] propertyNames)
        {
            foreach (var propertyName in propertyNames)
            {
                var value = GetDecimalValue(source, propertyName);
                if (value.HasValue)
                {
                    return value;
                }
            }
            return null;
        }

        private static decimal? GetDecimalValue(object source, string propertyName)
        {
            if (source == null)
            {
                return null;
            }

            var property = source.GetType().GetProperty(propertyName, BindingFlags.Instance | BindingFlags.Public | BindingFlags.IgnoreCase);
            if (property == null)
            {
                return null;
            }

            var value = property.GetValue(source);
            return value switch
            {
                decimal decimalValue => decimalValue,
                double doubleValue => Convert.ToDecimal(doubleValue),
                int intValue => intValue,
                _ => null,
            };
        }
    }

    public record ShippingEstimateResult(ShipEstimateResponse Response, bool DemoFallbackUsed, int ReturnedMethodCount, bool SubtotalUnavailable);
}
