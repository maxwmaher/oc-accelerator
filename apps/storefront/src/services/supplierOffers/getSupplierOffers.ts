import { BuyerProduct, InventoryRecord, Me } from "ordercloud-javascript-sdk";
import {
  applyComputedOfferBadges,
  normalizeSupplierOffer,
  sortSupplierOffers,
} from "./normalizeSupplierOffer";
import {
  SupplierOfferQueryContext,
  SupplierOffersResult,
  SupplierOfferSellerSource,
} from "./types";

interface SupplierOfferProductXp {
  canonicalPartNumber?: string;
  catalogID?: string;
  categoryID?: string;
  catalog?: { ID?: string };
  category?: { ID?: string };
  supplier?: {
    id?: string;
    sellerID?: string;
    sellerType?: string;
  };
}

type InventoryRecordListOptions = { pageSize: number; sellerID?: string };

const getProductXp = (product: BuyerProduct) =>
  product.xp as SupplierOfferProductXp | undefined;

const getCanonicalPartNumber = (product: BuyerProduct) =>
  getProductXp(product)?.canonicalPartNumber;

const getCatalogID = (product: BuyerProduct, context: SupplierOfferQueryContext) => {
  const xp = getProductXp(product);
  return context.catalogID || xp?.catalogID || xp?.catalog?.ID;
};

const getCategoryID = (product: BuyerProduct, context: SupplierOfferQueryContext) => {
  const xp = getProductXp(product);
  return context.categoryID || xp?.categoryID || xp?.category?.ID;
};

const getProductSupplierSellerID = (product: BuyerProduct) => {
  const xp = getProductXp(product);
  return xp?.supplier?.sellerID || xp?.supplier?.id || product.DefaultSupplierID;
};

const isSupplierOwnedProduct = (product: BuyerProduct) => {
  const xp = getProductXp(product);
  return Boolean(product.DefaultSupplierID || xp?.supplier?.sellerType === "supplier");
};

const productMatchesSource = (
  product: BuyerProduct,
  source: SupplierOfferSellerSource
) => {
  if (source.sellerType === "admin") {
    return !isSupplierOwnedProduct(product);
  }

  const productSupplierSellerID = getProductSupplierSellerID(product);
  return !productSupplierSellerID || productSupplierSellerID === source.sellerID;
};

const preferOffer = (
  current: ReturnType<typeof normalizeSupplierOffer> | undefined,
  next: ReturnType<typeof normalizeSupplierOffer> | undefined
) => {
  if (!current) return next;
  if (!next) return current;

  const currentMatchesOwnership =
    current.sellerType === "supplier" && current.sellerID === getProductSupplierSellerID(current.product);
  const nextMatchesOwnership =
    next.sellerType === "supplier" && next.sellerID === getProductSupplierSellerID(next.product);

  if (currentMatchesOwnership !== nextMatchesOwnership) {
    return nextMatchesOwnership ? next : current;
  }

  if (current.sellerType !== next.sellerType) {
    return next.sellerType === "supplier" ? next : current;
  }

  return current;
};

const fetchInventoryRecords = async (
  productID: string,
  source: SupplierOfferSellerSource
): Promise<InventoryRecord[]> => {
  const listOptions: InventoryRecordListOptions = {
    pageSize: 100,
    ...(source.sellerID ? { sellerID: source.sellerID } : {}),
  };
  const result = await Me.ListProductInventoryRecords(productID, listOptions);
  return (result.Items || []) as InventoryRecord[];
};

export const getSupplierOffers = async (
  currentProduct: BuyerProduct,
  context: SupplierOfferQueryContext
): Promise<SupplierOffersResult> => {
  const canonicalPartNumber = getCanonicalPartNumber(currentProduct);
  if (!canonicalPartNumber) {
    return { offers: [], warnings: [] };
  }

  const catalogID = getCatalogID(currentProduct, context);
  const categoryID = getCategoryID(currentProduct, context);
  const warnings: SupplierOffersResult["warnings"] = [];
  const offersBySource = await Promise.all(
    context.sellerSources.map(async (source) => {
      try {
        const productsResult = await Me.ListProducts({
          pageSize: 100,
          ...(catalogID ? { catalogID } : {}),
          ...(categoryID ? { categoryID } : {}),
          ...(source.sellerID ? { sellerID: source.sellerID } : {}),
          filters: { "xp.canonicalPartNumber": canonicalPartNumber },
        });

        const sourceProducts = (productsResult.Items || []).filter((product) =>
          productMatchesSource(product, source)
        );

        const offers = await Promise.all(
          sourceProducts.map(async (product) => {
            try {
              const inventoryRecords = product.ID
                ? await fetchInventoryRecords(product.ID, source)
                : [];
              return normalizeSupplierOffer({ product, source, inventoryRecords });
            } catch (error) {
              warnings.push({
                source: source.displayName,
                message: `Inventory records unavailable for ${product.ID || "offer"}.`,
              });
              return normalizeSupplierOffer({ product, source });
            }
          })
        );

        return offers.filter(
          (offer): offer is NonNullable<typeof offer> => Boolean(offer)
        );
      } catch (error) {
        warnings.push({
          source: source.displayName,
          message: "Offer products could not be loaded for this seller.",
        });
        return [];
      }
    })
  );

  const uniqueOffers = offersBySource.flat().reduce((offerMap, offer) => {
    const existingOffer = offerMap.get(offer.productID);
    const preferredOffer = preferOffer(existingOffer, offer);
    if (preferredOffer) {
      offerMap.set(offer.productID, preferredOffer);
    }
    return offerMap;
  }, new Map<string, NonNullable<ReturnType<typeof normalizeSupplierOffer>>>());
  const offers = Array.from(uniqueOffers.values());

  return {
    offers: sortSupplierOffers(applyComputedOfferBadges(offers)),
    warnings,
  };
};
