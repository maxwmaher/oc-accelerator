export const BRISTAN_DEMO_CATALOG_IDS = {
  spares: "bristan-demo-spares-catalog",
  marketplace: "bristan-demo-marketplace-catalog",
  supplierNorth: "bristan-demo-supplier-north-catalog",
  supplierSouth: "bristan-demo-supplier-south-catalog",
} as const;

export const BRISTAN_DEMO_JOURNEY_ROUTES = {
  spares: `/shop/${BRISTAN_DEMO_CATALOG_IDS.spares}/categories`,
  marketplace: `/shop/${BRISTAN_DEMO_CATALOG_IDS.marketplace}/products`,
  supplierNorth: `/shop/${BRISTAN_DEMO_CATALOG_IDS.supplierNorth}/products`,
  supplierSouth: `/shop/${BRISTAN_DEMO_CATALOG_IDS.supplierSouth}/products`,
} as const;

export const BRISTAN_DEMO_ACCOUNTS = [
  {
    persona: "Installer / Spare Parts",
    story:
      "Accessories-only spare parts self-service for installers and builders who need to quickly identify Bristan replacement parts.",
    username: "bristan-demo-spares-user",
    buyerID: "bristan-demo-spares-buyer",
    catalogID: BRISTAN_DEMO_CATALOG_IDS.spares,
    targetRoute: BRISTAN_DEMO_JOURNEY_ROUTES.spares,
  },
  {
    persona: "Trade Merchant Buying from Bristan - North Supplies",
    story:
      "Bulk buying from Bristan with account-specific quantity breaks for the North Supplies account.",
    username: "bristan-demo-supplier-north-buyer-user",
    buyerID: "bristan-demo-supplier-north-buyer",
    catalogID: BRISTAN_DEMO_CATALOG_IDS.supplierNorth,
    targetRoute: BRISTAN_DEMO_JOURNEY_ROUTES.supplierNorth,
  },
  {
    persona: "Trade Merchant Buying from Bristan - South Supplies",
    story:
      "A second trade merchant account that shows how account-specific pricing and future order history can differ by trading partner.",
    username: "bristan-demo-supplier-south-buyer-user",
    buyerID: "bristan-demo-supplier-south-buyer",
    catalogID: BRISTAN_DEMO_CATALOG_IDS.supplierSouth,
    targetRoute: BRISTAN_DEMO_JOURNEY_ROUTES.supplierSouth,
  },
  {
    persona: "Marketplace Buyer",
    story:
      "A normal buyer browsing Bristan-governed product data with merchant offers seeded for the next PDP comparison phase.",
    username: "bristan-demo-marketplace-user",
    buyerID: "bristan-demo-marketplace-buyer",
    catalogID: BRISTAN_DEMO_CATALOG_IDS.marketplace,
    targetRoute: BRISTAN_DEMO_JOURNEY_ROUTES.marketplace,
  },
] as const;

export const BRISTAN_DEMO_USER_TARGETS: Record<string, string> =
  BRISTAN_DEMO_ACCOUNTS.reduce(
    (targets, account) => ({
      ...targets,
      [account.username]: account.targetRoute,
    }),
    {} as Record<string, string>,
  );

export const BRISTAN_DEMO_USER_CATALOG_IDS: Record<string, string> =
  BRISTAN_DEMO_ACCOUNTS.reduce(
    (catalogIds, account) => ({
      ...catalogIds,
      [account.username]: account.catalogID,
    }),
    {} as Record<string, string>,
  );

export const BRISTAN_DEMO_SUPPLIER_BUYER_USERNAMES = [
  "bristan-demo-supplier-north-buyer-user",
  "bristan-demo-supplier-south-buyer-user",
] as const;

export const BRISTAN_DEMO_SUPPLIER_BUYER_CATALOG_IDS = [
  BRISTAN_DEMO_CATALOG_IDS.supplierNorth,
  BRISTAN_DEMO_CATALOG_IDS.supplierSouth,
] as const;

export const getBristanDemoUserByUsername = (username?: string) =>
  username
    ? BRISTAN_DEMO_ACCOUNTS.find((account) => account.username === username)
    : undefined;

export const isBristanSupplierBuyerUsername = (username?: string) =>
  Boolean(
    username &&
      BRISTAN_DEMO_SUPPLIER_BUYER_USERNAMES.includes(
        username as (typeof BRISTAN_DEMO_SUPPLIER_BUYER_USERNAMES)[number],
      ),
  );

export const isBristanSupplierBuyerCatalogId = (catalogId?: string) =>
  Boolean(
    catalogId &&
      BRISTAN_DEMO_SUPPLIER_BUYER_CATALOG_IDS.includes(
        catalogId as (typeof BRISTAN_DEMO_SUPPLIER_BUYER_CATALOG_IDS)[number],
      ),
  );

export const isBristanDemoSupplierBuyerBulkContext = (
  username?: string,
  catalogId?: string,
) =>
  isBristanSupplierBuyerUsername(username) ||
  isBristanSupplierBuyerCatalogId(catalogId);

export const isBristanDemoMarketplaceBuyerContext = (
  username?: string,
  catalogId?: string,
) =>
  username === "bristan-demo-marketplace-user" ||
  catalogId === BRISTAN_DEMO_CATALOG_IDS.marketplace;

const BRISTAN_DEMO_LEGACY_ROUTE_PREFIX = "/shop/buyer";

export const getBristanDemoTargetRoute = (username?: string) =>
  username ? BRISTAN_DEMO_USER_TARGETS[username] : undefined;

export const getBristanDemoCatalogId = (username?: string) =>
  username ? BRISTAN_DEMO_USER_CATALOG_IDS[username] : undefined;

export const isBristanDemoCatalogId = (catalogId?: string) =>
  Boolean(
    catalogId &&
      Object.values(BRISTAN_DEMO_CATALOG_IDS).includes(
        catalogId as (typeof BRISTAN_DEMO_CATALOG_IDS)[keyof typeof BRISTAN_DEMO_CATALOG_IDS],
      ),
  );

export const getBristanDemoCategoriesRoute = (username?: string) => {
  const catalogId = getBristanDemoCatalogId(username);
  return catalogId ? `/shop/${catalogId}/categories` : undefined;
};

export const getBristanDemoProductsRoute = (username?: string) => {
  const catalogId = getBristanDemoCatalogId(username);
  return catalogId ? `/shop/${catalogId}/products` : undefined;
};

export const getBristanDemoShopAllRoute = (username?: string) =>
  getBristanDemoProductsRoute(username);

export const getCorrectedBristanDemoCatalogPath = (
  pathname: string,
  username?: string,
) => {
  const correctCatalogId = getBristanDemoCatalogId(username);
  if (!correctCatalogId) return undefined;

  const match = pathname.match(
    /^\/shop\/([^/]+)\/(categories|products)(?:\/(.*))?$/,
  );
  if (!match) return undefined;

  const [, requestedCatalogId, routeType, remainder] = match;
  if (
    requestedCatalogId === correctCatalogId ||
    !isBristanDemoCatalogId(requestedCatalogId)
  ) {
    return undefined;
  }

  return `/shop/${correctCatalogId}/${routeType}${remainder ? `/${remainder}` : ""}`;
};

export const shouldRedirectBristanDemoRoute = (
  pathname: string,
  username?: string,
) =>
  Boolean(
    getBristanDemoTargetRoute(username) &&
      (pathname === "/products" ||
        pathname.startsWith(BRISTAN_DEMO_LEGACY_ROUTE_PREFIX)),
  );
