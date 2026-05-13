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

export type DemoSelectedShippingMethod = {
  ShipEstimateID: string;
  ShipMethodID: string;
  ShipMethodName: string;
  Cost: number;
};

export type DemoOrderImportFailureStage =
  | "NORMALIZATION"
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

export type DemoOrderImportApi = {
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
