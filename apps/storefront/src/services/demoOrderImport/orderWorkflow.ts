import {
  Cart,
  LineItem,
  Order,
  OrderShipMethodSelection,
  Payment,
  Payments,
} from "ordercloud-javascript-sdk";
import {
  acceptDemoPayment,
  buildDemoPaymentRequest,
  DemoPayment,
  DemoPaymentXp,
} from "../demoPayment";
import { buildDemoCustomerData } from "./demoData";
import { createBatchID, summarizeBatchResults } from "./results";
import { chooseCheapestShippingMethod, NoShippingRatesError } from "./shipping";
import {
  createImportError,
  getAccessibleProduct,
  groupRowsByExternalOrderID,
  normalizeImportedRows,
  resolveInventoryRecord,
  validateGroupedOrder,
  validateProductQuantity,
} from "./validation";
import {
  DemoOrderImportApi,
  DemoOrderImportBatchResult,
  DemoOrderImportError,
  DemoOrderImportFailureStage,
  DemoOrderImportGroupedOrder,
  DemoOrderImportLineResult,
  DemoOrderImportNormalizedRow,
  DemoOrderImportOrderResult,
  DemoOrderImportRawRow,
  DemoOrderImportRuntimeOptions,
  DemoSelectedShippingMethod,
} from "./types";

const nowIso = () => new Date().toISOString();

const toError = (
  stage: DemoOrderImportFailureStage,
  error: unknown,
  context: Omit<DemoOrderImportError, "stage" | "message" | "cause"> = {},
): DemoOrderImportError =>
  createImportError(
    stage,
    error instanceof Error ? error.message : String(error),
    {
      ...context,
      cause: error,
    },
  );

const getLatestUnacceptedPayment = (payments: DemoPayment[]) => {
  const latest = payments[payments.length - 1] || null;
  return latest?.Accepted ? null : latest;
};

export const createDefaultDemoOrderImportApi = (): DemoOrderImportApi => ({
  cleanCart: () => Cart.Delete(),
  setSellerContext: (sellerID: string) => Cart.Save({ ToCompanyID: sellerID }),
  getProduct: getAccessibleProduct,
  resolveInventoryRecord: (
    productID: string,
    quantity: number,
    requestedInventoryRecordID?: string,
  ) => resolveInventoryRecord(productID, quantity, requestedInventoryRecordID),
  createLineItem: (lineItem: LineItem) => Cart.CreateLineItem(lineItem),
  setShippingAddress: (address) => Cart.SetShippingAddress(address),
  estimateShipping: () => Cart.EstimateShipping(),
  selectShipMethod: (selection: DemoSelectedShippingMethod) => {
    const shipMethodSelection: OrderShipMethodSelection = {
      ShipMethodSelections: [
        {
          ShipEstimateID: selection.ShipEstimateID,
          ShipMethodID: selection.ShipMethodID,
        },
      ],
    };
    return Cart.SelectShipMethods(shipMethodSelection);
  },
  calculateOrder: () => Cart.Calculate(),
  listPayments: async (orderID: string) => {
    const response = await Payments.List<DemoPayment>("Outgoing", orderID, {
      pageSize: 100,
      sortBy: ["DateCreated"],
    });
    return response.Items || [];
  },
  createOrPatchPayment: (order: Order, payment, existingPayment) => {
    if (!order.ID)
      throw new Error("Unable to create payment without an order ID.");
    return existingPayment?.ID
      ? Payments.Patch<DemoPayment>(
          "Outgoing",
          order.ID,
          existingPayment.ID,
          payment,
        )
      : Payments.Create<DemoPayment>("Outgoing", order.ID, payment);
  },
  verifyPayment: (orderID: string, paymentID: string) =>
    Payments.Get<DemoPayment>("Outgoing", orderID, paymentID),
  acceptPayment: acceptDemoPayment,
  submitCart: () => Cart.Submit(),
});

export const processDemoImportedOrder = async (
  order: DemoOrderImportGroupedOrder,
  api: DemoOrderImportApi = createDefaultDemoOrderImportApi(),
  options: DemoOrderImportRuntimeOptions = {},
): Promise<DemoOrderImportOrderResult> => {
  const startedAt = nowIso();
  const lineResults: DemoOrderImportLineResult[] = [];
  const errors: DemoOrderImportError[] = [];
  let orderID: string | undefined;
  let submittedOrderID: string | undefined;
  let shipping: DemoSelectedShippingMethod | undefined;
  let total: number | undefined;
  let paymentStatus: DemoOrderImportOrderResult["paymentStatus"] = "NOT_CREATED";
  let submitStatus: DemoOrderImportOrderResult["submitStatus"] = "NOT_SUBMITTED";
  let currentStage: DemoOrderImportFailureStage = "VALIDATION";

  const fail = (
    error: unknown,
    stage = currentStage,
  ): DemoOrderImportOrderResult => {
    errors.push(
      toError(stage, error, { externalOrderID: order.externalOrderID }),
    );
    const completedAt = nowIso();
    return {
      externalOrderID: order.externalOrderID,
      orderIndex: order.orderIndex,
      status: "FAILED",
      orderID,
      sellerID: order.sellerID,
      startedAt,
      completedAt,
      shipping,
      total,
      paymentStatus,
      submitStatus,
      lineResults,
      errors,
    };
  };

  try {
    errors.push(...validateGroupedOrder(order));
    if (errors.length)
      throw new Error(errors.map((error) => error.message).join("; "));

    currentStage = "CLEAN_CART";
    await api.cleanCart();

    if (order.sellerID) {
      currentStage = "SELLER_CONTEXT";
      await api.setSellerContext(order.sellerID);
    }

    for (const row of order.rows) {
      try {
        currentStage = "PRODUCT_VALIDATION";
        const product = await api.getProduct(row.ProductID, order.sellerID);
        validateProductQuantity(product, row.Quantity);

        currentStage = "INVENTORY_RESOLUTION";
        const inventoryRecord = await api.resolveInventoryRecord(
          row.ProductID,
          row.Quantity,
          row.InventoryRecordID,
        );

        currentStage = "ADD_LINE_ITEM";
        const createdLine = await api.createLineItem({
          ProductID: row.ProductID,
          Quantity: row.Quantity,
          InventoryRecordID: inventoryRecord?.ID || row.InventoryRecordID,
        });
        orderID = createdLine.OutgoingOrderID || orderID;
        lineResults.push({
          externalOrderID: order.externalOrderID,
          lineNumber: row.LineNumber,
          productID: row.ProductID,
          quantity: row.Quantity,
          status: "SUCCESS",
          lineItemID: createdLine.ID,
          inventoryRecordID: createdLine.InventoryRecordID,
          productName: product.Name,
        });
      } catch (lineError) {
        const lineResult: DemoOrderImportLineResult = {
          externalOrderID: order.externalOrderID,
          lineNumber: row.LineNumber,
          productID: row.ProductID,
          quantity: row.Quantity,
          status: "FAILED",
          error: toError(currentStage, lineError, {
            externalOrderID: order.externalOrderID,
            lineNumber: row.LineNumber,
            productID: row.ProductID,
          }),
        };
        lineResults.push(lineResult);
        errors.push(lineResult.error as DemoOrderImportError);
        throw lineError;
      }
    }

    const customerData = buildDemoCustomerData(order, options.now);

    currentStage = "SHIPPING_ADDRESS";
    const cartWithAddress = await api.setShippingAddress(
      customerData.shippingAddress,
    );
    orderID = cartWithAddress.ID || orderID;

    currentStage = "ESTIMATE_SHIPPING";
    const estimatedWorksheet = await api.estimateShipping();
    orderID = estimatedWorksheet.Order?.ID || orderID;
    if (!estimatedWorksheet.ShipEstimateResponse?.Succeeded) {
      throw new Error("Shipping estimate did not succeed.");
    }

    currentStage = "NO_SHIPPING_RATES";
    try {
      shipping = chooseCheapestShippingMethod(
        estimatedWorksheet.ShipEstimateResponse,
      );
    } catch (error) {
      if (error instanceof NoShippingRatesError) throw error;
      throw new NoShippingRatesError(
        error instanceof Error ? error.message : String(error),
      );
    }

    currentStage = "SELECT_SHIPPING";
    await api.selectShipMethod(shipping);

    currentStage = "CALCULATE_ORDER";
    const calculatedWorksheet = await api.calculateOrder();
    const calculatedOrder = calculatedWorksheet.Order;
    if (!calculatedOrder?.ID)
      throw new Error("Unable to load calculated cart order.");
    orderID = calculatedOrder.ID;
    total = calculatedOrder.Total ?? 0;

    currentStage = "CREATE_PAYMENT";
    const existingPayment = getLatestUnacceptedPayment(
      (await api.listPayments(calculatedOrder.ID)) as DemoPayment[],
    );
    const paymentRequest = buildDemoPaymentRequest(customerData.payment, total);
    const workingPayment = await api.createOrPatchPayment(
      calculatedOrder,
      paymentRequest as Payment<DemoPaymentXp>,
      existingPayment,
    );
    if (!workingPayment.ID)
      throw new Error("Payment was created or updated without an ID.");
    paymentStatus = "CREATED";

    currentStage = "VERIFY_PAYMENT";
    const paymentCheck = await api.verifyPayment(
      calculatedOrder.ID,
      workingPayment.ID,
    );
    if (!paymentCheck.ID)
      throw new Error("Unable to verify created payment before acceptance.");
    paymentStatus = "VERIFIED";

    currentStage = "ACCEPT_PAYMENT";
    await api.acceptPayment(calculatedOrder.ID, workingPayment.ID, total);
    paymentStatus = "ACCEPTED";

    currentStage = "CALCULATE_ORDER";
    const recalculatedWorksheet = await api.calculateOrder();
    total = recalculatedWorksheet.Order?.Total ?? total;

    currentStage = "SUBMIT_ORDER";
    const submittedOrder = await api.submitCart();
    submittedOrderID = submittedOrder.ID || calculatedOrder.ID;
    submitStatus = "SUBMITTED";

    return {
      externalOrderID: order.externalOrderID,
      orderIndex: order.orderIndex,
      status: "SUCCESS",
      orderID,
      submittedOrderID,
      sellerID: order.sellerID,
      startedAt,
      completedAt: nowIso(),
      shipping,
      total,
      paymentStatus,
      submitStatus,
      lineResults,
      errors,
    };
  } catch (error) {
    const result = errors.length ? fail(error, currentStage) : fail(error);
    if (!submittedOrderID) {
      try {
        currentStage = "CLEANUP";
        await api.cleanCart();
      } catch (cleanupError) {
        result.errors.push(
          toError("CLEANUP", cleanupError, {
            externalOrderID: order.externalOrderID,
          }),
        );
      }
    }
    return result;
  }
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
