import fs from 'node:fs';import path from 'node:path';
import {createLLMClient} from '@/infrastructure/llm/client';import {resolveInteractionIntent} from '@/application/agent/intent-resolver';
import {scoreIntentResolution,validateEvaluationCases,evaluationScene} from '@/application/agent/intent-evaluation';import {listSkillDefinitions} from '@/application/skills/skill-service';import {spatialCapabilityFor} from '@/application/geo/spatial-capabilities';import {loadRegionCatalog} from '@/infrastructure/geo/region-catalog';
const args=process.argv.slice(2),arg=(name:string,fallback:string)=>args.includes(name)?args[args.indexOf(name)+1]:fallback;
if(fs.existsSync('.env.local'))for(const line of fs.readFileSync('.env.local','utf8').split('\n')){const m=/^([A-Z0-9_]+)=(.*)$/.exec(line.trim());if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^['"]|['"]$/g,'');}
const suite=arg('--suite','development');if(!['development','holdout'].includes(suite))throw Error('Unknown suite');
const selectedIds=arg('--ids','').split(',').filter(Boolean);
const repeats=Number(arg('--repeats','3')),limit=Number(arg('--limit','10000')),concurrency=Number(arg('--concurrency','4'));if(![repeats,limit,concurrency].every(n=>Number.isSafeInteger(n)&&n>0)||repeats>10||concurrency>8)throw Error('Invalid evaluation budgets');
const supplemental=JSON.parse(fs.readFileSync('tests/evaluation/region-intent-expectations.json','utf8'));
const cases=validateEvaluationCases(fs.readFileSync(`tests/evaluation/region-intent-${suite}.jsonl`,'utf8').trim().split('\n').map(line=>{const row=JSON.parse(line);return {...row,...supplemental[row.id]};})).filter(row=>!selectedIds.length||selectedIds.includes(row.id)).slice(0,limit);
const queue=cases.flatMap(row=>Array.from({length:repeats},(_,repeat)=>({row,repeat})));const results:Record<string,any>[]=[];const llm=createLLMClient();let cursor=0;
const output=path.resolve(arg('--output',`.superpowers/sdd/2026-10-13-llm-region-map-improvement-plan/${suite}-evaluation.jsonl`));fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,'');
await Promise.all(Array.from({length:concurrency},async()=>{while(cursor<queue.length){const {row,repeat}=queue[cursor++];const started=Date.now();
 const scene=evaluationScene(row);
 const attempts:string[]=[];const result=await resolveInteractionIntent({onAttempt:content=>attempts.push(content),text:row.input,domain:row.domain,now:'2026-10-13',previous:row.serverState,scene,capabilities:listSkillDefinitions(row.domain).map(spatialCapabilityFor),deadlineAt:Date.now()+120000},llm);const score=scoreIntentResolution(row,result);
 const record={id:row.id,repeat,input:row.input,attempts,result,score,elapsedMs:Date.now()-started,model:process.env.SILICONFLOW_MODEL??'Qwen/Qwen3.6-27B',catalogVersion:loadRegionCatalog().version,promptVersion:'region-intent-v4-semantic-review',scoringVersion:'complete-intent-v3'};results.push(record);fs.appendFileSync(output,JSON.stringify(record)+'\n');console.log(`${results.length}/${queue.length} ${row.id} ${score.passed?'PASS':'FAIL'} ${score.reasons.join(',')} ${record.elapsedMs}ms`);
}}));
const timings=results.map(r=>r.elapsedMs).sort((a,b)=>a-b),passed=results.filter(r=>r.score.passed).length;console.log(JSON.stringify({suite,cases:cases.length,repeats,total:results.length,passed,accuracy:passed/results.length,p50Ms:timings[Math.floor(timings.length*.5)],p95Ms:timings[Math.min(timings.length-1,Math.floor(timings.length*.95))],output}));process.exitCode=passed===results.length?0:1;
