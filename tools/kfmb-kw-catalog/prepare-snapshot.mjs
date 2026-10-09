/** Materialize reviewable files from a locally captured/normalized source snapshot. No network. */
import {writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {readInputs,prepare,buildPlan} from './catalog.mjs';
const args=process.argv.slice(2);let snapshot,output;
for(let i=0;i<args.length;i++){if(args[i]==='--snapshot')snapshot=args[++i];else if(args[i]==='--output-dir')output=args[++i];else throw new Error('Unknown argument: '+args[i]);}
if(!output)throw new Error('Supply --output-dir; existing source snapshots are never overwritten.');
const inputs=await readInputs(snapshot);const {manifest,report}=prepare(inputs.snapshot,inputs.sa,inputs.config);
try{const plan=buildPlan(inputs.snapshot,inputs.sa,inputs.config);report.planned={resources:plan.resources.length,assignments:plan.assignments.length};}catch(error){report.blockedReason=error.message;}
await mkdir(resolve(output),{recursive:true});for(const [name,value]of [['kw-catalog.json',manifest],['mapping-report.json',report]])await writeFile(join(output,name),JSON.stringify(value,null,2)+'\n');
console.log(JSON.stringify({counts:report.counts,planned:report.planned,blockedReason:report.blockedReason}));
