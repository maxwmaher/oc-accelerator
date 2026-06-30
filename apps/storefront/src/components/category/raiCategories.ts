const RAI_CATEGORY_ID_PREFIX = "rai-devworld-cat-";

export const CURATED_RAI_CATEGORY_IDS = new Set<string>([
  "rai-devworld-cat-food-beverages-catering",
  "rai-devworld-cat-food-breakfast-catering",
  "rai-devworld-cat-stand-construction",
  "rai-devworld-cat-raised-flooring",
  "rai-devworld-cat-power-internet-water",
  "rai-devworld-cat-power-sockets",
]);

const CURATED_RAI_PRODUCT_CATEGORY_IDS = new Set<string>([
  "rai-devworld-cat-food-breakfast-catering",
  "rai-devworld-cat-power-sockets",
  "rai-devworld-cat-raised-flooring",
]);

export const isRaiCategoryId = (categoryId?: string | null) =>
  categoryId?.toLowerCase().startsWith(RAI_CATEGORY_ID_PREFIX) === true;

export const isCuratedRaiCategoryId = (categoryId?: string | null) =>
  typeof categoryId === "string" && CURATED_RAI_CATEGORY_IDS.has(categoryId.toLowerCase());

export const isStaleRaiCategoryId = (categoryId?: string | null) =>
  isRaiCategoryId(categoryId) && !isCuratedRaiCategoryId(categoryId);

export const getCuratedRaiCategoryProductRoute = (
  catalogId: string | undefined,
  categoryId: string | undefined
) => {
  if (!catalogId || !categoryId || !CURATED_RAI_PRODUCT_CATEGORY_IDS.has(categoryId.toLowerCase())) {
    return undefined;
  }

  return `/shop/${catalogId}/categories/${categoryId}/products`;
};

export const getCategoryCardRoute = (
  catalogId: string | undefined,
  categoryId: string | undefined,
  childCount?: number | null
) => {
  if (!catalogId || !categoryId) {
    return "/shop";
  }

  const curatedProductRoute = getCuratedRaiCategoryProductRoute(catalogId, categoryId);
  if (curatedProductRoute) {
    return curatedProductRoute;
  }

  if (isStaleRaiCategoryId(categoryId)) {
    return `/shop/${catalogId}/categories`;
  }

  return childCount
    ? `/shop/${catalogId}/categories/${categoryId}`
    : `/shop/${catalogId}/categories/${categoryId}/products`;
};
