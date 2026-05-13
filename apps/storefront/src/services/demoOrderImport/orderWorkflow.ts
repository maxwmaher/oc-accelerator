import { buildDemoCustomerData } from "./demoData";
import { createBatchID, summarizeBatchResults } from "./results";
import {
  groupRowsByExternalOrderID,
  normalizeImportedRows,
  validateGroupedOrder,
} from "./validation";
import {
  DemoOrderImportApi,
  DemoOrderImportBatchResult,
  DemoOrderImportGroupedOrder,
  DemoOrderImportNormalizedRow,
  DemoOrderImportOrderResult,
  DemoOrderImportRawRow,
  DemoOrderImportRuntimeOptions,
} from "./types";
import {
  createDefaultDemoCartCheckoutApi,
  runDemoCartCheckout,
} from "../demoCartCheckout";

const nowIso = () => new Date().toISOString();

export const createDefaultDemoOrderImportApi = createDefaultDemoCartCheckoutApi;

export const processDemoImportedOrder = async (
  order: DemoOrderImportGroupedOrder,
  api: DemoOrderImportApi = createDefaultDemoOrderImportApi(),
  options: DemoOrderImportRuntimeOptions = {},
): Promise<DemoOrderImportOrderResult> => {
  const startedAt = nowIso();
  const errors = validateGroupedOrder(order);
  if (errors.length) {
    const completedAt = nowIso();
    return {
      externalOrderID: order.externalOrderID,
      orderIndex: order.orderIndex,
      status: "FAILED",
      sellerID: order.sellerID,
      startedAt,
      completedAt,
      paymentStatus: "NOT_CREATED",
      submitStatus: "NOT_SUBMITTED",
      lineResults: [],
      errors,
    };
  }

  const customerData = buildDemoCustomerData(order, options.now);
  const result = await runDemoCartCheckout(
    {
      referenceID: order.externalOrderID,
      sellerID: order.sellerID,
      lines: order.rows.map((row) => ({
        lineNumber: row.LineNumber,
        ProductID: row.ProductID,
        Quantity: row.Quantity,
        InventoryRecordID: row.InventoryRecordID,
      })),
      shippingAddress: customerData.shippingAddress,
      payment: customerData.payment,
    },
    api,
  );

  return {
    externalOrderID: order.externalOrderID,
    orderIndex: order.orderIndex,
    status: result.status,
    orderID: result.orderID,
    submittedOrderID: result.submittedOrderID,
    sellerID: order.sellerID,
    startedAt: result.startedAt,
    completedAt: result.completedAt,
    shipping: result.shipping,
    total: result.total,
    paymentStatus: result.paymentStatus,
    submitStatus: result.submitStatus,
    lineResults: result.lineResults.map((line) => ({
      externalOrderID: order.externalOrderID,
      lineNumber: line.lineNumber || 0,
      productID: line.productID,
      quantity: line.quantity,
      status: line.status,
      lineItemID: line.lineItemID,
      inventoryRecordID: line.inventoryRecordID,
      productName: line.productName,
      error: line.error
        ? { ...line.error, externalOrderID: order.externalOrderID }
        : undefined,
    })),
    errors: result.errors.map((error) => ({
      ...error,
      externalOrderID: order.externalOrderID,
    })),
  };
};

export const runDemoOrderImportBatch = async (
  rows: DemoOrderImportNormalizedRow[],
  api: DemoOrderImportApi = createDefaultDemoOrderImportApi(),
  options: DemoOrderImportRuntimeOptions = {},
): Promise<DemoOrderImportBatchResult> => {
  const batchID = options.batchID || createBatchID();
  const startedAt = nowIso();
  const groupedOrders = groupRowsByExternalOrderID(rows);
  const orderResults: DemoOrderImportOrderResult[] = [];

  for (const order of groupedOrders) {
    const result = await processDemoImportedOrder(order, api, options);
    orderResults.push(result);
    options.onOrderComplete?.(result);
  }

  return summarizeBatchResults(batchID, startedAt, nowIso(), orderResults);
};

export const runDemoOrderImportBatchFromRawRows = async (
  rows: DemoOrderImportRawRow[],
  api: DemoOrderImportApi = createDefaultDemoOrderImportApi(),
  options: DemoOrderImportRuntimeOptions = {},
): Promise<DemoOrderImportBatchResult> => {
  const batchID = options.batchID || createBatchID();
  const startedAt = nowIso();
  const normalized = normalizeImportedRows(rows);
  const groupedOrders = groupRowsByExternalOrderID(normalized.normalizedRows);
  const orderResults: DemoOrderImportOrderResult[] = [];

  for (const order of groupedOrders) {
    const result = await processDemoImportedOrder(order, api, options);
    orderResults.push(result);
    options.onOrderComplete?.(result);
  }

  return summarizeBatchResults(
    batchID,
    startedAt,
    nowIso(),
    orderResults,
    normalized.errors,
  );
};
