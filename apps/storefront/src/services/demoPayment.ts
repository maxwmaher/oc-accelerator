import { Order, Payment, Payments } from "ordercloud-javascript-sdk";
import { getDemoAcceptPaymentUrl } from "../config/demoFunctions";

export type DemoPaymentFormData = {
  nameOnCard: string;
  cardNumber: string;
  expirationMonth: string | number;
  expirationYear: string | number;
  cvv?: string;
  billingZip: string;
};

export type DemoPaymentXp = {
  BillingZip?: string;
  CardType?: string;
  CardholderName?: string;
  DemoPayment?: boolean;
  ExpirationMonth?: number;
  ExpirationYear?: number;
  LastFour?: string;
};

export type DemoPayment = Payment<DemoPaymentXp>;

export type DemoPaymentSummary = {
  cardholderName: string;
  cardType: string;
  maskedCardNumber: string;
  expirationMonth: number;
  expirationYear: number;
  billingZip: string;
  amount: number;
};

export type DemoPaymentValidationErrors = Partial<
  Record<keyof DemoPaymentFormData, string>
>;

export const DEMO_CARD_NUMBER = "4111111111111111";
export const DEMO_CARD_CVV = "123";

export const amountsDiffer = (a?: number | null, b?: number | null) =>
  Math.abs((a ?? 0) - (b ?? 0)) > 0.0001;

export const parseDemoPaymentResponseBody = (responseText: string) => {
  if (!responseText) return null;
  try {
    return JSON.parse(responseText);
  } catch {
    return { message: responseText };
  }
};

export const getCardType = (cardNumber: string) => {
  if (/^4/.test(cardNumber)) return "Visa";
  if (/^5[1-5]/.test(cardNumber)) return "Mastercard";
  if (/^3[47]/.test(cardNumber)) return "AmericanExpress";
  if (/^6(?:011|5)/.test(cardNumber)) return "Discover";
  return "Unknown";
};

export const validateDemoPaymentForm = (
  formData: DemoPaymentFormData,
  now = new Date(),
): DemoPaymentValidationErrors => {
  const nextErrors: DemoPaymentValidationErrors = {};
  const sanitizedCard = formData.cardNumber.replace(/\s+/g, "");
  const month = Number(formData.expirationMonth);
  const year = Number(formData.expirationYear);
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth() + 1;

  if (!formData.nameOnCard.trim())
    nextErrors.nameOnCard = "Name on card is required";
  if (!/^\d{13,19}$/.test(sanitizedCard))
    nextErrors.cardNumber = "Card number must be 13-19 digits";
  if (!Number.isInteger(month) || month < 1 || month > 12)
    nextErrors.expirationMonth = "Use month 1-12";
  if (
    !Number.isInteger(year) ||
    year < currentYear ||
    year > currentYear + 20
  ) {
    nextErrors.expirationYear = "Enter a valid future year";
  } else if (month && year === currentYear && month < currentMonth) {
    nextErrors.expirationYear = "Expiration must be in the future";
  }
  if (!/^\d{3,4}$/.test(formData.cvv || "")) nextErrors.cvv = "CVV is required";
  if (!formData.billingZip.trim())
    nextErrors.billingZip = "Billing ZIP/postal code is required";

  return nextErrors;
};

export const buildDemoPaymentRequest = (
  formData: DemoPaymentFormData,
  amount: number,
): Payment<DemoPaymentXp> => {
  const sanitizedCard = formData.cardNumber.replace(/\s+/g, "");

  return {
    Type: "CreditCard",
    Amount: amount,
    xp: {
      CardholderName: formData.nameOnCard.trim(),
      CardType: getCardType(sanitizedCard),
      LastFour: sanitizedCard.slice(-4),
      ExpirationMonth: Number(formData.expirationMonth),
      ExpirationYear: Number(formData.expirationYear),
      BillingZip: formData.billingZip.trim(),
      DemoPayment: true,
    },
  };
};

export const buildDemoPaymentSummary = (
  payment: DemoPayment,
  fallbackAmount = 0,
): DemoPaymentSummary => {
  const xp = payment.xp || {};

  return {
    cardholderName: xp.CardholderName || "Cardholder",
    cardType: xp.CardType || "Credit Card",
    maskedCardNumber: `•••• •••• •••• ${xp.LastFour || "0000"}`,
    expirationMonth: Number(xp.ExpirationMonth) || 0,
    expirationYear: Number(xp.ExpirationYear) || 0,
    billingZip: xp.BillingZip || "N/A",
    amount: payment.Amount ?? fallbackAmount,
  };
};

export const acceptDemoPayment = async (
  orderID: string,
  paymentID: string,
  amount: number,
) => {
  const direction = "All";
  const endpoint = getDemoAcceptPaymentUrl();
  const method = "POST";
  const requestBody = { orderID, paymentID, direction, amount };

  const response = await fetch(endpoint, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  const responseText = await response.text();
  const responseBody = parseDemoPaymentResponseBody(responseText);

  if (!response.ok) {
    throw new Error(
      responseBody?.message ||
        responseBody?.error ||
        `Payment acceptance failed (${response.status})`,
    );
  }

  return responseBody as DemoPayment;
};

export const createOrPatchAndAcceptDemoPayment = async ({
  order,
  formData,
  amount,
  existingPayment,
}: {
  order: Order;
  formData: DemoPaymentFormData;
  amount: number;
  existingPayment?: DemoPayment | null;
}) => {
  if (!order.ID)
    throw new Error("Unable to create payment without an order ID.");

  const createdPaymentRequest = buildDemoPaymentRequest(formData, amount);
  const paymentToUse = existingPayment?.Accepted ? null : existingPayment;
  const workingPayment = paymentToUse?.ID
    ? await Payments.Patch<DemoPayment>(
        "Outgoing",
        order.ID,
        paymentToUse.ID,
        createdPaymentRequest,
      )
    : await Payments.Create<DemoPayment>(
        "Outgoing",
        order.ID,
        createdPaymentRequest,
      );

  if (!workingPayment?.ID)
    throw new Error("Payment was created or updated without an ID.");

  const paymentCheck = await Payments.Get<DemoPayment>(
    "Outgoing",
    order.ID,
    workingPayment.ID,
  );
  if (!paymentCheck?.ID)
    throw new Error("Unable to verify created payment before acceptance.");

  return acceptDemoPayment(order.ID, workingPayment.ID, amount);
};
