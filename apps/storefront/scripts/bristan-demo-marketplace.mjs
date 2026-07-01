#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = path.join(ROOT, 'scrape-output', 'bristan-products.json');
const DEFAULT_API = 'https://westeurope-sandbox.ordercloud.io/v1';
const args = new Set(process.argv.slice(2));
let dryRun = args.has('--dry-run');

const CATEGORIES = [
  { ID: 'bristan-taps', Name: 'Taps' },
  { ID: 'bristan-bathroom-taps', Name: 'Bathroom Taps', ParentID: 'bristan-taps' },
  { ID: 'bristan-kitchen-taps', Name: 'Kitchen Taps', ParentID: 'bristan-taps' },
  { ID: 'bristan-showers', Name: 'Showers' },
  { ID: 'bristan-accessories', Name: 'Accessories' },
  { ID: 'bristan-shower-accessories', Name: 'Shower Accessories', ParentID: 'bristan-accessories' },
  { ID: 'bristan-complementary-accessories', Name: 'Complementary Accessories', ParentID: 'bristan-accessories' },
];
const ACCESSORY_CATEGORY_IDS = new Set(['bristan-accessories', 'bristan-shower-accessories', 'bristan-complementary-accessories']);
const SUPPLIERS = [
  { key: 'north', id: 'bristan-demo-supplier-north', name: 'Bristan Demo North Supplies', buyerID: 'bristan-demo-supplier-north-buyer', catalogID: 'bristan-demo-supplier-north-catalog', discount: 0.04, availability: 'In stock', leadTime: '2-3 working days' },
  { key: 'south', id: 'bristan-demo-supplier-south', name: 'Bristan Demo South Supplies', buyerID: 'bristan-demo-supplier-south-buyer', catalogID: 'bristan-demo-supplier-south-catalog', discount: 0.07, availability: 'Limited stock', leadTime: '3-5 working days' },
];
const report = { created: 0, updated: 0, assigned: 0, skipped: 0 };
let ocContext = null;

function clean(text) { return text?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || null; }
function money(value) { return Math.max(0.01, Math.round(Number(value || 0) * 100) / 100); }
function productPrice(product) { return money(product.rrp || 10); }
function orderCloudBaseApiUrl() { return process.env.OC_API_URL || process.env.ORDERCLOUD_API_URL || process.env.VITE_APP_ORDERCLOUD_BASE_API_URL || DEFAULT_API; }
function orderCloudAuthRoot(baseApiUrl) { return baseApiUrl.replace(/\/v1\/?$/i, ''); }
function operationDetails(operation) { return [operation.name, operation.endpoint, operation.payloadID && `payload ID ${operation.payloadID}`].filter(Boolean).join(' | '); }
function orderCloudErrorMessage(operation, err, responseBody = null, status = null, statusText = null) {
  const lines = [`OrderCloud operation failed: ${operationDetails(operation) || operation.name || 'unknown operation'}`];
  if (operation.endpoint) lines.push(`endpoint: ${operation.endpoint}`);
  if (operation.payloadID) lines.push(`payloadID: ${operation.payloadID}`);
  const httpStatus = status ?? err?.status ?? err?.response?.status;
  const httpStatusText = statusText ?? err?.statusText ?? err?.response?.statusText;
  if (httpStatus) lines.push(`status: ${httpStatus}${httpStatusText ? ` ${httpStatusText}` : ''}`);
  const body = responseBody ?? err?.errors ?? err?.response?.data ?? err?.response?.body ?? err?.data ?? err?.body;
  if (body) lines.push(`orderCloudBody: ${typeof body === 'string' ? body : JSON.stringify(body)}`);
  if (err?.message) lines.push(`message: ${err.message}`);
  return lines.join('\n');
}
function isOrderCloudNotFound(err) { return (err?.status ?? err?.cause?.status) === 404 || /\bnot found\b/i.test(`${err?.message || ''}`); }
function parseOrderCloudBody(body) { try { return typeof body === 'string' ? JSON.parse(body) : body; } catch { return body; } }
function isExistingAssignmentError(err) {
  const status = err?.status ?? err?.response?.status;
  const text = JSON.stringify(parseOrderCloudBody(err?.body ?? err?.response?.data ?? err?.data ?? err?.message) || '');
  return status === 409 || /\b(already exists|duplicate|conflict|assignment.+exists)\b/i.test(text);
}
async function readOptionalJson(filePath) {
  try { return JSON.parse(await fs.readFile(filePath, 'utf8')); } catch { return null; }
}
async function loadAppSettingsEnv() {
  const candidates = [path.resolve(process.cwd(), 'appSettings.json'), path.resolve(process.cwd(), 'infrastructure/appSettings.json')];
  for (const candidate of candidates) {
    const json = await readOptionalJson(candidate);
    const settings = json?.Values || json;
    if (!settings) continue;
    for (const key of ['OC_CLIENT_ID', 'OC_CLIENT_SECRET', 'OC_API_URL', 'ORDERCLOUD_API_URL', 'OC_CATALOG_ID']) {
      if (!process.env[key] && settings[key]) process.env[key] = settings[key];
    }
  }
}
async function fetchOrderCloudToken(baseApiUrl) {
  const authUrl = `${orderCloudAuthRoot(baseApiUrl)}/oauth/token`;
  const body = new URLSearchParams({ grant_type: 'client_credentials', client_id: process.env.OC_CLIENT_ID || '', client_secret: process.env.OC_CLIENT_SECRET || '', scope: process.env.OC_SCOPE || 'FullAccess' });
  const res = await fetch(authUrl, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body });
  const text = await res.text();
  if (!res.ok) throw new Error(`OrderCloud auth failed for ${authUrl}: HTTP ${res.status} ${res.statusText}${text ? ` - ${text}` : ''}`);
  return JSON.parse(text);
}
async function ocInit() {
  await loadAppSettingsEnv();
  const baseApiUrl = orderCloudBaseApiUrl();
  const token = await fetchOrderCloudToken(baseApiUrl);
  if (!token.access_token) throw new Error(`OrderCloud auth failed for ${orderCloudAuthRoot(baseApiUrl)}/oauth/token: missing access_token in response`);
  ocContext = { baseApiUrl: baseApiUrl.replace(/\/$/, ''), accessToken: token.access_token };
}
async function ocRequest(method, requestPath, body) {
  const normalizedPath = requestPath.startsWith('/') ? requestPath : `/${requestPath}`;
  const endpoint = `${ocContext.baseApiUrl}${normalizedPath}`;
  const operation = { name: `${method} ${normalizedPath}`, endpoint, payloadID: body?.ID || body?.ProductID || body?.PriceScheduleID || body?.BuyerID || body?.SupplierID };
  const res = await fetch(endpoint, { method, headers: { authorization: `Bearer ${ocContext.accessToken}`, accept: 'application/json', ...(body ? { 'content-type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const text = await res.text();
  if (!res.ok) { const err = new Error(orderCloudErrorMessage(operation, null, text, res.status, res.statusText)); err.status = res.status; err.statusText = res.statusText; err.body = text; throw err; }
  if (!text || res.status === 204) return null;
  return JSON.parse(text);
}
const ocGet = (p) => ocRequest('GET', p);
const ocPut = (p, b) => ocRequest('PUT', p, b);
const ocPost = (p, b) => ocRequest('POST', p, b);

async function saveEntity(label, endpoint, payload) {
  console.log(`GET ${label} ${payload.ID}`);
  try { await ocGet(`${endpoint}/${encodeURIComponent(payload.ID)}`); report.updated++; }
  catch (err) { if (!isOrderCloudNotFound(err)) throw err; report.created++; }
  console.log(`PUT ${label} ${payload.ID}`);
  await ocPut(`${endpoint}/${encodeURIComponent(payload.ID)}`, payload);
}
async function assign(label, endpoint, payload) {
  console.log(`ASSIGN ${label}: ${JSON.stringify(payload)}`);
  try { await ocPost(endpoint, payload); report.assigned++; }
  catch (err) { if (isExistingAssignmentError(err)) { report.skipped++; console.log(`SKIP existing ${label}`); return; } throw err; }
}
function user(id, username, email) { return { ID: id, Username: username, FirstName: 'Bristan', LastName: 'Demo', Email: email, Active: true, xp: { Demo: 'BristanMarketplace' } }; }
function categoryPayload(category) { return { ...category, Active: true, xp: { Demo: 'BristanMarketplace', BristanOwnedCategory: true } }; }
function priceSchedule(id, name, base, multipliers = [1]) {
  return { ID: id, Name: name, ApplyTax: false, ApplyShipping: false, MinQuantity: 1, MaxQuantity: 10000, RestrictedQuantity: false, PriceBreaks: multipliers.map(([Quantity, factor]) => ({ Quantity, Price: money(base * factor) })), xp: { Demo: 'BristanMarketplace' } };
}
function offerProduct(supplier, product, index) {
  const id = `bristan-demo-offer-${supplier.key}-${product.id}`;
  return {
    ID: id, Name: `${product.name} - ${supplier.name}`, Description: clean(product.shortDescription || product.longDescription || product.name), Active: true, QuantityMultiplier: 1, ShipWeight: 1, ShipHeight: 1, ShipWidth: 1, ShipLength: 1,
    DefaultPriceScheduleID: `${id}-ps`,
    xp: { CanonicalProductID: product.id, SupplierOffer: true, BristanOwnedProduct: true, SupplierID: supplier.id, SupplierName: supplier.name, Availability: supplier.availability, LeadTime: supplier.leadTime, Images: product.images || [], ImageUrl: product.imageUrl || null, SKU: product.sku || null, OfferRank: index + 1 },
  };
}
async function seed() {
  await loadAppSettingsEnv();
  dryRun = dryRun || !process.env.OC_CLIENT_SECRET;
  const artifact = JSON.parse(await fs.readFile(process.env.BRISTAN_SCRAPE_OUTPUT || OUTPUT, 'utf8'));
  const products = artifact.groups.flatMap((g) => g.products);
  const accessories = products.filter((p) => ACCESSORY_CATEGORY_IDS.has(p.categoryID));
  const offerCanonicals = products.filter((p) => !ACCESSORY_CATEGORY_IDS.has(p.categoryID)).slice(0, 6);
  console.log(`Bristan marketplace demo seed: ${products.length} canonical products, ${accessories.length} accessories, ${offerCanonicals.length * SUPPLIERS.length} supplier offers.`);
  if (dryRun) { console.log('Dry-run: no OrderCloud writes. Set OC_CLIENT_ID and OC_CLIENT_SECRET, then remove --dry-run to seed.'); console.log(`Bristan marketplace seed report: ${JSON.stringify(report)}`); return; }
  await ocInit();

  await saveEntity('buyer', '/buyers', { ID: 'bristan-demo-spares-buyer', Name: 'Bristan Demo Spare Parts Buyer', Active: true, xp: { Demo: 'BristanMarketplace', Journey: 'SpareParts' } });
  await saveEntity('buyer', '/buyers', { ID: 'bristan-demo-marketplace-buyer', Name: 'Bristan Demo Marketplace Buyer', Active: true, xp: { Demo: 'BristanMarketplace', Journey: 'MarketplaceBuyer' } });
  await saveEntity('catalog', '/catalogs', { ID: 'bristan-demo-spares-catalog', Name: 'Bristan Demo Spare Parts Catalog', Active: true, xp: { Demo: 'BristanMarketplace', Journey: 'SpareParts' } });
  await saveEntity('catalog', '/catalogs', { ID: 'bristan-demo-marketplace-catalog', Name: 'Bristan Demo Marketplace Catalog', Active: true, xp: { Demo: 'BristanMarketplace', Journey: 'MarketplaceBuyer' } });
  await saveEntity('buyer user', '/buyers/bristan-demo-spares-buyer/users', user('bristan-demo-spares-user', 'bristan-demo-spares-user', 'bristan-demo-spares@example.com'));
  await saveEntity('buyer user', '/buyers/bristan-demo-marketplace-buyer/users', user('bristan-demo-marketplace-user', 'bristan-demo-marketplace-user', 'bristan-demo-marketplace@example.com'));
  await assign('catalog to spares buyer', '/catalogs/assignments', { CatalogID: 'bristan-demo-spares-catalog', BuyerID: 'bristan-demo-spares-buyer', ViewAllCategories: true, ViewAllProducts: true });
  await assign('catalog to marketplace buyer', '/catalogs/assignments', { CatalogID: 'bristan-demo-marketplace-catalog', BuyerID: 'bristan-demo-marketplace-buyer', ViewAllCategories: true, ViewAllProducts: true });

  for (const c of CATEGORIES.filter((c) => ACCESSORY_CATEGORY_IDS.has(c.ID))) await saveEntity('spares category', '/catalogs/bristan-demo-spares-catalog/categories', categoryPayload(c));
  for (const p of accessories) await assign('spares category product', '/catalogs/bristan-demo-spares-catalog/categories/productassignments', { CategoryID: p.categoryID, ProductID: p.id });
  for (const c of CATEGORIES) await saveEntity('marketplace category', '/catalogs/bristan-demo-marketplace-catalog/categories', categoryPayload(c));
  for (const p of products) await assign('marketplace canonical category product', '/catalogs/bristan-demo-marketplace-catalog/categories/productassignments', { CategoryID: p.categoryID, ProductID: p.id });

  for (const supplier of SUPPLIERS) {
    await saveEntity('supplier', '/suppliers', { ID: supplier.id, Name: supplier.name, Active: true, xp: { Demo: 'BristanMarketplace' } });
    await saveEntity('buyer', '/buyers', { ID: supplier.buyerID, Name: `${supplier.name} Bulk Buyer`, Active: true, xp: { Demo: 'BristanMarketplace', SupplierID: supplier.id, Journey: 'SupplierBuyingFromBristan' } });
    await saveEntity('catalog', '/catalogs', { ID: supplier.catalogID, Name: `${supplier.name} Bulk Bristan Catalog`, Active: true, xp: { Demo: 'BristanMarketplace', SupplierID: supplier.id } });
    await saveEntity('buyer user', `/buyers/${supplier.buyerID}/users`, user(`${supplier.buyerID}-user`, `${supplier.buyerID}-user`, `${supplier.buyerID}@example.com`));
    await saveEntity('supplier user', `/suppliers/${supplier.id}/users`, user(`${supplier.id}-seller-user`, `${supplier.id}-seller-user`, `${supplier.id}@example.com`));
    await assign('catalog to supplier buyer', '/catalogs/assignments', { CatalogID: supplier.catalogID, BuyerID: supplier.buyerID, ViewAllCategories: true, ViewAllProducts: true });
    for (const c of CATEGORIES) await saveEntity('supplier buyer category', `/catalogs/${supplier.catalogID}/categories`, categoryPayload(c));
    for (const p of products) await assign('supplier buyer category product', `/catalogs/${supplier.catalogID}/categories/productassignments`, { CategoryID: p.categoryID, ProductID: p.id });
    for (const p of products.slice(0, 12)) {
      const ps = priceSchedule(`bristan-demo-bulk-${supplier.key}-${p.id}`, `${supplier.name} bulk price - ${p.name}`, productPrice(p), [[1, 1], [10, 0.9 - supplier.discount], [50, 0.82 - supplier.discount], [100, 0.76 - supplier.discount]]);
      await saveEntity('bulk priceSchedule', '/priceschedules', ps);
      await assign('bulk priceSchedule to supplier buyer', '/priceschedules/assignments', { PriceScheduleID: ps.ID, BuyerID: supplier.buyerID });
    }
    for (const [index, p] of offerCanonicals.entries()) {
      const offer = offerProduct(supplier, p, index);
      await saveEntity('offer priceSchedule', '/priceschedules', priceSchedule(offer.DefaultPriceScheduleID, `${supplier.name} offer - ${p.name}`, productPrice(p), [[1, 1 - supplier.discount]]));
      await saveEntity('supplier offer product', '/products', offer);
      await assign('marketplace offer category product', '/catalogs/bristan-demo-marketplace-catalog/categories/productassignments', { CategoryID: p.categoryID, ProductID: offer.ID });
    }
  }
  console.log(`Bristan marketplace seed report: ${JSON.stringify(report)}`);
}

seed().catch((err) => { console.error(err.stack || err.message); process.exit(1); });
