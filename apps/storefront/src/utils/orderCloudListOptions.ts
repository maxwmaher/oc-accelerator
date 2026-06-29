export interface StorefrontRouteCatalogCategoryParams {
  catalogId?: string;
  categoryId?: string;
}

export type OrderCloudCatalogCategoryListOptions = Record<string, string>;

export const mapRouteParamsToOrderCloudListOptions = ({
  catalogId,
  categoryId,
}: StorefrontRouteCatalogCategoryParams): OrderCloudCatalogCategoryListOptions => ({
  ...(catalogId ? { catalogID: catalogId } : {}),
  ...(categoryId ? { categoryID: categoryId } : {}),
});
