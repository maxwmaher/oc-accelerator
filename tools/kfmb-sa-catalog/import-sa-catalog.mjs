/** Additive Saudi catalog import. Node 22+, no dependencies.
 * All API calls target this fixed sandbox. Existing resources are never PATCHed,
 * PUT, or deleted. Matching assignments may be restored on a partial-run retry.
 * Prices and quantity limits are fictional demo assumptions.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const SETTINGS = Object.freeze({
  api: 'https://westeurope-sandbox.ordercloud.io',
  marketplace: '_nfhvLBeikC2yF1a6f6v0w',
  clientId: '0BAD0F65-D294-448E-8819-98F713696BB9',
  buyer: 'sa-buyers', catalog: 'sa-catalog', locale: 'kfmb-en-SA-SAR',
  owner: 'kfmb-sa-catalog-v1'
});
const dir = new URL('./', import.meta.url);
export const readManifest = async () => JSON.parse(await readFile(new URL('sa-catalog.json', dir), 'utf8'));
const enc = encodeURIComponent;
export function requireCondition(condition, message) { if (!condition) throw new Error(message); }
// Compare only fields managed by this importer; accept server-provided extra fields.
export function matches(actual, expected) {
  if (Array.isArray(expected)) return Array.isArray(actual) && actual.length === expected.length && expected.every((x,i) => matches(actual[i], x));
  if (expected && typeof expected === 'object') return !!actual && Object.entries(expected).every(([key,value]) => matches(actual[key], value));
  return actual === expected;
}
export function buildPlan(manifest) {
  requireCondition(manifest.schemaVersion === 1, 'Unsupported catalog schema.');
  requireCondition(Array.isArray(manifest.products) && manifest.products.length > 0, 'No catalog products.');
  requireCondition(new Set(manifest.products.map(x=>x.id)).size === manifest.products.length, 'Duplicate product IDs.');
  const resources=[], assignments=[];
  const croot=`/catalogs/${SETTINGS.catalog}/categories`;
  for (const [i,c] of manifest.categories.entries()) {
    resources.push({root:croot,path:`${croot}/${enc(c.id)}`,body:{ID:c.id,Name:c.name,Active:true,ListOrder:i+1,xp:{ImportOwner:SETTINGS.owner,SourceUrl:c.sourceUrl}}});
  }
  const categoryIds=new Set(manifest.categories.map(c=>c.id));
  for (const p of manifest.products) {
    requireCondition(/^[a-z0-9-]+$/.test(p.id) && p.id.length<=70, `Invalid product ID: ${p.id}`);
    requireCondition(categoryIds.has(p.categoryId), `Unknown category for ${p.id}`);
    requireCondition(typeof p.name==='string' && p.name.length>0, `Missing name: ${p.id}`);
    for (const field of ['sourceUrl','imageUrl']) {
      const u=new URL(p[field]);
      requireCondition(u.protocol==='https:' && u.hostname==='www.mjcs.com.sa', `Unexpected ${field}: ${p.id}`);
    }
    resources.push({root:'/products',path:`/products/${enc(p.id)}`,body:{
      ID:p.id,Name:p.name,Description:p.description,Active:true,QuantityMultiplier:1,
      xp:{ImportOwner:SETTINGS.owner,DemoPricing:true,Brand:p.brand,FamilyID:p.familyId,
        PackSize:p.packSize,PackValue:p.packValue,PackUnit:p.packUnit,UnitOfMeasure:'One '+p.packSize+' pack',
        SourceUrl:p.sourceUrl,SourceProductName:p.sourceProductName,SourceCapturedOn:manifest.capturedOn,
        SourceChannel:'Saudi Arabia',Images:[{Url:p.imageUrl}],...(p.imageNotes?{ImageNotes:p.imageNotes}:{}),
        CommercialTerms:'Illustrative demo prices and quantity limits; not supplier terms.'}
    }});
    assignments.push({kind:'catalog',path:'/catalogs/productassignments',body:{CatalogID:SETTINGS.catalog,ProductID:p.id}});
    assignments.push({kind:'category',path:`${croot}/productassignments`,body:{CategoryID:p.categoryId,ProductID:p.id}});
    for (const group of ['standard','wholesale']) {
      const price=group==='standard'?p.demoStandardPriceSAR:p.demoWholesalePriceSAR;
      requireCondition(Number.isFinite(price) && price>0 && Math.abs(price*100-Math.round(price*100))<1e-7, `Invalid price: ${p.id}/${group}`);
      const id=`${p.id}-sa-${group}`;
      resources.push({root:'/priceschedules',path:`/priceschedules/${enc(id)}`,body:{
        ID:id,Name:`DEMO - ${p.name} - ${group}`,ApplyTax:false,ApplyShipping:false,
        MinQuantity:group==='standard'?1:5,MaxQuantity:group==='standard'?10:50,
        UseCumulativeQuantity:true,RestrictedQuantity:false,Currency:'SAR',PriceBreaks:[{Quantity:1,Price:price}],
        xp:{ImportOwner:SETTINGS.owner,DemoOnly:true,PriceSource:p.priceSource}
      }});
      assignments.push({kind:'price',path:'/products/assignments',body:{ProductID:p.id,BuyerID:SETTINGS.buyer,UserGroupID:group,PriceScheduleID:id}});
    }
  }
  return {resources,assignments};
}
export function assignmentKey(kind, b) {
  if (kind==='catalog') return `${b.CatalogID}|${b.ProductID}`;
  if (kind==='category') return `${b.CategoryID}|${b.ProductID}`;
  return `${b.ProductID}|${b.BuyerID}|${b.UserGroupID||''}|${b.UserID||''}`;
}
export class OCClient {
  constructor(secret, fetchImpl=fetch) { this.secret=secret; this.fetch=fetchImpl; this.token=null; this.expires=0; }
  async authenticate() {
    requireCondition(typeof this.secret==='string' && this.secret.length>0,'No backend secret supplied. Use Run-SaCatalog.ps1.');
    const response=await this.fetch(`${SETTINGS.api}/oauth/token`,{method:'POST',redirect:'error',signal:AbortSignal.timeout(45000),headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'client_credentials',client_id:SETTINGS.clientId,client_secret:this.secret,scope:'FullAccess'})});
    requireCondition(response.ok,`Backend authentication failed: HTTP ${response.status}. Secret/token values are not logged.`);
    const data=await response.json();
    requireCondition(typeof data.access_token==='string','Authentication response contained no access token.');
    this.token=data.access_token; this.expires=Date.now()+((data.expires_in||600)-30)*1000;
  }
  async request(method,path,body,allow404=false) {
    requireCondition(path.startsWith('/') && !path.startsWith('//') && !path.includes('://') && !path.includes('..'), 'Unsafe API path.');
    requireCondition(['GET','POST'].includes(method),'This importer permits only GET and POST.');
    if (!this.token || Date.now()>=this.expires) await this.authenticate();
    let response;
    // Only safe GET reads are automatically retried. Never retry an uncertain write.
    for (let attempt=0;attempt<3;attempt++) {
      try { response=await this.fetch(`${SETTINGS.api}/v1${path}`,{method,redirect:'error',signal:AbortSignal.timeout(45000),headers:{Authorization:`Bearer ${this.token}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})}); }
      catch { throw new Error(`${method} ${path}: network timeout/failure. No automatic write retry; a later run will inspect existing state.`); }
      if (method==='GET' && [429,502,503,504].includes(response.status) && attempt<2) {await new Promise(r=>setTimeout(r,(attempt+1)*1500));continue;}
      break;
    }
    if (allow404 && response.status===404) return null;
    const text=await response.text(); let data=null;
    if (text) {try {data=JSON.parse(text);} catch {requireCondition(false,`${method} ${path}: non-JSON API response (HTTP ${response.status}).`);}}
    if (!response.ok) {
      const errors=Array.isArray(data?.Errors)?data.Errors.map(x=>`${x.ErrorCode}: ${x.Message}`).join('; '):'Request failed';
      let message=`${method} ${path}: HTTP ${response.status}. ${errors}`;
      for (const value of [this.secret,this.token]) if(value) message=message.split(value).join('[redacted]');
      throw new Error(message);
    }
    return data;
  }
  async list(path) {
    const items=[];
    for (let page=1;page<=100;page++) {
      const data=await this.request('GET',`${path}${path.includes('?')?'&':'?'}pageSize=100&page=${page}`);
      requireCondition(Array.isArray(data?.Items) && Number.isInteger(data?.Meta?.TotalPages),`Unexpected pagination shape: ${path}`);
      items.push(...data.Items);
      if(page>=data.Meta.TotalPages) return items;
    }
    throw new Error(`Pagination exceeded limit: ${path}`);
  }
}
export async function verifyFoundation(client) {
  // The price schedule OwnerID verifies the target marketplace independently of
  // the default-context username (which the user changed to admin).
  const anchor=await client.request('GET','/priceschedules/kfmb-demo-flour-sa-standard');
  requireCondition(anchor?.OwnerID===SETTINGS.marketplace,'Marketplace guard failed. No writes made.');
  const buyer=await client.request('GET',`/buyers/${SETTINGS.buyer}`);
  requireCondition(buyer?.Active && buyer.DefaultCatalogID===SETTINGS.catalog,'Saudi Buyer/default catalog does not match expected foundation.');
  const catalog=await client.request('GET',`/catalogs/${SETTINGS.catalog}`);
  requireCondition(catalog?.Active,'Saudi catalog is inactive.');
  const locale=await client.request('GET',`/locales/${SETTINGS.locale}`);
  requireCondition(locale?.Currency==='SAR','Saudi locale is not SAR.');
  const localeRows=await client.list(`/locales/assignments?buyerID=${SETTINGS.buyer}`);
  for (const group of ['standard','wholesale']) {
    await client.request('GET',`/buyers/${SETTINGS.buyer}/usergroups/${group}`);
    requireCondition(localeRows.some(r=>r.BuyerID===SETTINGS.buyer && r.UserGroupID===group && r.LocaleID===SETTINGS.locale),`Missing explicit SAR locale assignment on ${group}. No automatic repair.`);
  }
  const visibility=await client.list(`/catalogs/assignments?catalogID=${SETTINGS.catalog}&buyerID=${SETTINGS.buyer}`);
  requireCondition(visibility.some(r=>r.CatalogID===SETTINGS.catalog && r.BuyerID===SETTINGS.buyer && r.ViewAllCategories===true && r.ViewAllProducts===true),'Expected Saudi catalog visibility assignment missing.');
}
export async function readAssignmentMaps(client) {
  const paths={catalog:`/catalogs/productassignments?catalogID=${SETTINGS.catalog}`,category:`/catalogs/${SETTINGS.catalog}/categories/productassignments`,price:`/products/assignments?buyerID=${SETTINGS.buyer}`};
  const maps={};
  for (const [kind,path] of Object.entries(paths)) {
    maps[kind]=new Map((await client.list(path)).map(x=>[assignmentKey(kind,x),x]));
  }
  return maps;
}
export async function preflight(client,plan,log=console.log) {
  const create=[],assign=[]; let kept=0;
  for (const [i,r] of plan.resources.entries()) {
    const current=await client.request('GET',r.path,undefined,true);
    if (current) {
      requireCondition(matches(current,r.body),`Conflict at ${r.path}. Existing record differs; it will NOT be overwritten.`);
      kept++;
    } else create.push(r);
    if((i+1)%40===0) log(`[PREFLIGHT] ${i+1}/${plan.resources.length} resource checks`);
  }
  const maps=await readAssignmentMaps(client);
  for (const a of plan.assignments) {
    const current=maps[a.kind].get(assignmentKey(a.kind,a.body));
    if (current) {requireCondition(matches(current,a.body),`Conflicting ${a.kind} assignment for ${a.body.ProductID}.`); kept++;}
    else assign.push(a);
  }
  return {create,assign,kept};
}
export async function execute(client,manifest,mode='preview',log=console.log) {
  const plan=buildPlan(manifest);
  await verifyFoundation(client);
  log('[READY] Correct marketplace, Saudi Buyer/catalog, and group-specific SAR locales verified.');
  const work=await preflight(client,plan,log);
  log(`[PLAN] ${work.create.length} resources to create; ${work.assign.length} assignments to add; ${work.kept} existing matches. No conflicts.`);
  if(mode==='preview') return {status:'preview',created:[],assigned:[],planned:{resources:work.create.length,assignments:work.assign.length}};
  requireCondition(mode==='import','Invalid mode.');
  const report={status:'in-progress',marketplace:SETTINGS.marketplace,startedAt:new Date().toISOString(),created:[],assigned:[]};
  try {
    for (const r of work.create) {
      // POST with fixed ID fails rather than overwriting a record created since preflight.
      const result=await client.request('POST',r.root,r.body);
      requireCondition(result?.ID===r.body.ID,`Create response ID mismatch at ${r.path}.`);
      report.created.push(r.path);log(`[CREATED] ${r.path}`);
    }
    // Plan order guarantees catalog membership precedes category and group pricing.
    for (const a of work.assign) {
      await client.request('POST',a.path,a.body);
      report.assigned.push({path:a.path,...a.body});
      log(`[ASSIGNED] ${a.kind}: ${a.body.ProductID}${a.body.UserGroupID?' / '+a.body.UserGroupID:''}`);
    }
    for (const [i,r] of plan.resources.entries()) {
      requireCondition(matches(await client.request('GET',r.path),r.body),`Readback mismatch: ${r.path}`);
      if((i+1)%40===0) log(`[READBACK] ${i+1}/${plan.resources.length} resources`);
    }
    const maps=await readAssignmentMaps(client);
    for (const a of plan.assignments) requireCondition(matches(maps[a.kind].get(assignmentKey(a.kind,a.body)),a.body),`Assignment readback mismatch: ${a.kind}/${a.body.ProductID}`);
    report.status='complete'; report.finishedAt=new Date().toISOString(); report.productCount=manifest.products.length;
    return report;
  } catch(error) {report.status='stopped'; report.error=error.message; error.publicReport=report; throw error;}
}
async function main() {
  const mode=process.argv.includes('--import')?'import':'preview';
  const manifest=await readManifest(); buildPlan(manifest);
  console.log(`KFMB Saudi catalog | ${manifest.products.length} products | ${manifest.categories.length} categories | mode=${mode}`);
  console.log('Real source product data; DEMO prices and min/max rules. Saudi only. No orders, users, clients, Azure settings or application files changed.');
  const client=new OCClient(process.env.KFMB_CATALOG_CLIENT_SECRET);
  let report;
  try {report=await execute(client,manifest,mode);}
  catch(error) {
    report=error.publicReport||{status:'stopped-before-import',error:error.message,created:[],assigned:[]};
    console.error('STOPPED:',error.message); process.exitCode=1;
  }
  const reportPath=new URL('sa-catalog-import-results.local.json',dir);
  await writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
  console.log('Public report:',fileURLToPath(reportPath));
  if(report.status==='complete') console.log('SAUDI CATALOG IMPORT COMPLETE - 52 products, 104 price schedules, 5 categories; seller-side readback passed. Checkout enforcement and buyer UI are not tested by this import.');
  else if(report.status==='preview') console.log('PREVIEW COMPLETE - no OrderCloud data changed.');
}
if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) main().catch(error=>{console.error('ERROR:',error.message);process.exitCode=1;});
