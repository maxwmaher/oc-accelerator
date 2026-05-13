import { BuyerProduct, InventoryRecord, Me } from "ordercloud-javascript-sdk";
import { IS_MULTI_LOCATION_INVENTORY } from "../../constants";
import { buildDemoCustomerData } from "./demoData";
import {
  DemoOrderImportError,
  DemoOrderImportGroupedOrder,
  DemoOrderImportNormalizedRow,
  DemoOrderImportRawRow,
} from "./types";

const toStringValue = (input: string | number | null | undefined) => {
  if (input === null || input === undefined) return undefined;
  const value = String(input).trim();
  return value || undefined;
};

const toPositiveInteger = (input: string | number | null | undefined) => {
  const value =
    typeof input === "number" ? input : Number(toStringValue(input));
  return Number.isInteger(value) && value > 0 ? value : undefined;
};

export const createImportError = (
  stage: DemoOrderImportError["stage"],
  message: string,
  context: Omit<DemoOrderImportError, "stage" | "message"> = {},
): DemoOrderImportError => ({ stage, message, ...context });

export const normalizeImportedRow = (
  row: DemoOrderImportRawRow,
  rowIndex: number,
): { row?: DemoOrderImportNormalizedRow; errors: DemoOrderImportError[] } => {
  const errors: DemoOrderImportError[] = [];
  const externalOrderID = toStringValue(row.ExternalOrderID);
  const productID = toStringValue(row.ProductID);
  const quantity = toPositiveInteger(row.Quantity);
  const lineNumber = toPositiveInteger(row.LineNumber) || rowIndex + 1;

  if (!externalOrderID)
    errors.push(
      createImportError("NORMALIZATION", "ExternalOrderID is required."),
    );
  if (!productID)
    errors.push(
      createImportError("NORMALIZATION", "ProductID is required.", {
        externalOrderID,
      }),
    );
  if (!quantity)
    errors.push(
      createImportError(
        "NORMALIZATION",
        "Quantity must be a positive integer.",
        { externalOrderID, productID },
      ),
    );

  if (!externalOrderID || !productID || !quantity) return { errors };

  return {
    row: {
      ExternalOrderID: externalOrderID,
      LineNumber: lineNumber,
      ProductID: productID,
      Quantity: quantity,
      SellerID: toStringValue(row.SellerID),
      SupplierID: toStringValue(row.SupplierID),
      InventoryRecordID: toStringValue(row.InventoryRecordID),
      ShipFirstName: toStringValue(row.ShipFirstName),
      ShipLastName: toStringValue(row.ShipLastName),
      ShipStreet1: toStringValue(row.ShipStreet1),
      ShipStreet2: toStringValue(row.ShipStreet2),
      ShipCity: toStringValue(row.ShipCity),
      ShipState: toStringValue(row.ShipState),
      ShipZip: toStringValue(row.ShipZip),
      ShipCountry: toStringValue(row.ShipCountry),
      ShipPhone: toStringValue(row.ShipPhone),
      BillingZip: toStringValue(row.BillingZip),
      CustomerEmail: toStringValue(row.CustomerEmail),
    },
    errors,
  };
};

export const normalizeImportedRows = (rows: DemoOrderImportRawRow[]) => {
  const normalizedRows: DemoOrderImportNormalizedRow[] = [];
  const errors: DemoOrderImportError[] = [];
  const lineNumbersByExternalOrder = new Map<string, number>();

  rows.forEach((row, index) => {
    const externalOrderID = toStringValue(row.ExternalOrderID) || `row-${index}`;
    const nextLineNumber = (lineNumbersByExternalOrder.get(externalOrderID) || 0) + 1;
    lineNumbersByExternalOrder.set(externalOrderID, nextLineNumber);

    const result = normalizeImportedRow(
      {
        ...row,
        LineNumber: toPositiveInteger(row.LineNumber) || nextLineNumber,
      },
      index,
    );
    if (result.row) normalizedRows.push(result.row);
    errors.push(...result.errors);
  });

  return { normalizedRows, errors };
};

export const groupRowsByExternalOrderID = (
  rows: DemoOrderImportNormalizedRow[],
): DemoOrderImportGroupedOrder[] => {
  const grouped = new Map<string, DemoOrderImportNormalizedRow[]>();
  rows.forEach((row) => {
    const existing = grouped.get(row.ExternalOrderID) || [];
    existing.push(row);
    grouped.set(row.ExternalOrderID, existing);
  });

  return Array.from(grouped.entries()).map(
    ([externalOrderID, orderRows], orderIndex) => ({
      externalOrderID,
      orderIndex,
      sellerID:
        orderRows.find((row) => row.SellerID || row.SupplierID)?.SellerID ||
        orderRows.find((row) => row.SupplierID)?.SupplierID,
      rows: orderRows.slice().sort((a, b) => a.LineNumber - b.LineNumber),
    }),
  );
};

export const validateGroupedOrder = (
  order: DemoOrderImportGroupedOrder,
): DemoOrderImportError[] => {
  const errors: DemoOrderImportError[] = [];
  const sellerIDs = Array.from(
    new Set(
      order.rows.map((row) => row.SellerID || row.SupplierID).filter(Boolean),
    ),
  );

  if (!order.externalOrderID)
    errors.push(
      createImportError("VALIDATION", "ExternalOrderID is required."),
    );
  if (!order.rows.length)
    errors.push(
      createImportError("VALIDATION", "Order has no line items.", {
        externalOrderID: order.externalOrderID,
      }),
    );
  if (sellerIDs.length > 1) {
    errors.push(
      createImportError(
        "VALIDATION",
        "SellerID must be consistent within one order.",
        { externalOrderID: order.externalOrderID },
      ),
    );
  }

  order.rows.forEach((row) => {
    if (!row.ProductID)
      errors.push(
        createImportError("VALIDATION", "ProductID is required.", {
          externalOrderID: order.externalOrderID,
          lineNumber: row.LineNumber,
        }),
      );
    if (!Number.isInteger(row.Quantity) || row.Quantity <= 0) {
      errors.push(
        createImportError(
          "VALIDATION",
          "Quantity must be a positive integer.",
          {
            externalOrderID: order.externalOrderID,
            lineNumber: row.LineNumber,
            productID: row.ProductID,
          },
        ),
      );
    }
    if (!Number.isInteger(row.LineNumber) || row.LineNumber <= 0) {
      errors.push(
        createImportError(
          "VALIDATION",
          "LineNumber must be present or derivable.",
          { externalOrderID: order.externalOrderID, productID: row.ProductID },
        ),
      );
    }
  });

  const customerData = buildDemoCustomerData(order);
  if (
    !customerData.shippingAddress.Street1 ||
    !customerData.shippingAddress.City ||
    !customerData.shippingAddress.State ||
    !customerData.shippingAddress.Zip ||
    !customerData.shippingAddress.Country
  ) {
    errors.push(
      createImportError(
        "VALIDATION",
        "Shipping defaults could not be generated.",
        { externalOrderID: order.externalOrderID },
      ),
    );
  }
  if (
    !customerData.payment.cardNumber ||
    !customerData.payment.cvv ||
    !customerData.payment.billingZip
  ) {
    errors.push(
      createImportError(
        "VALIDATION",
        "Payment defaults could not be generated.",
        { externalOrderID: order.externalOrderID },
      ),
    );
  }

  return errors;
};

export const validateProductQuantity = (
  product: BuyerProduct,
  quantity: number,
) => {
  const priceSchedule = product.PriceSchedule;
  if (priceSchedule?.MinQuantity && quantity < priceSchedule.MinQuantity) {
    throw new Error(
      `Quantity ${quantity} is below minimum quantity ${priceSchedule.MinQuantity}.`,
    );
  }
  if (priceSchedule?.MaxQuantity && quantity > priceSchedule.MaxQuantity) {
    throw new Error(
      `Quantity ${quantity} exceeds maximum quantity ${priceSchedule.MaxQuantity}.`,
    );
  }
  if (priceSchedule?.RestrictedQuantity) {
    const breakQuantities =
      priceSchedule.PriceBreaks?.map(
        (priceBreak) => priceBreak.Quantity,
      ).filter((qty): qty is number => typeof qty === "number") || [];
    if (breakQuantities.length && !breakQuantities.includes(quantity)) {
      throw new Error(
        `Quantity ${quantity} is not an allowed restricted quantity.`,
      );
    }
  }
};

export const getAccessibleProduct = async (
  productID: string,
  sellerID?: string,
) => Me.GetProduct(productID, sellerID ? { sellerID } : undefined);

export const resolveInventoryRecord = async (
  productID: string,
  quantity: number,
  requestedInventoryRecordID?: string,
): Promise<InventoryRecord | undefined> => {
  if (!IS_MULTI_LOCATION_INVENTORY) return undefined;
  const records = await Me.ListProductInventoryRecords(productID, {
    pageSize: 100,
  });
  const available = records.Items || [];

  if (requestedInventoryRecordID) {
    const requested = available.find(
      (record) => record.ID === requestedInventoryRecordID,
    );
    if (!requested)
      throw new Error(
        `InventoryRecordID ${requestedInventoryRecordID} is not available for product ${productID}.`,
      );
    if (
      !requested.OrderCanExceed &&
      (requested.QuantityAvailable ?? 0) < quantity
    ) {
      throw new Error(
        `InventoryRecordID ${requestedInventoryRecordID} does not have enough quantity available.`,
      );
    }
    return requested;
  }

  const resolved = available.find(
    (record) =>
      record.OrderCanExceed || (record.QuantityAvailable ?? 0) >= quantity,
  );
  if (!resolved)
    throw new Error(
      `No inventory record with quantity ${quantity} is available for product ${productID}.`,
    );
  return resolved;
};
