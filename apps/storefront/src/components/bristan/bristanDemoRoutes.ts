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

export const BRISTAN_DEMO_USER_TARGETS: Record<string, string> = {
  "bristan-demo-spares-user": BRISTAN_DEMO_JOURNEY_ROUTES.spares,
  "bristan-demo-marketplace-user": BRISTAN_DEMO_JOURNEY_ROUTES.marketplace,
  "bristan-demo-supplier-north-buyer-user":
    BRISTAN_DEMO_JOURNEY_ROUTES.supplierNorth,
  "bristan-demo-supplier-south-buyer-user":
    BRISTAN_DEMO_JOURNEY_ROUTES.supplierSouth,
};

const BRISTAN_DEMO_ROUTE_PREFIX = "/shop/buyer";

export const getBristanDemoTargetRoute = (username?: string) =>
  username ? BRISTAN_DEMO_USER_TARGETS[username] : undefined;

export const getBristanDemoCatalogId = (username?: string) => {
  const targetRoute = getBristanDemoTargetRoute(username);
  return targetRoute?.split("/")[2];
};

export const shouldRedirectBristanDemoRoute = (
  pathname: string,
  username?: string
) =>
  Boolean(
    getBristanDemoTargetRoute(username) &&
      pathname.startsWith(BRISTAN_DEMO_ROUTE_PREFIX)
  );
