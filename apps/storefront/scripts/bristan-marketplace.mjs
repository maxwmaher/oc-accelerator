#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = path.join(ROOT, 'scrape-output', 'bristan-products.json');
const BRISTAN = 'https://www.bristan.com';
const PREFIX = 'bristan-';
const CATALOG_ID = process.env.BRISTAN_CATALOG_ID || process.env.OC_CATALOG_ID || 'Default';
const LISTINGS = [
  { key: 'bathroom-taps', name: 'Bathroom Taps', url: `${BRISTAN}/products/bathroom-taps`, path: ['Taps', 'Bathroom Taps'], categoryID: 'bristan-bathroom-taps', parentID: 'bristan-taps' },
  { key: 'kitchen-taps', name: 'Kitchen Taps', url: `${BRISTAN}/products/kitchen-taps`, path: ['Taps', 'Kitchen Taps'], categoryID: 'bristan-kitchen-taps', parentID: 'bristan-taps' },
  { key: 'showers', name: 'Showers', url: `${BRISTAN}/products/showers`, path: ['Showers'], categoryID: 'bristan-showers' },
  { key: 'shower-accessories', name: 'Shower Accessories', url: `${BRISTAN}/products/accessories?type=shower`, path: ['Accessories', 'Shower Accessories'], categoryID: 'bristan-shower-accessories', parentID: 'bristan-accessories' },
  { key: 'complementary-accessories', name: 'Complementary Accessories', url: `${BRISTAN}/products/accessories?type=complementary`, path: ['Accessories', 'Complementary Accessories'], categoryID: 'bristan-complementary-accessories', parentID: 'bristan-accessories' },
];
const CATEGORIES = [
  { ID: 'bristan-taps', Name: 'Taps' },
  { ID: 'bristan-bathroom-taps', Name: 'Bathroom Taps', ParentID: 'bristan-taps' },
  { ID: 'bristan-kitchen-taps', Name: 'Kitchen Taps', ParentID: 'bristan-taps' },
  { ID: 'bristan-showers', Name: 'Showers' },
  { ID: 'bristan-accessories', Name: 'Accessories' },
  { ID: 'bristan-shower-accessories', Name: 'Shower Accessories', ParentID: 'bristan-accessories' },
  { ID: 'bristan-complementary-accessories', Name: 'Complementary Accessories', ParentID: 'bristan-accessories' },
];

const args = new Set(process.argv.slice(2));
const mode = args.has('seed') ? 'seed' : args.has('audit') ? 'audit' : 'scrape';
const dryRun = args.has('--dry-run') || !process.env.OC_CLIENT_SECRET;
const forceBrowser = args.has('--browser') || /^true$/i.test(process.env.BRISTAN_FORCE_BROWSER || '');
const inputPath = process.env.BRISTAN_SCRAPE_OUTPUT || OUTPUT;

function absoluteUrl(value) {
  if (!value) return null;
  try { return new URL(value, BRISTAN).toString(); } catch { return null; }
}
function clean(text) { return text?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || null; }
function slug(text) { return clean(text)?.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'unknown'; }
function uniq(items) { return [...new Set(items.filter(Boolean))]; }
function parsePrice(text) { const m = String(text || '').replace(/,/g, '').match(/(?:£|RRP)\s*([0-9]+(?:\.[0-9]{1,2})?)/i); return m ? Number(m[1]) : null; }
function extractJsonLd(html) {
  return [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].flatMap((m) => {
    try { const v = JSON.parse(m[1].trim()); return Array.isArray(v) ? v : [v]; } catch { return []; }
  });
}
async function fetchPage(url, options = {}) {
  const res = await fetch(url, { headers: { 'user-agent': 'oc-accelerator-bristan-seeder/1.0' } });
  const html = await res.text();
  if (!res.ok && !options.allowHttpErrors) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return { status: res.status, ok: res.ok, html, url: res.url || url };
}
async function get(url) { return (await fetchPage(url)).html; }

const KNOWN_NON_PRODUCT_PATHS = new Set([
  '/products',
  '/products/bathroom-taps',
  '/products/kitchen-taps',
  '/products/showers',
  '/products/accessories',
  '/products/browse-your-style',
  '/products/product-filters',
  '/products/kitchen-sinks',
]);
const BAD_PRODUCT_TEXT = /\b(?:404|page not found|product filters|browse your style)\b/i;
const NAV_CATEGORY_SEGMENT = /(?:^|\/)(?:product-filters|browse-your-style|kitchen-sinks|bathroom-taps|kitchen-taps|showers|accessories|products)(?:\/?$|[?#])/i;

const REJECTED_IMAGE_PATTERN = /(?:bristan-logo|footer-logo|fitting-instruct|designer-tag|filter-illustrations|product-icons|supernav|\/icons\/|cookie|share|navigation|badge|label)/i;
const PRODUCT_IMAGE_PATTERN = /\/product-files\/[^/]+\/product-web-image(?:-zoom)?\.(?:jpg|jpeg|webp)(?:\?|$)/i;
function imageUrlFromSrcset(value) {
  return clean(value)?.split(',').map((part) => clean(part).split(/\s+/)[0]).filter(Boolean).pop() || null;
}
function isRejectedImageUrl(value) {
  const abs = absoluteUrl(value);
  if (!abs) return true;
  try {
    const u = new URL(abs);
    return u.origin !== BRISTAN || REJECTED_IMAGE_PATTERN.test(`${u.pathname}${u.search}`);
  } catch { return true; }
}
function isProductImageUrl(value) {
  const abs = absoluteUrl(value);
  return !!abs && !isRejectedImageUrl(abs) && PRODUCT_IMAGE_PATTERN.test(abs);
}
function normalizeImageUrl(value) {
  const abs = absoluteUrl(value);
  return abs && !isRejectedImageUrl(abs) ? abs : null;
}

function productFileIDFromImageUrl(value) {
  const abs = absoluteUrl(value);
  if (!abs) return null;
  try {
    const u = new URL(abs);
    if (u.origin !== BRISTAN) return null;
    return clean(u.pathname.match(/\/product-files\/([^/]+)\/product-web-image(?:-zoom)?\.(?:jpg|jpeg|webp)$/i)?.[1]);
  } catch { return null; }
}
function isRealBristanProductImage(value) {
  const abs = absoluteUrl(value);
  if (!abs || isRejectedImageUrl(abs)) return false;
  try {
    const u = new URL(abs);
    return u.origin === BRISTAN && /\/product-files\/[^/]+\/product-web-image(?:-zoom)?\.(?:jpg|jpeg|webp)$/i.test(u.pathname);
  } catch { return false; }
}
function productWebImageUrl(fileID, zoom = false) {
  return fileID ? `${BRISTAN}/product-files/${fileID}/product-web-image${zoom ? '-zoom' : ''}.jpg` : null;
}
function compactProductImages(product) {
  const primary = isRealBristanProductImage(product?.imageUrl) ? absoluteUrl(product.imageUrl) : null;
  const fileID = productFileIDFromImageUrl(primary);
  if (!primary || !fileID) return [];
  const allowed = new Set([primary, productWebImageUrl(fileID, false), productWebImageUrl(fileID, true)].filter(Boolean));
  return uniq([primary, productWebImageUrl(fileID, true), ...(product?.images || [])]
    .map(absoluteUrl)
    .filter((url) => url && allowed.has(url) && productFileIDFromImageUrl(url) === fileID && isRealBristanProductImage(url)))
    .slice(0, 2);
}
function rankImageUrl(value) {
  const abs = normalizeImageUrl(value);
  if (!abs) return -1;
  if (isProductImageUrl(abs)) return 100;
  if (/\/product-files\//i.test(abs)) return 90;
  if (/\.(?:jpg|jpeg|webp)(?:\?|$)/i.test(abs)) return 50;
  return 10;
}
function bestImageUrl(values) {
  return values.flat().map((value) => normalizeImageUrl(value)).filter(Boolean).sort((a, b) => rankImageUrl(b) - rankImageUrl(a))[0] || null;
}

function normalizedBristanUrl(value) {
  const abs = absoluteUrl(value);
  if (!abs) return null;
  try {
    const u = new URL(abs);
    u.hash = '';
    return u.origin === BRISTAN ? u.toString().replace(/\/$/, '') : null;
  } catch { return null; }
}
function productCodeFromUrl(value) {
  const normalized = normalizedBristanUrl(value);
  if (!normalized) return null;
  try { return clean(new URL(normalized).searchParams.get('code')); } catch { return null; }
}
function rejectProductUrlReason(value) {
  const normalized = normalizedBristanUrl(value);
  if (!normalized) return 'not a Bristan URL';
  const { pathname, searchParams } = new URL(normalized);
  const pathKey = pathname.replace(/\/$/, '');
  const hasCode = !!clean(searchParams.get('code'));
  if (!pathname.startsWith('/products/')) return 'not under /products/';
  if (/^\/products\/(?:product-filters|browse-your-style|kitchen-sinks)(?:\/)?$/i.test(pathKey)) return 'known navigation URL';
  if (hasCode) return null;
  if (KNOWN_NON_PRODUCT_PATHS.has(pathKey)) return 'known category/navigation URL without code';
  if (NAV_CATEGORY_SEGMENT.test(pathname)) return 'category/filter/navigation URL without code';
  const slugPart = pathname.split('/').filter(Boolean).pop() || '';
  if (!/[a-z0-9]/i.test(slugPart) || slugPart.length < 4) return 'not a product-looking URL';
  return null;
}
function isLikelyProductUrl(value) { return !rejectProductUrlReason(value); }
function findProductLinks(html) {
  const links = [...html.matchAll(/href=["']([^"']*\/products\/[^"'#]*)["']/gi)].map((m) => normalizedBristanUrl(m[1]));
  return uniq(links).filter(isLikelyProductUrl);
}
function parseBrowserCardText(text, url) {
  const sourceText = clean(text);
  const queryCode = productCodeFromUrl(url);
  const rrp = parsePrice(sourceText);
  const beforePrice = clean(sourceText?.replace(/£\s*[0-9][0-9,.]*(?:\.[0-9]{1,2})?\s*RRP\s*View Item.*$/i, '')?.replace(/\s*View Item\s*$/i, ''));
  let name = beforePrice;
  let sku = queryCode;
  if (beforePrice && queryCode) {
    const codePattern = queryCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    const m = beforePrice.match(new RegExp(`^(.*?)\\s+(${codePattern})$`, 'i'));
    if (m) { name = clean(m[1]); sku = clean(m[2]); }
  }
  if (BAD_PRODUCT_TEXT.test(name || '') || /^(products?|taps|showers|accessories|product filters)$/i.test(name || '')) name = null;
  return { text: sourceText, name, sku, rrp, code: queryCode };
}

async function importPlaywright() {
  try { return await import('playwright'); } catch {
    try { return await import('@playwright/test'); } catch {
      throw new Error('Playwright is required for Bristan browser scraping. Install it with:\n  npm install -D playwright --prefix apps/storefront\n  npx --prefix apps/storefront playwright install chromium');
    }
  }
}
async function findProductLinksWithBrowser(url, listingName = url, staticCandidateCount = 0) {
  const { chromium } = await importPlaywright();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const networkProductImages = [];
    page.on('response', (response) => {
      const responseUrl = response.url();
      if (isProductImageUrl(responseUrl) && !networkProductImages.includes(responseUrl)) networkProductImages.push(responseUrl);
    });
    console.log(`${listingName}: opening ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    console.log(`${listingName}: DOM loaded`);
    for (const label of [/accept all/i, /^accept$/i, /allow all/i, /agree/i, /ok/i]) {
      const button = page.getByRole('button', { name: label }).first();
      if (await button.isVisible().catch(() => false)) {
        await button.click().catch(() => {});
        await page.waitForTimeout(300);
        break;
      }
    }
    const collect = async () => (await page.$$eval('a[href*="/products/"]', (anchors) => {
      const rejectedImage = /(?:designer-tag|filter-illustrations|product-icons|supernav|\/icons\/|cookie|share|navigation|badge|label)/i;
      const productImage = /(?:\/product-files\/|product-web-image)/i;
      const srcsetUrl = (value) => (value || '').split(',').map((part) => part.trim().split(/\s+/)[0]).filter(Boolean).pop() || null;
      const absolute = (value) => {
        if (!value) return null;
        try { return new URL(value, window.location.href).toString(); } catch { return null; }
      };
      const imageCandidates = (root) => [...(root?.querySelectorAll?.('img, source') || [])].flatMap((el) => [
        el.currentSrc,
        el.src,
        el.getAttribute('src'),
        el.getAttribute('data-src'),
        el.getAttribute('data-lazy-src'),
        el.getAttribute('data-original'),
        el.getAttribute('data-image'),
        el.getAttribute('data-bg'),
        srcsetUrl(el.getAttribute('srcset')),
        srcsetUrl(el.getAttribute('data-srcset')),
      ]).map(absolute).filter((url) => url && !rejectedImage.test(url));
      const bestImage = (root) => imageCandidates(root).sort((a, b) => {
        const ar = productImage.test(a) ? 100 : /\/product-files\//i.test(a) ? 90 : /\.(?:jpg|jpeg|webp)(?:\?|$)/i.test(a) ? 50 : 10;
        const br = productImage.test(b) ? 100 : /\/product-files\//i.test(b) ? 90 : /\.(?:jpg|jpeg|webp)(?:\?|$)/i.test(b) ? 50 : 10;
        return br - ar;
      })[0] || null;
      return anchors.map((a, index) => {
        const text = (a.textContent || '').replace(/\s+/g, ' ').trim();
        let card = a.closest('article, li, [class*="product" i], [class*="card" i], [data-testid*="product" i]');
        if (!card) card = a.parentElement;
        const imageUrl = bestImage(card) || bestImage(a);
        const image = card?.querySelector('img') || a.querySelector('img');
        return { url: a.href, text, rank: index + 1, imageUrl, imageAlt: image?.alt || null };
      });
    }))
      .filter((item) => {
        try {
          const u = new URL(item.url, BRISTAN);
          const text = item.text || '';
          return u.pathname.startsWith('/products/') && u.searchParams.has('code') && (/view item/i.test(text) || /£\s*\d/.test(text) || /\b[A-Z]+\s+[A-Z0-9][A-Z0-9\s-]{2,}\b/.test(text));
        } catch { return false; }
      })
      .map((item) => ({ ...item, url: normalizedBristanUrl(item.url), imageUrl: normalizeImageUrl(item.imageUrl) }))
      .filter((item) => item.url && isLikelyProductUrl(item.url))
      .map((item, index) => ({ ...item, imageUrl: item.imageUrl || networkProductImages[index] || null }));
    await page.waitForFunction(() => [...document.querySelectorAll('a[href*="/products/"]')].some((a) => {
      try { return new URL(a.href, location.href).searchParams.has('code') && /view item|£\s*\d/i.test(a.textContent || ''); } catch { return false; }
    }), null, { timeout: 15000 }).catch(() => {});
    let cards = await collect();
    let clicks = 0;
    while (cards.length < 10 && clicks < 12) {
      const loadMore = page.getByRole('button', { name: /load more|show more|view more/i }).first();
      const linkLoadMore = page.getByRole('link', { name: /load more|show more|view more/i }).first();
      const control = (await loadMore.isVisible().catch(() => false)) ? loadMore : ((await linkLoadMore.isVisible().catch(() => false)) ? linkLoadMore : null);
      if (!control) break;
      const before = cards.length;
      await control.click().catch(() => {});
      clicks++;
      await page.waitForTimeout(700);
      cards = await collect();
      if (cards.length <= before) break;
    }
    const byUrl = new Map();
    for (const card of cards) if (!byUrl.has(card.url)) byUrl.set(card.url, { ...card, ...parseBrowserCardText(card.text, card.url) });
    const results = [...byUrl.values()];
    console.log(`${listingName}: browser candidate count ${results.length}`);
    if (!results.length) {
      throw new Error(`${listingName}: no browser product links found for ${url} (static candidates: ${staticCandidateCount}). Retry with BRISTAN_FORCE_BROWSER=true. If links are still missing, inspect the page manually because Bristan may have changed selectors.`);
    }
    return results.slice(0, 10);
  } finally {
    await browser.close();
  }
}
function validateProductDetail(page, url, card = null) {
  const reasons = [];
  if (!page.ok || page.status === 404) reasons.push(`HTTP ${page.status}`);
  if (rejectProductUrlReason(url)) reasons.push(rejectProductUrlReason(url));
  const html = page.html || '';
  const title = clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
  const h1 = clean(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]);
  const cardParsed = card ? { ...parseBrowserCardText(card.text, url), ...card } : null;
  const hasCode = !!(cardParsed?.sku || productCodeFromUrl(url));
  const hasCardProductSignal = !!(cardParsed?.name && hasCode && /view item/i.test(cardParsed.text || '') && (cardParsed.rrp || cardParsed.imageUrl));
  if (BAD_PRODUCT_TEXT.test(`${title || ''} ${h1 || ''}`) && !hasCardProductSignal) reasons.push('bad title/heading');
  const json = extractJsonLd(html);
  const hasProductJson = json.some((x) => /Product/i.test(Array.isArray(x['@type']) ? x['@type'].join(' ') : x['@type'] || ''));
  const hasSku = hasCode || /(?:Product Code|SKU|Code)\s*(?:<[^>]+>\s*){0,4}[:#]?\s*[A-Z0-9][A-Z0-9-]{2,}/i.test(html) || json.some((x) => x.sku || x.mpn);
  const images = [...html.matchAll(/(?:src|data-src|content)=["']([^"']+\.(?:jpg|jpeg|png|webp)(?:\?[^"']*)?)["']/gi)].map((m) => absoluteUrl(m[1])).filter((u) => u?.startsWith(BRISTAN));
  const hasPrice = cardParsed?.rrp != null || parsePrice(html) != null || json.some((x) => parsePrice(JSON.stringify(x.offers || {})) != null);
  const hasTemplateMarker = /product-detail|product details|pdp|add to basket|download spec|technical specifications/i.test(html);
  const hasSpecificHeading = h1 && !BAD_PRODUCT_TEXT.test(h1) && !/^(products?|taps|showers|accessories|product filters)$/i.test(h1);
  if (!(hasCardProductSignal || hasProductJson || hasSku || hasTemplateMarker || (images.length && hasPrice) || (hasSpecificHeading && images.length))) reasons.push('no credible product signal');
  return { valid: reasons.length === 0, reasons };
}
function productFromDetail(html, url, listing, rank, card = null) {
  const json = extractJsonLd(html).find((x) => /Product/i.test(Array.isArray(x['@type']) ? x['@type'].join(' ') : x['@type'] || '')) || {};
  const cardParsed = card ? { ...parseBrowserCardText(card.text, url), ...card } : null;
  const detailTitle = clean(json.name) || clean(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]);
  const title = cardParsed?.name || (BAD_PRODUCT_TEXT.test(detailTitle || '') ? null : detailTitle);
  const sku = clean(cardParsed?.sku || json.sku || json.mpn || html.match(/(?:Product Code|SKU|Code)<\/[^>]+>\s*<[^>]+>([^<]+)/i)?.[1] || html.match(/(?:Product Code|SKU|Code)[:\s]+([A-Z0-9-]+)/i)?.[1] || productCodeFromUrl(url));
  const rawImages = uniq([cardParsed?.imageUrl, json.image, ...(Array.isArray(json.image) ? json.image : []), ...[...html.matchAll(/(?:src|data-src|data-lazy-src|data-original|data-image|content)=["']([^"']+\.(?:jpg|jpeg|png|webp)(?:\?[^"']*)?)["']/gi)].map((m) => m[1]), ...[...html.matchAll(/(?:srcset|data-srcset)=["']([^"']+)["']/gi)].map((m) => imageUrlFromSrcset(m[1]))].flat().map(normalizeImageUrl)).filter(Boolean).sort((a, b) => rankImageUrl(b) - rankImageUrl(a));
  const imageUrl = bestImageUrl([cardParsed?.imageUrl, rawImages.filter(isRealBristanProductImage)]) || null;
  const images = compactProductImages({ imageUrl, images: rawImages });
  const rrp = cardParsed?.rrp ?? parsePrice(JSON.stringify(json.offers || {})) ?? parsePrice(html);
  const desc = clean(json.description || html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i)?.[1]);
  const finish = clean(html.match(/Finish<\/[^>]+>\s*<[^>]+>([^<]+)/i)?.[1] || html.match(/Finish[:\s]+([^<\n]+)/i)?.[1]);
  const productType = clean(html.match(/Type<\/[^>]+>\s*<[^>]+>([^<]+)/i)?.[1]);
  const idBase = sku || url.split('/').filter(Boolean).pop() || title;
  return { id: `${PREFIX}${slug(idBase)}`, name: title || slug(idBase), sku, url, listingUrl: listing.url, categoryPath: listing.path, categoryID: listing.categoryID, listingRank: rank, rrp, imageUrl, images, imageAlt: cardParsed?.imageAlt || null, shortDescription: desc, longDescription: desc, finish, productType, sourceCategory: listing.name, validated: true };
}
async function validatedProductsForListing(listing) {
  const listingHtml = forceBrowser ? '' : await get(listing.url);
  const staticUrls = forceBrowser ? [] : findProductLinks(listingHtml);
  console.log(`${listing.name}: static candidate count ${staticUrls.length}`);
  let browserCards = [];
  if (forceBrowser || staticUrls.length < 10) browserCards = await findProductLinksWithBrowser(listing.url, listing.name, staticUrls.length);
  const browserMeta = new Map(browserCards.map((card) => [card.url, card]));
  let candidates = (browserCards.length ? uniq([...browserCards.map((card) => card.url), ...staticUrls]) : staticUrls).map((url) => ({ url, card: browserMeta.get(url) || null }));
  const products = [], rejected = [];
  for (const candidate of candidates) {
    if (products.length >= 10) break;
    const page = await fetchPage(candidate.url, { allowHttpErrors: true });
    const validation = validateProductDetail(page, candidate.url, candidate.card);
    if (!validation.valid) { rejected.push({ url: candidate.url, reason: validation.reasons.join(', ') }); continue; }
    products.push(productFromDetail(page.html, candidate.url, listing, products.length + 1, candidate.card));
  }
  if (products.length < 10 && !browserCards.length) {
    browserCards = await findProductLinksWithBrowser(listing.url, listing.name, staticUrls.length);
    for (const card of browserCards) browserMeta.set(card.url, card);
    candidates = uniq([...browserCards.map((card) => card.url), ...staticUrls])
      .filter((u) => !products.some((p) => p.url === u) && !rejected.some((r) => r.url === u))
      .map((url) => ({ url, card: browserMeta.get(url) || null }));
    for (const candidate of candidates) {
      if (products.length >= 10) break;
      const page = await fetchPage(candidate.url, { allowHttpErrors: true });
      const validation = validateProductDetail(page, candidate.url, candidate.card);
      if (!validation.valid) { rejected.push({ url: candidate.url, reason: validation.reasons.join(', ') }); continue; }
      products.push(productFromDetail(page.html, candidate.url, listing, products.length + 1, candidate.card));
    }
  }
  console.log(`${listing.name}: browser candidate count ${browserCards.length}`);
  console.log(`${listing.name}: validated product count ${products.length}`);
  console.log(`${listing.name}: rejected candidate count ${rejected.length}${rejected.length ? ` (${rejected.map((r) => `${r.url} => ${r.reason}`).join('; ')})` : ''}`);
  console.log(`${listing.name}: first accepted product URLs ${products.slice(0, 3).map((p) => p.url).join(', ') || '(none)'}`);
  return products;
}
async function scrape() {
  const groups = [];
  for (const listing of LISTINGS) {
    const products = await validatedProductsForListing(listing);
    groups.push({ ...listing, count: products.length, products });
    console.log(`${listing.name}: ${products.length}`);
  }
  const artifact = { scrapedAt: new Date().toISOString(), source: 'Bristan', total: groups.reduce((n, g) => n + g.products.length, 0), groups };
  await fs.mkdir(path.dirname(inputPath), { recursive: true });
  await fs.writeFile(inputPath, JSON.stringify(artifact, null, 2));
  return artifact;
}
function compactObject(value) {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== null && v !== undefined));
}
function xpFor(p) {
  const compactImages = compactProductImages(p);
  return {
    Demo: 'Bristan',
    Brand: 'Bristan',
    Source: 'Bristan',
    SourceUrl: p.url,
    SourceListingUrl: p.listingUrl,
    SourceCategoryPath: p.categoryPath,
    SourceCategoryPaths: [p.categoryPath],
    ImageUrl: p.imageUrl,
    Images: compactImages.map((Url) => ({ Url, ThumbnailUrl: Url, AltText: p.name, Source: 'Bristan' })),
    Scraped: compactObject({ Sku: p.sku, Rrp: p.rrp, Category: p.sourceCategory, ListingRank: p.listingRank }),
  };
}
function priceScheduleFor(p) { return p.rrp ? { ID: `${p.id}-ps`, Name: p.name, ApplyTax: true, MinQuantity: 1, PriceBreaks: [{ Quantity: 1, Price: p.rrp }], xp: { Demo: 'Bristan', Source: 'Bristan' } } : null; }
function productFor(p) { return { ID: p.id, Name: p.name, Description: p.shortDescription || p.longDescription || undefined, Active: true, DefaultPriceScheduleID: p.rrp ? `${p.id}-ps` : undefined, xp: xpFor(p) }; }
function assertShapes(artifact) {
  const errors = [];
  let largestProductXpSize = 0;
  const expectedNames = new Set(LISTINGS.map((l) => l.name));
  for (const listing of LISTINGS) {
    const group = (artifact.groups || []).find((g) => g.name === listing.name);
    if (!group) { errors.push(`missing listing group: ${listing.name}`); continue; }
    if ((group.products || []).length < 10 && !group.siteHasFewerThan10) errors.push(`${listing.name}: fewer than 10 validated products (${(group.products || []).length})`);
  }
  for (const g of artifact.groups || []) {
    if (!expectedNames.has(g.name)) errors.push(`unexpected listing group: ${g.name}`);
    for (const p of g.products || []) {
      const product = productFor(p), ps = priceScheduleFor(p);
      const xpSize = JSON.stringify(product.xp).length;
      largestProductXpSize = Math.max(largestProductXpSize, xpSize);
      const haystack = `${p.name || ''} ${p.url || ''} ${p.shortDescription || ''} ${p.longDescription || ''}`;
      if (typeof product.xp === 'string') errors.push(`${p.id}: Product.xp is string`);
      if (xpSize > 7500) errors.push(`${p.id}: Product.xp serialized length ${xpSize} exceeds 7500 characters`);
      if (typeof product.xp.Images === 'string') errors.push(`${p.id}: Images is string`);
      if (typeof product.xp.SourceCategoryPath === 'string' || typeof product.xp.SourceCategoryPaths === 'string') errors.push(`${p.id}: category path is string`);
      if (!Array.isArray(product.xp.SourceCategoryPath)) errors.push(`${p.id}: SourceCategoryPath is not an array`);
      if (!Array.isArray(product.xp.SourceCategoryPaths) || product.xp.SourceCategoryPaths.some((x) => !Array.isArray(x))) errors.push(`${p.id}: SourceCategoryPaths is not an array of arrays`);
      if (ps && Object.hasOwn(ps, 'Currency')) errors.push(`${p.id}: PriceSchedule includes Currency`);
      if (!p.url?.startsWith(BRISTAN)) errors.push(`${p.id}: non-Bristan product URL`);
      const urlReason = rejectProductUrlReason(p.url);
      if (urlReason) errors.push(`${p.id}: invalid product URL (${urlReason})`);
      if (BAD_PRODUCT_TEXT.test(haystack)) errors.push(`${p.id}: artifact contains 404/filter/navigation text`);
      if (/\/products\/(?:product-filters|browse-your-style|kitchen-sinks)(?:$|[/?#])/i.test(p.url || '')) errors.push(`${p.id}: forbidden non-product URL`);
      if (!p.validated) errors.push(`${p.id}: missing validated product marker`);
      if (p.imageUrl && isRejectedImageUrl(p.imageUrl)) errors.push(`${p.id}: rejected UI/badge primary image URL ${p.imageUrl}`);
      if (p.imageUrl && !isRealBristanProductImage(p.imageUrl)) errors.push(`${p.id}: primary image is not a real Bristan product image ${p.imageUrl}`);
      const primaryFileID = productFileIDFromImageUrl(p.imageUrl);
      if (!Array.isArray(product.xp.Images)) errors.push(`${p.id}: Images is not an array`);
      if ((product.xp.Images || []).length > 2) errors.push(`${p.id}: Images has more than 2 entries`);
      for (const image of product.xp.Images || []) {
        const img = image?.Url;
        if (!img?.startsWith(BRISTAN)) errors.push(`${p.id}: non-Bristan image URL ${img}`);
        if (isRejectedImageUrl(img)) errors.push(`${p.id}: rejected UI/badge image URL ${img}`);
        if (!isRealBristanProductImage(img)) errors.push(`${p.id}: image is not a real Bristan product image ${img}`);
        if (primaryFileID && productFileIDFromImageUrl(img) !== primaryFileID) errors.push(`${p.id}: image URL does not match primary product-files ID ${img}`);
      }
      for (const img of p.images || []) {
        if (!img.startsWith(BRISTAN)) errors.push(`${p.id}: non-Bristan artifact image URL ${img}`);
        if (isRejectedImageUrl(img)) errors.push(`${p.id}: rejected UI/badge artifact image URL ${img}`);
        if (primaryFileID && productFileIDFromImageUrl(img) !== primaryFileID) errors.push(`${p.id}: artifact image URL does not match primary product-files ID ${img}`);
      }
    }
    for (let i = 0; i < (g.products || []).length; i++) {
      const expectedRank = i + 1;
      if (g.products[i].listingRank !== expectedRank) errors.push(`${g.name}: ${g.products[i].id} listingRank ${g.products[i].listingRank} should be ${expectedRank}`);
    }
    const imageCounts = new Map();
    for (const p of g.products || []) if (p.imageUrl) imageCounts.set(p.imageUrl, (imageCounts.get(p.imageUrl) || 0) + 1);
    const maxShared = Math.max(0, ...imageCounts.values());
    if ((g.products || []).length >= 10 && maxShared >= 8) errors.push(`${g.name}: most products share the same image URL`);
    const missingImages = (g.products || []).filter((p) => !p.imageUrl).length;
    if ((g.products || []).length >= 10 && missingImages > 2) errors.push(`${g.name}: too many products are missing image URLs (${missingImages})`);
  }
  if (errors.length) throw new Error(`Bristan audit failed:\n${errors.join('\n')}`);
  console.log(`Audit passed: ${artifact.total} validated real products; largest Product.xp serialized size ${largestProductXpSize}; Product.xp, Images, category paths are object/array-shaped; no PriceSchedule Currency.`);
}
async function readArtifact() { return JSON.parse(await fs.readFile(inputPath, 'utf8')); }
function orderCloudBaseApiUrl() {
  return process.env.OC_API_URL || process.env.VITE_APP_ORDERCLOUD_BASE_API_URL || 'https://api.ordercloud.io/v1';
}
function orderCloudAuthRoot(baseApiUrl) {
  return baseApiUrl.replace(/\/v1\/?$/i, '');
}
async function fetchOrderCloudToken(baseApiUrl) {
  const authUrl = `${orderCloudAuthRoot(baseApiUrl)}/oauth/token`;
  const scope = process.env.OC_SCOPE || 'FullAccess';
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: process.env.OC_CLIENT_ID || '',
    client_secret: process.env.OC_CLIENT_SECRET || '',
    scope,
  });
  const res = await fetch(authUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  const responseBody = await res.text();
  if (!res.ok) throw new Error(`OrderCloud auth failed for ${authUrl}: HTTP ${res.status} ${res.statusText}${responseBody ? ` - ${responseBody}` : ''}`);
  try {
    return JSON.parse(responseBody);
  } catch (err) {
    throw new Error(`OrderCloud auth failed for ${authUrl}: HTTP ${res.status} ${res.statusText} returned invalid JSON${responseBody ? ` - ${responseBody}` : ''}`);
  }
}
let ocContext = null;
function operationDetails(operation) {
  return [operation.name, operation.endpoint || operation.sdkMethod, operation.payloadID && `payload ID ${operation.payloadID}`].filter(Boolean).join(' | ');
}
function logSeedOperation(message) {
  console.log(message);
}
function orderCloudErrorMessage(operation, err, responseBody = null, status = null, statusText = null) {
  const lines = [`OrderCloud operation failed: ${operationDetails(operation) || operation.name || 'unknown operation'}`];
  if (operation.endpoint) lines.push(`endpoint: ${operation.endpoint}`);
  if (operation.sdkMethod) lines.push(`sdkMethod: ${operation.sdkMethod}`);
  if (operation.payloadID) lines.push(`payloadID: ${operation.payloadID}`);
  const httpStatus = status ?? err?.status ?? err?.response?.status;
  const httpStatusText = statusText ?? err?.statusText ?? err?.response?.statusText;
  if (httpStatus) lines.push(`status: ${httpStatus}${httpStatusText ? ` ${httpStatusText}` : ''}`);
  const body = responseBody ?? err?.errors ?? err?.response?.data ?? err?.response?.body ?? err?.data ?? err?.body;
  if (body) lines.push(`orderCloudBody: ${typeof body === 'string' ? body : JSON.stringify(body)}`);
  if (err?.message) lines.push(`message: ${err.message}`);
  return lines.join('\n');
}
async function withOrderCloudError(operation, fn) {
  try { return await fn(); } catch (err) {
    const wrapped = new Error(orderCloudErrorMessage(operation, err), { cause: err });
    wrapped.status = err?.status ?? err?.response?.status;
    throw wrapped;
  }
}
function isOrderCloudNotFound(err) {
  const status = err?.status ?? err?.cause?.status ?? err?.cause?.response?.status;
  return status === 404 || (!status && /\bnot found\b/i.test(`${err?.message || ''} ${err?.cause?.message || ''}`));
}
async function ocInit() {
  const baseApiUrl = orderCloudBaseApiUrl();
  const token = await fetchOrderCloudToken(baseApiUrl);
  if (!token.access_token) throw new Error(`OrderCloud auth failed for ${orderCloudAuthRoot(baseApiUrl)}/oauth/token: missing access_token in response`);
  ocContext = { baseApiUrl: baseApiUrl.replace(/\/$/, ''), accessToken: token.access_token };
  return ocContext;
}
async function ocRequest(method, path, body) {
  if (!ocContext?.accessToken) throw new Error('OrderCloud REST request attempted before authentication.');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const endpoint = `${ocContext.baseApiUrl}${normalizedPath}`;
  const operation = { name: `${method} ${normalizedPath}`, endpoint, payloadID: body?.ID || body?.ProductID || body?.PriceScheduleID };
  const res = await fetch(endpoint, {
    method,
    headers: { authorization: `Bearer ${ocContext.accessToken}`, accept: 'application/json', ...(body ? { 'content-type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  if (!res.ok) {
    const err = new Error(orderCloudErrorMessage(operation, null, text, res.status, res.statusText));
    err.status = res.status;
    err.statusText = res.statusText;
    err.body = text;
    throw err;
  }
  if (!text || res.status === 204) return null;
  try { return JSON.parse(text); } catch { return text; }
}
async function ocGet(path) { return ocRequest('GET', path); }
async function ocPut(path, body) { return ocRequest('PUT', path, body); }
async function ocDelete(path) { return ocRequest('DELETE', path); }
async function safeSave(label, get, save, payload, report, options = {}) {
  const readOperation = { name: options.getLog || `GET ${label} ${payload.ID}`, sdkMethod: options.getMethod, endpoint: options.getEndpoint, payloadID: payload.ID };
  logSeedOperation(readOperation.name);
  try { await withOrderCloudError(readOperation, () => get(payload.ID)); report.updated++; }
  catch (err) {
    if (!isOrderCloudNotFound(err)) throw err;
    report.created++;
  }
  const writeOperation = { name: options.saveLog || `SAVE ${label} ${payload.ID}`, sdkMethod: options.saveMethod, endpoint: options.saveEndpoint, payloadID: payload.ID };
  logSeedOperation(writeOperation.name);
  await withOrderCloudError(writeOperation, () => save(payload.ID, payload));
  console.log(`${label}: ${payload.ID}`);
}
async function seed() {
  const artifact = await readArtifact(); assertShapes(artifact);
  const products = artifact.groups.flatMap((g) => g.products);
  const report = { created: 0, updated: 0, deleted: 0, skipped: 0 };
  if (dryRun) { console.log(`Dry-run: validated ${products.length} products and ${CATEGORIES.length} categories. Set OC_CLIENT_ID/OC_CLIENT_SECRET to seed.`); return report; }
  await ocInit();
  const categoryPath = (id) => `/catalogs/${encodeURIComponent(CATALOG_ID)}/categories/${encodeURIComponent(id)}`;
  for (const c of CATEGORIES) await safeSave(
    'category',
    (id) => ocGet(categoryPath(id)),
    (id, body) => ocPut(categoryPath(id), body),
    { ...c, Active: true, xp: { Demo: 'Bristan', Source: 'Bristan', ManagedBy: 'bristan-seeder' } },
    report,
    {
      getLog: `GET category ${c.ID} in catalog ${CATALOG_ID}`,
      saveLog: `SAVE category ${c.ID} in catalog ${CATALOG_ID}`,
      getEndpoint: `${ocContext.baseApiUrl}${categoryPath(c.ID)}`,
      saveEndpoint: `${ocContext.baseApiUrl}${categoryPath(c.ID)}`,
    }
  );
  for (const p of products) {
    const ps = priceScheduleFor(p);
    if (ps) {
      const priceSchedulePath = (id) => `/priceschedules/${encodeURIComponent(id)}`;
      await safeSave(
        'priceSchedule',
        (id) => ocGet(priceSchedulePath(id)),
        (id, body) => ocPut(priceSchedulePath(id), body),
        ps,
        report,
        {
          getLog: `GET priceSchedule ${ps.ID} at ${priceSchedulePath(ps.ID)}`,
          saveLog: `SAVE priceSchedule ${ps.ID} at ${priceSchedulePath(ps.ID)}`,
          getEndpoint: `${ocContext.baseApiUrl}${priceSchedulePath(ps.ID)}`,
          saveEndpoint: `${ocContext.baseApiUrl}${priceSchedulePath(ps.ID)}`,
        }
      );
    } else report.skipped++;
    const prod = productFor(p);
    const productPath = (id) => `/products/${encodeURIComponent(id)}`;
    const getProductOperation = { name: `GET product ${p.id} at ${productPath(p.id)}`, endpoint: `${ocContext.baseApiUrl}${productPath(p.id)}`, payloadID: p.id };
    logSeedOperation(getProductOperation.name);
    try {
      const existing = await withOrderCloudError(getProductOperation, () => ocGet(productPath(p.id)));
      if (typeof existing.xp === 'string') {
        const deleteProductOperation = { name: `DELETE malformed product ${p.id} at ${productPath(p.id)}`, endpoint: `${ocContext.baseApiUrl}${productPath(p.id)}`, payloadID: p.id };
        logSeedOperation(deleteProductOperation.name);
        await withOrderCloudError(deleteProductOperation, () => ocDelete(productPath(p.id)));
        report.deleted++;
      }
    } catch (err) {
      if (!isOrderCloudNotFound(err)) throw err;
    }
    await safeSave(
      'product',
      (id) => ocGet(productPath(id)),
      (id, body) => ocPut(productPath(id), body),
      prod,
      report,
      {
        getLog: `GET product ${prod.ID} at ${productPath(prod.ID)}`,
        saveLog: `SAVE product ${prod.ID} at ${productPath(prod.ID)}`,
        getEndpoint: `${ocContext.baseApiUrl}${productPath(prod.ID)}`,
        saveEndpoint: `${ocContext.baseApiUrl}${productPath(prod.ID)}`,
      }
    );
    const categoryAssignmentPath = `/catalogs/${encodeURIComponent(CATALOG_ID)}/categories/${encodeURIComponent(p.categoryID)}/productassignments/${encodeURIComponent(p.id)}`;
    const assignCategoryOperation = { name: `ASSIGN category product ${p.id} to category ${p.categoryID} in catalog ${CATALOG_ID} at ${categoryAssignmentPath}`, endpoint: `${ocContext.baseApiUrl}${categoryAssignmentPath}`, payloadID: p.id };
    logSeedOperation(assignCategoryOperation.name);
    await withOrderCloudError(assignCategoryOperation, () => ocPut(categoryAssignmentPath, { ProductID: p.id }));
  }
  console.log(`Bristan seed report: ${JSON.stringify(report)}`);
  return report;
}

try {
  if (mode === 'scrape') { const artifact = await scrape(); assertShapes(artifact); }
  if (mode === 'audit') assertShapes(await readArtifact());
  if (mode === 'seed') await seed();
} catch (err) { console.error(err.stack || err.message); process.exit(1); }
