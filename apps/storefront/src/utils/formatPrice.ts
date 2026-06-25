export default function formatPrice(amount?: number | null): string {
  const value = typeof amount === "number" ? amount : 0;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EUR",
    currencyDisplay: "symbol",
  }).format(value);
}
