import { Address } from "ordercloud-javascript-sdk";
import {
  DEMO_CARD_CVV,
  DEMO_CARD_NUMBER,
  DemoPaymentFormData,
} from "../demoPayment";
import {
  DemoGeneratedCustomerData,
  DemoOrderImportGroupedOrder,
  DemoOrderImportNormalizedRow,
} from "./types";

const value = (input?: string) => input?.trim() || undefined;

export const sanitizeEmailToken = (input: string) =>
  input
    .toLowerCase()
    .replace(/[^a-z0-9._+-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "order";

export const getFutureDemoExpiration = (now = new Date()) => {
  const expirationDate = new Date(
    Date.UTC(now.getUTCFullYear() + 1, now.getUTCMonth(), 1),
  );
  return {
    expirationMonth: expirationDate.getUTCMonth() + 1,
    expirationYear: expirationDate.getUTCFullYear(),
  };
};

export const getDemoPhone = (orderIndex: number) => {
  const suffix = String((orderIndex % 10000) + 1).padStart(4, "0");
  return `312555${suffix}`;
};

export const buildDemoShippingAddress = (
  order: DemoOrderImportGroupedOrder,
): Address => {
  const firstRow: DemoOrderImportNormalizedRow | undefined = order.rows[0];
  const externalSuffix = order.externalOrderID.slice(-12);

  return {
    FirstName: value(firstRow?.ShipFirstName) || "Demo",
    LastName:
      value(firstRow?.ShipLastName) ||
      `Shopper ${externalSuffix || order.orderIndex + 1}`,
    CompanyName: "Demo Import Order",
    Street1: value(firstRow?.ShipStreet1) || "123 Demo Way",
    Street2: value(firstRow?.ShipStreet2) || `Suite ${order.orderIndex + 1}`,
    City: value(firstRow?.ShipCity) || "Chicago",
    State: value(firstRow?.ShipState) || "Illinois",
    Zip: value(firstRow?.ShipZip) || "60601",
    Country: value(firstRow?.ShipCountry) || "US",
    Phone: value(firstRow?.ShipPhone) || getDemoPhone(order.orderIndex),
  };
};

export const buildDemoPaymentData = (
  order: DemoOrderImportGroupedOrder,
  shippingAddress: Address,
  now = new Date(),
): DemoPaymentFormData => {
  const firstRow = order.rows[0];
  const { expirationMonth, expirationYear } = getFutureDemoExpiration(now);
  const cardholderName =
    `${shippingAddress.FirstName || "Demo"} ${shippingAddress.LastName || "Shopper"}`.trim();

  return {
    nameOnCard: cardholderName,
    cardNumber: DEMO_CARD_NUMBER,
    expirationMonth,
    expirationYear,
    cvv: DEMO_CARD_CVV,
    billingZip: value(firstRow?.BillingZip) || shippingAddress.Zip || "60601",
  };
};

export const buildDemoCustomerData = (
  order: DemoOrderImportGroupedOrder,
  now = new Date(),
): DemoGeneratedCustomerData => {
  const shippingAddress = buildDemoShippingAddress(order);
  const firstRow = order.rows[0];
  const email =
    value(firstRow?.CustomerEmail) ||
    `demo+${sanitizeEmailToken(order.externalOrderID)}@example.com`;

  return {
    email,
    shippingAddress,
    payment: buildDemoPaymentData(order, shippingAddress, now),
  };
};
