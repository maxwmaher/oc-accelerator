import { OrderWorksheet, ShipMethod } from "ordercloud-javascript-sdk";

export interface DemoShipEstimate {
  ID: string;
  ShipMethods: ShipMethod[];
  xp?: { demoShippingFallback?: boolean };
}

export const isMissingShipEstimates = (worksheet?: OrderWorksheet) => {
  const response = worksheet?.ShipEstimateResponse;
  return Boolean(
    !response ||
      response.Succeeded === false ||
      response.HttpStatusCode === 404 ||
      !response.ShipEstimates ||
      response.ShipEstimates.length === 0
  );
};

/**
 * DEMO ONLY:
 * Build realistic fallback shipping estimates when OrderCloud estimation does not return usable methods.
 */
export const getDemoFallbackShipEstimates = (orderID?: string): DemoShipEstimate[] => {
  const prefix = orderID || "DEMO_ORDER";
  return [
    {
      ID: `${prefix}_DEMO_ESTIMATE_1`,
      xp: { demoShippingFallback: true },
      ShipMethods: [
        {
          ID: `${prefix}_DEMO_STANDARD`,
          Name: "Standard Freight",
          EstimatedTransitDays: 6,
          xp: { demoLabel: "5–7 days" },
          Cost: 24.95,
        } as ShipMethod,
        {
          ID: `${prefix}_DEMO_EXPEDITED`,
          Name: "Expedited Freight",
          EstimatedTransitDays: 3,
          Cost: 59.95,
          xp: { demoLabel: "2–3 days" },
        } as ShipMethod,
        {
          ID: `${prefix}_DEMO_PRIORITY`,
          Name: "Priority Dispatch",
          EstimatedTransitDays: 1,
          Cost: 119.95,
          xp: { demoLabel: "Next day" },
        } as ShipMethod,
      ],
    },
  ];
};
