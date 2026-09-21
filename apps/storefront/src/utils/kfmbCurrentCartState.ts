import type { LineItem, OrderWorksheet } from "ordercloud-javascript-sdk";

export type CurrentCartState =
  | { status: "auth-pending" }
  | { status: "loading" }
  | { status: "empty"; lineItems: LineItem[] }
  | { status: "ready"; worksheet: OrderWorksheet; lineItems: LineItem[] }
  | { status: "error"; message: string };

function isExplicitEmptyWorksheet(worksheet: unknown): boolean {
  return typeof worksheet === "object" && worksheet !== null && !Array.isArray(worksheet) &&
    Object.prototype.hasOwnProperty.call(worksheet, "Order") &&
    Object.prototype.hasOwnProperty.call(worksheet, "LineItems") &&
    (worksheet as Record<string, unknown>).Order === null &&
    (worksheet as Record<string, unknown>).LineItems === null;
}

export function resolveCurrentCartState(
  authenticated: boolean,
  userReady: boolean,
  fetching: boolean,
  // Keep the API boundary honest: the observed null response is outside the SDK type.
  worksheet: unknown,
  error: unknown
): CurrentCartState {
  if (!authenticated || !userReady) return { status: "auth-pending" };
  if (fetching && worksheet === undefined && error === null) return { status: "loading" };
  if (error) {
    const message = error instanceof Error ? error.message : "The cart could not be loaded.";
    return { status: "error", message };
  }
  if (isExplicitEmptyWorksheet(worksheet)) return { status: "empty", lineItems: [] };

  const persistedWorksheet = worksheet as OrderWorksheet | undefined;
  const lineItems = persistedWorksheet?.LineItems;
  const usableLines = Array.isArray(lineItems) && lineItems.every(line =>
    typeof line?.ProductID === "string" && line.ProductID.length > 0 &&
    typeof line.Quantity === "number" && Number.isSafeInteger(line.Quantity) && line.Quantity > 0
  );
  if (!persistedWorksheet || typeof persistedWorksheet.Order?.ID !== "string" || !persistedWorksheet.Order.ID || !usableLines || !lineItems) {
    return { status: "error", message: "The cart service returned an unusable response." };
  }
  return { status: "ready", worksheet: persistedWorksheet, lineItems };
}
