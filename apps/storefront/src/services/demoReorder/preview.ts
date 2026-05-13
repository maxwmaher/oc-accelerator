import { LineItem } from "ordercloud-javascript-sdk";
import { getFutureDemoExpiration } from "../demoOrderImport/demoData";
import {
  getAccessibleProduct,
  resolveInventoryRecord,
  validateProductQuantity,
} from "../demoOrderImport/validation";
import { isSubmittedOrder, loadDemoReorderSource } from "./sourceOrder";
import {
  DemoReorderLinePreview,
  DemoReorderPreview,
  DemoReorderValidationMessage,
} from "./types";

const orderTotal = (order: { Total?: number; Subtotal?: number; ShippingCost?: number; TaxCost?: number }) =>
  typeof order.Total === "number"
    ? order.Total
    : (order.Subtotal || 0) + (order.ShippingCost || 0) + (order.TaxCost || 0);

export const validateDemoReorderLine = async (
  line: LineItem,
  sellerID?: string,
): Promise<DemoReorderLinePreview> => {
  const base = {
    sourceLineItemID: line.ID,
    productID: line.ProductID,
    productName: line.Product?.Name,
    quantity: line.Quantity,
    inventoryRecordID: line.InventoryRecordID,
    specs: line.Specs,
  };

  try {
    if (!line.ProductID) throw new Error("Line item is missing ProductID.");
    if (!Number.isFinite(line.Quantity) || (line.Quantity || 0) <= 0) {
      throw new Error("Line item quantity must be greater than zero.");
    }
    const product = await getAccessibleProduct(line.ProductID, sellerID);
    validateProductQuantity(product, line.Quantity as number);
    const inventoryRecord = await resolveInventoryRecord(
      line.ProductID,
      line.Quantity as number,
      line.InventoryRecordID,
    );
    return {
      ...base,
      productName: product.Name || line.Product?.Name,
      resolvedInventoryRecordID: inventoryRecord?.ID || line.InventoryRecordID,
      reorderable: true,
    };
  } catch (error) {
    return {
      ...base,
      reorderable: false,
      validationMessage: error instanceof Error ? error.message : String(error),
    };
  }
};

export const buildDemoReorderPreview = async (
  orderID: string,
): Promise<DemoReorderPreview> => {
  const source = await loadDemoReorderSource(orderID);
  const errors: DemoReorderValidationMessage[] = [];
  const warnings: DemoReorderValidationMessage[] = [];

  if (!source.order.ID) {
    errors.push({ stage: "SOURCE_ORDER", message: "Source order was not found." });
  }
  if (!isSubmittedOrder(source.order.Status, source.order.IsSubmitted)) {
    errors.push({
      stage: "SOURCE_ORDER",
      message: "Only submitted orders are eligible for reorder.",
    });
  }
  if (!source.lineItems.length) {
    errors.push({ stage: "LINE", message: "Source order has no line items." });
  }
  if (!source.shippingAddress) {
    errors.push({
      stage: "SHIPPING_ADDRESS",
      message: "Source order shipping address is unavailable.",
    });
  }
  if (!source.previousShippingMethod) {
    warnings.push({
      stage: "SHIPPING_METHOD",
      message:
        "Previous shipping method was not available; submit will use the cheapest available real shipping rate.",
    });
  }

  const lines = await Promise.all(
    source.lineItems.map((line) =>
      validateDemoReorderLine(line, source.order.ToCompanyID),
    ),
  );

  lines.forEach((line) => {
    if (!line.reorderable) {
      errors.push({
        stage: "LINE",
        lineItemID: line.sourceLineItemID,
        productID: line.productID,
        message: line.validationMessage || "Line item is not reorderable.",
      });
    }
  });

  return {
    sourceOrder: {
      orderID,
      dateSubmitted: source.order.DateSubmitted,
      dateCreated: source.order.DateCreated,
      status: source.order.Status,
      total: orderTotal(source.order),
      toCompanyID: source.order.ToCompanyID,
    },
    lines,
    shippingAddress: source.shippingAddress,
    previousShippingMethod: source.previousShippingMethod,
    shippingStrategy:
      "Submit will estimate real shipping rates, then match by ShipMethod.xp stable key, normalized name, normalized name plus transit days, weak ID, or cheapest real rate fallback.",
    warnings,
    errors,
    canSubmit: errors.length === 0,
  };
};

export const getDemoReorderPaymentPreview = (zip?: string) => {
  const expiration = getFutureDemoExpiration();
  return {
    maskedCardNumber: "•••• •••• •••• 1111",
    billingZip: zip || "60601",
    expirationMonth: expiration.expirationMonth,
    expirationYear: expiration.expirationYear,
  };
};

export const previewDemoReorder = buildDemoReorderPreview;
