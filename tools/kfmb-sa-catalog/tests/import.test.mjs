import test from 'node:test';
import assert from 'node:assert/strict';
import {SETTINGS,readManifest,buildPlan,matches,assignmentKey,execute,OCClient} from '../import-sa-catalog.mjs';
const manifest=await readManifest();
const clone=x=>structuredClone(x);
class MockOC {
  constructor() {
    this.entities=new Map([
      ['/priceschedules/kfmb-demo-flour-sa-standard',{OwnerID:SETTINGS.marketplace,Currency:'SAR'}],
      ['/buyers/sa-buyers',{Active:true,DefaultCatalogID:'sa-catalog'}],
      ['/catalogs/sa-catalog',{Active:true}],
      ['/locales/kfmb-en-SA-SAR',{Currency:'SAR'}],
      ['/buyers/sa-buyers/usergroups/standard',{ID:'standard'}],
      ['/buyers/sa-buyers/usergroups/wholesale',{ID:'wholesale'}]
    ]);
    this.locales=['standard','wholesale'].map(g=>({BuyerID:'sa-buyers',UserGroupID:g,LocaleID:'kfmb-en-SA-SAR'}));
    this.assignments={catalog:new Map(),category:new Map(),price:new Map()};
    this.posts=[];this.failAt=Infinity;
  }
  async request(method,path,body,allow404=false) {
    if(method==='GET') {const r=this.entities.get(path);if(!r&&!allow404) throw new Error('Missing '+path);return r?clone(r):null;}
    assert.equal(method,'POST');
    if(this.posts.length===this.failAt) throw new Error('Simulated interruption');
    this.posts.push({method,path,body:clone(body)});
    const kind=path==='/catalogs/productassignments'?'catalog':path==='/products/assignments'?'price':path.endsWith('/categories/productassignments')?'category':null;
    if(kind) {this.assignments[kind].set(assignmentKey(kind,body),clone(body));return null;}
    assert(body.ID);
    const target=path+'/'+body.ID;
    assert(!this.entities.has(target),'POST must not overwrite');
    // Model real API extra fields (server-only fields and null PriceBreak properties).
    const result=clone(body);result.OwnerID=SETTINGS.marketplace;
    if(result.PriceBreaks) result.PriceBreaks=result.PriceBreaks.map(x=>({...x,SalePrice:null}));
    this.entities.set(target,result);return clone(result);
  }
  async list(path) {
    if(path.startsWith('/locales/assignments')) return clone(this.locales);
    if(path.startsWith('/catalogs/assignments')) return [{CatalogID:'sa-catalog',BuyerID:'sa-buyers',ViewAllCategories:true,ViewAllProducts:true}];
    const kind=path.startsWith('/catalogs/productassignments')?'catalog':path.startsWith('/products/assignments')?'price':path.includes('/categories/productassignments')?'category':null;
    assert(kind,'Unexpected list path: '+path);return clone([...this.assignments[kind].values()]);
  }
}
const silent=()=>{};
test('manifest has 38 source families, 52 pack-sized products and five categories',()=>{
  assert.equal(new Set(manifest.products.map(p=>p.familyId)).size,38);assert.equal(manifest.products.length,52);assert.equal(manifest.categories.length,5);
  assert.equal(new Set(manifest.products.map(p=>p.sourceUrl)).size,38);
});
test('plan has 161 resources and 208 assignments',()=>{const p=buildPlan(manifest);assert.equal(p.resources.length,161);assert.equal(p.assignments.length,208);assert.equal(p.resources.filter(r=>r.root==='/priceschedules').length,104);});
test('plan is Saudi-only and all price schedules use SAR',()=>{for(const r of buildPlan(manifest).resources) {assert(!r.path.includes('kw-'));if(r.root==='/priceschedules')assert.equal(r.body.Currency,'SAR');}});
test('each product has real source URL, image and explicit demo pricing provenance',()=>{for(const r of buildPlan(manifest).resources.filter(r=>r.root==='/products')) {assert.equal(r.body.xp.DemoPricing,true);assert(r.body.xp.Images[0].Url.startsWith('https://www.mjcs.com.sa/'));assert(!r.body.ID.includes('demo-flour'));}});
test('array comparison allows additional server fields but not changed prices',()=>{assert(matches([{Price:10,SalePrice:null}],[{Price:10}]));assert(!matches([{Price:11}],[{Price:10}]));});
test('duplicate manifest IDs rejected before network work',()=>{const m=clone(manifest);m.products.push(m.products[0]);assert.throws(()=>buildPlan(m),/Duplicate/);});
test('preview performs no writes',async()=>{const c=new MockOC();const r=await execute(c,manifest,'preview',silent);assert.equal(r.status,'preview');assert.equal(c.posts.length,0);});
test('wrong marketplace stopped before any write',async()=>{const c=new MockOC();c.entities.get('/priceschedules/kfmb-demo-flour-sa-standard').OwnerID='other';await assert.rejects(()=>execute(c,manifest,'import',silent),/Marketplace guard/);assert.equal(c.posts.length,0);});
test('missing explicit group locale stopped before any write',async()=>{const c=new MockOC();c.locales.pop();await assert.rejects(()=>execute(c,manifest,'import',silent),/explicit SAR locale/);assert.equal(c.posts.length,0);});
test('conflicting existing product is not overwritten',async()=>{const c=new MockOC();const r=buildPlan(manifest).resources.find(r=>r.root==='/products');c.entities.set(r.path,{...r.body,Name:'Edited by user'});await assert.rejects(()=>execute(c,manifest,'import',silent),/Conflict/);assert.equal(c.posts.length,0);});
test('existing product/group price assignment conflict stopped before any write',async()=>{const c=new MockOC();const a=buildPlan(manifest).assignments.find(a=>a.kind==='price');c.assignments.price.set(assignmentKey('price',a.body),{...a.body,PriceScheduleID:'different'});await assert.rejects(()=>execute(c,manifest,'import',silent),/Conflicting price assignment/);assert.equal(c.posts.length,0);});
test('successful mock import reads back every resource and assignment',async()=>{const c=new MockOC();const r=await execute(c,manifest,'import',silent);assert.equal(r.status,'complete');assert.equal(r.created.length,161);assert.equal(r.assigned.length,208);assert.equal(c.posts.length,369);});
test('second import does not write or overwrite existing matching state',async()=>{const c=new MockOC();await execute(c,manifest,'import',silent);const before=c.posts.length;const r=await execute(c,manifest,'import',silent);assert.equal(c.posts.length,before);assert.equal(r.created.length,0);assert.equal(r.assigned.length,0);});
test('partial run can resume without overwriting its previously created records',async()=>{const c=new MockOC();c.failAt=40;await assert.rejects(()=>execute(c,manifest,'import',silent),/Simulated interruption/);assert.equal(c.posts.length,40);c.failAt=Infinity;const r=await execute(c,manifest,'import',silent);assert.equal(r.status,'complete');assert.equal(c.posts.length,369);assert.equal(r.created.length,121);});
test('catalog membership is assigned before group pricing for each product',()=>{const a=buildPlan(manifest).assignments;for(const p of manifest.products) {const x=a.filter(a=>a.body.ProductID===p.id);assert.deepEqual(x.map(a=>a.kind),['catalog','category','price','price']);}});
test('API client refuses destructive methods',async()=>{const c=new OCClient('never-sent',async()=>{throw new Error('No network expected');});await assert.rejects(()=>c.request('DELETE','/products/example'),/only GET and POST/);await assert.rejects(()=>c.request('PUT','/products/example',{}),/only GET and POST/);});
test('API client paginates read collections',async()=>{const c=new OCClient('unused');const seen=[];c.request=async(method,path)=>{seen.push(path);const p=new URL('https://example.com'+path).searchParams.get('page');return {Items:[{ID:p}],Meta:{TotalPages:2}};};assert.equal((await c.list('/products')).length,2);assert.equal(seen.length,2);});
