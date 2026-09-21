import type { LineItem, OrderCloudError, OrderWorksheet } from "ordercloud-javascript-sdk";

export type CurrentCartState =
  | { status: "auth-pending" }
  | { status: "loading" }
  | { status: "empty"; lineItems: LineItem[] }
  | { status: "ready"; worksheet: OrderWorksheet; lineItems: LineItem[] }
  | { status: "error"; message: string };

type CartErrorShape = Partial<OrderCloudError> & {
  response?: { config?: { url?: string }; status?: number };
};

/** OrderCloud's supported no-current-order result for GET /cart/worksheet. */
export function isNoCurrentCartError(error: unknown): boolean {
  const candidate = error as CartErrorShape | undefined;
  const url = candidate?.response?.config?.url;
  return candidate?.status === 404 && candidate.errorCode === "NotFound" &&
    typeof url === "string" && /(?:^|\/)cart\/worksheet(?:\?|$)/i.test(url);
}

export function resolveCurrentCartState(
  authenticated: boolean,
  userReady: boolean,
  fetching: boolean,
  worksheet: OrderWorksheet | undefined,
  error: unknown
): CurrentCartState {
  if (!authenticated || !userReady) return { status: "auth-pending" };
  if (fetching && worksheet === undefined && error === null) return { status: "loading" };
  if (error) {
    if (isNoCurrentCartError(error)) return { status: "empty", lineItems: [] };
    const message = error instanceof Error ? error.message : "The cart could not be loaded.";
    return { status: "error", message };
  }
  const lineItems = worksheet?.LineItems;
  const usableLines = Array.isArray(lineItems) && lineItems.every(line =>
    typeof line?.ProductID === "string" && line.ProductID.length > 0 &&
    typeof line.Quantity === "number" && Number.isSafeInteger(line.Quantity) && line.Quantity > 0
  );
  if (!worksheet || typeof worksheet.Order?.ID !== "string" || !worksheet.Order.ID || !usableLines || !lineItems) {
    return { status: "error", message: "The cart service returned an unusable response." };
  }
  return { status: "ready", worksheet, lineItems };
}
