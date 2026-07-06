#!/usr/bin/env node
const DEFAULT_API = 'https://westeurope-sandbox.ordercloud.io/v1';
const PARENT_ID = 'bristan-apl-es-bas-blk';
const CATEGORY_ID = 'bristan-bathroom-taps';
const CATEGORIES = [
  { ID: 'bristan-taps', Name: 'Taps' },
  { ID: CATEGORY_ID, Name: 'Bathroom Taps', ParentID: 'bristan-taps' },
];
const BUYER_CONTEXTS = [
  { buyerID: 'bristan-demo-spares-buyer', catalogID: 'bristan-demo-spares-catalog' },
  { buyerID: 'bristan-demo-marketplace-buyer', catalogID: 'bristan-demo-marketplace-catalog' },
  { buyerID: 'bristan-demo-supplier-north-buyer', catalogID: 'bristan-demo-supplier-north-catalog' },
  { buyerID: 'bristan-demo-supplier-south-buyer', catalogID: 'bristan-demo-supplier-south-catalog' },
];
const SOURCE_URL = 'https://www.bristan.com/products/bathroom-taps?code=apl%20es%20bas%20blk';
const IMAGE_URL = 'https://www.bristan.com/product-files/842567/product-web-image.jpg';
const DESCRIPTION = 'European-inspired design meets everyday efficiency in the Appeal Basin Mixer, with a gently curving spout and thickset body in a statement black finish. Eco Start technology runs cold in the central position to reduce energy use.';
const report = { created: 0, updated: 0, assigned: 0, skipped: 0 };
let ocContext;

const children = [
  { ID: `${PARENT_ID}-complete`, Name: 'Appeal Eco Start Basin Mixer with Clicker Waste', role: 'CompleteProduct', PartNumber: 'APL ES BAS BLK', DiagramNumber: 'COMPLETE', Price: 163.75 },
  { ID: `${PARENT_ID}-part-210h80898dh-feu09`, Name: 'Handle Assembly', role: 'SparePart', PartNumber: '210H80898DH-FEU09', DiagramNumber: '01', Price: 22.68 },
  { ID: `${PARENT_ID}-part-20uf00200dh-feu09`, Name: 'Shroud', role: 'SparePart', PartNumber: '20UF00200DH-FEU09', DiagramNumber: '02', Price: 5.98 },
  { ID: `${PARENT_ID}-part-20ny00182nt-feu09`, Name: 'Cartridge Retaining Nut', role: 'SparePart', PartNumber: '20NY00182NT-FEU09', DiagramNumber: '03', Price: 6.65 },
  { ID: `${PARENT_ID}-part-08g35l150104`, Name: '35mm Cold Start Upper Seal Cartridge', role: 'SparePart', PartNumber: '08G35L1501.04', DiagramNumber: '04', Price: 9.14 },
  { ID: `${PARENT_ID}-part-210v80941dh-feu09`, Name: 'Plinth', role: 'SparePart', PartNumber: '210V80941DH-FEU09', DiagramNumber: '05', Price: 10.66 },
  { ID: `${PARENT_ID}-part-210v80942nt-feu09`, Name: '350mm Flexible Tail', role: 'SparePart', PartNumber: '210V80942NT-FEU09', DiagramNumber: '08', Price: 23.36 },
  { ID: `${PARENT_ID}-part-1z01029nt`, Name: 'Fixing Kit', role: 'SparePart', PartNumber: '1Z01029NT', DiagramNumber: '07', Price: 4.38 },
  { ID: `${PARENT_ID}-part-210a80534dh-feu09`, Name: 'Outlet', role: 'SparePart', PartNumber: '210A80534DH-FEU09', DiagramNumber: '06', Price: 9.37 },
  { ID: `${PARENT_ID}-part-w-basin04-blk`, Name: 'Waste', role: 'SparePart', PartNumber: 'W BASIN04 BLK', DiagramNumber: '09', Price: 44.00 },
];

function money(value) { return Math.round(Number(value) * 100) / 100; }
function orderCloudBaseApiUrl() { return process.env.OC_API_URL || process.env.ORDERCLOUD_API_URL || process.env.VITE_APP_ORDERCLOUD_BASE_API_URL || DEFAULT_API; }
function orderCloudAuthRoot(baseApiUrl) { return baseApiUrl.replace(/\/v1\/?$/i, ''); }
function isNotFound(err) { return err.status === 404; }
function isExistingAssignmentError(err) { return err.status === 409 || /already exists|duplicate|conflict|assignment.+exists/i.test(String(err.body || err.message)); }
async function fetchOrderCloudToken(baseApiUrl) {
  const body = new URLSearchParams({ grant_type: 'client_credentials', client_id: process.env.OC_CLIENT_ID || '', client_secret: process.env.OC_CLIENT_SECRET || '', scope: process.env.OC_SCOPE || 'FullAccess' });
  const res = await fetch(`${orderCloudAuthRoot(baseApiUrl)}/oauth/token`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body });
  const text = await res.text();
  if (!res.ok) throw new Error(`OrderCloud auth failed: HTTP ${res.status} ${res.statusText}${text ? ` - ${text}` : ''}`);
  return JSON.parse(text);
}
async function ocInit() {
  if (!process.env.OC_CLIENT_ID || !process.env.OC_CLIENT_SECRET) throw new Error('OC_CLIENT_ID and OC_CLIENT_SECRET are required. This script does not read or set user passwords.');
  const baseApiUrl = orderCloudBaseApiUrl().replace(/\/$/, '');
  const token = await fetchOrderCloudToken(baseApiUrl);
  ocContext = { baseApiUrl, accessToken: token.access_token };
}
async function ocRequest(method, path, body) {
  const res = await fetch(`${ocContext.baseApiUrl}${path}`, { method, headers: { authorization: `Bearer ${ocContext.accessToken}`, accept: 'application/json', ...(body ? { 'content-type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const text = await res.text();
  if (!res.ok) { const err = new Error(`${method} ${path} failed: HTTP ${res.status} ${res.statusText}${text ? ` - ${text}` : ''}`); err.status = res.status; err.body = text; throw err; }
  return text ? JSON.parse(text) : null;
}
const get = (p) => ocRequest('GET', p);
const put = (p, b) => ocRequest('PUT', p, b);
const post = (p, b) => ocRequest('POST', p, b);
async function saveEntity(label, endpoint, payload) {
  console.log(`GET ${label} ${payload.ID}`);
  try { await get(`${endpoint}/${encodeURIComponent(payload.ID)}`); report.updated++; console.log(`UPDATE ${label} ${payload.ID}`); }
  catch (err) { if (!isNotFound(err)) throw err; report.created++; console.log(`CREATE ${label} ${payload.ID}`); }
  await put(`${endpoint}/${encodeURIComponent(payload.ID)}`, payload);
}
async function assign(label, endpoint, payload) {
  console.log(`ASSIGN ${label}: ${JSON.stringify(payload)}`);
  try { await post(endpoint, payload); report.assigned++; }
  catch (err) { if (isExistingAssignmentError(err)) { report.skipped++; console.log(`SKIP existing ${label}`); return; } throw err; }
}
async function ensureCatalogCategory(catalogID, category) {
  console.log(`ENSURE category ${category.ID} in catalog ${catalogID}`);
  await saveEntity('catalog category', `/catalogs/${catalogID}/categories`, { ...category, Active: true, xp: { Demo: 'BristanMarketplace', BristanOwnedCategory: true } });
}
async function assignProductToCatalogCategory(catalogID, categoryID, product, labelPrefix) {
  await assign(`${labelPrefix} product ${product.ID} to catalog/category ${catalogID}/${categoryID}`, `/catalogs/${catalogID}/categories/productassignments`, { CategoryID: categoryID, ProductID: product.ID });
}
async function assignProductToBuyer(buyerID, product) {
  const priceScheduleID = `${product.ID}-ps`;
  await assign(`product ${product.ID} to buyer ${buyerID} with price schedule ${priceScheduleID}`, '/products/assignments', { ProductID: product.ID, BuyerID: buyerID, PriceScheduleID: priceScheduleID });
}
function priceSchedule(product) {
  return { ID: `${product.ID}-ps`, Name: product.Name.slice(0, 100), ApplyTax: false, ApplyShipping: false, MinQuantity: 1, MaxQuantity: 10000, RestrictedQuantity: false, PriceBreaks: [{ Quantity: 1, Price: money(product.Price) }], xp: { Demo: 'BristanMarketplace', BristanChildProductFamily: true } };
}
function parentPriceSchedule() {
  return priceSchedule({ ID: PARENT_ID, Name: 'Appeal Eco Start Basin Mixer with Clicker Waste', Price: 163.75 });
}
function childPriceSchedules() {
  return children.map((child) => priceSchedule(child));
}
function parentProduct() {
  return { ID: PARENT_ID, Name: 'Appeal Eco Start Basin Mixer with Clicker Waste', Description: DESCRIPTION, Active: true, QuantityMultiplier: 1, ShipWeight: 1, ShipHeight: 1, ShipWidth: 1, ShipLength: 1, DefaultPriceScheduleID: `${PARENT_ID}-ps`, IsParent: true, ParentID: null, xp: { Demo: 'BristanMarketplace', BristanChildProductFamily: true, FamilyType: 'FaucetWithSpareParts', ProductCode: 'APL ES BAS BLK', SourceUrl: SOURCE_URL, BrandRange: 'Appeal', DisplayPrice: 163.75, Currency: 'GBP', Description: DESCRIPTION, Features: ['Eco Start', 'Precise Glide', 'Secure Fix', 'Lifetime guarantee'], SparesNote: 'Spare parts are specific to the latest revision. If unsure on parts or revision, contact the Customer Service Team.', ExpectedSparesDelivery: 'Orders received before 1pm are normally dispatched same day and delivered within 2 working days.', Images: [{ Url: IMAGE_URL, ThumbnailUrl: IMAGE_URL }] } };
}
function childProduct(child) {
  return { ID: child.ID, Name: child.Name, Description: child.role === 'CompleteProduct' ? DESCRIPTION : `${child.Name} spare part for Appeal Eco Start Basin Mixer.`, Active: true, QuantityMultiplier: 1, ShipWeight: 1, ShipHeight: 1, ShipWidth: 1, ShipLength: 1, DefaultPriceScheduleID: `${child.ID}-ps`, IsParent: false, ParentID: PARENT_ID, xp: { Demo: 'BristanMarketplace', BristanChildProduct: true, ChildProductRole: child.role, ParentProductID: PARENT_ID, ParentProductCode: 'APL ES BAS BLK', PartNumber: child.PartNumber, DiagramNumber: child.DiagramNumber, Currency: 'GBP', Images: [{ Url: IMAGE_URL, ThumbnailUrl: IMAGE_URL }] } };
}
async function seed() {
  await ocInit();
  const parent = parentProduct();
  const products = [parent, ...children.map((child) => childProduct(child))];
  const priceSchedules = [parentPriceSchedule(), ...childPriceSchedules()];

  for (const schedule of priceSchedules) {
    await saveEntity('price schedule', '/priceschedules', schedule);
  }

  await saveEntity('parent product', '/products', parent);
  for (const product of products.slice(1)) {
    await saveEntity('child product', '/products', product);
  }
  for (const { buyerID, catalogID } of BUYER_CONTEXTS) {
    for (const category of CATEGORIES) await ensureCatalogCategory(catalogID, category);

    await assignProductToCatalogCategory(catalogID, CATEGORY_ID, parent, 'parent');
    for (const product of products.slice(1)) {
      await assignProductToCatalogCategory(catalogID, CATEGORY_ID, product, 'child');
    }

    for (const product of products) await assignProductToBuyer(buyerID, product);
  }
  console.log(`Bristan Appeal child products seed report: ${JSON.stringify(report)}`);
}
seed().catch((err) => { console.error(err.stack || err.message); process.exit(1); });
