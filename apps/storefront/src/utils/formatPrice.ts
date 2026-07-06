export default function formatPrice(amount?: number): string {
  if (typeof amount !== "number") return "";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    currencyDisplay: "symbol",
  }).format(amount);
}
