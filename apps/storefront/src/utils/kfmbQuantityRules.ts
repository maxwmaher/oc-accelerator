/** Pure quantity rules. Values come from the shopper's resolved PriceSchedule. */
export interface QuantitySchedule {
  MinQuantity?: number | null;
  MaxQuantity?: number | null;
  UseCumulativeQuantity?: boolean;
  RestrictedQuantity?: boolean;
  PriceBreaks?: { Quantity?: number }[] | null;
}

export interface QuantityLine {
  ID?: string;
  ProductID: string;
  Quantity?: number;
}

export function productQuantity(
  lines: readonly QuantityLine[] | undefined,
  productId: string,
  excludeLineId?: string
): number {
  return (lines ?? []).reduce((total, line) => {
    if (line.ProductID !== productId || (excludeLineId && line.ID === excludeLineId)) return total;
    const quantity = line.Quantity;
    if (!Number.isSafeInteger(quantity) || (quantity ?? 0) < 1) {
      throw new Error("The cart contains an invalid saved quantity. Refresh the cart before continuing.");
    }
    const next = total + quantity!;
    if (!Number.isSafeInteger(next)) throw new Error("The total cart quantity is too large.");
    return next;
  }, 0);
}

export function quantityBounds(ps: QuantitySchedule, otherQuantity = 0) {
  const offset = ps.UseCumulativeQuantity ? otherQuantity : 0;
  const minimum = Math.max(1, ps.MinQuantity ?? 1);
  const maximum = ps.MaxQuantity ?? undefined;
  return {
    minimum,
    maximum,
    offset,
    entryMin: Math.max(1, minimum - offset),
    entryMax: maximum === undefined ? undefined : maximum - offset,
  };
}

export function quantityError(
  ps: QuantitySchedule | undefined,
  quantity: number,
  otherQuantity = 0
): string | undefined {
  if (!ps) return "Pricing and quantity rules are not available yet.";
  if (!Number.isSafeInteger(quantity) || quantity < 1) return "Enter a positive whole number of packs.";
  const { minimum, maximum, offset } = quantityBounds(ps, otherQuantity);
  if (!Number.isSafeInteger(minimum) ||
      (maximum !== undefined && (!Number.isSafeInteger(maximum) || maximum < minimum))) {
    return "The configured quantity limits are inconsistent. Check the price schedule.";
  }
  const total = quantity + offset;
  if (!Number.isSafeInteger(total)) return "The total quantity is too large.";
  if (total < minimum) return `Minimum quantity is ${minimum} packs for this product; the proposed total is ${total}.`;
  if (maximum !== undefined && total > maximum) return `Maximum quantity is ${maximum} packs for this product; the proposed total is ${total}.`;
  if (ps.RestrictedQuantity && !ps.PriceBreaks?.some(breakpoint => breakpoint.Quantity === total)) {
    return "Select one of the quantities allowed by this price schedule.";
  }
  return undefined;
}

export function quantityRuleLabel(ps: QuantitySchedule): string {
  const { minimum, maximum } = quantityBounds(ps);
  const range = maximum === undefined ? `${minimum}+` : `${minimum}\u2013${maximum}`;
  return `Allowed: ${range} packs per product, ${ps.UseCumulativeQuantity ? "per order" : "per line"}.`;
}
