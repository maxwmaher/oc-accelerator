#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = path.join(ROOT, 'scrape-output', 'bristan-products.json');
const DEFAULT_API = 'https://westeurope-sandbox.ordercloud.io/v1';
const MARKETPLACE_BUYER_ID = 'bristan-demo-marketplace-buyer';
const MARKETPLACE_CATALOG_ID = 'bristan-demo-marketplace-catalog';
const args = new Set(process.argv.slice(2));
let dryRun = args.has('--dry-run');
const SUPPLIERS = [
  { key: 'north', id: 'bristan-demo-supplier-north', name: 'Bristan Demo North Supplies', discount: 0.04, availability: 'In stock', leadTime: '2-3 working days' },
  { key: 'south', id: 'bristan-demo-supplier-south', name: 'Bristan Demo South Supplies', discount: 0.07, availability: 'Limited stock', leadTime: '3-5 working days' },
];
const report = { created: 0, updated: 0, assigned: 0, skipped: 0 };
let ocContext = null;

function clean(text) { return text?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || null; }
function safeOrderCloudName(value, maxLength = 100) {
  const fallback = 'Bristan Demo';
  const normalized = (value ? String(value) : fallback).replace(/\s+/g, ' ').trim() || fallback;
  return normalized.length <= maxLength ? normalized : normalized.slice(0, maxLength).trim().replace(/[\s,.;:!?-]+$/g, '') || fallback;
}
function money(value) { return Math.max(0.01, Math.round(Number(value || 0) * 100) / 100); }
function productPrice(product) { return money(product.rrp || 10); }
function orderCloudBaseApiUrl() { return process.env.OC_API_URL || process.env.ORDERCLOUD_API_URL || process.env.VITE_APP_ORDERCLOUD_BASE_API_URL || DEFAULT_API; }
function orderCloudAuthRoot(baseApiUrl) { return baseApiUrl.replace(/\/v1\/?$/i, ''); }
async function readOptionalJson(filePath) { try { return JSON.parse(await fs.readFile(filePath, 'utf8')); } catch { return null; } }
async function loadAppSettingsEnv() {
  for (const candidate of [path.resolve(process.cwd(), 'appSettings.json'), path.resolve(process.cwd(), 'infrastructure/appSettings.json')]) {
    const json = await readOptionalJson(candidate);
    const settings = json?.Values || json;
    if (!settings) continue;
    for (const key of ['OC_CLIENT_ID', 'OC_CLIENT_SECRET', 'OC_API_URL', 'ORDERCLOUD_API_URL']) if (!process.env[key] && settings[key]) process.env[key] = settings[key];
  }
}
async function fetchOrderCloudToken(baseApiUrl) {
  const body = new URLSearchParams({ grant_type: 'client_credentials', client_id: process.env.OC_CLIENT_ID || '', client_secret: process.env.OC_CLIENT_SECRET || '', scope: process.env.OC_SCOPE || 'FullAccess' });
  const res = await fetch(`${orderCloudAuthRoot(baseApiUrl)}/oauth/token`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body });
  const text = await res.text();
  if (!res.ok) throw new Error(`OrderCloud auth failed: HTTP ${res.status} ${res.statusText}${text ? ` - ${text}` : ''}`);
  return JSON.parse(text);
}
async function ocInit() {
  await loadAppSettingsEnv();
  const baseApiUrl = orderCloudBaseApiUrl();
  const token = await fetchOrderCloudToken(baseApiUrl);
  ocContext = { baseApiUrl: baseApiUrl.replace(/\/$/, ''), accessToken: token.access_token };
}
async function ocRequest(method, requestPath, body) {
  const endpoint = `${ocContext.baseApiUrl}${requestPath.startsWith('/') ? requestPath : `/${requestPath}`}`;
  const res = await fetch(endpoint, { method, headers: { authorization: `Bearer ${ocContext.accessToken}`, accept: 'application/json', ...(body ? { 'content-type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const text = await res.text();
  if (!res.ok) { const err = new Error(`${method} ${endpoint} failed: HTTP ${res.status} ${res.statusText}${text ? ` - ${text}` : ''}`); err.status = res.status; err.body = text; throw err; }
  return text && res.status !== 204 ? JSON.parse(text) : null;
}
const ocGet = (p) => ocRequest('GET', p);
const ocPut = (p, b) => ocRequest('PUT', p, b);
const ocPost = (p, b) => ocRequest('POST', p, b);
function isNotFound(err) { return err?.status === 404; }
function isExistingAssignmentError(err) { return err?.status === 409 || /already exists|duplicate|assignment.+exists/i.test(err?.body || err?.message || ''); }
async function saveEntity(label, endpoint, payload) {
  try { await ocGet(`${endpoint}/${encodeURIComponent(payload.ID)}`); report.updated++; } catch (err) { if (!isNotFound(err)) throw err; report.created++; }
  console.log(`PUT ${label} ${payload.ID}`);
  await ocPut(`${endpoint}/${encodeURIComponent(payload.ID)}`, payload);
}
async function assign(label, endpoint, payload) {
  console.log(`ASSIGN ${label}: ${JSON.stringify(payload)}`);
  try { await ocPost(endpoint, payload); report.assigned++; } catch (err) { if (isExistingAssignmentError(err)) { report.skipped++; console.log(`SKIP existing ${label}`); return; } throw err; }
}
function priceSchedule(id, name, price) {
  return { ID: id, Name: safeOrderCloudName(name), ApplyTax: false, ApplyShipping: false, MinQuantity: 1, MaxQuantity: 10000, RestrictedQuantity: false, PriceBreaks: [{ Quantity: 1, Price: money(price) }], xp: { Demo: 'BristanMarketplace', HiddenMarketplaceOffer: true } };
}
function offerProduct(supplier, product, priceScheduleID, index) {
  const id = `bristan-demo-offer-${supplier.key}-${product.id}`;
  return {
    ID: id,
    Name: `${product.name} - ${supplier.name}`,
    Description: clean(product.shortDescription || product.longDescription || product.name),
    Active: true,
    QuantityMultiplier: 1,
    ShipWeight: 1,
    ShipHeight: 1,
    ShipWidth: 1,
    ShipLength: 1,
    DefaultPriceScheduleID: priceScheduleID,
    xp: {
      CanonicalProductID: product.id,
      CanonicalProductName: product.name,
      SupplierOffer: true,
      HiddenMarketplaceOffer: true,
      BristanOwnedProduct: true,
      SupplierID: supplier.id,
      SupplierName: supplier.name,
      Availability: supplier.availability,
      LeadTime: supplier.leadTime,
      Images: product.images || [],
      ImageUrl: product.imageUrl || null,
      SKU: product.sku || null,
      OfferRank: index + 1,
    },
  };
}
async function repair() {
  await loadAppSettingsEnv();
  dryRun = dryRun || !process.env.OC_CLIENT_SECRET;
  const artifact = JSON.parse(await fs.readFile(process.env.BRISTAN_SCRAPE_OUTPUT || OUTPUT, 'utf8'));
  const products = artifact.groups.flatMap((g) => g.products);
  console.log(`Bristan marketplace offer access repair: ${products.length * SUPPLIERS.length} offer products.`);
  if (dryRun) { console.log('Dry-run: no OrderCloud writes. Set OC_CLIENT_ID and OC_CLIENT_SECRET, then remove --dry-run to repair offer access.'); return; }
  await ocInit();
  for (const supplier of SUPPLIERS) {
    for (const [index, product] of products.entries()) {
      const offerProductID = `bristan-demo-offer-${supplier.key}-${product.id}`;
      const priceScheduleID = `${offerProductID}-ps`;
      const offerPrice = money(productPrice(product) * (1 - supplier.discount));
      await saveEntity('offer priceSchedule', '/priceschedules', priceSchedule(priceScheduleID, `${supplier.name} offer - ${product.name}`, offerPrice));
      await saveEntity('supplier offer product', '/products', offerProduct(supplier, product, priceScheduleID, index));
      await assign('marketplace offer category product', `/catalogs/${MARKETPLACE_CATALOG_ID}/categories/productassignments`, { CategoryID: product.categoryID, ProductID: offerProductID });
      await assign('supplier offer product to marketplace buyer', '/products/assignments', { ProductID: offerProductID, BuyerID: MARKETPLACE_BUYER_ID, PriceScheduleID: priceScheduleID });
    }
  }
  console.log(`Bristan marketplace offer access repair report: ${JSON.stringify(report)}`);
}
repair().catch((err) => { console.error(err.stack || err.message); process.exit(1); });
