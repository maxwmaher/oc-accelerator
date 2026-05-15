#!/usr/bin/env -S npx tsx
import {
  AdminAddresses,
  Auth,
  Buyers,
  Catalogs,
  Categories,
  Configuration,
  InventoryRecords,
  Me,
  PriceSchedules,
  Products,
  Suppliers,
  Tokens,
  type Address,
  type ApiRole,
  type Catalog,
  type Category,
  type InventoryRecord,
  type PriceSchedule,
  type Product,
  type Supplier,
} from "ordercloud-javascript-sdk";

/**
 * Phase 1 supplier offers demo seed.
 *
 * Safety defaults:
 * - DRY_RUN defaults to true.
 * - Writes only run when SUPPLIER_OFFERS_DEMO_DRY_RUN=false or --write is passed.
 * - Existing records are saved/upserted but never deleted.
 * - Secrets/tokens are read from environment variables only.
 *
 * Suggested dry run from apps/admin:
 *   npx tsx scripts/seed-supplier-offers-demo.ts
 *
 * Suggested real run from apps/admin:
 *   SUPPLIER_OFFERS_DEMO_DRY_RUN=false npx tsx scripts/seed-supplier-offers-demo.ts
 *   # or: npx tsx scripts/seed-supplier-offers-demo.ts --write
 */

type SellerType = "admin" | "supplier";

type OfferProductConfig = {
  product: Product;
  priceSchedule: PriceSchedule;
  supplierID?: string;
  sellerID?: string;
  sellerType: SellerType;
  inventory: {
    address: Address;
    record: InventoryRecord;
  };
  expectedPrice: number;
};

type RequiredConfigKey =
  | "BUYER_ID"
  | "CATALOG_ID"
  | "CATEGORY_ID"
  | "MARKETPLACE_SELLER_ID"
  | "SUPPLIER_ABC_ID"
  | "SUPPLIER_NORDIC_ID"
  | "ABC_SUPPLIER_SELLER_ID"
  | "NORDIC_SUPPLIER_SELLER_ID";

const hasArg = (arg: string) => process.argv.includes(arg);
const env = (key: string, fallback = "") => process.env[key] || fallback;
const boolEnv = (key: string, defaultValue: boolean) => {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  return ["1", "true", "yes", "y"].includes(value.toLowerCase());
};

const normalizeApiConfig = (rawBaseApiUrl: string) => {
  const trimmed = rawBaseApiUrl.replace(/\/$/, "");
  const versionMatch = trimmed.match(/\/v(\d+)$/i);
  if (!versionMatch) {
    return { baseApiUrl: trimmed, apiVersion: env("OC_API_VERSION", "v1") };
  }
  return {
    baseApiUrl: trimmed.replace(/\/v\d+$/i, ""),
    apiVersion: `v${versionMatch[1]}`,
  };
};

const ENVIRONMENT = env("OC_ENVIRONMENT", "sandbox");
const BASE_API_URL = env("OC_BASE_API_URL", "https://api.ordercloud.io/v1");
const ADMIN_TOKEN = env("OC_ADMIN_TOKEN");
const ADMIN_CLIENT_ID = env("OC_ADMIN_CLIENT_ID");
const ADMIN_CLIENT_SECRET = env("OC_ADMIN_CLIENT_SECRET");
const ADMIN_SCOPE = env("OC_ADMIN_SCOPE", "FullAccess");
const BUYER_TOKEN = env("OC_BUYER_TOKEN");
const VERIFY_BUYER = boolEnv("SUPPLIER_OFFERS_DEMO_VERIFY_BUYER", Boolean(BUYER_TOKEN));
const DRY_RUN = hasArg("--write") ? false : boolEnv("SUPPLIER_OFFERS_DEMO_DRY_RUN", true);

const BUYER_ID = env("OC_DEMO_BUYER_ID", "");
const CATALOG_ID = env("OC_DEMO_CATALOG_ID", "SCANIA_PARTS_MARKETPLACE");
const CATEGORY_ID = env("OC_DEMO_CATEGORY_ID", "ELECTRICAL_SENSORS");
const MARKETPLACE_SELLER_ID = env("OC_MARKETPLACE_SELLER_ID", "");
const SUPPLIER_ABC_ID = env("OC_SUPPLIER_ABC_ID", "ABC_USED_PARTS_SUPPLIER");
const SUPPLIER_NORDIC_ID = env("OC_SUPPLIER_NORDIC_ID", "NORDIC_EDI_SUPPLIER");
const ABC_SUPPLIER_SELLER_ID = env("OC_ABC_SUPPLIER_SELLER_ID", SUPPLIER_ABC_ID);
const NORDIC_SUPPLIER_SELLER_ID = env("OC_NORDIC_SUPPLIER_SELLER_ID", SUPPLIER_NORDIC_ID);
const ASSIGN_INVENTORY_RECORDS_TO_BUYER = boolEnv("OC_DEMO_ASSIGN_INVENTORY_RECORDS_TO_BUYER", true);

const CANONICAL_PART_NUMBER = "SCANIA-APS-6007002";
const CANONICAL_NAME = "Active Pressure Sensor";
const CANONICAL_DESCRIPTION = "Replacement active pressure sensor for Scania heavy-duty trucks.";
const CANONICAL_BRAND = "Scania";

const PRODUCT_IDS = {
  direct: "SCANIA-APS-6007002-DIRECT",
  abc: "USED-APS-6007002-ABC",
  nordic: "EDI-APS-6007002-NORDIC",
} as const;

const PRICE_SCHEDULE_IDS = {
  direct: "PS-SCANIA-APS-6007002-DIRECT",
  abc: "PS-USED-APS-6007002-ABC",
  nordic: "PS-EDI-APS-6007002-NORDIC",
} as const;

const ADDRESS_IDS = {
  direct: "ADDR-SCANIA-SE-CENTRAL-APS-6007002",
  abc: "ADDR-ABC-DE-NORTH-APS-6007002",
  nordic: "ADDR-NORDIC-SE-SOUTH-APS-6007002",
} as const;

const INVENTORY_RECORD_IDS = {
  direct: "INV-SCANIA-SE-CENTRAL-APS-6007002",
  abc: "INV-ABC-DE-NORTH-APS-6007002",
  nordic: "INV-NORDIC-SE-SOUTH-APS-6007002",
} as const;

const requiredConfig: Record<RequiredConfigKey, string> = {
  BUYER_ID,
  CATALOG_ID,
  CATEGORY_ID,
  MARKETPLACE_SELLER_ID,
  SUPPLIER_ABC_ID,
  SUPPLIER_NORDIC_ID,
  ABC_SUPPLIER_SELLER_ID,
  NORDIC_SUPPLIER_SELLER_ID,
};

const compatibility = {
  summary: "Compatible with Scania R-Series, P-Series, and G-Series",
  vehicleVariants: ["R-Series", "P-Series", "G-Series"],
  modelYears: ["2019", "2020", "2021", "2022", "2023", "2024"],
  fitmentNotes: "Verify connector type before installation.",
};

const technicalSpecs = [
  { label: "Type", value: "Active Pressure Sensor" },
  { label: "Voltage", value: "12V / 24V" },
  { label: "Mounting Type", value: "Bolt-on" },
  { label: "Connector Type", value: "2-pin sealed" },
  { label: "Operating Temperature", value: "-40°C to +125°C" },
  { label: "Protection Class", value: "IP67" },
];

const catalog: Catalog = {
  ID: CATALOG_ID,
  Name: "Scania Parts Marketplace",
  Active: true,
  xp: {
    demoPurpose: "Supplier offers demo catalog",
  },
};

const category: Category = {
  ID: CATEGORY_ID,
  Name: "Electrical Sensors",
  Active: true,
  xp: {
    Description: "Sensors and electrical components for Scania heavy-duty trucks.",
  },
};

const abcSupplier: Supplier = {
  ID: SUPPLIER_ABC_ID,
  Name: "ABC Used Parts Supplier",
  Active: true,
  xp: {
    displayName: "ABC Used Parts Supplier",
    maturityLevel: "Ad hoc supplier",
    catalogModel: "Ad hoc product creation through supplier portal",
    pricingModel: "Partially admin-controlled pricing",
    pricingModelLabel: "Supplier proposes price; admin governs approval",
    demoRole: "Used/refurbished part offer",
  },
};

const nordicSupplier: Supplier = {
  ID: SUPPLIER_NORDIC_ID,
  Name: "Nordic EDI Supplier",
  Active: true,
  xp: {
    displayName: "Nordic EDI Supplier",
    maturityLevel: "Integrated supplier",
    catalogModel: "EDI/catalog synchronization",
    pricingModel: "Supplier-controlled pricing",
    pricingModelLabel: "Supplier-controlled direct price",
    demoRole: "EDI-updated supplier offer",
  },
};

const sharedProductXp = {
  canonicalPartNumber: CANONICAL_PART_NUMBER,
  canonicalName: CANONICAL_NAME,
  canonicalDescription: CANONICAL_DESCRIPTION,
  canonicalBrand: CANONICAL_BRAND,
  compatibility,
  technicalSpecs,
};

const priceSchedule = (id: string, name: string, price: number, supplierDisplayName: string, pricingModel: string): PriceSchedule => ({
  ID: id,
  Name: name,
  ApplyTax: true,
  ApplyShipping: true,
  MinQuantity: 1,
  UseCumulativeQuantity: false,
  RestrictedQuantity: false,
  PriceBreaks: [{ Quantity: 1, Price: price }],
  xp: {
    canonicalPartNumber: CANONICAL_PART_NUMBER,
    supplierDisplayName,
    pricingModel,
  },
});

const offerProducts: OfferProductConfig[] = [
  {
    sellerType: "admin",
    expectedPrice: 124.5,
    priceSchedule: priceSchedule(
      PRICE_SCHEDULE_IDS.direct,
      "Scania Direct - Active Pressure Sensor",
      124.5,
      "Scania Direct",
      "Admin-controlled pricing",
    ),
    product: {
      ID: PRODUCT_IDS.direct,
      Name: CANONICAL_NAME,
      Description: CANONICAL_DESCRIPTION,
      Active: true,
      DefaultPriceScheduleID: PRICE_SCHEDULE_IDS.direct,
      Inventory: {
        Enabled: true,
        QuantityAvailable: 24,
      },
      xp: {
        ...sharedProductXp,
        isCanonicalPrimary: true,
        displayRank: 10,
        supplier: {
          id: "scania-direct",
          displayName: "Scania Direct",
          sellerType: "admin",
          sellerID: MARKETPLACE_SELLER_ID,
          maturityLevel: "Mature distributor-managed supplier",
          catalogModel: "Products and catalog managed directly in OrderCloud",
          pricingModel: "Admin-controlled pricing",
          pricingModelLabel: "Distributor-controlled price with margin",
          demoRole: "Primary Scania-managed offer",
        },
        offer: {
          deliveryEstimate: "2-3 business days",
          warranty: "2 years",
          shippingLabel: "Free shipping",
          shippingCost: 0,
          warehouseRegion: "Sweden Central",
          warehouseName: "Scania Sweden Central DC",
          badges: ["Best Offer"],
          offerRank: 1,
        },
        catalogUpdate: {
          source: "OrderCloud Supplier Portal",
          updateModel: "Manual portal/catalog management",
        },
      },
    },
    inventory: {
      address: {
        ID: ADDRESS_IDS.direct,
        AddressName: "Scania Sweden Central DC",
        CompanyName: "Scania Direct",
        Street1: "Södertälje Distribution Center",
        City: "Södertälje",
        State: "Stockholm County",
        Zip: "151 87",
        Country: "SE",
        xp: {
          warehouseRegion: "Sweden Central",
          warehouseName: "Scania Sweden Central DC",
        },
      },
      record: {
        ID: INVENTORY_RECORD_IDS.direct,
        AddressID: ADDRESS_IDS.direct,
        AllowAllBuyers: false,
        OrderCanExceed: false,
        QuantityAvailable: 24,
        xp: {
          warehouseRegion: "Sweden Central",
          warehouseName: "Scania Sweden Central DC",
          deliveryEstimate: "2-3 business days",
        },
      },
    },
  },
  {
    sellerType: "supplier",
    supplierID: SUPPLIER_ABC_ID,
    sellerID: ABC_SUPPLIER_SELLER_ID,
    expectedPrice: 109,
    priceSchedule: priceSchedule(
      PRICE_SCHEDULE_IDS.abc,
      "ABC Used Parts - Active Pressure Sensor",
      109,
      "ABC Used Parts Supplier",
      "Partially admin-controlled pricing",
    ),
    product: {
      ID: PRODUCT_IDS.abc,
      Name: "Active Pressure Sensor - Used Grade A",
      Description: "Used Grade A active pressure sensor for Scania heavy-duty trucks. Inspected and tested.",
      Active: true,
      DefaultSupplierID: SUPPLIER_ABC_ID,
      DefaultPriceScheduleID: PRICE_SCHEDULE_IDS.abc,
      Inventory: {
        Enabled: true,
        QuantityAvailable: 3,
      },
      xp: {
        ...sharedProductXp,
        isCanonicalPrimary: false,
        displayRank: 20,
        supplier: {
          id: SUPPLIER_ABC_ID,
          displayName: "ABC Used Parts Supplier",
          sellerType: "supplier",
          sellerID: ABC_SUPPLIER_SELLER_ID,
          maturityLevel: "Ad hoc supplier",
          catalogModel: "Ad hoc product creation through supplier portal",
          pricingModel: "Partially admin-controlled pricing",
          pricingModelLabel: "Supplier proposes price; admin governs approval",
          demoRole: "Used/refurbished part offer",
        },
        offer: {
          deliveryEstimate: "3-5 business days",
          warranty: "1 year",
          shippingLabel: "Calculated at checkout",
          shippingCost: null,
          warehouseRegion: "Germany North",
          warehouseName: "ABC Hamburg Used Parts Warehouse",
          badges: ["Lowest Offer"],
          offerRank: 2,
        },
        condition: {
          type: "Used",
          grade: "A",
          mileage: "42,000 km",
          vin: null,
          inspectionStatus: "Inspected and tested",
        },
        catalogUpdate: {
          source: "Supplier Portal",
          updateModel: "Ad hoc product entry",
        },
      },
    },
    inventory: {
      address: {
        ID: ADDRESS_IDS.abc,
        AddressName: "ABC Hamburg Used Parts Warehouse",
        CompanyName: "ABC Used Parts Supplier",
        Street1: "Demo Warehouse North",
        City: "Hamburg",
        State: "Hamburg",
        Zip: "20095",
        Country: "DE",
        xp: {
          warehouseRegion: "Germany North",
          warehouseName: "ABC Hamburg Used Parts Warehouse",
        },
      },
      record: {
        ID: INVENTORY_RECORD_IDS.abc,
        AddressID: ADDRESS_IDS.abc,
        AllowAllBuyers: false,
        OrderCanExceed: false,
        QuantityAvailable: 3,
        xp: {
          warehouseRegion: "Germany North",
          warehouseName: "ABC Hamburg Used Parts Warehouse",
          deliveryEstimate: "3-5 business days",
        },
      },
    },
  },
  {
    sellerType: "supplier",
    supplierID: SUPPLIER_NORDIC_ID,
    sellerID: NORDIC_SUPPLIER_SELLER_ID,
    expectedPrice: 117.25,
    priceSchedule: priceSchedule(
      PRICE_SCHEDULE_IDS.nordic,
      "Nordic EDI Supplier - Active Pressure Sensor",
      117.25,
      "Nordic EDI Supplier",
      "Supplier-controlled pricing",
    ),
    product: {
      ID: PRODUCT_IDS.nordic,
      Name: "Active Pressure Sensor - Nordic EDI Supplier",
      Description: "Active pressure sensor supplied by Nordic EDI Supplier with synchronized catalog, price, and availability updates.",
      Active: true,
      DefaultSupplierID: SUPPLIER_NORDIC_ID,
      DefaultPriceScheduleID: PRICE_SCHEDULE_IDS.nordic,
      Inventory: {
        Enabled: true,
        QuantityAvailable: 28,
      },
      xp: {
        ...sharedProductXp,
        isCanonicalPrimary: false,
        displayRank: 30,
        supplier: {
          id: SUPPLIER_NORDIC_ID,
          displayName: "Nordic EDI Supplier",
          sellerType: "supplier",
          sellerID: NORDIC_SUPPLIER_SELLER_ID,
          maturityLevel: "Integrated supplier",
          catalogModel: "EDI/catalog synchronization",
          pricingModel: "Supplier-controlled pricing",
          pricingModelLabel: "Supplier-controlled direct price",
          demoRole: "EDI-updated supplier offer",
        },
        offer: {
          deliveryEstimate: "1-2 business days",
          warranty: "18 months",
          shippingLabel: "Calculated at checkout",
          shippingCost: null,
          warehouseRegion: "Sweden South",
          warehouseName: "Nordic Malmö Fulfillment Hub",
          badges: [],
          offerRank: 3,
        },
        catalogUpdate: {
          source: "EDI/catalog sync",
          updateModel: "EDI/catalog sync",
          lastSyncStatus: "Successful",
          recordsUpdated: 184,
          availabilityUpdated: true,
          pricingUpdated: true,
        },
      },
    },
    inventory: {
      address: {
        ID: ADDRESS_IDS.nordic,
        AddressName: "Nordic Malmö Fulfillment Hub",
        CompanyName: "Nordic EDI Supplier",
        Street1: "Demo Fulfillment Hub South",
        City: "Malmö",
        State: "Skåne",
        Zip: "211 20",
        Country: "SE",
        xp: {
          warehouseRegion: "Sweden South",
          warehouseName: "Nordic Malmö Fulfillment Hub",
        },
      },
      record: {
        ID: INVENTORY_RECORD_IDS.nordic,
        AddressID: ADDRESS_IDS.nordic,
        AllowAllBuyers: false,
        OrderCanExceed: false,
        QuantityAvailable: 28,
        xp: {
          warehouseRegion: "Sweden South",
          warehouseName: "Nordic Malmö Fulfillment Hub",
          deliveryEstimate: "1-2 business days",
        },
      },
    },
  },
];

const log = (message: string) => console.log(message);
const warn = (message: string) => console.warn(`[WARN] ${message}`);
const errorLog = (message: string) => console.error(`[ERROR] ${message}`);
const actionLog = (resource: string, id: string) => log(`${DRY_RUN ? "[DRY RUN] would save" : "[SAVE]"} ${resource} ${id}`);
const skipLog = (resource: string, id: string) => log(`[SKIP] ${resource} ${id} already exists`);
const verifyLog = (message: string) => log(`[VERIFY] ${message}`);

const getErrorStatus = (error: unknown): number | undefined => {
  if (!error || typeof error !== "object") return undefined;
  const maybeStatus = error as { status?: unknown; statusCode?: unknown; response?: { status?: unknown } };
  const status = maybeStatus.status ?? maybeStatus.statusCode ?? maybeStatus.response?.status;
  if (typeof status === "number") return status;
  if (typeof status === "string") {
    const parsedStatus = Number.parseInt(status, 10);
    return Number.isNaN(parsedStatus) ? undefined : parsedStatus;
  }
  return undefined;
};

const collectErrorText = (value: unknown, seen = new WeakSet<object>()): string[] => {
  if (typeof value === "string" || typeof value === "number") return [String(value)];
  if (!value || typeof value !== "object" || seen.has(value)) return [];

  seen.add(value);
  if (Array.isArray(value)) return value.flatMap((item) => collectErrorText(item, seen));

  return Object.entries(value).flatMap(([key, nestedValue]) =>
    ["message", "Message", "error", "Error", "errorCode", "ErrorCode", "code", "Code", "statusText"].includes(key)
      ? collectErrorText(nestedValue, seen)
      : [],
  );
};

const isAlreadyExistsError = (error: unknown): boolean => {
  const status = getErrorStatus(error);
  const text = collectErrorText(error).join(" ").toLowerCase();
  const hasAlreadyExistsText = /\balready exists\b|\bobject already exists\b/.test(text);
  const hasConflictText = /\bconflict\b/.test(text);

  return hasAlreadyExistsText || status === 409 || (status === undefined && hasConflictText && hasAlreadyExistsText);
};

const requireConfig = () => {
  const missing = Object.entries(requiredConfig)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length) {
    throw new Error(
      `Missing required demo ID(s): ${missing.join(", ")}. Set the corresponding OC_* environment variables before running.`,
    );
  }

  if (!ADMIN_TOKEN && (!ADMIN_CLIENT_ID || !ADMIN_CLIENT_SECRET)) {
    throw new Error(
      "Missing admin authentication. Set OC_ADMIN_TOKEN, or set OC_ADMIN_CLIENT_ID and OC_ADMIN_CLIENT_SECRET.",
    );
  }
};

const configureSdk = () => {
  const { baseApiUrl, apiVersion } = normalizeApiConfig(BASE_API_URL);
  Configuration.Set({ baseApiUrl, apiVersion });
  log(`[CONFIG] environment=${ENVIRONMENT} baseApiUrl=${baseApiUrl} apiVersion=${apiVersion} dryRun=${DRY_RUN}`);
};

const authenticateAdmin = async () => {
  if (ADMIN_TOKEN) {
    Tokens.SetAccessToken(ADMIN_TOKEN);
    log("[CONFIG] using OC_ADMIN_TOKEN for admin authentication");
    return;
  }

  log("[CONFIG] requesting admin token with client credentials");
  const token = await Auth.ClientCredentials(ADMIN_CLIENT_SECRET, ADMIN_CLIENT_ID, ADMIN_SCOPE.split(/[ ,]+/).filter(Boolean) as ApiRole[]);
  if (!token.access_token) {
    throw new Error("Admin client credentials response did not include an access_token.");
  }
  Tokens.SetAccessToken(token.access_token);
};

const safeGet = async <T>(label: string, getter: () => Promise<T>) => {
  try {
    const result = await getter();
    log(`[FOUND] ${label}`);
    return result;
  } catch {
    warn(`${label} was not found or could not be read. It will be created/updated if this is not a dry run.`);
    return undefined;
  }
};

const saveIfEnabled = async <T>(resource: string, id: string, saver: () => Promise<T>) => {
  actionLog(resource, id);
  if (DRY_RUN) return undefined;
  return saver();
};

const saveIdempotentAssignmentIfEnabled = async <T>(resource: string, id: string, saver: () => Promise<T>) => {
  try {
    return await saveIfEnabled(resource, id, saver);
  } catch (error) {
    if (isAlreadyExistsError(error)) {
      skipLog(resource, id);
      return undefined;
    }
    throw error;
  }
};

const preflight = async () => {
  log("[PREFLIGHT] verifying admin authentication and configured resources");
  const me = await Me.Get();
  log(`[PREFLIGHT] authenticated as ${me.Username || me.ID || "unknown user"}`);
  if (me.Seller?.ID) {
    log(`[PREFLIGHT] current marketplace seller context: ${me.Seller.ID}`);
    if (me.Seller.ID !== MARKETPLACE_SELLER_ID) {
      warn(
        `OC_MARKETPLACE_SELLER_ID=${MARKETPLACE_SELLER_ID} does not match authenticated seller context ${me.Seller.ID}. Confirm this before real seeding.`,
      );
    }
  } else {
    warn("Authenticated user did not include Seller.ID; confirm OC_MARKETPLACE_SELLER_ID manually.");
  }

  await safeGet(`buyer ${BUYER_ID}`, () => Buyers.Get(BUYER_ID));
  await safeGet(`catalog ${CATALOG_ID}`, () => Catalogs.Get(CATALOG_ID));
  await safeGet(`category ${CATEGORY_ID}`, () => Categories.Get(CATALOG_ID, CATEGORY_ID));
  await safeGet(`supplier ${SUPPLIER_ABC_ID}`, () => Suppliers.Get(SUPPLIER_ABC_ID));
  await safeGet(`supplier ${SUPPLIER_NORDIC_ID}`, () => Suppliers.Get(SUPPLIER_NORDIC_ID));
};

const saveSuppliers = async () => {
  await saveIfEnabled("supplier", SUPPLIER_ABC_ID, () => Suppliers.Save(SUPPLIER_ABC_ID, abcSupplier));
  await saveIfEnabled("supplier", SUPPLIER_NORDIC_ID, () => Suppliers.Save(SUPPLIER_NORDIC_ID, nordicSupplier));
};

const saveCatalogAndCategory = async () => {
  await saveIfEnabled("catalog", CATALOG_ID, () => Catalogs.Save(CATALOG_ID, catalog));
  await saveIfEnabled("category", `${CATALOG_ID}/${CATEGORY_ID}`, () => Categories.Save(CATALOG_ID, CATEGORY_ID, category));
};

const savePriceSchedules = async () => {
  for (const offer of offerProducts) {
    await saveIfEnabled("price schedule", offer.priceSchedule.ID || "unknown", () =>
      PriceSchedules.Save(offer.priceSchedule.ID || "", offer.priceSchedule),
    );
  }
};

const saveProducts = async () => {
  for (const offer of offerProducts) {
    await saveIfEnabled("product", offer.product.ID || "unknown", () => Products.Save(offer.product.ID || "", offer.product));
    if (offer.supplierID) {
      await saveIdempotentAssignmentIfEnabled("product supplier link", `${offer.product.ID}/${offer.supplierID}`, () =>
        Products.SaveSupplier(offer.product.ID || "", offer.supplierID || "", {
          defaultPriceScheduleID: offer.priceSchedule.ID,
        }),
      );
    }
  }
};

const saveAssignments = async () => {
  await saveIdempotentAssignmentIfEnabled("catalog assignment", `${CATALOG_ID}/${BUYER_ID}`, () =>
    Catalogs.SaveAssignment({
      CatalogID: CATALOG_ID,
      BuyerID: BUYER_ID,
      ViewAllCategories: false,
      ViewAllProducts: false,
    }),
  );

  await saveIdempotentAssignmentIfEnabled("category assignment", `${CATALOG_ID}/${CATEGORY_ID}/${BUYER_ID}`, () =>
    Categories.SaveAssignment(CATALOG_ID, {
      CategoryID: CATEGORY_ID,
      BuyerID: BUYER_ID,
      Visible: true,
      ViewAllProducts: false,
    }),
  );

  for (const offer of offerProducts) {
    const productID = offer.product.ID || "";
    const priceScheduleID = offer.priceSchedule.ID || "";

    await saveIdempotentAssignmentIfEnabled("catalog product assignment", `${CATALOG_ID}/${productID}`, () =>
      Catalogs.SaveProductAssignment({
        CatalogID: CATALOG_ID,
        ProductID: productID,
      }),
    );

    await saveIdempotentAssignmentIfEnabled("category product assignment", `${CATALOG_ID}/${CATEGORY_ID}/${productID}`, () =>
      Categories.SaveProductAssignment(CATALOG_ID, {
        CategoryID: CATEGORY_ID,
        ProductID: productID,
      }),
    );

    await saveIdempotentAssignmentIfEnabled("product assignment", `${productID}/${BUYER_ID}/${priceScheduleID}`, () =>
      Products.SaveAssignment({
        ProductID: productID,
        BuyerID: BUYER_ID,
        SellerID: offer.sellerID,
        PriceScheduleID: priceScheduleID,
      }),
    );
  }
};

const saveBuyerSupplierEligibility = async () => {
  log("[INFO] configuring buyer-supplier eligibility with Suppliers.SaveBuyer(supplierID, buyerID)");
  await saveIdempotentAssignmentIfEnabled("supplier buyer eligibility", `${SUPPLIER_ABC_ID}/${BUYER_ID}`, () =>
    Suppliers.SaveBuyer(SUPPLIER_ABC_ID, BUYER_ID),
  );
  await saveIdempotentAssignmentIfEnabled("supplier buyer eligibility", `${SUPPLIER_NORDIC_ID}/${BUYER_ID}`, () =>
    Suppliers.SaveBuyer(SUPPLIER_NORDIC_ID, BUYER_ID),
  );
  warn(
    "After a real run, verify Me.ListBuyerSellers with a buyer token. If ABC or Nordic is missing, configure buyer-supplier eligibility manually in this marketplace.",
  );
};

const saveInventoryRecords = async () => {
  for (const offer of offerProducts) {
    const productID = offer.product.ID || "";
    const addressID = offer.inventory.address.ID || "";
    const inventoryRecordID = offer.inventory.record.ID || "";

    try {
      await saveIfEnabled("admin address", addressID, () => AdminAddresses.Save(addressID, offer.inventory.address));
      await saveIfEnabled("inventory record", `${productID}/${inventoryRecordID}`, () =>
        InventoryRecords.Save(productID, inventoryRecordID, offer.inventory.record),
      );
    } catch (error) {
      warn(
        `inventory record setup failed for ${productID}/${inventoryRecordID}; product-level Inventory.QuantityAvailable remains seeded. ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      continue;
    }

    if (ASSIGN_INVENTORY_RECORDS_TO_BUYER) {
      await saveIdempotentAssignmentIfEnabled("inventory record assignment", `${productID}/${inventoryRecordID}/${BUYER_ID}`, () =>
        InventoryRecords.SaveAssignment(productID, {
          InventoryRecordID: inventoryRecordID,
          BuyerID: BUYER_ID,
        }),
      );
    } else {
      warn(`skipping inventory record buyer assignment for ${inventoryRecordID}; OC_DEMO_ASSIGN_INVENTORY_RECORDS_TO_BUYER=false`);
    }
  }
};

const assertPrice = (actual: number | undefined, expected: number, productID: string) => {
  if (actual === undefined || Math.abs(actual - expected) > 0.0001) {
    throw new Error(`Price verification failed for ${productID}: expected ${expected}, got ${actual ?? "undefined"}`);
  }
};

const verifyBuyerAccess = async () => {
  if (!BUYER_TOKEN) {
    warn("OC_BUYER_TOKEN is not set; skipping buyer-context verification.");
    return;
  }

  if (!VERIFY_BUYER) {
    warn("SUPPLIER_OFFERS_DEMO_VERIFY_BUYER=false; skipping buyer-context verification.");
    return;
  }

  verifyLog("checking Me.ListBuyerSellers includes ABC and Nordic");
  const buyerSellers = await Me.ListBuyerSellers({ pageSize: 100, sortBy: ["Name"] }, { accessToken: BUYER_TOKEN });
  const sellerIDs = new Set((buyerSellers.Items || []).map((seller) => seller.ID));
  for (const sellerID of [ABC_SUPPLIER_SELLER_ID, NORDIC_SUPPLIER_SELLER_ID]) {
    if (!sellerIDs.has(sellerID)) {
      warn(`buyer token cannot see supplier seller ${sellerID}. Configure buyer-supplier eligibility manually if Suppliers.SaveBuyer did not resolve it.`);
    } else {
      verifyLog(`buyer can access supplier seller ${sellerID}`);
    }
  }

  for (const offer of offerProducts) {
    const productID = offer.product.ID || "";
    verifyLog(`checking Me.GetProduct ${productID}${offer.sellerID ? ` sellerID=${offer.sellerID}` : ""}`);
    const buyerProduct = await Me.GetProduct(
      productID,
      offer.sellerID ? { sellerID: offer.sellerID } : undefined,
      { accessToken: BUYER_TOKEN },
    );

    if (buyerProduct.xp?.canonicalPartNumber !== CANONICAL_PART_NUMBER) {
      throw new Error(`Canonical part verification failed for ${productID}`);
    }
    assertPrice(buyerProduct.PriceSchedule?.PriceBreaks?.[0]?.Price, offer.expectedPrice, productID);

    const quantity = buyerProduct.Inventory?.QuantityAvailable;
    if (quantity === undefined) {
      warn(`${productID} buyer-context product response did not include Inventory.QuantityAvailable`);
    } else {
      verifyLog(`${productID} inventory quantity=${quantity}`);
    }

    try {
      verifyLog(`checking Me.ListProductInventoryRecords ${productID}`);
      const records = await Me.ListProductInventoryRecords(productID, { pageSize: 100 }, { accessToken: BUYER_TOKEN });
      const expectedRecordID = offer.inventory.record.ID;
      if (!records.Items?.some((record) => record.ID === expectedRecordID)) {
        warn(`${productID} buyer-context inventory records did not include ${expectedRecordID}; relying on product-level inventory.`);
      } else {
        verifyLog(`${productID} inventory record ${expectedRecordID} is visible`);
      }
    } catch (error) {
      warn(
        `${productID} buyer-context inventory record verification failed; relying on product-level inventory. ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  verifyLog("checking list query by catalog/category and sellerID");
  for (const offer of offerProducts) {
    const result = await Me.ListProducts(
      {
        catalogID: CATALOG_ID,
        categoryID: CATEGORY_ID,
        sellerID: offer.sellerID,
        pageSize: 100,
      },
      { accessToken: BUYER_TOKEN },
    );
    if (!result.Items?.some((product) => product.ID === offer.product.ID)) {
      warn(`list query did not return ${offer.product.ID}; confirm catalog/category/product assignments and seller context.`);
    } else {
      verifyLog(`list query returned ${offer.product.ID}`);
    }
  }

  verifyLog("checking optional xp.canonicalPartNumber filter support");
  for (const offer of offerProducts) {
    const result = await Me.ListProducts(
      {
        catalogID: CATALOG_ID,
        categoryID: CATEGORY_ID,
        sellerID: offer.sellerID,
        pageSize: 100,
        filters: { "xp.canonicalPartNumber": CANONICAL_PART_NUMBER },
      },
      { accessToken: BUYER_TOKEN },
    );
    if (!result.Items?.some((product) => product.ID === offer.product.ID)) {
      warn(`xp.canonicalPartNumber filter did not return ${offer.product.ID}; future UI may need to filter related offers client-side.`);
    } else {
      verifyLog(`xp.canonicalPartNumber filter returned ${offer.product.ID}`);
    }
  }
};

const main = async () => {
  try {
    requireConfig();
    configureSdk();
    await authenticateAdmin();
    await preflight();
    await saveSuppliers();
    await saveCatalogAndCategory();
    await savePriceSchedules();
    await saveProducts();
    await saveAssignments();
    await saveBuyerSupplierEligibility();
    await saveInventoryRecords();
    await verifyBuyerAccess();
    log(DRY_RUN ? "[DONE] dry run complete; no records were written." : "[DONE] supplier offers demo seed complete.");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errorLog(message);
    process.exitCode = 1;
  }
};

void main();
