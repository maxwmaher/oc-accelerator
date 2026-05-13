import {
  Address,
  IntegrationEvents,
  LineItem,
  LineItems,
  Me,
  Orders,
  OrderWorksheet,
  ShipEstimateResponse,
} from "ordercloud-javascript-sdk";
import { DemoPreferredShippingMethod } from "../demoCartCheckout";
import { DemoReorderSourceData } from "./types";

const getSelectedShippingMethod = (
  response?: ShipEstimateResponse,
): DemoPreferredShippingMethod | undefined => {
  const estimates = response?.ShipEstimates || [];
  for (const estimate of estimates) {
    const selectedID = estimate.SelectedShipMethodID;
    const method = selectedID
      ? estimate.ShipMethods?.find((shipMethod) => shipMethod.ID === selectedID)
      : estimate.ShipMethods?.[0];
    if (method?.ID) {
      return {
        ShipMethodID: method.ID,
        ShipMethodName: method.Name,
        Cost: method.Cost,
        EstimatedTransitDays: method.EstimatedTransitDays,
        xp: method.xp as Record<string, unknown> | undefined,
      };
    }
  }
  return undefined;
};

const getLineShippingAddress = (lineItems: LineItem[]): Address | undefined =>
  lineItems.find((line) => line.ShippingAddress)?.ShippingAddress;

export const isSubmittedOrder = (status?: string, isSubmitted?: boolean) =>
  Boolean(isSubmitted) || (status || "").toLowerCase() === "submitted";

export const loadDemoReorderSource = async (
  orderID: string,
): Promise<DemoReorderSourceData> => {
  const order = await Orders.Get("Outgoing", orderID);
  const lineResponse = await LineItems.List("Outgoing", orderID, {
    pageSize: 100,
  });
  const lineItems = lineResponse.Items || [];

  let worksheet: OrderWorksheet | undefined;
  try {
    worksheet = await IntegrationEvents.GetWorksheet("Outgoing", orderID);
  } catch (error) {
    console.warn(`Unable to load worksheet for reorder source ${orderID}`, error);
  }

  let shippingAddress: Address | undefined;
  if (order.ShippingAddressID) {
    try {
      shippingAddress = await Me.GetAddress(order.ShippingAddressID);
    } catch (error) {
      console.warn(
        `Unable to load source shipping address ${order.ShippingAddressID}`,
        error,
      );
    }
  }

  shippingAddress =
    shippingAddress ||
    getLineShippingAddress(worksheet?.LineItems || []) ||
    getLineShippingAddress(lineItems);

  return {
    order,
    lineItems,
    shippingAddress,
    previousShippingMethod: getSelectedShippingMethod(
      worksheet?.ShipEstimateResponse,
    ),
  };
};
