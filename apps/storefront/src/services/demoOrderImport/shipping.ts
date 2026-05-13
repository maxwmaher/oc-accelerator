import { ShipEstimateResponse } from "ordercloud-javascript-sdk";
import { DemoSelectedShippingMethod } from "./types";

export class NoShippingRatesError extends Error {
  constructor(
    message = "No valid shipping methods were returned for this order.",
  ) {
    super(message);
    this.name = "NoShippingRatesError";
  }
}

export const chooseCheapestShippingMethod = (
  response?: ShipEstimateResponse | null,
): DemoSelectedShippingMethod => {
  const estimates = response?.ShipEstimates || [];
  const methods = estimates.flatMap((estimate) =>
    (estimate.ShipMethods || [])
      .filter(
        (method) =>
          estimate.ID &&
          method.ID &&
          typeof method.Cost === "number" &&
          Number.isFinite(method.Cost),
      )
      .map((method) => ({
        ShipEstimateID: estimate.ID as string,
        ShipMethodID: method.ID as string,
        ShipMethodName: method.Name || method.ID || "Shipping Method",
        Cost: method.Cost as number,
      })),
  );

  const cheapest = methods.sort((a, b) => a.Cost - b.Cost)[0];
  if (!cheapest) throw new NoShippingRatesError();
  return cheapest;
};
