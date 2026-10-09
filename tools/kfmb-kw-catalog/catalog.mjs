/** Pure source-snapshot validation, sellable-item matching, and additive planning. */
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {buildPlan as saPlan} from '../kfmb-sa-catalog/import-sa-catalog.mjs';
export const SETTINGS=Object.freeze({api:'https://westeurope-sandbox.ordercloud.io',marketplace:'_nfhvLBeikC2yF1a6f6v0w',clientId:'0BAD0F65-D294-448E-8819-98F713696BB9',buyer:'kw-buyers',catalog:'kw-catalog',locale:'kfmb-en-KW-KWD',owner:'kfmb-kw-catalog-v1'});
export const readJSON=async path=>JSON.parse(await readFile(path,'utf8'));
export const readInputs=async(snapshot=new URL('./source-snapshot.json',import.meta.url))=>({snapshot:await readJSON(snapshot),sa:await readJSON(new URL('../kfmb-sa-catalog/sa-catalog.json',import.meta.url)),config:await readJSON(new URL('../kfmb-demo-bootstrap/kfmb-public-config.local.json',import.meta.url))});
export function guard(ok,message){if(!ok)throw new Error(message);}
export function matches(actual,expected){
 if(Array.isArray(expected))return Array.isArray(actual)&&actual.length===expected.length&&expected.every((x,i)=>matches(actual[i],x));
 if(expected&&typeof expected==='object')return !!actual&&Object.entries(expected).every(([k,v])=>matches(actual[k],v));
 return actual===expected;
}
export function verifyConfig(config){const kw=config?.storefronts?.kw;guard(config?.marketplaceID===SETTINGS.marketplace&&config.apiBaseURL===SETTINGS.api&&kw?.buyerID===SETTINGS.buyer&&kw.catalogID===SETTINGS.catalog&&kw.localeID===SETTINGS.locale&&kw.currency==='KWD','Public configuration target guard failed.');}
export function fils(value){
 // Decimal strings preserve source precision; numeric local assumptions are also accepted.
 const s=String(value);guard(/^(?:0|[1-9]\d*)(?:\.\d{1,3})?$/.test(s),'KWD requires a positive decimal with at most three fractional digits.');
 const [whole,decimal='']=s.split('.');const result=Number(whole)*1000+Number(decimal.padEnd(3,'0'));
 guard(Number.isSafeInteger(result)&&result>0,'Invalid KWD amount.');return result;
}
const norm=s=>String(s??'').normalize('NFKC').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const url=value=>{let u;try{u=new URL(value);}catch{throw new Error('Invalid source URL.');}guard(u.protocol==='https:'&&['mills.kfmb.com.kw','sales.kfmb.com.kw'].includes(u.hostname)&&!u.username&&!u.password,'Source URL must use a public KFMB HTTPS host.');return u;};
const size=p=>p.packUnit==='kg'?p.packValue*1000:p.packUnit==='L'?p.packValue*1000:p.packValue;
const dimension=p=>['kg','g'].includes(p.packUnit)?'mass':['L','ml'].includes(p.packUnit)?'volume':p.packUnit;
const unitKey=p=>p.unitsPerMultipack===1&&['pack','bag','bottle'].includes(p.sellingUnit)?'single':p.sellingUnit;
export function sameSellingItem(a,b){return size(a)===size(b)&&dimension(a)===dimension(b)&&a.unitsPerMultipack===b.unitsPerMultipack&&unitKey(a)===unitKey(b);}
export function validateSnapshot(s){
 guard(s?.schemaVersion===1&&Array.isArray(s.products)&&Array.isArray(s.categories),'Unsupported source snapshot schema.');
 guard(/^\d{4}-\d{2}-\d{2}$/.test(s.capturedOn)&&!Number.isNaN(Date.parse(s.capturedOn)),'Missing capture date.');
 const cats=new Set();for(const c of s.categories){guard(/^kw-[a-z0-9-]+$/.test(c.id)&&!cats.has(c.id),'Duplicate or invalid category ID.');cats.add(c.id);guard(c.name&&c.sourceName,'Category names required.');url(c.sourceUrl);}
 const keys=new Set();for(const p of s.products){
  guard(cats.has(p.categoryId),'Unknown category.');
  for(const f of ['name','sourceProductName','productType','description','brandEvidence'])guard(typeof p[f]==='string'&&p[f].trim(),`Missing ${f}.`);
  guard(p.capturedOn===s.capturedOn,'Product capture date differs from snapshot.');url(p.sourceUrl);if(p.imageUrl!==null)url(p.imageUrl);
  guard(['g','kg','ml','L'].includes(p.packUnit)&&Number.isFinite(p.packValue)&&p.packValue>0,'Invalid pack size.');
  guard(['pack','bag','bottle','bundle','carton'].includes(p.sellingUnit)&&Number.isInteger(p.unitsPerMultipack)&&p.unitsPerMultipack>0,'Invalid selling unit/count.');
  guard(!['pack','bag','bottle'].includes(p.sellingUnit)||p.unitsPerMultipack===1,'A single pack/bag/bottle cannot represent a multipack.');
  guard(p.evidence?.url===p.sourceUrl&&p.evidence.originalName===p.sourceProductName,'Missing source identity evidence.');
  if(p.publishedPrice!==null){const v=p.publishedPrice;guard(v?.currency==='KWD'&&sameSellingItem(p,v),'Published price selling unit differs from item.');fils(v.amount);guard(p.evidence.priceText,'Published price evidence required.');}
  const key=JSON.stringify([p.sourceUrl,p.sourceProductName]);guard(!keys.has(key),'Duplicate source item.');keys.add(key);
 }
 return s;
}
function saIdentity(p){
 // Remove explicitly labeled brand suffixes when comparing identity; compare the brand separately.
 let name=(' '+norm(p.sourceProductName)+' ').replace(' '+norm(p.brand)+' ',' ').trim();
 if(p.categoryId==='mjcs-pasta')name=name.replace(/ pasta$/, '');
 return name;
}
function saItem(p){return {...p,identity:saIdentity(p),unitsPerMultipack:1,sellingUnit:'pack'};}
export function matchProducts(snapshot,sa){
 validateSnapshot(snapshot);guard(sa?.schemaVersion===1&&Array.isArray(sa.products),'Unsupported Saudi manifest.');
 const saIDs=new Set();for(const p of sa.products){guard(!saIDs.has(p.id),'Duplicate Saudi product ID.');saIDs.add(p.id);}
 return snapshot.products.map(p=>{
  const candidates=sa.products.filter(s=>saIdentity(s)===norm(p.identity));
  const comparisons=candidates.map(s=>({productId:s.id,sourceUrl:s.sourceUrl,brand:s.brand,packSize:s.packSize,sellingUnit:'one labeled pack',unitsPerMultipack:1,
   differences:[...(norm(p.brand)!==norm(s.brand)?['brand']:[]),...(!sameSellingItem(p,saItem(s))?['pack size / selling unit / multipack count']:[])]}));
  const exact=candidates.filter(s=>p.brand&&p.identity&&norm(p.brand)===norm(s.brand)&&sameSellingItem(p,saItem(s)));
  let status='new',reason='No identical Saudi sellable item: '+(comparisons.length?'see candidate differences.':'no same-identity candidate in the 52-record Saudi manifest.'),productId=null;
  if(!p.brand||!p.identity){status='ambiguous';reason='Brand or normalized identity is unknown; review before creating or reusing.';}
  else if(exact.length){
   status='ambiguous';reason='Compatible attributes need explicit evidence review; no automatic reuse.';
   const review=p.reuseEvidence;
   if(review){const selected=exact.find(s=>s.id===review.saProductId);
    guard(selected&&exact.length===1,'Reuse evidence does not select a unique identical selling item.');
    guard(review.kwSourceUrl===p.sourceUrl&&review.saSourceUrl===selected.sourceUrl&&typeof review.note==='string'&&review.note.trim(),'Reuse requires both source URLs and an identity/brand/unit review note.');
    status='reused';reason=review.note;productId=selected.id;
   }
  }else guard(!p.reuseEvidence,'Unsupported reuse evidence: attributes differ.');
  if(status==='new'){
   const slug=norm(p.identity).replaceAll(' ','-').slice(0,32);
   const hash=createHash('sha256').update(JSON.stringify([p.sourceUrl,p.sourceProductName,p.packValue,p.packUnit,p.sellingUnit,p.unitsPerMultipack])).digest('hex').slice(0,12);
   productId=`kfmb-${slug}-${hash}`;
  }
  return {sourceProductName:p.sourceProductName,sourceUrl:p.sourceUrl,brand:p.brand,identity:p.identity,packSize:p.packSize,sellingUnit:p.sellingUnit,unitsPerMultipack:p.unitsPerMultipack,status,productId,reason,candidates:comparisons};
 });
}
export function prepare(snapshot,sa,config){
 verifyConfig(config);const mapping=matchProducts(snapshot,sa);const counts={reused:0,new:0,ambiguous:0};for(const row of mapping)counts[row.status]++;
 const products=snapshot.products.map((p,i)=>({...p,id:mapping[i].productId,matchStatus:mapping[i].status,
  demoPricing:p.publishedPrice?{standardKWD:(fils(p.publishedPrice.amount)/1000).toFixed(3),wholesaleKWD:(Math.floor((fils(p.publishedPrice.amount)*9+5)/10)/1000).toFixed(3),policy:'Standard follows captured whole-selling-unit price; Wholesale is an illustrative 10% discount rounded to nearest fils, not a supplier term.'}:p.demoPricing}));
 const manifest={...snapshot,products,pricingPolicy:{currency:'KWD',standardMin:1,standardMax:10,wholesaleMin:5,wholesaleMax:50,wholesaleDiscountPercent:10,demoOnly:true,applyTax:false,applyShipping:false}};
 const report={capturedOn:snapshot.capturedOn,coverage:snapshot.coverage,counts,mapping,unpriced:products.filter(p=>!p.demoPricing).map(p=>p.sourceProductName)};
 return {manifest,report};
}
export function buildPlan(snapshot,sa,config){
 const {manifest,report}=prepare(snapshot,sa,config);
 guard(report.counts.ambiguous===0,'Unresolved product matches require review. Offline report remains available.');
 guard(manifest.products.length>0,'No importable products.');guard(report.unpriced.length===0,'Missing demo pricing assumptions.');
 const resources=[],assignments=[],reused=[];const croot=`/catalogs/${SETTINGS.catalog}/categories`;
 for(const [i,c] of manifest.categories.entries())if(manifest.products.some(p=>p.categoryId===c.id))resources.push({root:croot,path:`${croot}/${c.id}`,body:{ID:c.id,Name:c.name,Active:true,ListOrder:i+1,xp:{ImportOwner:SETTINGS.owner,SourceUrl:c.sourceUrl}}});
 const masters=new Map(saPlan(sa).resources.filter(r=>r.root==='/products').map(r=>[r.body.ID,r]));const ids=new Set();
 for(const p of manifest.products){
  guard(/^[a-z0-9-]{1,70}$/.test(p.id)&&!ids.has(p.id),'Duplicate or invalid planned ProductID.');ids.add(p.id);
  if(p.matchStatus==='reused')reused.push(masters.get(p.id));
  else resources.push({root:'/products',path:`/products/${p.id}`,body:{ID:p.id,Name:p.name,Description:p.description,Active:true,QuantityMultiplier:1,xp:{ImportOwner:SETTINGS.owner,Brand:p.brand,ProductType:p.productType,PackSize:p.packSize,PackValue:p.packValue,PackUnit:p.packUnit,SellingUnit:p.sellingUnit,UnitsPerMultipack:p.unitsPerMultipack,UnitOfMeasure:`One ${p.sellingUnit}: ${p.unitsPerMultipack} × ${p.packSize}`,SourceUrl:p.sourceUrl,SourceProductID:p.sourceProductId,SourceAssetIdentifier:p.sourceAssetIdentifier,SourceProductName:p.sourceProductName,SourceCapturedOn:p.capturedOn,PublishedPrice:p.publishedPrice,Images:p.imageUrl?[{Url:p.imageUrl}]:[]}}});
  assignments.push({kind:'catalog',path:'/catalogs/productassignments',body:{CatalogID:SETTINGS.catalog,ProductID:p.id}},{kind:'category',path:`${croot}/productassignments`,body:{CategoryID:p.categoryId,ProductID:p.id}});
  for(const group of ['standard','wholesale']){
   guard(typeof p.demoPricing.policy==='string'&&p.demoPricing.policy.trim(),'Missing demo pricing policy.');
   const price=fils(p.demoPricing[group+'KWD'])/1000;const id=`${p.id}-kw-${group}`;guard(id.length<=100,'Price schedule ID too long.');
   resources.push({root:'/priceschedules',path:`/priceschedules/${id}`,body:{ID:id,Name:`DEMO - ${p.name} - ${group}`,Currency:'KWD',ApplyTax:false,ApplyShipping:false,MinQuantity:group==='standard'?1:5,MaxQuantity:group==='standard'?10:50,UseCumulativeQuantity:true,RestrictedQuantity:false,PriceBreaks:[{Quantity:1,Price:price}],xp:{ImportOwner:SETTINGS.owner,DemoOnly:true,Policy:p.demoPricing.policy,SourceUrl:p.sourceUrl}}});
   assignments.push({kind:'price',path:'/products/assignments',body:{ProductID:p.id,BuyerID:SETTINGS.buyer,UserGroupID:group,PriceScheduleID:id}});
  }
 }
 return {resources,assignments,reused,report,manifest};
}
