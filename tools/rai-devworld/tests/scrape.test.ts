import { describe, it, expect, vi } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  SEEDED_TARGETS,
  assertExpectedCategoryNavigation,
  assertNonEmptyCategoryPath,
  assertTraverseStartUrl,
  assertNotProductTraversal,
  childCategoryLinks,
  filterChildCategoryLinks,
  filterProductLinks,
  handleCookieBanner,
  isAllowedRaiUrl,
  isExcludedUrl,
  isProductCardLink,
  isProductDetailUrl,
  isRaiProductPdpUrl,
  out,
  raiUrlAllowlist,
  rejectChildCategoryReasons,
  scrapeProduct,
} from "../src/scrape.js";
import { firstChildren } from "../src/lib.js";
const base =
  "https://service.rai.nl/INTERSHOP/web/WFS/RAI-raievents-Site/en_US/devworld/EUR/";
const pdp = base + "ViewProduct-Show?SKU=ABC";

describe("rai scraper URL allowlist", () => {
  it("rejects Cookiebot URLs", () => {
    const r = raiUrlAllowlist(
      "https://www.cookiebot.com/us/what-is-behind-powered-by-cookiebot/?utm_source=banner_cb",
    );
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain("external hostname");
  });
  it("rejects external hostnames", () => {
    expect(
      raiUrlAllowlist(
        "https://example.com/INTERSHOP/web/WFS/RAI-raievents-Site/en_US/devworld/EUR/ViewHomepage-Start",
      ).allowed,
    ).toBe(false);
  });
  it("accepts service.rai.nl DevWorld category URLs", () => {
    expect(
      isAllowedRaiUrl(
        base + "ViewStandardCatalog-Browse?CategoryName=fnb-main",
      ),
    ).toBe(true);
  });
  it("accepts service.rai.nl DevWorld product URLs", () => {
    expect(isAllowedRaiUrl(pdp)).toBe(true);
  });
});

describe("rai scraper product link discovery guards", () => {
  it("excludes compare links", () => {
    expect(isExcludedUrl("https://x/ViewProductCompare-Show")).toBe(true);
    expect(isProductDetailUrl("https://x/ViewProductCompare-Show")).toBe(false);
  });
  it("excludes category links", () => {
    expect(
      isExcludedUrl("https://x/ViewStandardCatalog-Browse?CatalogID=1"),
    ).toBe(true);
    expect(
      isProductDetailUrl("https://x/ViewStandardCatalog-Browse?CatalogID=1"),
    ).toBe(false);
  });
  it("includes product card PDP links with product-like content", () => {
    expect(
      isProductCardLink({
        href: pdp,
        text: "DevWorld chair",
        title: "DevWorld chair",
        cardText: "DevWorld chair EUR 12,50",
        hasPrice: true,
        hasImage: false,
      }),
    ).toBe(true);
  });
  it("skips non-product action links without poisoning the scrape", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const page: any = {
      url: vi.fn(() => base + "ViewProductCompare-Show"),
      goto: vi.fn(),
      waitForLoadState: vi.fn().mockResolvedValue(undefined),
      locator: vi.fn((selector: string) =>
        selector === "h1"
          ? { first: () => ({ textContent: vi.fn().mockResolvedValue("") }) }
          : {
              innerText: vi.fn().mockResolvedValue("Compare products"),
              evaluateAll: vi.fn().mockResolvedValue([]),
            },
      ),
    };
    await expect(
      scrapeProduct(page, base + "ViewProductCompare-Show", "", []),
    ).resolves.toBeNull();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("Skipped non-product URL"),
    );
    warn.mockRestore();
  });
  it("resolves output path from the tool package", () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    expect(out).toBe(path.resolve(here, "../data/rai-devworld.snapshot.json"));
  });
});

describe("rai scraper product/category split filtering", () => {
  const current =
    base + "ViewStandardCatalog-Browse?CategoryName=Power&CatalogID=1";
  const product =
    base + "ViewProduct-Start?SKU=POWER-DAY-230-3KW&CategoryName=Power";
  it("accepts ViewProduct-Start with CatalogID=RAIMasterCatalog as a product but not a category", () => {
    const href =
      base +
      "ViewProduct-Start?SKU=POWER-DAY-230-3KW&CategoryName=fnb-main&CatalogID=RAIMasterCatalog";
    const products = filterProductLinks(
      [
        {
          text: "Mandatory daytime power",
          href,
          cardText: "Mandatory daytime power € 335.63",
          hasPrice: true,
          title: "Mandatory daytime power",
        },
      ],
      current,
    );
    expect(products.accepted).toHaveLength(1);
    expect(new URL(products.accepted[0].href).searchParams.get("SKU")).toBe(
      "POWER-DAY-230-3KW",
    );

    const categories = filterChildCategoryLinks(
      [{ text: "Mandatory daytime power", href }],
      current,
    );
    expect(categories.accepted).toHaveLength(0);
    expect(categories.rejected[0].reasons).toContain("not a category browse URL");
  });

  it("accepts ViewProduct-Start product links even when CategoryName equals current category", () => {
    const r = filterProductLinks(
      [
        {
          text: "Mandatory daytime power",
          href: product,
          cardText: "Mandatory daytime power € 335.63",
          hasPrice: true,
          title: "Mandatory daytime power",
        },
      ],
      current,
    );
    expect(r.accepted).toHaveLength(1);
    expect(new URL(r.accepted[0].href).searchParams.get("SKU")).toBe(
      "POWER-DAY-230-3KW",
    );
  });
  it("never accepts ViewProduct-Start as a child category", () => {
    const r = filterChildCategoryLinks(
      [{ text: "Mandatory daytime power", href: product }],
      current,
    );
    expect(r.accepted).toHaveLength(0);
    expect(r.rejected[0].reasons).toContain("not a category browse URL");
  });
  it("traverse guard refuses product URLs", () => {
    expect(() => assertNotProductTraversal(product)).toThrow(
      "traverse() received product PDP URL",
    );
  });
  it("selects first five unique product links in displayed order", () => {
    const links = ["A", "B", "C", "D", "E", "F", "C"].map((sku) => ({
      text: sku,
      href: base + `ViewProduct-Start?SKU=${sku}&CategoryName=Power`,
      cardText: `${sku} € 1.00`,
      hasPrice: true,
      title: sku,
    }));
    const r = filterProductLinks(links, current);
    expect(
      r.accepted.map((l) => new URL(l.href).searchParams.get("SKU")),
    ).toEqual(["A", "B", "C", "D", "E"]);
  });
  it("accepts empty anchor text when visible product card context has title and price", () => {
    const r = filterProductLinks(
      [
        {
          text: "",
          href: product,
          cardText: "Mandatory daytime power € 335.63",
          hasPrice: true,
          title: "Mandatory daytime power",
        },
      ],
      current,
    );
    expect(r.accepted).toHaveLength(1);
    expect(isRaiProductPdpUrl(product)).toBe(true);
  });
});

describe("rai scraper child category filtering", () => {
  const current =
    "https://service.rai.nl/INTERSHOP/web/WFS/RAI-raievents-Site/en_US/devworld/EUR/ViewStandardCatalog-Browse?CategoryName=fnb-main&CatalogID=1";
  it("excludes Consent links", () => {
    const r = filterChildCategoryLinks(
      [{ text: "Consent", href: current + "#" }],
      current,
    );
    expect(r.accepted).toHaveLength(0);
    expect(r.rejected[0].reasons).toContain("consent link text");
  });
  it("excludes same URL with #", () => {
    const r = filterChildCategoryLinks(
      [{ text: "Food", href: current + "#section" }],
      current,
    );
    expect(r.accepted).toHaveLength(0);
    expect(r.rejected[0].reasons).toContain("only # fragment change");
  });
  it("excludes the same current CategoryName", () => {
    const href =
      "https://service.rai.nl/INTERSHOP/web/WFS/RAI-raievents-Site/en_US/devworld/EUR/ViewStandardCatalog-Browse?CatalogID=2&CategoryName=fnb-main";
    const r = filterChildCategoryLinks(
      [{ text: "Same category", href }],
      current,
    );
    expect(r.accepted).toHaveLength(0);
    expect(r.rejected[0].reasons).toContain("same current CategoryName");
  });
  it("accepts a different CategoryName category link", () => {
    const href =
      "https://service.rai.nl/INTERSHOP/web/WFS/RAI-raievents-Site/en_US/devworld/EUR/ViewStandardCatalog-Browse?CatalogID=1&CategoryName=coffee";
    const r = filterChildCategoryLinks([{ text: "Coffee", href }], current);
    expect(r.rejected).toHaveLength(0);
    expect(r.accepted).toHaveLength(1);
    expect(new URL(r.accepted[0].href).searchParams.get("CategoryName")).toBe(
      "coffee",
    );
  });
  it("accepts CatalogID=RAIMasterCatalog category links with a different CategoryName", () => {
    const href =
      "https://service.rai.nl/INTERSHOP/web/WFS/RAI-raievents-Site/en_US/devworld/EUR/ViewStandardCatalog-Browse?CatalogID=RAIMasterCatalog&CategoryName=fnb-food";
    const r = filterChildCategoryLinks([{ text: "Food", href }], current);
    expect(r.rejected).toHaveLength(0);
    expect(r.accepted).toHaveLength(1);
    expect(new URL(r.accepted[0].href).searchParams.get("CategoryName")).toBe(
      "fnb-food",
    );
  });
  it("rejects CategoryName=RAIMasterCatalog as global/root catalog", () => {
    const href =
      "https://service.rai.nl/INTERSHOP/web/WFS/RAI-raievents-Site/en_US/devworld/EUR/ViewStandardCatalog-Browse?CatalogID=RAIMasterCatalog&CategoryName=RAIMasterCatalog";
    const r = filterChildCategoryLinks([{ text: "All categories", href }], current);
    expect(r.accepted).toHaveLength(0);
    expect(r.rejected[0].reasons).toContain(
      "CategoryName=RAIMasterCatalog global/root catalog",
    );
  });
  it("rejects CatalogID=RAIMasterCatalog with the same current CategoryName", () => {
    const href =
      "https://service.rai.nl/INTERSHOP/web/WFS/RAI-raievents-Site/en_US/devworld/EUR/ViewStandardCatalog-Browse?CatalogID=RAIMasterCatalog&CategoryName=fnb-main";
    const r = filterChildCategoryLinks([{ text: "Same category", href }], current);
    expect(r.accepted).toHaveLength(0);
    expect(r.rejected[0].reasons).toContain("same current CategoryName");
    expect(r.rejected[0].reasons).not.toContain(
      "CategoryName=RAIMasterCatalog global/root catalog",
    );
  });
  it("records rejected reasons in the category debug shape", () => {
    const reasons = rejectChildCategoryReasons(
      { text: "Consent", href: current + "#" },
      current,
    );
    expect(reasons).toEqual(
      expect.arrayContaining([
        "consent link text",
        "same current CategoryName",
      ]),
    );
  });
  it("rejects Cookiebot consent links as categories", () => {
    const href =
      "https://www.cookiebot.com/us/what-is-behind-powered-by-cookiebot/?utm_source=banner_cb";
    const r = filterChildCategoryLinks(
      [{ text: "powered by Cookiebot", href }],
      current,
    );
    expect(r.accepted).toHaveLength(0);
    expect(r.rejected[0].reasons.join(" ")).toMatch(
      /disallowed URL|cookie\/consent/,
    );
  });
  it("refuses empty category paths", () => {
    expect(() => assertNonEmptyCategoryPath([])).toThrow(
      "Internal scraper error: refusing to traverse empty category path",
    );
    expect(() => assertNonEmptyCategoryPath([""])).toThrow(
      "Internal scraper error: refusing to traverse empty category path",
    );
  });

describe("rai scraper seeded target traversal", () => {
  it("seeded fnb-main target starts from its category browse URL, not homepage", () => {
    const target = SEEDED_TARGETS[0];
    expect(target.categoryName).toBe("fnb-main");
    expect(target.url).toContain("ViewStandardCatalog-Browse");
    expect(target.url).toContain("CategoryName=fnb-main");
    expect(target.url).not.toContain("ViewHomepage-Start");
  });
  it("seeded target path uses display label, not slug", () => {
    const target = SEEDED_TARGETS[0];
    expect(target.label).toBe("Food | Beverages | Catering");
    expect(target.label).not.toBe(target.categoryName);
    expect(assertTraverseStartUrl(target.url, [target.label])).toBe(target.url);
  });
  it("traverse refuses target category traversal from homepage", () => {
    expect(() =>
      assertTraverseStartUrl(base + "ViewHomepage-Start", [SEEDED_TARGETS[0].label]),
    ).toThrow("Internal scraper error: target category traversal cannot start from homepage");
    expect(() =>
      assertTraverseStartUrl(base + "ViewHomepage-Start", [SEEDED_TARGETS[0].categoryName]),
    ).toThrow("Internal scraper error: target category traversal cannot start from homepage");
  });
  it("fails clearly if target category navigation lands on homepage", () => {
    const target = SEEDED_TARGETS[0];
    expect(() =>
      assertExpectedCategoryNavigation(target.url, base + "ViewHomepage-Start", target.label),
    ).toThrow(
      `Failed to navigate to target category ${target.label}: expected CategoryName=${target.categoryName}`,
    );
  });
  it("product URL routing still works by refusing product URLs in traversal", () => {
    expect(isProductDetailUrl(base + "ViewProduct-Start?SKU=ABC")).toBe(true);
    expect(() =>
      assertTraverseStartUrl(base + "ViewProduct-Start?SKU=ABC", [SEEDED_TARGETS[0].label]),
    ).toThrow("route to scrapeProduct() instead");
  });
});

describe("rai scraper child category filtering", () => {
  const current =
    "https://service.rai.nl/INTERSHOP/web/WFS/RAI-raievents-Site/en_US/devworld/EUR/ViewStandardCatalog-Browse?CategoryName=fnb-main&CatalogID=1";
  it("excludes Consent links", () => {
    const r = filterChildCategoryLinks([{ text: "Consent", href: current + "#" }], current);
    expect(r.accepted).toHaveLength(0);
    expect(r.rejected[0].reasons).toContain("consent link text");
  });
  it("excludes same URL with #", () => {
    const r = filterChildCategoryLinks([{ text: "Food", href: current + "#section" }], current);
    expect(r.accepted).toHaveLength(0);
    expect(r.rejected[0].reasons).toContain("only # fragment change");
  });
  it("excludes the same current CategoryName", () => {
    const href =
      "https://service.rai.nl/INTERSHOP/web/WFS/RAI-raievents-Site/en_US/devworld/EUR/ViewStandardCatalog-Browse?CatalogID=2&CategoryName=fnb-main";
    const r = filterChildCategoryLinks([{ text: "Same category", href }], current);
    expect(r.accepted).toHaveLength(0);
    expect(r.rejected[0].reasons).toContain("same current CategoryName");
  });
  it("accepts a different CategoryName category link", () => {
    const href =
      "https://service.rai.nl/INTERSHOP/web/WFS/RAI-raievents-Site/en_US/devworld/EUR/ViewStandardCatalog-Browse?CatalogID=1&CategoryName=coffee";
    const r = filterChildCategoryLinks([{ text: "Coffee", href }], current);
    expect(r.rejected).toHaveLength(0);
    expect(r.accepted).toHaveLength(1);
    expect(new URL(r.accepted[0].href).searchParams.get("CategoryName")).toBe("coffee");
  });
  it("records rejected reasons in the category debug shape", () => {
    const reasons = rejectChildCategoryReasons({ text: "Consent", href: current + "#" }, current);
    expect(reasons).toEqual(
      expect.arrayContaining(["consent link text", "same current CategoryName"]),
    );
  });
  it("rejects Cookiebot consent links as categories", () => {
    const href =
      "https://www.cookiebot.com/us/what-is-behind-powered-by-cookiebot/?utm_source=banner_cb";
    const r = filterChildCategoryLinks([{ text: "powered by Cookiebot", href }], current);
    expect(r.accepted).toHaveLength(0);
    expect(r.rejected[0].reasons.join(" ")).toMatch(/disallowed URL|cookie\/consent/);
  });
  it("refuses empty category paths", () => {
    expect(() => assertNonEmptyCategoryPath([])).toThrow(
      "Internal scraper error: refusing to traverse empty category path",
    );
    expect(() => assertNonEmptyCategoryPath([""])).toThrow(
      "Internal scraper error: refusing to traverse empty category path",
    );
  });
  it("stops traversal child discovery when products are present before global nav links", async () => {
    const current =
      base + "ViewStandardCatalog-Browse?CategoryName=Power&CatalogID=1";
    const navLink = {
      text: "Food | Beverages | Catering",
      href:
        base + "ViewStandardCatalog-Browse?CategoryName=fnb-main&CatalogID=1",
    };
    const allLink = {
      text: "Power configurator",
      href: base + "ViewProduct-Start?SKU=POWER-CONFIG&CategoryName=Power",
      cardText: "Power configurator € 570.18",
      hasPrice: true,
      title: "Power configurator",
    };
    const locator = (sel: string) => ({
      evaluateAll: vi.fn(async (_fn: any, source?: string) =>
        sel === "a[href]" ? [allLink] : [navLink],
      ),
    });
    const page: any = { url: vi.fn(() => current), locator };
    const pd = {
      productLinkCandidates: [allLink],
      acceptedProductLinks: [allLink],
      rejectedProductLinks: [],
      isProductBearing: true,
      stoppedBecauseProductsFound: true,
    };
    const children = await childCategoryLinks(page, ["Power"], pd);
    expect(children).toHaveLength(0);
  });
  it("keeps first-three traversal after filtering", () => {
    const links = ["one", "two", "three", "four"].map((name) => ({
      text: name,
      href: `https://service.rai.nl/INTERSHOP/web/WFS/RAI-raievents-Site/en_US/devworld/EUR/ViewStandardCatalog-Browse?CategoryName=${name}`,
    }));
    const r = filterChildCategoryLinks(
      [{ text: "Consent", href: current + "#" }, ...links],
      current,
    );
    expect(firstChildren(r.accepted).map((l) => l.text)).toEqual([
      "one",
      "two",
      "three",
    ]);
  });
});

describe("rai scraper cookie banner handling", () => {
  it("returns to the RAI homepage if cookie handling navigates away", async () => {
    const click = vi.fn(async () => {
      current =
        "https://www.cookiebot.com/us/what-is-behind-powered-by-cookiebot/";
    });
    let current = base + "ViewHomepage-Start";
    const button = { isVisible: vi.fn().mockResolvedValue(true), click };
    const scope = { getByRole: vi.fn(() => ({ first: () => button })) };
    const page: any = {
      locator: vi.fn(() => ({ first: () => scope })),
      getByRole: vi.fn(() => ({ first: () => button })),
      waitForLoadState: vi.fn().mockResolvedValue(undefined),
      url: vi.fn(() => current),
      goto: vi.fn(async (url: string) => {
        current = url;
      }),
    };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(handleCookieBanner(page)).resolves.toBe(true);
    expect(click).toHaveBeenCalled();
    expect(page.goto).toHaveBeenCalledWith(
      expect.stringContaining("service.rai.nl"),
      expect.any(Object),
    );
    expect(isAllowedRaiUrl(current)).toBe(true);
    warn.mockRestore();
  });
});
