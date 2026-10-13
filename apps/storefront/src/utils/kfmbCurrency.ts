/** Format the supplied currency without converting amounts. */
export function formatCurrencyAmount(amount: number, currency: string): string {
  const code = currency.trim().toUpperCase();
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: code, currencyDisplay: "code",
    ...(code === "KWD" ? { minimumFractionDigits: 3, maximumFractionDigits: 3 } :
      code === "SAR" ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : {}),
  }).format(amount);
}
