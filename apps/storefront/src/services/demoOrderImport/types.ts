import {
  Address,
  BuyerProduct,
  InventoryRecord,
} from "ordercloud-javascript-sdk";
import { DemoPaymentFormData } from "../demoPayment";
import {
  DemoCartCheckoutApi,
  DemoCartCheckoutFailureStage,
  DemoSelectedShippingMethod,
} from "../demoCartCheckout";

export type DemoOrderImportRawRow = {
  ExternalOrderID?: string | number | null;
  LineNumber?: string | number | null;
  ProductID?: string | number | null;
  Quantity?: string | number | null;
  SellerID?: string | number | null;
  SupplierID?: string | number | null;
  InventoryRecordID?: string | number | null;
  ShipFirstName?: string | number | null;
  ShipLastName?: string | number | null;
  ShipStreet1?: string | number | null;
  ShipStreet2?: string | number | null;
  ShipCity?: string | number | null;
  ShipState?: string | number | null;
  ShipZip?: string | number | null;
  ShipCountry?: string | number | null;
  ShipPhone?: string | number | null;
  BillingZip?: string | number | null;
  CustomerEmail?: string | number | null;
};

export type DemoOrderImportNormalizedRow = {
  ExternalOrderID: string;
  LineNumber: number;
  ProductID: string;
  Quantity: number;
  SellerID?: string;
  SupplierID?: string;
  InventoryRecordID?: string;
  ShipFirstName?: string;
  ShipLastName?: string;
  ShipStreet1?: string;
  ShipStreet2?: string;
  ShipCity?: string;
  ShipState?: string;
  ShipZip?: string;
  ShipCountry?: string;
  ShipPhone?: string;
  BillingZip?: string;
  CustomerEmail?: string;
};

export type DemoOrderImportGroupedOrder = {
  externalOrderID: string;
  orderIndex: number;
  sellerID?: string;
  rows: DemoOrderImportNormalizedRow[];
};

export type DemoGeneratedCustomerData = {
  email: string;
  shippingAddress: Address;
  payment: DemoPaymentFormData;
};

export type DemoOrderImportFailureStage =
  | "NORMALIZATION"
  | DemoCartCheckoutFailureStage;

export type DemoOrderImportError = {
  stage: DemoOrderImportFailureStage;
  message: string;
  externalOrderID?: string;
  lineNumber?: number;
  productID?: string;
  cause?: unknown;
};

export type DemoOrderImportLineResult = {
  externalOrderID: string;
  lineNumber: number;
  productID: string;
  quantity: number;
  status: "SUCCESS" | "FAILED" | "SKIPPED";
  lineItemID?: string;
  inventoryRecordID?: string;
  productName?: string;
  error?: DemoOrderImportError;
};

export type DemoOrderImportOrderStatus = "SUCCESS" | "FAILED";

export type DemoOrderImportPaymentStatus =
  | "NOT_CREATED"
  | "CREATED"
  | "VERIFIED"
  | "ACCEPTED";

export type DemoOrderImportSubmitStatus = "NOT_SUBMITTED" | "SUBMITTED";

export type DemoOrderImportOrderResult = {
  externalOrderID: string;
  orderIndex: number;
  status: DemoOrderImportOrderStatus;
  orderID?: string;
  submittedOrderID?: string;
  sellerID?: string;
  startedAt: string;
  completedAt: string;
  shipping?: DemoSelectedShippingMethod;
  total?: number;
  paymentStatus?: DemoOrderImportPaymentStatus;
  submitStatus?: DemoOrderImportSubmitStatus;
  lineResults: DemoOrderImportLineResult[];
  errors: DemoOrderImportError[];
};

export type DemoOrderImportBatchResult = {
  batchID: string;
  startedAt: string;
  completedAt: string;
  totalOrders: number;
  succeededCount: number;
  failedCount: number;
  orderResults: DemoOrderImportOrderResult[];
  lineResults: DemoOrderImportLineResult[];
  errors: DemoOrderImportError[];
};

export type DemoOrderImportRuntimeOptions = {
  strictShipping?: boolean;
  batchID?: string;
  now?: Date;
  onOrderComplete?: (result: DemoOrderImportOrderResult) => void;
};

export type DemoValidatedProductLine = {
  row: DemoOrderImportNormalizedRow;
  product: BuyerProduct;
  inventoryRecordID?: string;
  inventoryRecord?: InventoryRecord;
};

export type DemoOrderImportApi = DemoCartCheckoutApi;
