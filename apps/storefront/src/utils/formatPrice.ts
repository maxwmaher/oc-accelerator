/**
 * Display an OrderCloud amount without converting its value.
 *
 * Pass the currency from the product's PriceSchedule or the Order
 * whenever available. The configured storefront currency is a fallback
 * for existing call sites that only pass an amount.
 */
export default function formatPrice(
  amount?: number,
  currency?: string | null
): string {
  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    return "";
  }

  const fallbackCurrency =
    import.meta.env.VITE_APP_ORDERCLOUD_CURRENCY || "SAR";

  const currencyCode =
    currency?.trim().toUpperCase() ||
    fallbackCurrency.trim().toUpperCase();

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
    currencyDisplay: "code",
  }).format(amount);
}