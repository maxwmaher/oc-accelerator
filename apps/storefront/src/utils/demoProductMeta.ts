import { BuyerProduct } from "ordercloud-javascript-sdk";

const USED_PARTS_KEYS = [
  "condition",
  "mileage",
  "vin",
  "grade",
  "compatibility",
] as const;

const toTitle = (value: string) =>
  value
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (s) => s.toUpperCase());

export const resolveSellerLabel = (product: Partial<BuyerProduct> & { [key: string]: any }) => {
  const direct = product?.SellerName || product?.SupplierName || product?.SellerID;
  if (direct) return String(direct);

  const xp = (product as any)?.xp;
  const xpSeller =
    xp?.SellerName ||
    xp?.SupplierName ||
    xp?.SellerID ||
    xp?.sellerName ||
    xp?.supplierName ||
    xp?.sellerID;

  return xpSeller ? String(xpSeller) : undefined;
};

export const resolveUsedPartsMeta = (product: Partial<BuyerProduct> & { [key: string]: any }) => {
  const xp = (product as any)?.xp || {};
  const specs = Array.isArray((product as any)?.Specs) ? (product as any).Specs : [];

  const fromXp = USED_PARTS_KEYS.map((key) => {
    const value = xp[key] ?? xp[toTitle(key)] ?? xp[key.toUpperCase()];
    return value
      ? {
          label: toTitle(key),
          value: String(value),
        }
      : undefined;
  }).filter(Boolean) as { label: string; value: string }[];

  const fromSpecs = specs
    .filter((spec: any) =>
      USED_PARTS_KEYS.some((key) => String(spec?.Name || "").toLowerCase().includes(key))
    )
    .map((spec: any) => ({
      label: spec?.Name || "Detail",
      value: String(spec?.Value || ""),
    }))
    .filter((spec: any) => Boolean(spec.value));

  return [...fromXp, ...fromSpecs].slice(0, 5);
};
