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
    persona: "Supplier Buying from Bristan - North Supplies",
    story:
      "Bulk buying from Bristan with supplier-specific quantity breaks for the North Supplies account.",
    username: "bristan-demo-supplier-north-buyer-user",
    buyerID: "bristan-demo-supplier-north-buyer",
    catalogID: BRISTAN_DEMO_CATALOG_IDS.supplierNorth,
    targetRoute: BRISTAN_DEMO_JOURNEY_ROUTES.supplierNorth,
  },
  {
    persona: "Supplier Buying from Bristan - South Supplies",
    story:
      "A second supplier buyer account that shows how account-specific pricing and future order history can differ by trading partner.",
    username: "bristan-demo-supplier-south-buyer-user",
    buyerID: "bristan-demo-supplier-south-buyer",
    catalogID: BRISTAN_DEMO_CATALOG_IDS.supplierSouth,
    targetRoute: BRISTAN_DEMO_JOURNEY_ROUTES.supplierSouth,
  },
  {
    persona: "Marketplace Buyer",
    story:
      "A normal buyer browsing Bristan-governed product data with supplier offers seeded for the next PDP comparison phase.",
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

const BRISTAN_DEMO_LEGACY_ROUTE_PREFIX = "/shop/buyer";

export const getBristanDemoTargetRoute = (username?: string) =>
  username ? BRISTAN_DEMO_USER_TARGETS[username] : undefined;

export const getBristanDemoCatalogId = (username?: string) => {
  const targetRoute = getBristanDemoTargetRoute(username);
  return targetRoute?.split("/")[2];
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
