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

        const offers = await Promise.all(
          (productsResult.Items || []).map(async (product) => {
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

  const uniqueOffers = new Map(
    offersBySource.flat().map((offer) => [
      `${offer?.sellerID || "admin"}:${offer?.productID}`,
      offer,
    ])
  );
  const offers = Array.from(uniqueOffers.values()).filter(
    (offer): offer is NonNullable<typeof offer> => Boolean(offer)
  );

  return {
    offers: sortSupplierOffers(applyComputedOfferBadges(offers)),
    warnings,
  };
};
