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
  filterProductImageUrls,
  filterProductLinks,
  handleCookieBanner,
  preparePageForScraping,
  isAllowedRaiUrl,
  isExcludedUrl,
  isProductCardLink,
  isProductDetailUrl,
  isRaiProductPdpUrl,
  isLiteralProductStartUrl,
  out,
  raiUrlAllowlist,
  rejectChildCategoryReasons,
  scrapeProduct,
  isUnpricedQuoteRequestProduct,
  isCookieDisabledPageText,
  productTitleFromPage,
  productTitleFromPdpText,
  recordSkippedQuoteRequestProduct,
  gotoCategoryOrSkip,
} from "../src/scrape.js";
import { validateSnapshot } from "../src/lib.js";
import { firstChildren } from "../src/lib.js";
const base =
  "https://service.rai.nl/INTERSHOP/web/WFS/RAI-raievents-Site/en_US/devworld/EUR/";
const pdp = base + "ViewProduct-Show?SKU=ABC";

describe("rai scraper product image filtering", () => {
  it("removes chrome SVGs", () => {
    const images = filterProductImageUrls(
      [
        "/INTERSHOP/static/WFS/RAI-raievents-Site/-/RAI/en_US/Hamburger_3.svg",
        "/INTERSHOP/static/WFS/RAI-raievents-Site/-/RAI/en_US/Logo.svg",
        "/INTERSHOP/static/WFS/RAI-raievents-Site/-/RAI/en_US/Close_L.svg",
        "/INTERSHOP/static/WFS/RAI-raievents-Site/-/RAI/en_US/product/CAT-FOOD-SAFE-CROISSTEEK.jpg",
      ],
      pdp,
      "CAT-FOOD-SAFE-CROISSTEEK",
      "Croissant in a bag",
    );

    expect(images).toEqual([
      "https://service.rai.nl/INTERSHOP/static/WFS/RAI-raievents-Site/-/RAI/en_US/product/CAT-FOOD-SAFE-CROISSTEEK.jpg",
    ]);
  });

  it("keeps real food product URLs ordered before thumbnails and productCard", () => {
    const images = filterProductImageUrls(
      [
        "/INTERSHOP/static/WFS/RAI-raievents-Site/-/RAI/en_US/thumb/CAT-FOOD-SAFE-CROISSTEEK_small.jpg",
        "/INTERSHOP/static/WFS/RAI-raievents-Site/-/RAI/en_US/productCard/CAT-FOOD-SAFE-CROISSTEEK_card.jpg",
        "/INTERSHOP/static/WFS/RAI-raievents-Site/-/RAI/en_US/img/fnb/CAT-FOOD-SAFE-CROISSTEEK.jpg",
        "/INTERSHOP/static/WFS/RAI-raievents-Site/-/RAI/en_US/product/CAT-FOOD-SAFE-CROISSTEEK.jpg",
      ],
      pdp,
      "CAT-FOOD-SAFE-CROISSTEEK",
      "Croissant in a bag",
    );

    expect(images.slice(0, 2)).toEqual([
      "https://service.rai.nl/INTERSHOP/static/WFS/RAI-raievents-Site/-/RAI/en_US/product/CAT-FOOD-SAFE-CROISSTEEK.jpg",
      "https://service.rai.nl/INTERSHOP/static/WFS/RAI-raievents-Site/-/RAI/en_US/img/fnb/CAT-FOOD-SAFE-CROISSTEEK.jpg",
    ]);
    expect(images.at(-1)).toContain("/productCard/");
  });

  it("removes unrelated productCard images", () => {
    const images = filterProductImageUrls(
      [
        "/INTERSHOP/static/WFS/RAI-raievents-Site/-/RAI/en_US/productCard/CAT-FOOD-SAFE-BURGER.jpg",
        "/INTERSHOP/static/WFS/RAI-raievents-Site/-/RAI/en_US/product/CAT-FOOD-SAFE-CROISSTEEK.jpg",
      ],
      pdp,
      "CAT-FOOD-SAFE-CROISSTEEK",
      "Croissant in a bag",
    );

    expect(images).toHaveLength(1);
    expect(images[0]).toContain("CAT-FOOD-SAFE-CROISSTEEK");
  });

  it("keeps power and flooring image URLs", () => {
    const images = filterProductImageUrls(
      [
        "/INTERSHOP/static/WFS/RAI-raievents-Site/-/RAI/en_US/power/MANDATORY-DAYTIME-POWER.jpg",
        "/INTERSHOP/static/WFS/RAI-raievents-Site/-/RAI/en_US/flooring/RAISED-STAND-FLOOR.jpg",
      ],
      pdp,
      "MANDATORY-DAYTIME-POWER",
      "Mandatory daytime power",
    );

    expect(images).toEqual([
      "https://service.rai.nl/INTERSHOP/static/WFS/RAI-raievents-Site/-/RAI/en_US/power/MANDATORY-DAYTIME-POWER.jpg",
      "https://service.rai.nl/INTERSHOP/static/WFS/RAI-raievents-Site/-/RAI/en_US/flooring/RAISED-STAND-FLOOR.jpg",
    ]);
  });

  it("does not return Hamburger, Logo, or Close SVG as the first image", () => {
    const images = filterProductImageUrls(
      [
        "/Hamburger_3.svg",
        "/Logo.svg",
        "/Close_L.svg",
        "/INTERSHOP/static/WFS/RAI-raievents-Site/-/RAI/en_US/visuals/CHAIR-001.jpg",
      ],
      pdp,
      "CHAIR-001",
      "Conference chair",
    );

    expect(images[0]).not.toMatch(/Hamburger|Logo|Close|\.svg/i);
    expect(images[0]).toContain("CHAIR-001.jpg");
  });
});

describe("rai scraper product title extraction", () => {
  it("detects the cookie-disabled page text", () => {
    expect(
      isCookieDisabledPageText(
        "It appears that your browser has cookies disabled.",
      ),
    ).toBe(true);
  });

  it("does not accept the cookie-disabled phrase as a product title", async () => {
    const phrase = "It appears that your browser has cookies disabled.";
    const page: any = {
      locator: vi.fn(() => ({
        first: () => ({ textContent: vi.fn().mockResolvedValue(phrase) }),
      })),
    };

    expect(productTitleFromPdpText(`${phrase} € 12.50 Product details`)).toBe(
      "",
    );
    await expect(productTitleFromPage(page, phrase, phrase, null)).resolves.toBe(
      "",
    );
  });

  it("throws on cookie-disabled product pages before card price fallback", async () => {
    const href = base + "ViewProduct-Start?SKU=COOKIE-001";
    const body = "It appears that your browser has cookies disabled.";
    const page: any = {
      goto: vi.fn().mockResolvedValue(undefined),
      waitForLoadState: vi.fn().mockResolvedValue(undefined),
      url: vi.fn(() => href),
      setViewportSize: vi.fn().mockResolvedValue(undefined),
      evaluate: vi.fn().mockResolvedValue(0),
      getByRole: vi.fn(() => ({
        first: () => ({ isVisible: vi.fn().mockResolvedValue(false) }),
      })),
      locator: vi.fn((selector: string) =>
        selector === "body"
          ? {
              innerText: vi.fn().mockResolvedValue(body),
              first: () => ({
                getByRole: vi.fn(() => ({
                  first: () => ({ isVisible: vi.fn().mockResolvedValue(false) }),
                })),
              }),
            }
          : {
              evaluateAll: vi.fn().mockResolvedValue([]),
              first: () => ({
                textContent: vi.fn().mockResolvedValue(""),
                getByRole: vi.fn(() => ({
                  first: () => ({ isVisible: vi.fn().mockResolvedValue(false) }),
                })),
              }),
            },
      ),
    };

    await expect(
      scrapeProduct(page, href, "Fallback product", ["Category"], "€ 12.50"),
    ).rejects.toThrow(
      `RAI returned cookie-disabled page for product URL: ${href}`,
    );
  });

  it("extracts the breadcrumb product segment from PDP body text", () => {
    expect(
      productTitleFromPdpText(
        "Home/ Products & services/ Food | Beverages | Catering/ Food/ Breakfast/ Croissant in a bag You need to login to be able to order. Croissant in a bag Croissant wrapped in a paper bag € 3.15 per1 Product details...",
      ),
    ).toBe("Croissant in a bag");
  });

  it.each([
    "French breakfast rolls",
    "Farmhouse yoghurt with muesli and fresh fruit",
    "Raised stand floor",
    "Power configurator",
    "Mandatory daytime power",
    "Additional sockets",
    "Optional continuous power",
  ])("extracts real product name %s from PDP body text", (name) => {
    expect(
      productTitleFromPdpText(
        `Home/ Products & services/ Category/ ${name} You need to login to be able to order. ${name} Details € 9.95 per1 Product details`,
      ),
    ).toBe(name);
  });

  it("ignores invalid Shopping cart heading and uses PDP body text", async () => {
    const href = base + "ViewProduct-Start?SKU=CAT-FOOD-SAFE-CROISSTEEK";
    const body =
      "Home/ Products & services/ Food | Beverages | Catering/ Food/ Breakfast/ Croissant in a bag You need to login to be able to order. Croissant in a bag Croissant wrapped in a paper bag € 3.15 per1 Product details...";
    const page: any = {
      goto: vi.fn().mockResolvedValue(undefined),
      waitForLoadState: vi.fn().mockResolvedValue(undefined),
      url: vi.fn(() => href),
      locator: vi.fn((selector: string) =>
        selector === "img"
          ? { evaluateAll: vi.fn().mockResolvedValue([]) }
          : selector === "body"
            ? { innerText: vi.fn().mockResolvedValue(body) }
            : { first: () => ({ textContent: vi.fn().mockResolvedValue("Shopping cart") }) },
      ),
    };
    const product = await scrapeProduct(page, href, "Shopping cart", [
      "Food",
      "Breakfast",
    ]);
    expect(product?.name).toBe("Croissant in a bag");
    expect(product?.pricing.basePrice.amount).toBe(3.15);
  });

  it("uses card text fallback when PDP heading is invalid and body has no readable name", async () => {
    const href = base + "ViewProduct-Start?SKU=CARD-001";
    const page: any = {
      goto: vi.fn().mockResolvedValue(undefined),
      waitForLoadState: vi.fn().mockResolvedValue(undefined),
      url: vi.fn(() => href),
      locator: vi.fn((selector: string) =>
        selector === "img"
          ? { evaluateAll: vi.fn().mockResolvedValue([]) }
          : selector === "body"
            ? { innerText: vi.fn().mockResolvedValue("Shopping cart € 12.50 Product details") }
            : { first: () => ({ textContent: vi.fn().mockResolvedValue("Shopping cart") }) },
      ),
    };
    const product = await scrapeProduct(page, href, "Conference chair € 12.50", [
      "Furniture",
    ]);
    expect(product?.name).toBe("Conference chair");
  });

  it("uses SKU fallback only when no readable heading, body, or card name exists", async () => {
    const href = base + "ViewProduct-Start?SKU=CAT-FOOD-SAFE-CROISSTEEK";
    const page: any = {
      goto: vi.fn().mockResolvedValue(undefined),
      waitForLoadState: vi.fn().mockResolvedValue(undefined),
      url: vi.fn(() => href),
      locator: vi.fn((selector: string) =>
        selector === "img"
          ? { evaluateAll: vi.fn().mockResolvedValue([]) }
          : selector === "body"
            ? { innerText: vi.fn().mockResolvedValue("Shopping cart € 3.15 Product details") }
            : { first: () => ({ textContent: vi.fn().mockResolvedValue("Shopping cart") }) },
      ),
    };
    const product = await scrapeProduct(page, href, "Shopping cart € 3.15", [
      "Food",
    ]);
    expect(product?.name).toBe("Croisstiek");
  });
});

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

  it("classifies request/quote words inside SKU as product PDPs", () => {
    for (const sku of ["request", "quote", "rigging-request", "POWER-DAY-230-3KW"]) {
      const href = base + `ViewProduct-Start?SKU=${sku}`;
      expect(isRaiProductPdpUrl(href)).toBe(true);
      expect(classifyTraversalUrl(href)).toBe("product");
    }
  });

  it("keeps compare/cart/login/wishlist URLs out of product PDP classification", () => {
    for (const actionPath of [
      "ViewProductCompare-Show?SKU=POWER-DAY-230-3KW",
      "ViewCart-Start?SKU=POWER-DAY-230-3KW",
      "Login-Show?SKU=POWER-DAY-230-3KW",
      "Wishlist-Add?SKU=POWER-DAY-230-3KW",
    ]) {
      expect(isRaiProductPdpUrl(base + actionPath)).toBe(false);
    }
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

  it("literal ViewProduct-Start SKU traversal guard runs before navigation and CategoryName reads", async () => {
    const href = base + "ViewProduct-Start?SKU=rigging-request";
    expect(isLiteralProductStartUrl(href)).toBe(true);

    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("../src/scrape.ts", import.meta.url), "utf8"),
    );
    const traverseStart = source.indexOf("async function traverse(");
    const guard = source.indexOf(
      "if (isLiteralProductStartUrl(url))",
      traverseStart,
    );
    const routeLog = source.indexOf(
      "Product URL reached traverse; routing to scrapeProduct instead",
      guard,
    );
    const productHandler = source.indexOf(
      "await scrapeProduct(page, url",
      guard,
    );
    const skippedProducts = source.indexOf(
      "snapshot.source.skippedProducts",
      guard,
    );
    const pageGoto = source.indexOf("await gotoCategoryOrSkip(page, snapshot, url, catPath)", traverseStart);
    const categoryNameRead = source.indexOf(
      "const currentCategoryName = categoryNameOf(page.url())",
      traverseStart,
    );
    const classifyRead = source.indexOf(
      "classifyTraversalUrl(url)",
      traverseStart,
    );

    expect(guard).toBeGreaterThan(traverseStart);
    expect(routeLog).toBeGreaterThan(guard);
    expect(productHandler).toBeGreaterThan(guard);
    expect(skippedProducts).toBeGreaterThan(productHandler);
    expect(productHandler).toBeLessThan(pageGoto);
    expect(skippedProducts).toBeLessThan(pageGoto);
    expect(guard).toBeLessThan(pageGoto);
    expect(guard).toBeLessThan(categoryNameRead);
    expect(classifyRead === -1 || classifyRead > categoryNameRead).toBe(true);
  });

  it("post-navigation product redirect guard runs before CategoryName failure", async () => {
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("../src/scrape.ts", import.meta.url), "utf8"),
    );
    const traverseStart = source.indexOf("async function traverse(");
    const pageGoto = source.indexOf("await gotoCategoryOrSkip(page, snapshot, url, catPath)", traverseStart);
    const loadState = source.indexOf(
      'waitForLoadState("networkidle"',
      pageGoto,
    );
    const navigatedUrl = source.indexOf(
      "const navigatedUrl = page.url()",
      loadState,
    );
    const postNavGuard = source.indexOf(
      "if (isLiteralProductStartUrl(navigatedUrl))",
      navigatedUrl,
    );
    const routeLog = source.indexOf(
      "Category traversal resolved to product URL; routing to scrapeProduct instead",
      postNavGuard,
    );
    const productHandler = source.indexOf(
      "await scrapeProduct(page, navigatedUrl",
      postNavGuard,
    );
    const skippedProducts = source.indexOf(
      "snapshot.source.skippedProducts.push",
      productHandler,
    );
    const categoryNameRead = source.indexOf(
      "const currentCategoryName = categoryNameOf(page.url())",
      postNavGuard,
    );
    const missingCategoryName = source.indexOf(
      "Missing CategoryName",
      postNavGuard,
    );

    expect(pageGoto).toBeGreaterThan(traverseStart);
    expect(loadState).toBeGreaterThan(pageGoto);
    expect(navigatedUrl).toBeGreaterThan(loadState);
    expect(postNavGuard).toBeGreaterThan(navigatedUrl);
    expect(routeLog).toBeGreaterThan(postNavGuard);
    expect(productHandler).toBeGreaterThan(postNavGuard);
    expect(skippedProducts).toBeGreaterThan(productHandler);
    expect(postNavGuard).toBeLessThan(categoryNameRead);
    expect(postNavGuard).toBeLessThan(missingCategoryName);
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


  it("skips Shopping cart quote/request products with fake zero price", async () => {
    const href = base + "ViewProduct-Start?SKU=rigging-request";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const page: any = {
      goto: vi.fn().mockResolvedValue(undefined),
      waitForLoadState: vi.fn().mockResolvedValue(undefined),
      url: vi.fn(() => href),
      locator: vi.fn((selector: string) =>
        selector === "h1"
          ? { first: () => ({ textContent: vi.fn().mockResolvedValue("Shopping cart") }) }
          : selector === "img"
            ? { evaluateAll: vi.fn().mockResolvedValue([]) }
            : { innerText: vi.fn().mockResolvedValue("Shopping cart Request for rigging quote €0,") },
      ),
    };
    await expect(scrapeProduct(page, href, "Shopping cart €0,", ["Rigging"])).resolves.toBeNull();
    warn.mockRestore();
  });

  it("imports normal priced products", async () => {
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
            : { innerText: vi.fn().mockResolvedValue("Conference chair €25,00") },
      ),
    };
    const product = await scrapeProduct(page, href, "Conference chair €25,00", ["Furniture"]);
    expect(product?.name).toBe("Conference chair");
    expect(product?.pricing.basePrice.amount).toBe(25);
  });

  it("deduplicates skipped quote/request products by SKU", () => {
    const snapshot: any = { source: { skippedProducts: [] } };
    recordSkippedQuoteRequestProduct(snapshot, { url: base + "ViewProduct-Start?SKU=rigging-request", sku: "rigging-request", name: "Shopping cart" });
    recordSkippedQuoteRequestProduct(snapshot, { url: base + "ViewProduct-Start?SKU=rigging-request&CategoryName=Rigging", sku: "rigging-request", name: "Request for rigging quote" });
    expect(snapshot.source.skippedProducts).toHaveLength(1);
  });

  it("skips and records Rigging category navigation timeouts without invalidating captured products", async () => {
    const url = base + "ViewStandardCatalog-Browse?CatalogID=RAIMasterCatalog&CategoryName=Rigging";
    const timeout = new Error("page.goto: Timeout 45000ms exceeded.");
    timeout.name = "TimeoutError";
    const page: any = { goto: vi.fn().mockRejectedValue(timeout) };
    const snapshot: any = {
      schemaVersion: 1,
      complete: true,
      source: {
        system: "RAI Amsterdam Exhibitor Services",
        event: "DevWorld",
        language: "en_US",
        currency: "EUR",
        homepageUrl: base + "ViewHomepage-Start",
        scrapedAtUtc: new Date().toISOString(),
      },
      categories: [],
      products: [
        {
          sourceSku: "CHAIR-001",
          name: "Conference chair",
          canonicalUrl: base + "ViewProduct-Start?SKU=CHAIR-001",
          images: [],
          pricing: { basePrice: { amount: 25, currency: "EUR", rawText: "€25,00" }, rawPriceText: "€25,00", minQuantity: 1, quantityMultiplier: 1, priceBreaks: [], options: [] },
          ordering: { notes: [] },
          attributes: [],
          sourceBreadcrumbs: ["Furniture"],
          categoryPaths: [["Furniture"]],
          sourceHash: "hash",
          ocId: "chair-001",
          priceScheduleId: "chair-001",
        },
      ],
    };

    await expect(gotoCategoryOrSkip(page, snapshot, url, ["Stand construction items", "Rigging"])).resolves.toBe(false);
    expect(snapshot.source.skippedCategories).toEqual([
      {
        url,
        categoryPath: ["Stand construction items", "Rigging"],
        reason: "navigation timeout for quote/request category",
      },
    ]);
    expect(() => validateSnapshot(snapshot)).not.toThrow();
  });

  it("reports normal category navigation timeouts as real errors", async () => {
    const url = base + "ViewStandardCatalog-Browse?CatalogID=RAIMasterCatalog&CategoryName=Furniture";
    const timeout = new Error("page.goto: Timeout 45000ms exceeded.");
    timeout.name = "TimeoutError";
    const page: any = { goto: vi.fn().mockRejectedValue(timeout) };
    const snapshot: any = { source: {} };

    await expect(gotoCategoryOrSkip(page, snapshot, url, ["Stand construction items", "Furniture"])).rejects.toThrow(
      'Category navigation failed for "Stand construction items > Furniture"',
    );
    expect(snapshot.source.skippedCategories).toBeUndefined();
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
