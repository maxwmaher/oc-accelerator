export default function formatPrice(amount?: number): string {
  if (typeof amount !== 'number') return "";
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    currencyDisplay: 'symbol',
  }).format(amount);
}
