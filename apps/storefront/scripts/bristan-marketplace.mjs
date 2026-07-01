#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Auth, Categories, Configuration, PriceSchedules, Products } from 'ordercloud-javascript-sdk';

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

function normalizedBristanUrl(value) {
  const abs = absoluteUrl(value);
  if (!abs) return null;
  try {
    const u = new URL(abs);
    u.hash = '';
    u.search = '';
    return u.origin === BRISTAN ? u.toString().replace(/\/$/, '') : null;
  } catch { return null; }
}
function rejectProductUrlReason(value) {
  const normalized = normalizedBristanUrl(value);
  if (!normalized) return 'not a Bristan URL';
  const { pathname } = new URL(normalized);
  if (!pathname.startsWith('/products/')) return 'not under /products/';
  if (KNOWN_NON_PRODUCT_PATHS.has(pathname.replace(/\/$/, ''))) return 'known category/navigation URL';
  if (NAV_CATEGORY_SEGMENT.test(pathname)) return 'category/filter/navigation URL';
  const slugPart = pathname.split('/').filter(Boolean).pop() || '';
  if (!/[a-z0-9]/i.test(slugPart) || slugPart.length < 4) return 'not a product-looking URL';
  return null;
}
function isLikelyProductUrl(value) { return !rejectProductUrlReason(value); }
function findProductLinks(html) {
  const links = [...html.matchAll(/href=["']([^"']*\/products\/[^"'#]*)["']/gi)].map((m) => normalizedBristanUrl(m[1]));
  return uniq(links).filter(isLikelyProductUrl);
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
    const collect = async () => uniq(await page.$$eval('a[href*="/products/"]', (anchors) => anchors
      .filter((a) => {
        const text = (a.textContent || '').trim();
        const card = a.closest('article, li, [class*="product" i], [data-testid*="product" i]');
        return card || /view item|view product|details/i.test(text);
      })
      .map((a) => a.href))).map(normalizedBristanUrl).filter(isLikelyProductUrl);
    await page.waitForFunction(() => [...document.querySelectorAll('a[href*="/products/"]')].some((a) => /view item|view product|details/i.test(a.textContent || '') || a.closest('article, li, [class*="product" i], [data-testid*="product" i]')), null, { timeout: 15000 }).catch(() => {});
    let links = await collect();
    let clicks = 0;
    while (links.length < 10 && clicks < 12) {
      const loadMore = page.getByRole('button', { name: /load more|show more|view more/i }).first();
      const linkLoadMore = page.getByRole('link', { name: /load more|show more|view more/i }).first();
      const control = (await loadMore.isVisible().catch(() => false)) ? loadMore : ((await linkLoadMore.isVisible().catch(() => false)) ? linkLoadMore : null);
      if (!control) break;
      const before = links.length;
      await control.click().catch(() => {});
      clicks++;
      await page.waitForFunction((previousCount) => [...document.querySelectorAll('a[href*="/products/"]')]
        .filter((a) => {
          const text = (a.textContent || '').trim();
          const card = a.closest('article, li, [class*="product" i], [data-testid*="product" i]');
          return card || /view item|view product|details/i.test(text);
        }).length > previousCount, before, { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(500);
      links = await collect();
      if (links.length <= before) break;
    }
    console.log(`${listingName}: browser candidate count ${links.length}`);
    if (!links.length) {
      throw new Error(`${listingName}: no browser product links found for ${url} (static candidates: ${staticCandidateCount}). Retry with BRISTAN_FORCE_BROWSER=true. If links are still missing, inspect the page manually because Bristan may have changed selectors.`);
    }
    return links.slice(0, 10);
  } finally {
    await browser.close();
  }
}
function validateProductDetail(page, url) {
  const reasons = [];
  if (!page.ok || page.status === 404) reasons.push(`HTTP ${page.status}`);
  if (rejectProductUrlReason(url)) reasons.push(rejectProductUrlReason(url));
  const html = page.html || '';
  const title = clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
  const h1 = clean(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]);
  if (BAD_PRODUCT_TEXT.test(`${title || ''} ${h1 || ''}`)) reasons.push('bad title/heading');
  const json = extractJsonLd(html);
  const hasProductJson = json.some((x) => /Product/i.test(Array.isArray(x['@type']) ? x['@type'].join(' ') : x['@type'] || ''));
  const hasSku = /(?:Product Code|SKU|Code)\s*(?:<[^>]+>\s*){0,4}[:#]?\s*[A-Z0-9][A-Z0-9-]{2,}/i.test(html) || json.some((x) => x.sku || x.mpn);
  const images = [...html.matchAll(/(?:src|data-src|content)=["']([^"']+\.(?:jpg|jpeg|png|webp)(?:\?[^"']*)?)["']/gi)].map((m) => absoluteUrl(m[1])).filter((u) => u?.startsWith(BRISTAN));
  const hasPrice = parsePrice(html) != null || json.some((x) => parsePrice(JSON.stringify(x.offers || {})) != null);
  const hasTemplateMarker = /product-detail|product details|pdp|add to basket|download spec|technical specifications/i.test(html);
  const hasSpecificHeading = h1 && !BAD_PRODUCT_TEXT.test(h1) && !/^(products?|taps|showers|accessories|product filters)$/i.test(h1);
  if (!(hasProductJson || hasSku || hasTemplateMarker || (images.length && hasPrice) || (hasSpecificHeading && images.length))) reasons.push('no credible product signal');
  return { valid: reasons.length === 0, reasons };
}
function productFromDetail(html, url, listing, rank) {
  const json = extractJsonLd(html).find((x) => /Product/i.test(Array.isArray(x['@type']) ? x['@type'].join(' ') : x['@type'] || '')) || {};
  const title = clean(json.name) || clean(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]);
  const sku = clean(json.sku || json.mpn || html.match(/(?:Product Code|SKU|Code)<\/[^>]+>\s*<[^>]+>([^<]+)/i)?.[1] || html.match(/(?:Product Code|SKU|Code)[:\s]+([A-Z0-9-]+)/i)?.[1]);
  const images = uniq([json.image, ...(Array.isArray(json.image) ? json.image : []), ...[...html.matchAll(/(?:src|data-src|content)=["']([^"']+\.(?:jpg|jpeg|png|webp)(?:\?[^"']*)?)["']/gi)].map((m) => m[1])].flat().map(absoluteUrl)).filter((u) => u.startsWith(BRISTAN));
  const rrp = parsePrice(JSON.stringify(json.offers || {})) ?? parsePrice(html);
  const desc = clean(json.description || html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i)?.[1]);
  const finish = clean(html.match(/Finish<\/[^>]+>\s*<[^>]+>([^<]+)/i)?.[1] || html.match(/Finish[:\s]+([^<\n]+)/i)?.[1]);
  const productType = clean(html.match(/Type<\/[^>]+>\s*<[^>]+>([^<]+)/i)?.[1]);
  const idBase = sku || url.split('/').filter(Boolean).pop() || title;
  return { id: `${PREFIX}${slug(idBase)}`, name: title || slug(idBase), sku, url, listingUrl: listing.url, categoryPath: listing.path, categoryID: listing.categoryID, listingRank: rank, rrp, imageUrl: images[0] || null, images, shortDescription: desc, longDescription: desc, finish, productType, sourceCategory: listing.name, validated: true };
}
async function validatedProductsForListing(listing) {
  const listingHtml = forceBrowser ? '' : await get(listing.url);
  const staticUrls = forceBrowser ? [] : findProductLinks(listingHtml);
  console.log(`${listing.name}: static candidate count ${staticUrls.length}`);
  let browserUrls = [];
  if (forceBrowser || staticUrls.length < 10) browserUrls = await findProductLinksWithBrowser(listing.url, listing.name, staticUrls.length);
  let candidates = browserUrls.length ? uniq([...browserUrls, ...staticUrls]) : staticUrls;
  const products = [], rejected = [];
  for (const url of candidates) {
    if (products.length >= 10) break;
    const page = await fetchPage(url, { allowHttpErrors: true });
    const validation = validateProductDetail(page, url);
    if (!validation.valid) { rejected.push({ url, reason: validation.reasons.join(', ') }); continue; }
    products.push(productFromDetail(page.html, url, listing, products.length + 1));
  }
  if (products.length < 10 && !browserUrls.length) {
    browserUrls = await findProductLinksWithBrowser(listing.url, listing.name, staticUrls.length);
    candidates = uniq([...browserUrls, ...staticUrls]).filter((u) => !products.some((p) => p.url === u) && !rejected.some((r) => r.url === u));
    for (const url of candidates) {
      if (products.length >= 10) break;
      const page = await fetchPage(url, { allowHttpErrors: true });
      const validation = validateProductDetail(page, url);
      if (!validation.valid) { rejected.push({ url, reason: validation.reasons.join(', ') }); continue; }
      products.push(productFromDetail(page.html, url, listing, products.length + 1));
    }
  }
  console.log(`${listing.name}: validated product count ${products.length}`);
  console.log(`${listing.name}: rejected candidate count ${rejected.length}${rejected.length ? ` (${rejected.map((r) => `${r.url} => ${r.reason}`).join('; ')})` : ''}`);
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
function xpFor(p) {
  return { Demo: 'Bristan', Brand: 'Bristan', Source: 'Bristan', SourceUrl: p.url, SourceListingUrl: p.listingUrl, SourceCategoryPath: p.categoryPath, SourceCategoryPaths: [p.categoryPath], ImageUrl: p.imageUrl, Images: p.images.map((Url) => ({ Url, ThumbnailUrl: Url, AltText: p.name, Source: 'Bristan' })), Scraped: { Sku: p.sku, Rrp: p.rrp, Finish: p.finish, ProductType: p.productType, Category: p.sourceCategory, ListingRank: p.listingRank } };
}
function priceScheduleFor(p) { return p.rrp ? { ID: `${p.id}-ps`, Name: p.name, ApplyTax: true, MinQuantity: 1, PriceBreaks: [{ Quantity: 1, Price: p.rrp }], xp: { Demo: 'Bristan', Source: 'Bristan' } } : null; }
function productFor(p) { return { ID: p.id, Name: p.name, Description: p.shortDescription || p.longDescription || undefined, Active: true, DefaultPriceScheduleID: p.rrp ? `${p.id}-ps` : undefined, xp: xpFor(p) }; }
function assertShapes(artifact) {
  const errors = [];
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
      const haystack = `${p.name || ''} ${p.url || ''} ${p.shortDescription || ''} ${p.longDescription || ''}`;
      if (typeof product.xp === 'string') errors.push(`${p.id}: Product.xp is string`);
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
      for (const img of p.images || []) if (!img.startsWith(BRISTAN)) errors.push(`${p.id}: non-Bristan image URL ${img}`);
    }
  }
  if (errors.length) throw new Error(`Bristan audit failed:\n${errors.join('\n')}`);
  console.log(`Audit passed: ${artifact.total} validated real products; Product.xp, Images, category paths are object/array-shaped; no PriceSchedule Currency.`);
}
async function readArtifact() { return JSON.parse(await fs.readFile(inputPath, 'utf8')); }
async function ocInit() {
  Configuration.Set({ baseApiUrl: process.env.OC_API_URL || process.env.VITE_APP_ORDERCLOUD_BASE_API_URL || 'https://api.ordercloud.io/v1' });
  const token = await Auth.ClientCredentials(process.env.OC_CLIENT_ID, process.env.OC_CLIENT_SECRET, ['FullAccess']);
  Configuration.Set({ accessToken: token.access_token });
}
async function safeSave(label, get, save, payload, report) { try { await get(payload.ID); report.updated++; } catch { report.created++; } await save(payload.ID, payload); console.log(`${label}: ${payload.ID}`); }
async function seed() {
  const artifact = await readArtifact(); assertShapes(artifact);
  const products = artifact.groups.flatMap((g) => g.products);
  const report = { created: 0, updated: 0, deleted: 0, skipped: 0 };
  if (dryRun) { console.log(`Dry-run: validated ${products.length} products and ${CATEGORIES.length} categories. Set OC_CLIENT_ID/OC_CLIENT_SECRET to seed.`); return report; }
  await ocInit();
  for (const c of CATEGORIES) await safeSave('category', (id) => Categories.Get(CATALOG_ID, id), (id, body) => Categories.Save(CATALOG_ID, id, body), { ...c, Active: true, xp: { Demo: 'Bristan', Source: 'Bristan', ManagedBy: 'bristan-seeder' } }, report);
  for (const p of products) {
    const ps = priceScheduleFor(p);
    if (ps) await safeSave('priceSchedule', PriceSchedules.Get, PriceSchedules.Save, ps, report); else report.skipped++;
    const prod = productFor(p);
    try { const existing = await Products.Get(p.id); if (typeof existing.xp === 'string') { await Products.Delete(p.id); report.deleted++; } } catch {}
    await safeSave('product', Products.Get, Products.Save, prod, report);
    if (ps) await Products.SaveAssignment({ ProductID: p.id, PriceScheduleID: ps.ID });
    await Categories.SaveProductAssignment(CATALOG_ID, p.categoryID, { ProductID: p.id });
  }
  console.log(`Bristan seed report: ${JSON.stringify(report)}`);
  return report;
}

try {
  if (mode === 'scrape') { const artifact = await scrape(); assertShapes(artifact); }
  if (mode === 'audit') assertShapes(await readArtifact());
  if (mode === 'seed') await seed();
} catch (err) { console.error(err.stack || err.message); process.exit(1); }
