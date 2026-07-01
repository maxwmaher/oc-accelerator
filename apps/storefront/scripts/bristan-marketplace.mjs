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
async function get(url) {
  const res = await fetch(url, { headers: { 'user-agent': 'oc-accelerator-bristan-seeder/1.0' } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.text();
}
function findProductLinks(html) {
  const links = [...html.matchAll(/href=["']([^"']*\/products\/(?!bathroom-taps|kitchen-taps|showers|accessories)[^"'#?]+)[^"']*["']/gi)].map((m) => absoluteUrl(m[1]));
  return uniq(links).filter((u) => u?.startsWith(`${BRISTAN}/products/`)).slice(0, 10);
}
async function findProductLinksWithBrowser(url) {
  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    try {
      ({ chromium } = await import('@playwright/test'));
    } catch {
      throw new Error(`No product links were found in static HTML for ${url}, and Playwright is not installed for browser fallback.`);
    }
  }
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle' });
    const links = await page.$$eval('a[href*="/products/"]', (anchors) => anchors.map((a) => a.href));
    return uniq(links).filter((u) => u.startsWith(`${BRISTAN}/products/`) && !/\/products\/(?:bathroom-taps|kitchen-taps|showers|accessories)(?:[/?#]|$)/.test(u)).slice(0, 10);
  } finally {
    await browser.close();
  }
}
function productFromDetail(html, url, listing, rank) {
  const json = extractJsonLd(html).find((x) => /Product/i.test(Array.isArray(x['@type']) ? x['@type'].join(' ') : x['@type'] || '')) || {};
  const title = clean(json.name) || clean(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]) || clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
  const sku = clean(json.sku || json.mpn || html.match(/(?:Product Code|SKU|Code)<\/[^>]+>\s*<[^>]+>([^<]+)/i)?.[1] || html.match(/(?:Product Code|SKU|Code)[:\s]+([A-Z0-9-]+)/i)?.[1]);
  const images = uniq([json.image, ...(Array.isArray(json.image) ? json.image : []), ...[...html.matchAll(/(?:src|data-src|content)=["']([^"']+\.(?:jpg|jpeg|png|webp)(?:\?[^"']*)?)["']/gi)].map((m) => m[1])].flat().map(absoluteUrl)).filter((u) => u.startsWith(BRISTAN));
  const rrp = parsePrice(JSON.stringify(json.offers || {})) ?? parsePrice(html);
  const desc = clean(json.description || html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i)?.[1]);
  const finish = clean(html.match(/Finish<\/[^>]+>\s*<[^>]+>([^<]+)/i)?.[1] || html.match(/Finish[:\s]+([^<\n]+)/i)?.[1]);
  const productType = clean(html.match(/Type<\/[^>]+>\s*<[^>]+>([^<]+)/i)?.[1]);
  const idBase = sku || url.split('/').filter(Boolean).pop() || title;
  return { id: `${PREFIX}${slug(idBase)}`, name: title || slug(idBase), sku, url, listingUrl: listing.url, categoryPath: listing.path, categoryID: listing.categoryID, listingRank: rank, rrp, imageUrl: images[0] || null, images, shortDescription: desc, longDescription: desc, finish, productType, sourceCategory: listing.name };
}
async function scrape() {
  const groups = [];
  for (const listing of LISTINGS) {
    const html = await get(listing.url);
    let urls = findProductLinks(html);
    if (!urls.length) urls = await findProductLinksWithBrowser(listing.url);
    const products = [];
    for (const [i, url] of urls.entries()) products.push(productFromDetail(await get(url), url, listing, i + 1));
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
  for (const g of artifact.groups || []) for (const p of g.products || []) {
    const product = productFor(p), ps = priceScheduleFor(p);
    if (typeof product.xp === 'string') errors.push(`${p.id}: Product.xp is string`);
    if (typeof product.xp.Images === 'string') errors.push(`${p.id}: Images is string`);
    if (typeof product.xp.SourceCategoryPath === 'string' || typeof product.xp.SourceCategoryPaths === 'string') errors.push(`${p.id}: category path is string`);
    if (ps && Object.hasOwn(ps, 'Currency')) errors.push(`${p.id}: PriceSchedule includes Currency`);
    if (!p.url?.startsWith(BRISTAN)) errors.push(`${p.id}: non-Bristan product URL`);
    for (const img of p.images || []) if (!img.startsWith(BRISTAN)) errors.push(`${p.id}: non-Bristan image URL ${img}`);
  }
  if (errors.length) throw new Error(`Bristan audit failed:\n${errors.join('\n')}`);
  console.log(`Audit passed: ${artifact.total} products; Product.xp, Images, category paths are object/array-shaped; no PriceSchedule Currency.`);
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
