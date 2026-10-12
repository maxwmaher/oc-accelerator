/** Add Kuwait resources/assignments only. Reused Saudi masters are read-only. */
import {writeFile,rename} from 'node:fs/promises';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {SETTINGS,guard,matches,readInputs,buildPlan,prepare} from './catalog.mjs';
import {OCClient} from './oc-client.mjs';
export {OCClient};
export function assignmentKey(kind,b){
 if(kind==='catalog')return `${b.CatalogID}|${b.ProductID}`;
 if(kind==='category')return `${b.CategoryID}|${b.ProductID}`;
 return `${b.ProductID}|${b.BuyerID}|${b.UserGroupID||''}|${b.UserID||''}`;
}
function owner(record,label,required=false){guard((!required&&record?.OwnerID===undefined)||record?.OwnerID===SETTINGS.marketplace,`Ownership guard failed: ${label}.`);}
export async function verifyFoundation(client){
 const anchor=await client.request('GET','/priceschedules/kfmb-demo-flour-kw-standard');owner(anchor,'marketplace anchor',true);guard(anchor.Currency==='KWD','Foundation anchor is not KWD.');
 const buyer=await client.request('GET',`/buyers/${SETTINGS.buyer}`);owner(buyer,'Kuwait buyer');guard(buyer?.ID===SETTINGS.buyer&&buyer.Active===true&&buyer.DefaultCatalogID===SETTINGS.catalog,'Kuwait Buyer/default catalog guard failed.');
 const catalog=await client.request('GET',`/catalogs/${SETTINGS.catalog}`);owner(catalog,'Kuwait catalog');guard(catalog?.ID===SETTINGS.catalog&&catalog.Active===true,'Kuwait catalog guard failed.');
 const locale=await client.request('GET',`/locales/${SETTINGS.locale}`);guard(locale?.ID===SETTINGS.locale&&locale.Currency==='KWD','Kuwait locale guard failed.');
 const rows=await client.list(`/locales/assignments?buyerID=${SETTINGS.buyer}`);
 for(const group of ['standard','wholesale']){
  const g=await client.request('GET',`/buyers/${SETTINGS.buyer}/usergroups/${group}`);guard(g?.ID===group,'Kuwait group guard failed.');
  const assignments=rows.filter(r=>r.BuyerID===SETTINGS.buyer&&r.UserGroupID===group&&!r.UserID);
  guard(assignments.length===1&&assignments[0].LocaleID===SETTINGS.locale,'Missing or conflicting explicit KWD locale assignment: '+group);
 }
 const visibility=await client.list(`/catalogs/assignments?catalogID=${SETTINGS.catalog}&buyerID=${SETTINGS.buyer}`);
 guard(visibility.some(r=>r.CatalogID===SETTINGS.catalog&&r.BuyerID===SETTINGS.buyer&&!r.UserGroupID&&!r.UserID&&r.ViewAllCategories===true&&r.ViewAllProducts===true),'Kuwait catalog visibility guard failed.');
}
export async function readAssignmentMaps(client){
 const paths={catalog:`/catalogs/productassignments?catalogID=${SETTINGS.catalog}`,category:`/catalogs/${SETTINGS.catalog}/categories/productassignments`,price:`/products/assignments?buyerID=${SETTINGS.buyer}`};const maps={};
 for(const [kind,path]of Object.entries(paths)){
  maps[kind]=new Map();for(const row of await client.list(path)){const key=assignmentKey(kind,row);guard(!maps[kind].has(key),'Duplicate assignment returned: '+key);maps[kind].set(key,row);}
 }return maps;
}
function checkResource(current,r){owner(current,r.path,['/products','/priceschedules'].includes(r.root));guard(matches(current,r.body),`Conflict at ${r.path}; existing resource will not be overwritten.`);}
export async function preflight(client,plan){
 const create=[],assign=[];let kept=0;const shared=[];
 for(const r of plan.reused){const current=await client.request('GET',r.path,undefined,true);guard(current,'Reused Saudi ProductID missing: '+r.path);checkResource(current,r);shared.push({path:r.path,body:structuredClone(current)});kept++;}
 for(const r of plan.resources){const current=await client.request('GET',r.path,undefined,true);if(current){checkResource(current,r);kept++;}else create.push(r);}
 const maps=await readAssignmentMaps(client);
 for(const a of plan.assignments){const current=maps[a.kind].get(assignmentKey(a.kind,a.body));if(current){guard(matches(current,a.body),'Conflicting '+a.kind+' assignment for '+a.body.ProductID);kept++;}else assign.push(a);}
 return {create,assign,kept,shared};
}
export async function execute(client,inputs,mode='preflight',log=console.log,save=async()=>{}){
 guard(['preflight','apply'].includes(mode),'Invalid execution mode.');const plan=buildPlan(inputs.snapshot,inputs.sa,inputs.config);
 await verifyFoundation(client);const work=await preflight(client,plan);
 log(`[PLAN] ${work.create.length} resource creates, ${work.assign.length} assignments; ${work.kept} kept. Target and ownership verified.`);
 const report={status:mode==='preflight'?'preflight':'in-progress',marketplace:SETTINGS.marketplace,created:[],assigned:[],pending:null,planned:{resources:work.create.length,assignments:work.assign.length},counts:plan.report.counts};
 if(mode==='preflight')return report;
 try{
  await save(report);
  for(const r of work.create){
   // Fresh reads detect changes since the all-resource preflight. POST cannot replace a fixed-ID resource.
   const current=await client.request('GET',r.path,undefined,true);if(current){checkResource(current,r);continue;}
   report.pending={kind:'resource',path:r.path};await save(report);
   const result=await client.request('POST',r.root,r.body);checkResource(result,r);
   report.created.push(r.path);report.pending=null;await save(report);
  }
  for(const a of work.assign){
   // Assignment POST can upsert: recheck immediately before posting. Never run alongside another writer.
   const maps=await readAssignmentMaps(client);const current=maps[a.kind].get(assignmentKey(a.kind,a.body));
   if(current){guard(matches(current,a.body),'Conflicting assignment appeared since preflight.');continue;}
   report.pending={kind:a.kind,path:a.path,body:a.body};await save(report);
   await client.request('POST',a.path,a.body);report.assigned.push({path:a.path,...a.body});report.pending=null;await save(report);
  }
  for(const r of plan.resources)checkResource(await client.request('GET',r.path),r);
  for(const r of work.shared){const live=await client.request('GET',r.path);guard(matches(live,r.body)&&matches(r.body,live),'Reused Saudi master changed during run: '+r.path);}
  const maps=await readAssignmentMaps(client);for(const a of plan.assignments)guard(matches(maps[a.kind].get(assignmentKey(a.kind,a.body)),a.body),'Assignment readback mismatch.');
  report.status='complete';await save(report);return report;
 }catch(error){report.status='stopped';report.error=error.message;error.publicReport=report;try{await save(report);}catch{log('Report persistence failed; inspect existing state before rerunning.');}throw error;}
}
async function saveReport(path,data){await writeFile(path+'.tmp',JSON.stringify(data,null,2)+'\n',{mode:0o600});await rename(path+'.tmp',path);}
export function parseArgs(args){
 const options={};for(let i=0;i<args.length;i++){
  const a=args[i];guard(['--plan','--preflight','--apply','--snapshot','--report','--confirm-marketplace'].includes(a),'Unknown argument: '+a);
  guard(!(a in options),'Duplicate argument: '+a);options[a]=['--snapshot','--report','--confirm-marketplace'].includes(a)?args[++i]:true;guard(options[a]!==undefined,'Missing value: '+a);
 }
 const modes=['--plan','--preflight','--apply'].filter(a=>options[a]);guard(modes.length<=1,'Choose exactly one mode.');const mode=(modes[0]||'--plan').slice(2);
 if(mode==='apply')guard(options['--confirm-marketplace']===SETTINGS.marketplace,'Apply requires explicit --confirm-marketplace '+SETTINGS.marketplace);
 return {options,mode};
}
async function main(){
 const {options,mode}=parseArgs(process.argv.slice(2));
 const inputs=await readInputs(options['--snapshot']);const prepared=prepare(inputs.snapshot,inputs.sa,inputs.config);
 if(mode==='plan'){
  let plan;try{plan=buildPlan(inputs.snapshot,inputs.sa,inputs.config);}catch(error){prepared.report.blockedReason=error.message;}
  const report={...prepared.report,status:'offline-plan',planned:plan?{resources:plan.resources.length,assignments:plan.assignments.length}:null};
  if(options['--report'])await saveReport(options['--report'],report);console.log(JSON.stringify(report,null,2));return;
 }
 const path=options['--report']||fileURLToPath(new URL('./kw-catalog-results.local.json',import.meta.url));
 let report;try{report=await execute(new OCClient(process.env.KFMB_CATALOG_CLIENT_SECRET),inputs,mode,console.log,r=>saveReport(path,r));}
 catch(error){report=error.publicReport||{status:'stopped-before-writes',error:error.message,created:[],assigned:[]};process.exitCode=1;console.error('STOPPED:',error.message);}
 await saveReport(path,report);console.log(`${report.status.toUpperCase()} | report: ${path}`);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(error=>{console.error('ERROR:',error.message);process.exitCode=1;});
