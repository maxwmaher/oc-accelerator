import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, Page } from "@playwright/test";
import {
  HOME,
  TARGETS,
  firstChildren,
  firstProducts,
  loose,
  norm,
  ocId,
  parseMoney,
  sourceHash,
} from "./lib.js";
import type { RaiSnapshot, ProductSnapshot } from "./models.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const out = path.resolve(
  __dirname,
  "../data/rai-devworld.snapshot.json",
);
export const debugDir = path.resolve(__dirname, "../debug");
export type Link = {
  text: string;
  href: string;
  cardText?: string;
  hasImage?: boolean;
  hasPrice?: boolean;
  title?: string;
  source?: string;
};
export type RejectedLink = Link & { reasons: string[] };
export type ProductLinkDebug = {
  productLinkCandidates: Link[];
  acceptedProductLinks: Link[];
  rejectedProductLinks: RejectedLink[];
  isProductBearing: boolean;
  stoppedBecauseProductsFound: boolean;
};
export type CategoryLinkDebug = {
  currentUrl: string;
  currentCategoryName: string | null;
  allCandidateCategoryLinks: Link[];
  rejected: RejectedLink[];
  acceptedChildLinks: Link[];
  productLinkCandidates: Link[];
  acceptedProductLinks: Link[];
  rejectedProductLinks: RejectedLink[];
  isProductBearing: boolean;
  stoppedBecauseProductsFound: boolean;
  first50VisibleAnchors: Link[];
};
export type UrlAllowResult = {
  allowed: boolean;
  url?: string;
  reason?: string;
};
const RAI_HOST = "service.rai.nl";
const DEVWORLD_PATH =
  "/INTERSHOP/web/WFS/RAI-raievents-Site/en_US/devworld/EUR/";
const CONSENT_TEXT_RE = /(?:consent|cookiebot|powered by|privacy|learn more)/i;
const TARGET_CATEGORY_NAMES = ["fnb-main", "StandConstruciton", "Connections"];
const BLOCKED_URL_PARTS = [
  "ViewProductCompare",
  "ProductCompare",
  "ViewCart",
  "ViewBasket",
  "AddProduct",
  "AddToCart",
  "ViewStandardCatalog-Browse",
  "ViewHomepage",
  "Login",
  "Wishlist",
];
const BLOCKED_PRODUCT_URL_PARTS = [
  "ViewProductCompare",
  "ProductCompare",
  "ViewCart",
  "ViewBasket",
  "AddProduct",
  "AddToCart",
  "Login",
  "Wishlist",
  "privacy",
  "cookie",
  "consent",
  "Compare",
  "Cart",
  "Basket",
];
const BLOCKED_CHILD_URL_PARTS = [
  ...BLOCKED_PRODUCT_URL_PARTS,
  "ViewProduct-Start",
  "ViewProduct-Show",
  "Product-Show",
];
export function raiUrlAllowlist(href: string, base?: string): UrlAllowResult {
  let u: URL;
  try {
    u = new URL(href, base);
  } catch {
    return { allowed: false, reason: "invalid URL" };
  }
  const host = u.hostname.toLowerCase();
  const path = u.pathname;
  if (host !== RAI_HOST)
    return {
      allowed: false,
      url: u.href,
      reason: `external hostname: ${u.hostname}`,
    };
  if (/cookiebot|consent|privacy/i.test(u.href))
    return {
      allowed: false,
      url: u.href,
      reason: "consent/privacy/vendor URL",
    };
  if (!path.includes(DEVWORLD_PATH))
    return {
      allowed: false,
      url: u.href,
      reason: "outside DevWorld storefront path",
    };
  return { allowed: true, url: u.href };
}
export function isAllowedRaiUrl(href: string, base?: string) {
  return raiUrlAllowlist(href, base).allowed;
}
export function requireAllowedRaiPage(url: string) {
  const r = raiUrlAllowlist(url);
  if (!r.allowed) throw new Error(`Blocked external navigation: ${url}`);
}
export function assertNonEmptyCategoryPath(catPath: string[]) {
  if (!catPath.length || !norm(catPath.join("")).length)
    throw new Error(
      "Internal scraper error: refusing to traverse empty category path",
    );
}
function rejectDisallowedLinkReason(href: string, base?: string) {
  const r = raiUrlAllowlist(href, base);
  return r.allowed ? null : `disallowed URL: ${r.reason}`;
}
function filterAllowedLinks(
  candidates: Link[],
  context: string,
  base?: string,
) {
  const accepted: Link[] = [];
  for (const l of candidates) {
    const r = raiUrlAllowlist(l.href, base);
    if (!r.allowed) {
      console.log(
        `Rejected ${context} link "${l.text || "(empty)"}" (${l.href}): ${r.reason}`,
      );
      continue;
    }
    accepted.push({ ...l, href: r.url || l.href });
  }
  return accepted;
}
export function isExcludedUrl(href: string) {
  return BLOCKED_URL_PARTS.some((part) =>
    href.toLowerCase().includes(part.toLowerCase()),
  );
}
export function isProductActionUrl(href: string) {
  return BLOCKED_PRODUCT_URL_PARTS.some((part) =>
    href.toLowerCase().includes(part.toLowerCase()),
  );
}
export function isProductDetailUrl(href: string) {
  if (
    isProductActionUrl(href) ||
    /ViewStandardCatalog-Browse|ViewHomepage/i.test(href)
  )
    return false;
  return /(?:ViewProduct-(?:Show|Start)|Product-Show|ViewProductDetail|ProductID=|SKU=|sku=)/i.test(
    href,
  );
}
export function isRaiProductPdpUrl(href: string, base?: string) {
  const allowed = raiUrlAllowlist(href, base);
  if (!allowed.allowed) return false;
  try {
    const u = new URL(allowed.url || href);
    return (
      /ViewProduct-Start/i.test(u.pathname + u.search) &&
      Boolean(u.searchParams.get("SKU")) &&
      !isProductActionUrl(u.href)
    );
  } catch {
    return false;
  }
}
export function assertNotProductTraversal(url: string) {
  if (isRaiProductPdpUrl(url))
    throw new Error(
      `Internal scraper error: traverse() received product PDP URL; use scrapeProduct() instead: ${url}`,
    );
}
export function hasProductLikeCardContent(l: Link) {
  const text = norm(`${l.title || ""} ${l.cardText || ""} ${l.text || ""}`);
  const hasTitle = Boolean(norm(l.title || l.text));
  const hasPrice = Boolean(
    l.hasPrice || /(?:€|EUR)\s*[-+]?\d[\d.,\s]*/i.test(text),
  );
  return hasTitle && (hasPrice || Boolean(l.hasImage));
}
export function isProductCardLink(l: Link) {
  return (
    isProductDetailUrl(l.href) &&
    (isRaiProductPdpUrl(l.href) || hasProductLikeCardContent(l))
  );
}
function productKey(l: Link) {
  try {
    const u = new URL(l.href);
    return u.searchParams.get("SKU") || sortedUrlWithoutHash(u.href);
  } catch {
    return l.href;
  }
}
export function rejectProductLinkReasons(l: Link, base?: string) {
  const reasons: string[] = [];
  const allow = raiUrlAllowlist(l.href, base);
  if (!allow.allowed) reasons.push(`disallowed URL: ${allow.reason}`);
  let u: URL | undefined;
  try {
    u = new URL(allow.url || l.href);
  } catch {
    reasons.push("invalid URL");
  }
  if (u) {
    if (isProductActionUrl(u.href))
      reasons.push("compare/cart/login/wishlist/cookie/privacy/action URL");
    if (!/ViewProduct-Start/i.test(u.pathname + u.search))
      reasons.push("not a ViewProduct-Start URL");
    if (!u.searchParams.get("SKU")) reasons.push("missing SKU");
  }
  if (!hasProductLikeCardContent(l) && !isRaiProductPdpUrl(l.href, base))
    reasons.push("not product-like card content");
  return reasons;
}
export function filterProductLinks(
  candidates: Link[],
  base?: string,
  limit = 5,
) {
  const accepted: Link[] = [],
    rejected: RejectedLink[] = [],
    seen = new Set<string>();
  for (const l of candidates) {
    const reasons = rejectProductLinkReasons(l, base);
    const allowed = raiUrlAllowlist(l.href, base);
    const normalized = { ...l, href: allowed.url || l.href };
    const key = productKey(normalized);
    if (seen.has(key)) reasons.push("duplicate product URL/SKU");
    if (reasons.length) {
      rejected.push({ ...normalized, reasons });
      continue;
    }
    seen.add(key);
    accepted.push(normalized);
  }
  return { accepted: accepted.slice(0, limit), rejected };
}
function sortedUrlWithoutHash(href: string) {
  const u = new URL(href);
  u.hash = "";
  const entries = [...u.searchParams.entries()].sort(
    ([a, av], [b, bv]) => a.localeCompare(b) || av.localeCompare(bv),
  );
  u.search = "";
  for (const [k, v] of entries) u.searchParams.append(k, v);
  return u.href;
}
export function categoryNameOf(href: string) {
  try {
    return new URL(href).searchParams.get("CategoryName");
  } catch {
    return null;
  }
}
export function rejectChildCategoryReasons(l: Link, currentUrl: string) {
  const reasons: string[] = [];
  const text = norm(l.text);
  if (!text) reasons.push("empty link text");
  if (/^(consent)$/i.test(text) || loose(text) === "consent")
    reasons.push("consent link text");
  if (CONSENT_TEXT_RE.test(text)) reasons.push("cookie/consent link text");
  let u: URL | undefined, cur: URL | undefined;
  try {
    u = new URL(l.href);
    cur = new URL(currentUrl);
  } catch {
    reasons.push("invalid URL");
  }
  if (u && cur) {
    const allowReason = rejectDisallowedLinkReason(u.href);
    if (allowReason) reasons.push(allowReason);
    const rawSameExceptHash =
      sortedUrlWithoutHash(u.href) === sortedUrlWithoutHash(cur.href);
    if (rawSameExceptHash && u.hash && u.hash !== cur.hash)
      reasons.push("only # fragment change");
    if (rawSameExceptHash) reasons.push("same page URL without hash");
    if (isProductActionUrl(u.href))
      reasons.push("cookie/banner/privacy/action URL");
    if (/RAIMasterCatalog/i.test(u.href))
      reasons.push("RAIMasterCatalog/global catalog URL");
    const cat = u.searchParams.get("CategoryName"),
      currentCat = cur.searchParams.get("CategoryName");
    if (!cat) reasons.push("missing CategoryName");
    else if (currentCat && cat === currentCat)
      reasons.push("same current CategoryName");
    if (!/ViewStandardCatalog-Browse/i.test(u.href))
      reasons.push("not a category browse URL");
  }
  return reasons;
}
export function filterChildCategoryLinks(
  candidates: Link[],
  currentUrl: string,
) {
  const accepted: Link[] = [],
    rejected: RejectedLink[] = [],
    seen = new Set<string>();
  for (const l of candidates) {
    const reasons = rejectChildCategoryReasons(l, currentUrl);
    let key = "";
    try {
      key = sortedUrlWithoutHash(l.href);
    } catch {
      key = l.href;
    }
    if (seen.has(key)) reasons.push("duplicate normalized URL");
    if (reasons.length) {
      rejected.push({ ...l, reasons });
      continue;
    }
    seen.add(key);
    accepted.push({ ...l, href: key });
  }
  return { accepted, rejected };
}
async function visibleAnchors(locator: any, source = "all"): Promise<Link[]> {
  return locator.evaluateAll(
    (as: any[], source: string) =>
      as
        .filter((a) => {
          const r = a.getBoundingClientRect();
          const s = getComputedStyle(a);
          return (
            r.width > 0 &&
            r.height > 0 &&
            s.visibility !== "hidden" &&
            s.display !== "none" &&
            a.offsetParent !== null
          );
        })
        .map((a) => ({
          text: (a.innerText || a.textContent || "")
            .replace(/\s+/g, " ")
            .trim(),
          href: a.href,
          source,
        })),
    source,
  );
}
async function links(page: Page) {
  return visibleAnchors(page.locator("a[href]"));
}
export async function productLinkCandidates(page: Page) {
  return page
    .locator(
      'article, li, [data-testid*="product" i], [class*="product" i], [id*="product" i]',
    )
    .evaluateAll((cards: any[]) =>
      cards.flatMap((card) => {
        const cardText = (card.innerText || card.textContent || "")
          .replace(/\s+/g, " ")
          .trim();
        const hasImage = Boolean(card.querySelector("img"));
        const hasPrice = /(?:€|EUR)\s*[-+]?\d[\d.,\s]*/i.test(cardText);
        const title = (
          card.querySelector('h1,h2,h3,h4,[itemprop="name"]')?.textContent || ""
        )
          .replace(/\s+/g, " ")
          .trim();
        return Array.from(card.querySelectorAll("a[href]"))
          .filter((a: any) => {
            const r = a.getBoundingClientRect();
            const s = getComputedStyle(a);
            return (
              r.width > 0 &&
              r.height > 0 &&
              s.visibility !== "hidden" &&
              s.display !== "none"
            );
          })
          .map((a: any) => ({
            text: (a.innerText || a.textContent || "")
              .replace(/\s+/g, " ")
              .trim(),
            href: a.href,
            cardText,
            hasImage,
            hasPrice,
            title,
          }));
      }),
    );
}
export async function productLinksWithDebug(
  page: Page,
): Promise<ProductLinkDebug> {
  const base = page.url();
  const candidates = (await productLinkCandidates(page)) as Link[];
  const result = filterProductLinks(candidates, base, 5);
  const isProductBearing =
    result.accepted.length > 0 || candidates.some(hasProductLikeCardContent);
  return {
    productLinkCandidates: candidates,
    acceptedProductLinks: result.accepted,
    rejectedProductLinks: result.rejected,
    isProductBearing,
    stoppedBecauseProductsFound: isProductBearing,
  };
}
export async function productLinks(page: Page) {
  return (await productLinksWithDebug(page)).acceptedProductLinks;
}
export async function childCategoryLinks(
  page: Page,
  catPath: string[],
  productDebug?: ProductLinkDebug,
) {
  const currentUrl = page.url();
  const navSel =
    'nav a[href], aside a[href], [role="navigation"] a[href], [class*="category" i] a[href], [class*="menu" i] a[href], [class*="tree" i] a[href], [class*="product-services" i] a[href]';
  const nav = await visibleAnchors(page.locator(navSel), "nav");
  const all = await links(page);
  let candidates = nav.filter(
    (l) => /ViewStandardCatalog-Browse/i.test(l.href) || categoryNameOf(l.href),
  );
  if (!candidates.length)
    candidates = all.filter(
      (l) =>
        /ViewStandardCatalog-Browse/i.test(l.href) || categoryNameOf(l.href),
    );
  const pd = productDebug || (await productLinksWithDebug(page));
  let result = filterChildCategoryLinks(candidates, currentUrl);
  if (pd.isProductBearing) result = { ...result, accepted: [] };
  const debug: CategoryLinkDebug = {
    currentUrl,
    currentCategoryName: categoryNameOf(currentUrl),
    allCandidateCategoryLinks: candidates,
    rejected: result.rejected,
    acceptedChildLinks: result.accepted,
    productLinkCandidates: pd.productLinkCandidates,
    acceptedProductLinks: pd.acceptedProductLinks,
    rejectedProductLinks: pd.rejectedProductLinks,
    isProductBearing: pd.isProductBearing,
    stoppedBecauseProductsFound: pd.isProductBearing,
    first50VisibleAnchors: all.slice(0, 50),
  };
  writeCategoryDebug(debug);
  for (const r of result.rejected.filter((r) =>
    r.reasons.some((x) =>
      /consent|fragment|same page|action|privacy|cookie/i.test(x),
    ),
  ))
    console.log(
      `Skipped suspicious category link "${r.text || "(empty)"}" (${r.href}): ${r.reasons.join(", ")}`,
    );
  console.log(
    `Category debug written: ${debugPathForCategory(debug.currentCategoryName || loose(catPath.at(-1) || "category"))}`,
  );
  return result.accepted;
}
export function debugPathForCategory(categoryName: string) {
  return path.join(
    debugDir,
    `category-links-${categoryName || "unknown"}.json`,
  );
}
export function writeCategoryDebug(debug: CategoryLinkDebug) {
  fs.mkdirSync(debugDir, { recursive: true });
  fs.writeFileSync(
    debugPathForCategory(debug.currentCategoryName || "unknown"),
    JSON.stringify(debug, null, 2),
  );
}

export async function handleCookieBanner(page: Page) {
  const scoped = page
    .locator(
      '[role="dialog"], [role="alertdialog"], [aria-modal="true"], [class*="cookie" i], [id*="cookie" i], [class*="consent" i], [id*="consent" i], [class*="banner" i]',
    )
    .first();
  const scopes = [scoped, page];
  for (const scope of scopes) {
    for (const name of ["Accept all", "Accept", "Allow all", "I agree", "OK"]) {
      const button = scope
        .getByRole("button", {
          name: new RegExp(
            "^\\s*" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*$",
            "i",
          ),
        })
        .first();
      try {
        if (await button.isVisible({ timeout: 1200 })) {
          await button.click({ timeout: 3000 });
          await page
            .waitForLoadState("domcontentloaded", { timeout: 3000 })
            .catch(() => {});
          if (!isAllowedRaiUrl(page.url())) {
            console.warn(
              `Cookie handling left RAI domain at ${page.url()}; returning to DevWorld homepage`,
            );
            await page.goto(HOME, {
              waitUntil: "domcontentloaded",
              timeout: 60000,
            });
          }
          return true;
        }
      } catch {}
    }
  }
  return false;
}
export async function scrapeProduct(
  page: Page,
  href: string,
  card = "",
  catPath: string[],
  cardRawPriceText?: string,
): Promise<ProductSnapshot | null> {
  const allowed = raiUrlAllowlist(href);
  if (!allowed.allowed) throw new Error(`Blocked external navigation: ${href}`);
  await page.goto(allowed.url || href, {
    waitUntil: "domcontentloaded",
    timeout: 45000,
  });
  await page
    .waitForLoadState("networkidle", { timeout: 10000 })
    .catch(() => {});
  requireAllowedRaiPage(page.url());
  const title =
    norm(
      await page
        .locator("h1")
        .first()
        .textContent()
        .catch(() => ""),
    ) || card;
  const text = norm(await page.locator("body").innerText({ timeout: 5000 }));
  let price = parseMoney(
    text.match(/(?:€|EUR)\s*[-+]?\d[\d.,\s]*/i)?.[0] || "",
  );
  const inputUrl = new URL(allowed.url || href);
  const sourceSkuFromUrl = inputUrl.searchParams.get("SKU") || undefined;
  const sourceCategoryName =
    inputUrl.searchParams.get("CategoryName") || undefined;
  let usedCardPriceFallback = false;
  if (
    !price &&
    cardRawPriceText &&
    title &&
    (card.includes(title) || text.includes(title))
  ) {
    price = parseMoney(cardRawPriceText);
    usedCardPriceFallback = Boolean(price);
  }
  if (!title && !price) {
    console.warn(
      `Skipped non-product URL without product title or price: ${href}`,
    );
    return null;
  }
  if (!price) {
    if (!isProductDetailUrl(href) || isExcludedUrl(href)) {
      console.warn(`Skipped non-product URL without parseable price: ${href}`);
      return null;
    }
    throw new Error(`Unable to parse required price for ${href}`);
  }
  const imgs = await page
    .locator("img")
    .evaluateAll((els: any[]) =>
      els.map((i) => i.currentSrc || i.src).filter(Boolean),
    );
  const abs = [
    ...new Set(
      imgs
        .map((u) => new URL(u, page.url()).href)
        .filter((u) => u.startsWith("https://")),
    ),
  ];
  const sku =
    text.match(
      /(?:SKU|Item number|Product ID)\s*[:#]?\s*([A-Z0-9._-]+)/i,
    )?.[1] || sourceSkuFromUrl;
  const base: any = {
    sourceSku: sku,
    name: title,
    cardDescription: card,
    fullDescription: text.slice(0, 4000),
    canonicalUrl: page.url(),
    images: abs.map((u) => ({ thumbnailUrl: u, url: u })),
    pricing: {
      basePrice: price,
      rawPriceText: usedCardPriceFallback
        ? `Category card fallback: ${price.rawText}`
        : price.rawText,
      minQuantity: 1,
      quantityMultiplier: 1,
      priceBreaks: [{ quantity: 1, price }],
      options: [],
    },
    ordering: { notes: [] },
    attributes: [],
    sourceBreadcrumbs: catPath,
    categoryPaths: [catPath],
    ocId: ocId(["product", sku || title || href]),
    priceScheduleId: ocId(["ps", sku || title || href]),
    xp: {
      RAI: {
        Source: {
          CategoryName: sourceCategoryName,
          ProductUrl: allowed.url || href,
        },
        Pricing: {
          RawPriceText: usedCardPriceFallback
            ? `Category card fallback: ${price.rawText}`
            : price.rawText,
        },
      },
    },
  };
  base.sourceHash = sourceHash(base);
  return base;
}
export async function run() {
  const headed = process.argv.includes("--headed");
  const browser = await chromium.launch({ headless: !headed });
  const page = await browser.newPage();
  const scrapedAtUtc = new Date().toISOString();
  const snapshot: RaiSnapshot = {
    schemaVersion: 1,
    complete: false,
    source: {
      system: "RAI Amsterdam Exhibitor Services",
      event: "DevWorld",
      language: "en_US",
      currency: "EUR",
      homepageUrl: HOME,
      scrapedAtUtc,
    },
    categories: [],
    products: [],
  };
  try {
    await page.goto(HOME, { waitUntil: "domcontentloaded", timeout: 60000 });
    requireAllowedRaiPage(page.url());
    await handleCookieBanner(page);
    requireAllowedRaiPage(page.url());
    const homeAll = await links(page);
    const homeLinks = filterAllowedLinks(homeAll, "homepage", page.url());
    for (const [i, target] of TARGETS.entries()) {
      const targetCategory = TARGET_CATEGORY_NAMES[i];
      const l = homeLinks.find(
        (x) =>
          loose(x.text).includes(loose(target)) ||
          loose(target).includes(loose(x.text)) ||
          categoryNameOf(x.href) === targetCategory,
      );
      if (!l) continue;
      const name = norm(l.text) || categoryNameOf(l.href) || targetCategory;
      assertNonEmptyCategoryPath([name]);
      await traverse(l.href, [name], 0, new Set<string>());
    }
    snapshot.complete = snapshot.products.length > 0;
    snapshot.source.failure = snapshot.complete
      ? undefined
      : "No target products were discovered";
  } catch (e) {
    snapshot.source.failure =
      e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  } finally {
    await browser.close();
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(snapshot, null, 2));
    if (!snapshot.complete) {
      console.error(snapshot.source.failure);
      process.exitCode = 1;
    } else console.log(`Wrote ${snapshot.products.length} products to ${out}`);
  }
  async function traverse(
    url: string,
    catPath: string[],
    depth: number,
    seen: Set<string>,
  ) {
    assertNonEmptyCategoryPath(catPath);
    assertNotProductTraversal(url);
    const allowed = raiUrlAllowlist(url);
    if (!allowed.allowed)
      throw new Error(`Blocked external navigation: ${url}`);
    url = allowed.url || url;
    if (depth > 12 || seen.has(url)) return;
    seen.add(url);
    console.log(`Visiting category path: ${catPath.join(" > ")}`);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    requireAllowedRaiPage(page.url());
    await page
      .waitForLoadState("networkidle", { timeout: 10000 })
      .catch(() => {});
    requireAllowedRaiPage(page.url());
    console.log(
      `Current CategoryName: ${categoryNameOf(page.url()) || "(none)"}`,
    );
    const pd = await productLinksWithDebug(page);
    const products = pd.acceptedProductLinks;
    snapshot.categories.push({
      name: catPath.at(-1) || "",
      path: catPath,
      url: page.url(),
      listOrder: snapshot.categories.length,
      ocId: ocId(["cat", ...catPath]),
    });
    const children = await childCategoryLinks(page, catPath, pd);
    console.log(`Accepted child count: ${children.length}`);
    console.log(`Accepted product count: ${products.length}`);
    if (products.length) {
      for (const pl of firstProducts(products)) {
        try {
          const product = await scrapeProduct(
            page,
            pl.href,
            pl.cardText || pl.text,
            catPath,
            pl.cardText?.match(/(?:€|EUR)\s*[-+]?\d[\d.,\s]*/i)?.[0],
          );
          if (product) snapshot.products.push(product);
        } catch (e) {
          console.error(e);
        }
      }
      return;
    }
    if (!children.length)
      throw new Error(
        `No accepted child categories or products for category path "${catPath.join(" > ")}" at ${page.url()}. See ${debugPathForCategory(categoryNameOf(page.url()) || "unknown")}`,
      );
    for (const child of firstChildren(children)) {
      await traverse(child.href, [...catPath, child.text], depth + 1, seen);
    }
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) run();
