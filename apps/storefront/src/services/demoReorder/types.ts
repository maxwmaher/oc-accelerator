import { Address, LineItem, Order } from "ordercloud-javascript-sdk";
import {
  DemoCartCheckoutCleanupStatus,
  DemoCartCheckoutFailureStage,
  DemoCartCheckoutPaymentStatus,
  DemoCartCheckoutSubmitStatus,
  DemoPreferredShippingMethod,
  DemoSelectedShippingMethod,
} from "../demoCartCheckout";

export type DemoReorderValidationMessage = {
  stage: "SOURCE_ORDER" | "LINE" | "SHIPPING_ADDRESS" | "SHIPPING_METHOD";
  message: string;
  lineItemID?: string;
  productID?: string;
};

export type DemoReorderLinePreview = {
  sourceLineItemID?: string;
  productID?: string;
  productName?: string;
  quantity?: number;
  inventoryRecordID?: string;
  resolvedInventoryRecordID?: string;
  specs?: LineItem["Specs"];
  reorderable: boolean;
  validationMessage?: string;
};

export type DemoReorderSourceSummary = {
  orderID: string;
  dateSubmitted?: string;
  dateCreated?: string;
  status?: string;
  total?: number;
  toCompanyID?: string;
};

export type DemoReorderPreview = {
  sourceOrder: DemoReorderSourceSummary;
  lines: DemoReorderLinePreview[];
  shippingAddress?: Address;
  previousShippingMethod?: DemoPreferredShippingMethod;
  shippingStrategy: string;
  warnings: DemoReorderValidationMessage[];
  errors: DemoReorderValidationMessage[];
  canSubmit: boolean;
};

export type DemoReorderSubmitResult = {
  sourceOrderID: string;
  newSubmittedOrderID?: string;
  status: "SUCCESS" | "FAILED";
  selectedShippingMethod?: DemoSelectedShippingMethod;
  shippingMatchStatus?: DemoSelectedShippingMethod["matchStatus"];
  paymentStatus: DemoCartCheckoutPaymentStatus;
  submitStatus: DemoCartCheckoutSubmitStatus;
  failureStage?: DemoCartCheckoutFailureStage;
  cleanupStatus?: DemoCartCheckoutCleanupStatus;
  errors: DemoReorderValidationMessage[];
};

export type DemoReorderSourceData = {
  order: Order;
  lineItems: LineItem[];
  shippingAddress?: Address;
  previousShippingMethod?: DemoPreferredShippingMethod;
};
