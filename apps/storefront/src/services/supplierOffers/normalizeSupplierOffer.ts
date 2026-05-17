import { InventoryRecord } from "ordercloud-javascript-sdk";
import {
  SupplierOfferNormalizeOptions,
  SupplierOfferViewModel,
} from "./types";

const toTitleCase = (value: string) =>
  value
    .replace(/([A-Z])/g, " $1")
    .replace(/[_.-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (char) => char.toUpperCase());

const formatValue = (value: unknown): string | undefined => {
  if (value === undefined || value === null || value === "") return undefined;
  if (Array.isArray(value)) {
    return value.map(formatValue).filter(Boolean).join(", ");
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => {
        const formatted = formatValue(item);
        return formatted ? `${toTitleCase(key)}: ${formatted}` : undefined;
      })
      .filter(Boolean)
      .join("; ");
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
};

const normalizeSummary = (value: unknown): string | undefined => {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(formatValue).filter(Boolean).join(", ");
  return formatValue(value);
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const getString = (record: Record<string, unknown>, ...keys: string[]) => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value) return value;
  }
  return undefined;
};

const getNumber = (record: Record<string, unknown>, ...keys: string[]) => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number") return value;
  }
  return undefined;
};

const normalizeSpecs = (value: unknown) => {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value
      .map((item, index) => {
        const record = asRecord(item);
        const label = getString(record, "label", "name", "key") ||
          (Object.keys(record).length ? undefined : `Spec ${index + 1}`);
        const specValue =
          record.value ?? record.Value ?? record.displayValue ?? record.DisplayValue ?? item;

        return {
          label: label || `Spec ${index + 1}`,
          value: formatValue(specValue),
        };
      })
      .filter((spec): spec is { label: string; value: string } => Boolean(spec.value));
  }

  if (typeof value !== "object") return [];

  return Object.entries(value as Record<string, unknown>)
    .map(([key, specValue]) => ({
      label: toTitleCase(key),
      value: formatValue(specValue),
    }))
    .filter((spec): spec is { label: string; value: string } => Boolean(spec.value));
};

const normalizeBadges = (value: unknown, sellerType: SupplierOfferViewModel["sellerType"]) => {
  const badges = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  return Array.from(
    new Set(
      badges
        .map(String)
        .filter(Boolean)
        .map((badge) =>
          sellerType === "admin" && badge.toLowerCase() === "best offer"
            ? "Scania Direct"
            : badge
        )
    )
  );
};

const getPrice = (product: SupplierOfferNormalizeOptions["product"]) =>
  product.PriceSchedule?.PriceBreaks?.[0]?.SalePrice ??
  product.PriceSchedule?.PriceBreaks?.[0]?.Price;

const getDefaultInventoryRecord = (inventoryRecords?: InventoryRecord[]) =>
  inventoryRecords?.find((record) => (record.QuantityAvailable ?? 0) > 0);

const normalizeInventoryLocations = (inventoryRecords?: InventoryRecord[]) =>
  (inventoryRecords || []).map((record) => ({
    id: record.ID,
    name: record.Address?.AddressName,
    street1: record.Address?.Street1,
    street2: record.Address?.Street2,
    city: record.Address?.City,
    state: record.Address?.State,
    zip: record.Address?.Zip,
    quantityAvailable: record.QuantityAvailable,
  }));

export const normalizeSupplierOffer = ({
  product,
  source,
  inventoryRecords,
}: SupplierOfferNormalizeOptions): SupplierOfferViewModel | undefined => {
  if (!product.ID) return undefined;

  const xp = asRecord(product.xp);
  const offer = asRecord(xp.offer);
  const supplier = asRecord(xp.supplier);
  const defaultInventoryRecord = getDefaultInventoryRecord(inventoryRecords);

  return {
    productID: product.ID,
    productName: product.Name || product.ID,
    sellerType: source.sellerType,
    sellerID: source.sellerID,
    supplierDisplayName:
      getString(supplier, "displayName", "name") ||
      source.displayName ||
      "Scania Direct",
    pricingModelLabel: getString(supplier, "pricingModelLabel"),
    price: getPrice(product),
    deliveryEstimate: getString(offer, "deliveryEstimate"),
    warranty: getString(offer, "warranty"),
    shippingLabel: getString(offer, "shippingLabel"),
    warehouseRegion: getString(offer, "warehouseRegion", "region"),
    warehouseName: getString(offer, "warehouseName", "warehouse"),
    stockQuantity: product.Inventory?.QuantityAvailable,
    badges: normalizeBadges(offer.badges, source.sellerType),
    conditionSummary: normalizeSummary(xp.condition),
    catalogUpdateSummary: normalizeSummary(xp.catalogUpdate),
    compatibilitySummary: normalizeSummary(xp.compatibility),
    technicalSpecs: normalizeSpecs(xp.technicalSpecs),
    inventoryRecordID: defaultInventoryRecord?.ID,
    inventoryLocations: normalizeInventoryLocations(inventoryRecords),
    offerRank: getNumber(offer, "offerRank", "displayRank"),
    product,
  };
};

export const applyComputedOfferBadges = (offers: SupplierOfferViewModel[]) => {
  const visiblePrices = offers
    .map((offer) => offer.price)
    .filter((price): price is number => typeof price === "number");
  const lowestPrice = visiblePrices.length ? Math.min(...visiblePrices) : undefined;

  return offers.map((offer) => {
    const computedBadges = [...offer.badges];
    if (typeof lowestPrice === "number" && offer.price === lowestPrice) {
      computedBadges.push("Lowest Offer");
    }
    return {
      ...offer,
      badges: Array.from(new Set(computedBadges)),
    };
  });
};

export const sortSupplierOffers = (offers: SupplierOfferViewModel[]) =>
  [...offers].sort((a, b) => {
    const aInStock = (a.stockQuantity ?? 0) > 0;
    const bInStock = (b.stockQuantity ?? 0) > 0;
    if (aInStock !== bInStock) return aInStock ? -1 : 1;

    const aPrice = typeof a.price === "number" ? a.price : Number.POSITIVE_INFINITY;
    const bPrice = typeof b.price === "number" ? b.price : Number.POSITIVE_INFINITY;
    if (aPrice !== bPrice) return aPrice - bPrice;

    const aRank = a.offerRank ?? Number.POSITIVE_INFINITY;
    const bRank = b.offerRank ?? Number.POSITIVE_INFINITY;
    return aRank - bRank;
  });
