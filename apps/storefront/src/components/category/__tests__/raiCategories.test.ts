import { describe, expect, it } from "vitest";
import {
  getCategoryCardRoute,
  getCuratedRaiCategoryProductRoute,
  isCuratedRaiCategoryId,
  isStaleRaiCategoryId,
} from "../raiCategories";

describe("RAI category helpers", () => {
  it("identifies stale scraped RAI categories as non-curated", () => {
    const staleCategoryId =
      "rai-devworld-cat-food-beverages-catering-food-food-beverages-catering-beverages-coffee-982c0fdbcdd2";

    expect(isCuratedRaiCategoryId(staleCategoryId)).toBe(false);
    expect(isStaleRaiCategoryId(staleCategoryId)).toBe(true);
  });

  it("routes curated product categories directly to products", () => {
    expect(
      getCuratedRaiCategoryProductRoute(
        "buyer",
        "rai-devworld-cat-food-breakfast-catering"
      )
    ).toBe("/shop/buyer/categories/rai-devworld-cat-food-breakfast-catering/products");
    expect(getCategoryCardRoute("buyer", "rai-devworld-cat-power-sockets", 2)).toBe(
      "/shop/buyer/categories/rai-devworld-cat-power-sockets/products"
    );
    expect(getCategoryCardRoute("buyer", "rai-devworld-cat-raised-flooring", 1)).toBe(
      "/shop/buyer/categories/rai-devworld-cat-raised-flooring/products"
    );
  });

  it("does not route category cards into stale deep RAI category paths", () => {
    const staleCategoryId =
      "rai-devworld-cat-food-beverages-catering-food-food-beverages-catering-beverages-coffee-982c0fdbcdd2";

    expect(getCategoryCardRoute("buyer", staleCategoryId, 3)).toBe(
      "/shop/buyer/categories"
    );
  });
});
