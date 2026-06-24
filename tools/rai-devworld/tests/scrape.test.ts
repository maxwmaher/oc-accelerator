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
  categoryNameOf,
  classifyTraversalUrl,
  discoverChildCategoryLinks,
  filterChildCategoryLinks,
  filterProductLinks,
  handleCookieBanner,
  preparePageForScraping,
  isAllowedRaiUrl,
  isExcludedUrl,
  isProductCardLink,
  isProductDetailUrl,
  isRaiProductPdpUrl,
  out,
  raiUrlAllowlist,
  rejectChildCategoryReasons,
  scrapeProduct,
  isUnpricedQuoteRequestProduct,
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

  it("classifies ViewProduct-Start with SKU and no CategoryName as a product", () => {
    const href = base + "ViewProduct-Start?SKU=rigging-request";
    expect(classifyTraversalUrl(href)).toBe("product");
    expect(isRaiProductPdpUrl(href)).toBe(true);
  });

  it("accepts ViewProduct-Start product links without CategoryName", () => {
    const href = base + "ViewProduct-Start?SKU=rigging-request";
    const r = filterProductLinks([
      {
        text: "Request for rigging quote",
        href,
        cardText: "Request for rigging quote",
        hasImage: true,
        title: "Request for rigging quote",
      },
    ], current);
    expect(r.accepted).toHaveLength(1);
    expect(new URL(r.accepted[0].href).searchParams.get("CategoryName")).toBeNull();
  });

  it("does not return ViewProduct-Start without CategoryName as a child category", () => {
    const href = base + "ViewProduct-Start?SKU=rigging-request";
    const r = filterChildCategoryLinks(
      [{ text: "Request for rigging quote", href }],
      current,
    );
    expect(r.accepted).toHaveLength(0);
    expect(r.rejected[0].reasons).toEqual(
      expect.arrayContaining(["missing CategoryName", "not a category browse URL"]),
    );
  });

  it("traverse classification happens before CategoryName requirements", () => {
    const href = base + "ViewProduct-Start?SKU=rigging-request";
    expect(categoryNameOf(href)).toBeNull();
    expect(classifyTraversalUrl(href)).toBe("product");
  });

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
    expect(categories.rejected[0].reasons).toContain(
      "not a category browse URL",
    );
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
    const r = filterChildCategoryLinks(
      [{ text: "All categories", href }],
      current,
    );
    expect(r.accepted).toHaveLength(0);
    expect(r.rejected[0].reasons).toContain(
      "CategoryName=RAIMasterCatalog global/root catalog",
    );
  });
  it("rejects CatalogID=RAIMasterCatalog with the same current CategoryName", () => {
    const href =
      "https://service.rai.nl/INTERSHOP/web/WFS/RAI-raievents-Site/en_US/devworld/EUR/ViewStandardCatalog-Browse?CatalogID=RAIMasterCatalog&CategoryName=fnb-main";
    const r = filterChildCategoryLinks(
      [{ text: "Same category", href }],
      current,
    );
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
      assertTraverseStartUrl(base + "ViewHomepage-Start", [
        SEEDED_TARGETS[0].label,
      ]),
    ).toThrow(
      "Internal scraper error: target category traversal cannot start from homepage",
    );
    expect(() =>
      assertTraverseStartUrl(base + "ViewHomepage-Start", [
        SEEDED_TARGETS[0].categoryName,
      ]),
    ).toThrow(
      "Internal scraper error: target category traversal cannot start from homepage",
    );
  });
  it("fails clearly if target category navigation lands on homepage", () => {
    const target = SEEDED_TARGETS[0];
    expect(() =>
      assertExpectedCategoryNavigation(
        target.url,
        base + "ViewHomepage-Start",
        target.label,
      ),
    ).toThrow(
      `Failed to navigate to target category ${target.label}: expected CategoryName=${target.categoryName}`,
    );
  });
  it("product URL routing still works by refusing product URLs in traversal", () => {
    expect(isProductDetailUrl(base + "ViewProduct-Start?SKU=ABC")).toBe(true);
    expect(() =>
      assertTraverseStartUrl(base + "ViewProduct-Start?SKU=ABC", [
        SEEDED_TARGETS[0].label,
      ]),
    ).toThrow("route to scrapeProduct() instead");
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


  it("accepted category candidates survive dedupe and appear in finalChildLinks", () => {
    const r = discoverChildCategoryLinks(
      [
        { text: "Food", href: base + "ViewStandardCatalog-Browse?CategoryName=fnb-food", source: "card" },
        { text: "Beverages", href: base + "ViewStandardCatalog-Browse?CategoryName=fnb-beverages", source: "card" },
      ],
      current,
    );
    expect(r.acceptedBeforeDedupe).toHaveLength(2);
    expect(r.acceptedAfterDedupe).toHaveLength(2);
    expect(r.finalChildLinks.map((l) => l.categoryName)).toEqual([
      "fnb-food",
      "fnb-beverages",
    ]);
  });

  it("fnb-main fixture returns at least fnb-food, fnb-beverages, and fnb-drinksreception", () => {
    const fnbNames = [
      "fnb-food",
      "fnb-beverages",
      "fnb-drinksreception",
      "fnb-dietary",
      "fnb-catering",
      "fnb-materials",
    ];
    const r = discoverChildCategoryLinks(
      [
        { text: "Stand construction items", href: base + "ViewStandardCatalog-Browse?CategoryName=StandConstruciton", source: "nav" },
        { text: "Power, internet & water", href: base + "ViewStandardCatalog-Browse?CategoryName=Connections", source: "nav" },
        ...fnbNames.map((name) => ({
          text: name,
          href: base + `ViewStandardCatalog-Browse?CatalogID=RAIMasterCatalog&CategoryName=${name}`,
          source: "card",
        })),
      ],
      current,
    );
    expect(r.finalChildLinks.map((l) => l.categoryName)).toEqual([
      "StandConstruciton",
      "Connections",
      ...fnbNames,
    ]);
    expect(r.finalChildLinks.map((l) => l.categoryName)).toEqual(
      expect.arrayContaining([
        "fnb-food",
        "fnb-beverages",
        "fnb-drinksreception",
      ]),
    );
    expect(r.selectedChildLinks.map((l) => l.categoryName)).toEqual([
      "StandConstruciton",
      "Connections",
      "fnb-food",
    ]);
  });

  it("debug accepted count is based on the returned finalChildLinks", async () => {
    const page: any = {
      url: vi.fn(() => current),
      setViewportSize: vi.fn().mockResolvedValue(undefined),
      evaluate: vi.fn().mockResolvedValue(0),
      locator: vi.fn((sel: string) => ({
        evaluateAll: vi.fn(async (_fn: any, source?: string) =>
          sel.includes("card")
            ? ["fnb-food", "fnb-beverages", "fnb-drinksreception", "fnb-dietary"].map((name) => ({
                text: name,
                href: base + `ViewStandardCatalog-Browse?CategoryName=${name}`,
                source,
              }))
            : [],
        ),
      })),
      getByRole: vi.fn(() => ({
        first: () => ({ isVisible: vi.fn().mockResolvedValue(false) }),
      })),
    };
    const children = await childCategoryLinks(page, ["Food | Beverages | Catering"], {
      productLinkCandidates: [],
      acceptedProductLinks: [],
      rejectedProductLinks: [],
      isProductBearing: false,
      stoppedBecauseProductsFound: false,
    });
    expect(children).toHaveLength(4);
    expect(firstChildren(children)).toHaveLength(3);
  });

  it("keeps first valid duplicate and rejects later duplicate", () => {
    const href =
      base +
      "ViewStandardCatalog-Browse?CatalogID=RAIMasterCatalog&CategoryName=fnb-food";
    const r = filterChildCategoryLinks(
      [
        { text: "Food", href, source: "card" },
        { text: "Food duplicate", href: href + "#again", source: "card" },
      ],
      current,
    );
    expect(r.accepted).toHaveLength(1);
    expect(r.accepted[0].text).toBe("Food");
    expect(
      r.rejected.some((x) =>
        x.reasons.join(" ").includes("duplicate category"),
      ),
    ).toBe(true);
  });
  it("accepts fnb child category URLs even when duplicate variants exist", () => {
    const names = [
      "fnb-food",
      "fnb-beverages",
      "fnb-drinksreception",
      "fnb-dietary",
      "fnb-catering",
      "fnb-materials",
    ];
    const candidates = names.flatMap((name) => [
      {
        text: name,
        href:
          base + `ViewStandardCatalog-Browse?CatalogID=1&CategoryName=${name}`,
        source: "nav",
      },
      {
        text: name + " local card",
        href:
          base +
          `ViewStandardCatalog-Browse?CategoryName=${name}&CatalogID=RAIMasterCatalog`,
        source: "card",
      },
    ]);
    const r = filterChildCategoryLinks(candidates, current);
    expect(
      r.accepted.map((l) => new URL(l.href).searchParams.get("CategoryName")),
    ).toEqual(names);
    expect(r.duplicateGroups).toHaveLength(names.length);
    expect(r.accepted.every((l) => l.source === "nav")).toBe(true);
  });
  it("cleans Dietary description text to display name Dietary", () => {
    const href =
      base +
      "ViewStandardCatalog-Browse?CatalogID=RAIMasterCatalog&CategoryName=fnb-dietary";
    const r = filterChildCategoryLinks(
      [{ text: "Dietary Enjoy worry-free with diet-friendly options", href }],
      current,
    );
    expect(r.accepted[0].text).toBe("Dietary");
  });
  it("has non-empty accepted children after dedupe for fnb fixture links", () => {
    const r = filterChildCategoryLinks(
      ["fnb-food", "fnb-beverages", "fnb-dietary"].map((name) => ({
        text: name,
        href:
          base +
          `ViewStandardCatalog-Browse?CatalogID=RAIMasterCatalog&CategoryName=${name}`,
      })),
      current,
    );
    expect(r.acceptedBeforeDedupe).toHaveLength(3);
    expect(r.acceptedAfterDedupe.length).toBeGreaterThan(0);
  });
  it("cookie/privacy/footer links do not enter category candidates", async () => {
    const page: any = {
      url: vi.fn(() => current),
      setViewportSize: vi.fn().mockResolvedValue(undefined),
      evaluate: vi.fn().mockResolvedValue(0),
      locator: vi.fn((sel: string) => ({
        evaluateAll: vi.fn(async (_fn: any, source?: string) =>
          sel.includes("body")
            ? [
                {
                  text: "Privacy",
                  href: "https://www.cookiebot.com/privacy",
                  source,
                },
                {
                  text: "Food",
                  href:
                    base + "ViewStandardCatalog-Browse?CategoryName=fnb-food",
                  source,
                },
              ]
            : [],
        ),
      })),
      getByRole: vi.fn(() => ({
        first: () => ({ isVisible: vi.fn().mockResolvedValue(false) }),
      })),
    };
    const children = await childCategoryLinks(page, ["Food"], {
      productLinkCandidates: [],
      acceptedProductLinks: [],
      rejectedProductLinks: [],
      isProductBearing: false,
      stoppedBecauseProductsFound: false,
    });
    expect(children).toHaveLength(1);
    expect(children[0].text).toBe("Food");
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
  it("selected children are the first three accepted categories", () => {
    const links = ["one", "two", "three", "four"].map((name) => ({
      text: name,
      href: `https://service.rai.nl/INTERSHOP/web/WFS/RAI-raievents-Site/en_US/devworld/EUR/ViewStandardCatalog-Browse?CategoryName=${name}`,
    }));
    const r = filterChildCategoryLinks(
      [{ text: "Consent", href: current + "#" }, ...links],
      current,
    );
    expect(r.selectedChildLinks.map((l) => l.text)).toEqual([
      "one",
      "two",
      "three",
    ]);
  });
});


  it("skips unpriced quote/request products without fabricating a zero price", async () => {
    const href = base + "ViewProduct-Start?SKU=rigging-request";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const page: any = {
      goto: vi.fn().mockResolvedValue(undefined),
      waitForLoadState: vi.fn().mockResolvedValue(undefined),
      url: vi.fn(() => href),
      locator: vi.fn((selector: string) =>
        selector === "h1"
          ? { first: () => ({ textContent: vi.fn().mockResolvedValue("Request for rigging quote") }) }
          : selector === "img"
            ? { evaluateAll: vi.fn().mockResolvedValue([]) }
            : { innerText: vi.fn().mockResolvedValue("Request for rigging quote Contact us for pricing") },
      ),
    };
    await expect(scrapeProduct(page, href, "Request for rigging quote", ["Rigging"])).resolves.toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("Skipped unpriced quote/request product"));
    expect(isUnpricedQuoteRequestProduct({ sku: "rigging-request", title: "Request for rigging quote" })).toBe(true);
    warn.mockRestore();
  });

  it("ordinary products missing required prices still fail validation", async () => {
    const href = base + "ViewProduct-Start?SKU=CHAIR-001";
    const page: any = {
      goto: vi.fn().mockResolvedValue(undefined),
      waitForLoadState: vi.fn().mockResolvedValue(undefined),
      url: vi.fn(() => href),
      locator: vi.fn((selector: string) =>
        selector === "h1"
          ? { first: () => ({ textContent: vi.fn().mockResolvedValue("Conference chair") }) }
          : selector === "img"
            ? { evaluateAll: vi.fn().mockResolvedValue([]) }
            : { innerText: vi.fn().mockResolvedValue("Conference chair without visible price") },
      ),
    };
    await expect(scrapeProduct(page, href, "Conference chair", ["Furniture"])).rejects.toThrow(
      "Unable to parse required price",
    );
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
  it("sets large viewport and handles cookie banner before extraction helper completes", async () => {
    const page: any = {
      setViewportSize: vi.fn().mockResolvedValue(undefined),
      evaluate: vi.fn().mockResolvedValue(0),
      locator: vi.fn(() => ({
        first: () => ({
          getByRole: vi.fn(() => ({
            first: () => ({ isVisible: vi.fn().mockResolvedValue(false) }),
          })),
        }),
      })),
      getByRole: vi.fn(() => ({
        first: () => ({ isVisible: vi.fn().mockResolvedValue(false) }),
      })),
    };
    await preparePageForScraping(page);
    expect(page.setViewportSize).toHaveBeenCalledWith({
      width: 1920,
      height: 1080,
    });
    expect(page.evaluate).toHaveBeenCalled();
  });
});
