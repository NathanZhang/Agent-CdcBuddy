// Explicit local/demo control; production work is submitted through authenticated skills.
require('./register-runtime.cjs');
const fs=require('node:fs'),{randomUUID}=require('node:crypto');
const {createDevelopmentContext}=require('../src/lib/skills/server-executor.ts');
const {compileSciencePlan}=require('../src/application/science/dag-compiler.ts');
const {submitSciencePlan,scienceRunStatus,cancelScienceRun,resumeScienceRun,runScienceWorkerTick}=require('../src/application/science/dag-service.ts');
const [action,...args]=process.argv.slice(2);
(async()=>{
 const ctx=createDevelopmentContext('vector');let result;
 if(action==='compile'||action==='submit'){
  if(!args[0]||action==='submit'&&!args[1])throw Error('Usage: scientific-dag.cjs compile PLAN | submit PLAN REQUEST_KEY');
  const plan=JSON.parse(fs.readFileSync(args[0],'utf8'));result=action==='compile'?compileSciencePlan(plan,ctx):submitSciencePlan(plan,args[1],ctx);
 }else if(['status','cancel','resume'].includes(action)){
  if(!args[0])throw Error('Run ID required');result=({status:scienceRunStatus,cancel:cancelScienceRun,resume:resumeScienceRun})[action](args[0],ctx);
 }else if(action==='work')result=await runScienceWorkerTick('cli:'+randomUUID());
 else throw Error('Usage: scientific-dag.cjs compile|submit|status|cancel|resume|work');
 console.log(JSON.stringify(result,null,2));
})().catch(error=>{console.error(error.message);process.exitCode=1;});
