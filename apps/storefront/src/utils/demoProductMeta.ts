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

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const getString = (source: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number") return String(value);
  }
  return undefined;
};

const getNumber = (source: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
};

export const resolveSellerLabel = (product: Partial<BuyerProduct>) => {
  const productRecord = asRecord(product);
  const direct = getString(productRecord, [
    "SellerName",
    "SupplierName",
    "SellerID",
  ]);
  if (direct) return direct;

  const xp = asRecord(product.xp);
  return getString(xp, [
    "SellerName",
    "SupplierName",
    "SellerID",
    "sellerName",
    "supplierName",
    "sellerID",
  ]);
};

export const resolveUsedPartsMeta = (product: Partial<BuyerProduct>) => {
  const xp = asRecord(product.xp);
  const specs = Array.isArray(asRecord(product).Specs)
    ? (asRecord(product).Specs as unknown[])
    : [];

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
    .map(asRecord)
    .filter((spec) =>
      USED_PARTS_KEYS.some((key) =>
        String(spec.Name || "")
          .toLowerCase()
          .includes(key),
      ),
    )
    .map((spec) => ({
      label: String(spec.Name || "Detail"),
      value: String(spec.Value || ""),
    }))
    .filter((spec) => Boolean(spec.value));

  return [...fromXp, ...fromSpecs].slice(0, 5);
};

export const resolveMarketplaceOfferLabel = (
  product: Partial<BuyerProduct>,
) => {
  const xp = asRecord(product.xp);
  if (!xp.canonicalPartNumber) return undefined;

  const summary = asRecord(
    xp.marketplaceOffers || xp.availableOffers || xp.supplierOffers,
  );
  const offerCount =
    getNumber(summary, [
      "offerCount",
      "availableOfferCount",
      "supplierOfferCount",
      "count",
    ]) ??
    getNumber(xp, ["offerCount", "availableOfferCount", "supplierOfferCount"]);
  const lowestPrice =
    getNumber(summary, [
      "lowestPrice",
      "lowestOfferPrice",
      "minPrice",
      "fromPrice",
    ]) ??
    getNumber(xp, ["lowestPrice", "lowestOfferPrice", "minPrice", "fromPrice"]);

  if ((offerCount && offerCount > 0) || typeof lowestPrice === "number") {
    return "Supplier offers available";
  }

  return "Supplier offers available";
};
