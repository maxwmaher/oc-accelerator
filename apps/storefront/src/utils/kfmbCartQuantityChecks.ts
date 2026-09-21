import { LineItem, LineItems, Me } from "ordercloud-javascript-sdk";
import { productQuantity, quantityError } from "./kfmbQuantityRules";

/** Read all pages using the shopper token already managed by the existing SDK. */
async function listOrderLines(orderId?: string): Promise<LineItem[]> {
  if (!orderId) return [];
  const lines: LineItem[] = [];
  for (let page = 1; ; page++) {
    const result = await LineItems.List("Outgoing", orderId, { page, pageSize: 100 });
    lines.push(...result.Items);
    if (page >= result.Meta.TotalPages) return lines;
  }
}

/** Recheck fresh shopper pricing and saved quantities before an add/update. */
export async function assertCartQuantityChange(
  orderId: string | undefined,
  productId: string,
  proposedQuantity: number,
  replaceLineId?: string
): Promise<void> {
  const [product, lines] = await Promise.all([
    Me.GetProduct(productId),
    listOrderLines(orderId),
  ]);
  if (replaceLineId && !lines.some(line => line.ID === replaceLineId && line.ProductID === productId)) {
    throw new Error("This cart line has changed or been removed. Refresh the cart before editing it.");
  }
  const otherQuantity = productQuantity(lines, productId, replaceLineId);
  const error = quantityError(product.PriceSchedule, proposedQuantity, otherQuantity);
  if (error) throw new Error(`${product.Name || productId}: ${error}`);
}

/** Browser-side pre-submit guard; does not submit, pay, or call /validate. */
export async function assertCartQuantitiesBeforeSubmit(orderId: string): Promise<void> {
  const lines = await listOrderLines(orderId);
  if (!lines.length) throw new Error("The cart is empty. Refresh it before continuing.");
  const productIds = Array.from(new Set(lines.map(line => line.ProductID)));
  for (const productId of productIds) {
    const product = await Me.GetProduct(productId);
    const ps = product.PriceSchedule;
    const matching = lines.filter(line => line.ProductID === productId);
    const quantities = ps?.UseCumulativeQuantity
      ? [productQuantity(matching, productId)]
      : matching.map(line => line.Quantity ?? Number.NaN);
    for (const quantity of quantities) {
      const error = quantityError(ps, quantity);
      if (error) throw new Error(`${product.Name || productId}: ${error}`);
    }
  }
}
