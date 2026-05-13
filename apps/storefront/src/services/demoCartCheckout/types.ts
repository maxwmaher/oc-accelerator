import {
  Address,
  BuyerProduct,
  InventoryRecord,
  LineItem,
  Order,
  Payment,
  ShipEstimateResponse,
} from "ordercloud-javascript-sdk";
import { DemoPaymentFormData, DemoPaymentXp } from "../demoPayment";

export type DemoShippingMatchStatus = "MATCHED" | "FALLBACK_CHEAPEST";

export type DemoPreferredShippingMethod = {
  ShipMethodID?: string;
  ShipMethodName?: string;
  Cost?: number;
  EstimatedTransitDays?: number;
  xp?: Record<string, unknown>;
};

export type DemoSelectedShippingMethod = {
  ShipEstimateID: string;
  ShipMethodID: string;
  ShipMethodName: string;
  Cost: number;
  EstimatedTransitDays?: number;
  matchStatus: DemoShippingMatchStatus;
  fallbackReason?: string;
};

export type DemoCartCheckoutFailureStage =
  | "VALIDATION"
  | "CLEAN_CART"
  | "SELLER_CONTEXT"
  | "PRODUCT_VALIDATION"
  | "INVENTORY_RESOLUTION"
  | "ADD_LINE_ITEM"
  | "SHIPPING_ADDRESS"
  | "ESTIMATE_SHIPPING"
  | "NO_SHIPPING_RATES"
  | "SELECT_SHIPPING"
  | "CALCULATE_ORDER"
  | "CREATE_PAYMENT"
  | "VERIFY_PAYMENT"
  | "ACCEPT_PAYMENT"
  | "SUBMIT_ORDER"
  | "CLEANUP";

export type DemoCartCheckoutError = {
  stage: DemoCartCheckoutFailureStage;
  message: string;
  lineID?: string;
  lineNumber?: number;
  productID?: string;
  cause?: unknown;
};

export type DemoCartCheckoutLineInput = {
  lineID?: string;
  lineNumber?: number;
  ProductID: string;
  Quantity: number;
  InventoryRecordID?: string;
  Specs?: LineItem["Specs"];
  xp?: Record<string, unknown>;
};

export type DemoCartCheckoutLineResult = {
  lineID?: string;
  lineNumber?: number;
  productID: string;
  quantity: number;
  status: "SUCCESS" | "FAILED";
  lineItemID?: string;
  inventoryRecordID?: string;
  productName?: string;
  error?: DemoCartCheckoutError;
};

export type DemoCartCheckoutInput = {
  referenceID: string;
  sellerID?: string;
  lines: DemoCartCheckoutLineInput[];
  shippingAddress: Address;
  payment: DemoPaymentFormData;
  preferredShippingMethod?: DemoPreferredShippingMethod;
  orderXp?: Record<string, unknown>;
};

export type DemoCartCheckoutPaymentStatus =
  | "NOT_CREATED"
  | "CREATED"
  | "VERIFIED"
  | "ACCEPTED";

export type DemoCartCheckoutSubmitStatus = "NOT_SUBMITTED" | "SUBMITTED";
export type DemoCartCheckoutCleanupStatus = "NOT_ATTEMPTED" | "SUCCEEDED" | "FAILED";

export type DemoCartCheckoutResult = {
  referenceID: string;
  status: "SUCCESS" | "FAILED";
  orderID?: string;
  submittedOrderID?: string;
  sellerID?: string;
  startedAt: string;
  completedAt: string;
  shipping?: DemoSelectedShippingMethod;
  total?: number;
  paymentStatus: DemoCartCheckoutPaymentStatus;
  submitStatus: DemoCartCheckoutSubmitStatus;
  failureStage?: DemoCartCheckoutFailureStage;
  cleanupStatus: DemoCartCheckoutCleanupStatus;
  lineResults: DemoCartCheckoutLineResult[];
  errors: DemoCartCheckoutError[];
};

export type DemoCartCheckoutApi = {
  cleanCart: () => Promise<void>;
  setSellerContext: (sellerID: string) => Promise<unknown>;
  getProduct: (productID: string, sellerID?: string) => Promise<BuyerProduct>;
  resolveInventoryRecord: (
    productID: string,
    quantity: number,
    requestedInventoryRecordID?: string,
  ) => Promise<InventoryRecord | undefined>;
  createLineItem: (lineItem: LineItem) => Promise<LineItem>;
  setShippingAddress: (address: Address) => Promise<Order>;
  estimateShipping: () => Promise<{
    ShipEstimateResponse?: ShipEstimateResponse;
    Order?: Order;
  }>;
  selectShipMethod: (selection: DemoSelectedShippingMethod) => Promise<unknown>;
  calculateOrder: () => Promise<{
    Order?: Order;
    ShipEstimateResponse?: ShipEstimateResponse;
  }>;
  listPayments: (orderID: string) => Promise<Payment<DemoPaymentXp>[]>;
  createOrPatchPayment: (
    order: Order,
    payment: Payment<DemoPaymentXp>,
    existingPayment?: Payment<DemoPaymentXp> | null,
  ) => Promise<Payment<DemoPaymentXp>>;
  verifyPayment: (
    orderID: string,
    paymentID: string,
  ) => Promise<Payment<DemoPaymentXp>>;
  acceptPayment: (
    orderID: string,
    paymentID: string,
    amount: number,
  ) => Promise<Payment<DemoPaymentXp>>;
  submitCart: () => Promise<Order>;
};
