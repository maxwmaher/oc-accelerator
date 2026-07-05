import { Cart, OrderWorksheet, Payment } from "ordercloud-javascript-sdk";

export type DemoPaymentMethod = "credit-card" | "account-on-file";

export type DemoCreditCardForm = {
  cardholderName: string;
  cardNumber: string;
  expiration: string;
  cvv: string;
  billingZip: string;
};

type DemoPaymentXp = {
  DemoPayment: true;
  PaymentMethodLabel: string;
  SafeCardDetails?: {
    Token: string;
    Last4: string;
    CardType: string;
    ExpirationMonth: string;
    ExpirationYear: string;
  };
  Last4?: string;
  CardType?: string;
  ExpirationMonth?: string;
  ExpirationYear?: string;
  PurchaseOrderNumber?: string;
  AccountReference?: string;
};

const CREDIT_CARD_PAYMENT_ID = "BRISTAN-DEMO-CREDIT-CARD";
const ACCOUNT_PAYMENT_ID = "BRISTAN-ACCOUNT-ON-FILE";

const FUNCTIONS_BASE_URL = (
  import.meta.env.VITE_APP_FUNCTIONS_BASE_URL || ""
).replace(/\/$/, "");

type DemoPaymentAcceptResponse = {
  Payment: Payment<DemoPaymentXp>;
  AlreadyAccepted: boolean;
};

const getFunctionsBaseUrl = () => {
  if (FUNCTIONS_BASE_URL) return FUNCTIONS_BASE_URL;
  if (import.meta.env.DEV) return "http://localhost:7071/api";
  throw new Error(
    "Payment authorization is not configured. Please set VITE_APP_FUNCTIONS_BASE_URL."
  );
};

const acceptDemoPayment = async (
  orderID: string,
  payment: Payment<DemoPaymentXp>,
  paymentMethod: "CreditCard" | "PurchaseOrder",
  metadata: { cardholderName?: string; last4?: string; brand?: string } = {}
) => {
  if (!payment.ID) throw new Error("Payment could not be created for this order.");

  const response = await fetch(
    `${getFunctionsBaseUrl()}/demo/payments/${encodeURIComponent(
      orderID
    )}/${encodeURIComponent(payment.ID)}/accept`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentMethod,
        cardholderName: metadata.cardholderName,
        last4: metadata.last4,
        brand: metadata.brand,
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      errorText ||
        "We could not authorize your selected payment method. Please review your payment details and try again."
    );
  }

  const result = (await response.json()) as DemoPaymentAcceptResponse;
  return result.Payment;
};

const digitsOnly = (value: string) => value.replace(/\D/g, "");

const getOrderTotal = (orderWorksheet: OrderWorksheet): number => {
  const total = orderWorksheet.Order?.Total;
  if (typeof total !== "number") {
    throw new Error(
      "Order total is not available yet. Please review shipping and tax before payment."
    );
  }
  return total;
};

const findReusableDemoPayment = async (paymentID: string) => {
  const payments = await Cart.ListPayments<Payment<DemoPaymentXp>>();
  return payments.Items.find(
    (payment) => payment.ID === paymentID || payment.xp?.DemoPayment === true
  );
};

const upsertDemoPayment = async (payment: Payment<DemoPaymentXp>) => {
  const existingPayment = await findReusableDemoPayment(payment.ID ?? "");

  if (existingPayment?.ID) {
    if (existingPayment.Type === payment.Type) {
      return Cart.PatchPayment<Payment<DemoPaymentXp>>(existingPayment.ID, payment);
    }

    await Cart.DeletePayment(existingPayment.ID);
  }

  return Cart.CreatePayment<Payment<DemoPaymentXp>>(payment);
};

export const validateDemoCreditCard = (card: DemoCreditCardForm): string[] => {
  const errors: string[] = [];
  const cardNumber = digitsOnly(card.cardNumber);
  const expiration = card.expiration.trim();
  const [month, year] = expiration.split("/").map((part) => part.trim());

  if (!card.cardholderName.trim()) errors.push("Enter the cardholder name.");
  if (cardNumber.length < 13 || cardNumber.length > 19) {
    errors.push("Enter a valid card number.");
  }
  if (
    !month ||
    !year ||
    Number(month) < 1 ||
    Number(month) > 12 ||
    !/^\d{2,4}$/.test(year)
  ) {
    errors.push("Enter an expiration date as MM/YY.");
  }
  if (!/^\d{3,4}$/.test(card.cvv.trim())) errors.push("Enter a valid CVV.");
  if (!/^\d{5}(-\d{4})?$/.test(card.billingZip.trim())) {
    errors.push("Enter a valid billing ZIP.");
  }

  return errors;
};

export const prepareDemoCreditCardPayment = async (
  orderWorksheet: OrderWorksheet,
  card: DemoCreditCardForm
) => {
  const errors = validateDemoCreditCard(card);
  if (errors.length) throw new Error(errors[0]);

  const cardNumber = digitsOnly(card.cardNumber);
  const [expirationMonth, expirationYearInput] = card.expiration
    .trim()
    .split("/")
    .map((part) => part.trim());
  const expirationYear =
    expirationYearInput.length === 2 ? `20${expirationYearInput}` : expirationYearInput;
  const last4 = cardNumber.slice(-4);
  const cardType = cardNumber.startsWith("4") ? "Visa" : "Demo Card";

  const payment = await upsertDemoPayment({
    ID: CREDIT_CARD_PAYMENT_ID,
    Type: "CreditCard",
    Amount: getOrderTotal(orderWorksheet),
    Accepted: false,
    Description: "Pay by credit card",
    xp: {
      DemoPayment: true,
      PaymentMethodLabel: "Pay by credit card",
      SafeCardDetails: {
        Token: `BRISTAN-DEMO-TOKEN-${last4}`,
        Last4: last4,
        CardType: cardType,
        ExpirationMonth: expirationMonth,
        ExpirationYear: expirationYear,
      },
      Last4: last4,
      CardType: cardType,
      ExpirationMonth: expirationMonth,
      ExpirationYear: expirationYear,
    },
  });

  return acceptDemoPayment(orderWorksheet.Order!.ID!, payment, "CreditCard", {
    cardholderName: card.cardholderName.trim(),
    last4,
    brand: cardType,
  });
};

export const prepareDemoAccountOnFilePayment = async (
  orderWorksheet: OrderWorksheet
) => {
  const amount = getOrderTotal(orderWorksheet);
  const payment = await upsertDemoPayment({
    ID: ACCOUNT_PAYMENT_ID,
    Type: "PurchaseOrder",
    Amount: amount,
    Accepted: false,
    Description: "Pay by account on file",
    xp: {
      DemoPayment: true,
      PaymentMethodLabel: "Pay by account on file",
      PurchaseOrderNumber: ACCOUNT_PAYMENT_ID,
      AccountReference: ACCOUNT_PAYMENT_ID,
    },
  });

  return acceptDemoPayment(orderWorksheet.Order!.ID!, payment, "PurchaseOrder");
};
