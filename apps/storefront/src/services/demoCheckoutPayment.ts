import {
  Cart,
  OrderWorksheet,
  Payment,
  PaymentTransaction,
} from "ordercloud-javascript-sdk";

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
const ACCOUNT_TRANSACTION_ID = "BRISTAN-ACCOUNT-ON-FILE-AUTHORIZATION";

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

  return upsertDemoPayment({
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
};

export const prepareDemoAccountOnFilePayment = async (
  orderWorksheet: OrderWorksheet
) => {
  const amount = getOrderTotal(orderWorksheet);
  const payment = await upsertDemoPayment({
    ID: ACCOUNT_PAYMENT_ID,
    Type: "PurchaseOrder",
    Amount: amount,
    Accepted: true,
    Description: "Pay by account on file",
    xp: {
      DemoPayment: true,
      PaymentMethodLabel: "Pay by account on file",
      PurchaseOrderNumber: ACCOUNT_PAYMENT_ID,
      AccountReference: ACCOUNT_PAYMENT_ID,
    },
  });

  const hasAccountTransaction = payment.Transactions?.some(
    (transaction) => transaction.ID === ACCOUNT_TRANSACTION_ID
  );

  if (!hasAccountTransaction && payment.ID) {
    // Verified in the installed SDK typings: Cart.CreatePaymentTransaction is exposed
    // to shoppers and accepts PaymentTransaction for cart payments, including PurchaseOrder.
    return Cart.CreatePaymentTransaction<Payment<DemoPaymentXp>>(payment.ID, {
      ID: ACCOUNT_TRANSACTION_ID,
      Type: "Authorization",
      DateExecuted: new Date().toISOString(),
      Amount: amount,
      Succeeded: true,
      ResultCode: "BRISTAN_ACCOUNT_APPROVED",
      ResultMessage: "Account on file approved for invoice payment.",
      xp: {
        DemoPayment: true,
        PaymentMethodLabel: "Pay by account on file",
      },
    } satisfies PaymentTransaction);
  }

  return payment;
};
