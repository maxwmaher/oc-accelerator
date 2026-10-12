import test from 'node:test';
import assert from 'node:assert/strict';
import {SETTINGS,readInputs,guard,prepare,buildPlan,fils,matchProducts,sameSellingItem,verifyConfig} from '../catalog.mjs';
import {OCClient,assignmentKey,execute,parseArgs} from '../import-kw-catalog.mjs';
const inputs=await readInputs(),clone=structuredClone,silent=()=>{};
function small(){const x=clone(inputs);x.snapshot.products=x.snapshot.products.slice(0,2);return x;}
function shared(){
 // Synthetic unit-test review, not a real shared-product claim in the deliverable.
 const x=small(),p=x.snapshot.products[0],sa=x.sa.products[0];
 Object.assign(p,{brand:sa.brand,identity:sa.sourceProductName,packValue:sa.packValue,packUnit:sa.packUnit,packSize:sa.packSize,sellingUnit:'bag',unitsPerMultipack:1});
 Object.assign(p.publishedPrice,{packValue:p.packValue,packUnit:p.packUnit,sellingUnit:p.sellingUnit,unitsPerMultipack:1});
 p.reuseEvidence={saProductId:sa.id,kwSourceUrl:p.sourceUrl,saSourceUrl:sa.sourceUrl,note:'Synthetic test review of identical identity, brand, size and one-pack selling unit.'};return x;
}
class MockOC{
 constructor(){
  this.entities=new Map([
   ['/priceschedules/kfmb-demo-flour-kw-standard',{ID:'kfmb-demo-flour-kw-standard',OwnerID:SETTINGS.marketplace,Currency:'KWD'}],
   ['/buyers/kw-buyers',{ID:'kw-buyers',Active:true,DefaultCatalogID:'kw-catalog'}],
   ['/catalogs/kw-catalog',{ID:'kw-catalog',Active:true}],['/locales/kfmb-en-KW-KWD',{ID:SETTINGS.locale,Currency:'KWD'}],
   ...['standard','wholesale'].map(g=>[`/buyers/kw-buyers/usergroups/${g}`,{ID:g}])]);
  this.locales=['standard','wholesale'].map(UserGroupID=>({BuyerID:SETTINGS.buyer,UserGroupID,LocaleID:SETTINGS.locale}));
  this.visibility=[{CatalogID:SETTINGS.catalog,BuyerID:SETTINGS.buyer,ViewAllCategories:true,ViewAllProducts:true}];
  this.assignments={catalog:new Map(),category:new Map(),price:new Map()};this.posts=[];this.failAt=Infinity;this.uncertain=false;
 }
 async request(method,path,body,allow404=false){
  if(method==='GET'){const r=this.entities.get(path);if(!r&&!allow404)throw Error('Missing '+path);return r?clone(r):null;}
  assert.equal(method,'POST');if(this.posts.length===this.failAt&&!this.uncertain)throw Error('Interruption');
  const shouldFail=this.posts.length===this.failAt;this.posts.push({path,body:clone(body)});
  const kind=path==='/catalogs/productassignments'?'catalog':path==='/products/assignments'?'price':path.endsWith('/categories/productassignments')?'category':null;
  let result=null;
  if(kind)this.assignments[kind].set(assignmentKey(kind,body),clone(body));
  else{assert(!this.entities.has(path+'/'+body.ID),'No overwrite');result={...clone(body),OwnerID:SETTINGS.marketplace};if(result.PriceBreaks)result.PriceBreaks[0].SalePrice=null;this.entities.set(path+'/'+body.ID,result);}
  if(shouldFail)throw Error('Uncertain write response');return result;
 }
 async list(path){if(path.startsWith('/locales/assignments'))return clone(this.locales);if(path.startsWith('/catalogs/assignments'))return clone(this.visibility);
  const kind=path.startsWith('/catalogs/productassignments')?'catalog':path.startsWith('/products/assignments')?'price':path.includes('/categories/productassignments')?'category':null;assert(kind,path);return clone([...this.assignments[kind].values()]);}
}
function installShared(c,x){for(const r of buildPlan(x.snapshot,x.sa,x.config).reused)c.entities.set(r.path,{...clone(r.body),OwnerID:SETTINGS.marketplace,xp:{...r.body.xp,ExtraSaudiMetadata:'preserve me'}});}
test('actual coverage is 53 items, two importable categories; no unsupported shared claims',()=>{const p=buildPlan(inputs.snapshot,inputs.sa,inputs.config);assert.deepEqual(p.report.counts,{reused:0,new:53,ambiguous:0});assert.equal(p.resources.length,161);assert.equal(p.assignments.length,212);assert.equal(p.reused.length,0);assert.equal(inputs.snapshot.coverage.complete,false);});
test('actual source prices identify exact pack and multipack selling unit',()=>{for(const p of inputs.snapshot.products){assert(sameSellingItem(p,p.publishedPrice));assert.equal(p.publishedPrice.currency,'KWD');assert(p.evidence.priceText);assert.equal(p.sourceProductId,null);}assert.equal(inputs.snapshot.products.filter(p=>p.categoryId==='kw-mills').length,25);});
test('KWD preserves 2.275 and 1.790, rejects four decimals and exponent notation',()=>{assert.equal(fils('2.275'),2275);assert.equal(fils(1.79),1790);for(const v of ['1.2345','1e-3',0,-1,NaN,Infinity])assert.throws(()=>fils(v));});
test('demo pricing discounts the entire selling unit and rounds to nearest fils',()=>{const {manifest}=prepare(inputs.snapshot,inputs.sa,inputs.config);const p=manifest.products.find(p=>p.publishedPrice.amount==='2.275');assert.equal(p.demoPricing.standardKWD,'2.275');assert.equal(p.demoPricing.wholesaleKWD,'2.048');});
test('published selling-unit mismatch and single pack with count >1 rejected',()=>{const x=small();x.snapshot.products[0].publishedPrice.unitsPerMultipack=1;assert.throws(()=>buildPlan(x.snapshot,x.sa,x.config),/selling unit/);const y=small();y.snapshot.products[0].sellingUnit='pack';assert.throws(()=>buildPlan(y.snapshot,y.sa,y.config),/single pack/);});
test('duplicate source items and unknown categories rejected before network',()=>{const x=small();x.snapshot.products.push(clone(x.snapshot.products[0]));assert.throws(()=>buildPlan(x.snapshot,x.sa,x.config),/Duplicate source/);x.snapshot.products.pop();x.snapshot.products[0].categoryId='other';assert.throws(()=>buildPlan(x.snapshot,x.sa,x.config),/Unknown category/);});
test('source URLs and capture provenance validated',()=>{const x=small();x.snapshot.products[0].sourceUrl='https://untrusted.example/';assert.throws(()=>buildPlan(x.snapshot,x.sa,x.config),/KFMB HTTPS/);const y=small();y.snapshot.products[0].capturedOn='2020-01-01';assert.throws(()=>buildPlan(y.snapshot,y.sa,y.config),/capture date/);});
test('verified reuse requires identity, brand, size, selling unit and evidence',()=>{const x=shared();assert.equal(matchProducts(x.snapshot,x.sa)[0].status,'reused');const p=buildPlan(x.snapshot,x.sa,x.config);assert.equal(p.reused[0].body.ID,x.sa.products[0].id);assert(!p.resources.some(r=>r.path===p.reused[0].path));});
test('compatible same item without reviewed evidence remains ambiguous',()=>{const x=shared();delete x.snapshot.products[0].reuseEvidence;assert.equal(prepare(x.snapshot,x.sa,x.config).report.counts.ambiguous,1);assert.throws(()=>buildPlan(x.snapshot,x.sa,x.config),/Unresolved/);});
test('20-pack carton cannot reuse one 400 g Saudi pack',()=>{const x=shared(),p=x.snapshot.products[0];Object.assign(p,{packValue:400,packUnit:'g',sellingUnit:'carton',unitsPerMultipack:20});Object.assign(p.publishedPrice,{packValue:400,packUnit:'g',sellingUnit:'carton',unitsPerMultipack:20});assert.throws(()=>matchProducts(x.snapshot,x.sa),/Unsupported reuse/);});
test('size normalization allows 1000 g and 1 kg but rejects different brands',()=>{const x=shared(),p=x.snapshot.products[0];p.packValue=1000;p.packUnit='g';Object.assign(p.publishedPrice,{packValue:1000,packUnit:'g'});assert.equal(matchProducts(x.snapshot,x.sa)[0].status,'reused');p.brand='Different Brand';assert.throws(()=>matchProducts(x.snapshot,x.sa),/Unsupported reuse/);});
test('unknown identity stays unresolved; offline reporting succeeds',()=>{const x=small();x.snapshot.products[0].identity=null;assert.equal(prepare(x.snapshot,x.sa,x.config).report.counts.ambiguous,1);assert.throws(()=>buildPlan(x.snapshot,x.sa,x.config),/Unresolved/);});
test('stable IDs survive reorder; supplier identifiers are not invented',()=>{const x=small();const a=prepare(x.snapshot,x.sa,x.config).manifest.products;x.snapshot.products.reverse();const b=prepare(x.snapshot,x.sa,x.config).manifest.products;assert.equal(a[0].id,b[1].id);assert.equal(a[0].sourceProductId,null);});
test('configuration cannot redirect importer to Saudi, other marketplace or production',()=>{for(const edit of [c=>c.marketplaceID='other',c=>c.apiBaseURL='https://api.ordercloud.io',c=>c.storefronts.kw.buyerID='sa-buyers',c=>c.storefronts.kw.currency='SAR']){const c=clone(inputs.config);edit(c);assert.throws(()=>verifyConfig(c),/target guard/);}});
test('all plan writes are Kuwait-owned resources/assignments with pickup settings',()=>{const p=buildPlan(inputs.snapshot,inputs.sa,inputs.config);for(const r of p.resources){assert.equal(r.body.xp.ImportOwner,SETTINGS.owner);if(r.root==='/priceschedules'){assert.equal(r.body.Currency,'KWD');assert.equal(r.body.ApplyTax,false);assert.equal(r.body.ApplyShipping,false);assert.equal(r.body.RestrictedQuantity,false);}}for(const a of p.assignments)assert(a.body.BuyerID==='kw-buyers'||a.body.CatalogID==='kw-catalog'||a.path.includes('/kw-catalog/'));});
test('read-only preflight makes no data writes',async()=>{const c=new MockOC();assert.equal((await execute(c,small(),'preflight',silent)).status,'preflight');assert.equal(c.posts.length,0);});
test('invalid mode rejected before any API call',async()=>{await assert.rejects(()=>execute({request:()=>{throw Error('network');}},small(),'import',silent),/Invalid execution mode/);});
test('wrong marketplace or resource ownership blocks all writes',async()=>{for(const path of ['/priceschedules/kfmb-demo-flour-kw-standard','/buyers/kw-buyers','/catalogs/kw-catalog']){const c=new MockOC();c.entities.get(path).OwnerID='other';await assert.rejects(()=>execute(c,small(),'apply',silent),/Ownership guard/);assert.equal(c.posts.length,0);}});
test('buyer, catalog, groups, visibility and currency target guards stop writes',async()=>{for(const mutate of [c=>c.entities.get('/buyers/kw-buyers').DefaultCatalogID='sa-catalog',c=>c.entities.get('/catalogs/kw-catalog').Active=false,c=>c.entities.get('/locales/'+SETTINGS.locale).Currency='SAR',c=>c.entities.get('/buyers/kw-buyers/usergroups/standard').ID='other',c=>c.visibility=[]]){const c=new MockOC();mutate(c);await assert.rejects(()=>execute(c,small(),'apply',silent),/guard/);assert.equal(c.posts.length,0);}});
test('missing or conflicting group locale stops writes',async()=>{for(const mutate of [c=>c.locales.pop(),c=>c.locales[0].LocaleID='sa-locale',c=>c.locales.push({...c.locales[0],LocaleID:'other'})]){const c=new MockOC();mutate(c);await assert.rejects(()=>execute(c,small(),'apply',silent),/locale assignment/);assert.equal(c.posts.length,0);}});
test('existing product, category and price schedule conflicts never overwrite',async()=>{for(const root of ['/products','/priceschedules','/catalogs/kw-catalog/categories']){const c=new MockOC(),r=buildPlan(...[small().snapshot,inputs.sa,inputs.config]).resources.find(r=>r.root===root);c.entities.set(r.path,{...clone(r.body),OwnerID:SETTINGS.marketplace,Name:'Edited'});await assert.rejects(()=>execute(c,small(),'apply',silent),/Conflict/);assert.equal(c.posts.length,0);}});
test('matching shape with foreign OwnerID is not accepted',async()=>{const x=small(),c=new MockOC(),r=buildPlan(x.snapshot,x.sa,x.config).resources.find(r=>r.root==='/products');c.entities.set(r.path,{...r.body,OwnerID:'foreign'});await assert.rejects(()=>execute(c,x,'apply',silent),/Ownership/);assert.equal(c.posts.length,0);});
test('conflicting group price assignment stops entire plan before writes',async()=>{const x=small(),c=new MockOC(),a=buildPlan(x.snapshot,x.sa,x.config).assignments.find(a=>a.kind==='price');c.assignments.price.set(assignmentKey('price',a.body),{...a.body,PriceScheduleID:'existing-sa-price'});await assert.rejects(()=>execute(c,x,'apply',silent),/Conflicting price/);assert.equal(c.posts.length,0);});
test('repeat apply keeps matches; catalog membership precedes category/group pricing',async()=>{const c=new MockOC(),x=small();await execute(c,x,'apply',silent);const before=clone(c.posts);const r=await execute(c,x,'apply',silent);assert.deepEqual(c.posts,before);assert.equal(r.created.length,0);for(const p of buildPlan(x.snapshot,x.sa,x.config).manifest.products){const paths=c.posts.filter(a=>a.body.ProductID===p.id).map(a=>a.path);assert.deepEqual(paths,['/catalogs/productassignments','/catalogs/kw-catalog/categories/productassignments','/products/assignments','/products/assignments']);}});
test('partial and uncertain resource writes recover by reading existing state',async()=>{for(const uncertain of [false,true]){const c=new MockOC(),x=small();c.failAt=3;c.uncertain=uncertain;let stopped;await assert.rejects(()=>execute(c,x,'apply',silent,async r=>{stopped=clone(r);}),/Interruption|Uncertain/);assert.equal(stopped.status,'stopped');assert(stopped.pending);c.failAt=Infinity;const r=await execute(c,x,'apply',silent);assert.equal(r.status,'complete');assert.equal(c.posts.length,15);}});
test('uncertain assignment POST is not retried and can be recovered',async()=>{const c=new MockOC(),x=small();c.failAt=9;c.uncertain=true;await assert.rejects(()=>execute(c,x,'apply',silent),/Uncertain/);assert.equal(c.posts.length,10);c.failAt=Infinity;assert.equal((await execute(c,x,'apply',silent)).status,'complete');assert.equal(c.posts.length,15);});
test('journal persistence failure prevents the next write',async()=>{const c=new MockOC();await assert.rejects(()=>execute(c,small(),'apply',silent,async()=>{throw Error('disk full');}),/disk full/);assert.equal(c.posts.length,0);});
test('reused master is required, verified, and left byte-for-byte unchanged',async()=>{const x=shared(),c=new MockOC();installShared(c,x);const path=buildPlan(x.snapshot,x.sa,x.config).reused[0].path;const before=clone(c.entities.get(path));await execute(c,x,'apply',silent);assert.deepEqual(c.entities.get(path),before);assert(!c.posts.some(p=>p.path==='/products'&&p.body.ID===before.ID));});
test('missing or modified shared master blocks writes',async()=>{for(const mutate of [c=>{},c=>{installShared(c,shared());c.entities.get('/products/'+inputs.sa.products[0].id).Description='changed';}]){const c=new MockOC();mutate(c);await assert.rejects(()=>execute(c,shared(),'apply',silent),/missing|Conflict/);assert.equal(c.posts.length,0);}});
test('API client disallows destructive methods, external/path traversal URLs',async()=>{const c=new OCClient('unused',async()=>{throw Error('No network');});for(const method of ['PUT','PATCH','DELETE'])await assert.rejects(()=>c.request(method,'/products/x'),/only GET and POST/);for(const path of ['//evil','/../users','https://evil'])await assert.rejects(()=>c.request('GET',path),/Unsafe API path/);});
test('API client handles pagination and never retries an uncertain POST',async()=>{const c=new OCClient('unused');let n=0;c.request=async()=>({Items:[{ID:++n}],Meta:{TotalPages:2}});assert.equal((await c.list('/products')).length,2);let calls=0;const write=new OCClient('secret',async()=>{calls++;throw Error('timeout');});write.token='test';write.expires=Date.now()+10000;await assert.rejects(()=>write.request('POST','/products',{ID:'x'}),/No automatic write retry/);assert.equal(calls,1);});
test('CLI defaults to offline plan and requires explicit apply target confirmation',()=>{
 assert.equal(parseArgs([]).mode,'plan');assert.equal(parseArgs(['--plan']).mode,'plan');
 assert.throws(()=>parseArgs(['--apply']),/explicit --confirm-marketplace/);
 assert.throws(()=>parseArgs(['--apply','--confirm-marketplace','other']),/explicit/);
 assert.equal(parseArgs(['--apply','--confirm-marketplace',SETTINGS.marketplace]).mode,'apply');
 for(const args of [['--plan','--apply'],['--snapshot'],['--unknown'],['--plan','--plan']])assert.throws(()=>parseArgs(args));
});
test('all 53 items apply and read back in the offline simulator',async()=>{
 const c=new MockOC();const result=await execute(c,inputs,'apply',silent);assert.equal(result.status,'complete');assert.equal(result.created.length,161);assert.equal(result.assigned.length,212);assert.equal(c.posts.length,373);
});
test('assignment conflict appearing after preflight is preserved',async()=>{
 const c=new MockOC(),x=small(),a=buildPlan(x.snapshot,x.sa,x.config).assignments.find(a=>a.kind==='price');
 const original=c.request.bind(c);c.request=async(method,path,body,...rest)=>{
  const result=await original(method,path,body,...rest);if(method==='POST'&&path.endsWith('/categories/productassignments'))c.assignments.price.set(assignmentKey('price',a.body),{...a.body,PriceScheduleID:'concurrent-edit'});return result;
 };
 await assert.rejects(()=>execute(c,x,'apply',silent),/appeared since preflight/);
 assert.equal(c.assignments.price.get(assignmentKey('price',a.body)).PriceScheduleID,'concurrent-edit');
 assert(!c.posts.some(p=>p.path==='/products/assignments'));
});
test('unpublished price requires explicit demo assumptions and provenance',()=>{
 const x=small(),p=x.snapshot.products[0];p.publishedPrice=null;assert.throws(()=>buildPlan(x.snapshot,x.sa,x.config),/Missing demo pricing/);
 p.demoPricing={standardKWD:'1.235',wholesaleKWD:'1.111'};assert.throws(()=>buildPlan(x.snapshot,x.sa,x.config),/Missing demo pricing policy/);
 p.demoPricing.policy='Synthetic test assumptions, not supplier prices.';const plan=buildPlan(x.snapshot,x.sa,x.config);
 const schedules=plan.resources.filter(r=>r.root==='/priceschedules'&&r.body.xp.SourceUrl===p.sourceUrl);assert.equal(schedules[0].body.PriceBreaks[0].Price,1.235);assert.equal(plan.manifest.products[0].publishedPrice,null);
});
