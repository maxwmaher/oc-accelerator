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
import {
  getAccessibleProduct,
  resolveInventoryRecord,
  validateProductQuantity,
} from "../demoOrderImport/validation";
import { choosePreferredOrCheapestShippingMethod, NoShippingRatesError } from "./shipping";
import {
  DemoCartCheckoutApi,
  DemoCartCheckoutError,
  DemoCartCheckoutFailureStage,
  DemoCartCheckoutInput,
  DemoCartCheckoutLineResult,
  DemoCartCheckoutResult,
  DemoSelectedShippingMethod,
} from "./types";

const nowIso = () => new Date().toISOString();

const toError = (
  stage: DemoCartCheckoutFailureStage,
  error: unknown,
  context: Omit<DemoCartCheckoutError, "stage" | "message" | "cause"> = {},
): DemoCartCheckoutError => ({
  stage,
  message: error instanceof Error ? error.message : String(error),
  ...context,
  cause: error,
});

const getLatestUnacceptedPayment = (payments: DemoPayment[]) => {
  const latest = payments[payments.length - 1] || null;
  return latest?.Accepted ? null : latest;
};

export const createDefaultDemoCartCheckoutApi = (): DemoCartCheckoutApi => ({
  cleanCart: () => Cart.Delete(),
  setSellerContext: (sellerID: string) => Cart.Save({ ToCompanyID: sellerID }),
  getProduct: getAccessibleProduct,
  resolveInventoryRecord,
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

export const runDemoCartCheckout = async (
  input: DemoCartCheckoutInput,
  api: DemoCartCheckoutApi = createDefaultDemoCartCheckoutApi(),
): Promise<DemoCartCheckoutResult> => {
  const startedAt = nowIso();
  const lineResults: DemoCartCheckoutLineResult[] = [];
  const errors: DemoCartCheckoutError[] = [];
  let orderID: string | undefined;
  let submittedOrderID: string | undefined;
  let shipping: DemoSelectedShippingMethod | undefined;
  let total: number | undefined;
  let paymentStatus: DemoCartCheckoutResult["paymentStatus"] = "NOT_CREATED";
  let submitStatus: DemoCartCheckoutResult["submitStatus"] = "NOT_SUBMITTED";
  let cleanupStatus: DemoCartCheckoutResult["cleanupStatus"] = "NOT_ATTEMPTED";
  let currentStage: DemoCartCheckoutFailureStage = "VALIDATION";

  const fail = (error: unknown): DemoCartCheckoutResult => {
    if (!errors.length || errors[errors.length - 1]?.cause !== error) {
      errors.push(toError(currentStage, error));
    }
    return {
      referenceID: input.referenceID,
      status: "FAILED",
      orderID,
      sellerID: input.sellerID,
      startedAt,
      completedAt: nowIso(),
      shipping,
      total,
      paymentStatus,
      submitStatus,
      failureStage: currentStage,
      cleanupStatus,
      lineResults,
      errors,
    };
  };

  try {
    if (!input.lines.length) throw new Error("No line items were provided.");

    currentStage = "CLEAN_CART";
    await api.cleanCart();

    if (input.sellerID) {
      currentStage = "SELLER_CONTEXT";
      await api.setSellerContext(input.sellerID);
    }

    for (const line of input.lines) {
      try {
        currentStage = "PRODUCT_VALIDATION";
        const product = await api.getProduct(line.ProductID, input.sellerID);
        validateProductQuantity(product, line.Quantity);

        currentStage = "INVENTORY_RESOLUTION";
        const inventoryRecord = await api.resolveInventoryRecord(
          line.ProductID,
          line.Quantity,
          line.InventoryRecordID,
        );

        currentStage = "ADD_LINE_ITEM";
        const createdLine = await api.createLineItem({
          ProductID: line.ProductID,
          Quantity: line.Quantity,
          InventoryRecordID: inventoryRecord?.ID || line.InventoryRecordID,
          Specs: line.Specs,
          xp: line.xp,
        });
        orderID = createdLine.OutgoingOrderID || orderID;
        lineResults.push({
          lineID: line.lineID,
          lineNumber: line.lineNumber,
          productID: line.ProductID,
          quantity: line.Quantity,
          status: "SUCCESS",
          lineItemID: createdLine.ID,
          inventoryRecordID: createdLine.InventoryRecordID,
          productName: product.Name,
        });
      } catch (lineError) {
        const error = toError(currentStage, lineError, {
          lineID: line.lineID,
          lineNumber: line.lineNumber,
          productID: line.ProductID,
        });
        lineResults.push({
          lineID: line.lineID,
          lineNumber: line.lineNumber,
          productID: line.ProductID,
          quantity: line.Quantity,
          status: "FAILED",
          error,
        });
        errors.push(error);
        throw lineError;
      }
    }

    currentStage = "SHIPPING_ADDRESS";
    const cartWithAddress = await api.setShippingAddress(input.shippingAddress);
    orderID = cartWithAddress.ID || orderID;
    if (input.orderXp && orderID) {
      // Cart.Save patches the active cart without relying on admin-only order APIs.
      await Cart.Patch({ xp: input.orderXp });
    }

    currentStage = "ESTIMATE_SHIPPING";
    const estimatedWorksheet = await api.estimateShipping();
    orderID = estimatedWorksheet.Order?.ID || orderID;
    if (!estimatedWorksheet.ShipEstimateResponse?.Succeeded) {
      throw new Error("Shipping estimate did not succeed.");
    }

    currentStage = "NO_SHIPPING_RATES";
    try {
      shipping = choosePreferredOrCheapestShippingMethod(
        estimatedWorksheet.ShipEstimateResponse,
        input.preferredShippingMethod,
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
    const paymentRequest = buildDemoPaymentRequest(input.payment, total);
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
      referenceID: input.referenceID,
      status: "SUCCESS",
      orderID,
      submittedOrderID,
      sellerID: input.sellerID,
      startedAt,
      completedAt: nowIso(),
      shipping,
      total,
      paymentStatus,
      submitStatus,
      cleanupStatus,
      lineResults,
      errors,
    };
  } catch (error) {
    const result = fail(error);
    if (!submittedOrderID) {
      try {
        currentStage = "CLEANUP";
        await api.cleanCart();
        cleanupStatus = "SUCCEEDED";
        result.cleanupStatus = cleanupStatus;
      } catch (cleanupError) {
        cleanupStatus = "FAILED";
        result.cleanupStatus = cleanupStatus;
        result.errors.push(toError("CLEANUP", cleanupError));
      }
    }
    return result;
  }
};
