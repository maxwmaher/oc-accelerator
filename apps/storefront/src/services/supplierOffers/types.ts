import { BuyerProduct, InventoryRecord } from "ordercloud-javascript-sdk";

export type SupplierOfferSellerType = "admin" | "supplier";

export interface SupplierOfferSellerSource {
  sellerType: SupplierOfferSellerType;
  sellerID?: string;
  displayName: string;
}

export interface SupplierOfferQueryContext {
  catalogID?: string;
  categoryID?: string;
  sellerSources: SupplierOfferSellerSource[];
}

export interface SupplierOfferInventoryLocation {
  id?: string;
  name?: string;
  street1?: string;
  street2?: string;
  city?: string;
  state?: string;
  zip?: string;
  quantityAvailable?: number;
}

export interface SupplierOfferViewModel {
  productID: string;
  productName: string;
  sellerType: SupplierOfferSellerType;
  sellerID?: string;
  supplierDisplayName: string;
  pricingModelLabel?: string;
  price?: number;
  deliveryEstimate?: string;
  warranty?: string;
  shippingLabel?: string;
  warehouseRegion?: string;
  warehouseName?: string;
  stockQuantity?: number;
  badges: string[];
  conditionSummary?: string;
  catalogUpdateSummary?: string;
  compatibilitySummary?: string;
  technicalSpecs: Array<{ label: string; value: string }>;
  inventoryRecordID?: string;
  inventoryLocations: SupplierOfferInventoryLocation[];
  offerRank?: number;
  product: BuyerProduct;
}

export interface SupplierOfferWarning {
  source: string;
  message: string;
}

export interface SupplierOffersResult {
  offers: SupplierOfferViewModel[];
  warnings: SupplierOfferWarning[];
}

export interface SupplierOfferNormalizeOptions {
  product: BuyerProduct;
  source: SupplierOfferSellerSource;
  inventoryRecords?: InventoryRecord[];
}
