/** Live LLM verification of exact marketplace prompts, restricted to an isolated Mock bundle. */
require('./register-runtime.cjs');
require('@next/env').loadEnvConfig(process.cwd());
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const bundle=path.resolve(process.argv[2]??'.mock-data/skills-marketplace-20261015');
Object.assign(process.env,{DEPLOYMENT_TIER:'demo',DATASET_REGION_BINDINGS_PATH:path.join(bundle,'region-bindings.json'),DATASET_MANIFEST_PATH:path.join(bundle,'manifest.json'),APP_BUSINESS_DB_PATH:path.join(bundle,'simulation-business.db'),CDC_SIMULATION_CONFIG:path.join(bundle,'simulation.json')});
for(const d of ['VECTOR','FOODBORNE','ENV','CHRONIC'])delete process.env['DATASET_'+d+'_PATH'];
const {isolatedSimulationSources}=require('../src/infrastructure/db/simulation-policy.ts');
const {loadDatasetManifest}=require('../src/infrastructure/db/dataset-manifest.ts');
const {publicSkillMetadata}=require('../src/application/skills/capability-metadata.ts');
const {listSkillDefinitions,executeSkill}=require('../src/application/skills/skill-service.ts');
const {createDevelopmentContext}=require('../src/lib/skills/server-executor.ts');
const {createMainAgent}=require('../src/application/agent/main-agent.ts');
const {createLLMClient}=require('../src/infrastructure/llm/client.ts');
const {collectDispatch}=require('../src/application/dispatch/dispatch-service.ts');
const {projectAguiView}=require('../src/contracts/agui-view.ts');
const output=path.resolve('docs/reviews/2026-10-15/skills-marketplace');
fs.mkdirSync(output,{recursive:true});
const audit=['vector','foodborne','env','chronic'].map(domain=>{
 const skills=listSkillDefinitions(domain,{includeInternal:true}).map(publicSkillMetadata);
 const listed=skills.filter(s=>s.marketplace.listed);
 return {domain,total:listed.length,business:listed.filter(s=>s.marketplace.kind==='business').length,general:listed.filter(s=>s.marketplace.kind==='general').length,skills:skills.map(({id,name,method,availability,implementationStatus,validationStatus,marketplace,recommendedPrompts})=>({id,name,method,availability,implementationStatus,validationStatus,...marketplace,scenarioIds:recommendedPrompts.map(s=>s.scenarioId??s.requirementId)}))};
});
fs.writeFileSync(path.join(output,'catalog-audit.json'),JSON.stringify({customPolicy:'用户自定义技能按所属领域归入业务技能；按服务端当前身份过滤，保留数据，不删除用户成果。',domains:audit},null,2)+'\n');
(async()=>{
 if(!isolatedSimulationSources(loadDatasetManifest()))throw Error('Explicit isolated Mock configuration required');
 const selected=process.env.MARKETPLACE_SCENES?.split(',');
 const scenes=require('../config/supplemental-scenarios.json').filter(s=>!selected||selected.includes(s.scenarioId));
 const resultName=process.env.MARKETPLACE_RESULT_FILE??'live-scenarios.json';
 const file=path.join(bundle,'raw-'+resultName);
 const summaryFile=path.join(output,resultName);
 const results=process.env.MARKETPLACE_RESUME==='1'&&fs.existsSync(file)?JSON.parse(fs.readFileSync(file)).results:[];
 const agent=createMainAgent({enableRegionIntent:true,listSkills:listSkillDefinitions,executeSkill,llm:createLLMClient()});
 for(const scene of scenes){
  if(results.some(r=>r.scenarioId===scene.scenarioId&&r.prompt===scene.prompt&&r.passed))continue;
  const started=Date.now();console.log('START',scene.scenarioId);
  const turn=await collectDispatch(agent({interactionId:crypto.randomUUID(),kind:'conversation',userInput:scene.prompt},createDevelopmentContext(scene.domain)));
  const expected=scene.skillIds.map(id=>turn.skillRuns.find(r=>r.skillId===id&&r.result.status==='SUCCESS'&&r.result.payload));
  const checks={requestedSkills:expected.every(Boolean),view:!!projectAguiView(turn),session:!!turn.session?.id};
  if(scene.scenarioId.endsWith('-arima'))checks.forecast=expected.some(r=>r?.result.payload?.data?.models?.some(m=>m.history.length>=18&&m.forecasts.length===3&&Number.isFinite(m.validation.rmse)));
  if(scene.scenarioId.endsWith('-query-chart'))checks.chart=expected.some(r=>r?.result.payload?.data?.length&&r?.result.payload?.visualization?.kind==='line');
  if(scene.scenarioId.endsWith('-backtest'))checks.backtest=expected.some(r=>r?.result.payload?.data?.evaluatedPairs>0&&Object.keys(r?.result.payload?.data?.baseline??{}).length>0);
  if(scene.scenarioId.endsWith('-workflow'))checks.submission=turn.skillRuns.some(r=>r.skillId==='skill_composable_workflow'&&r.args?.action==='submit'&&r.result.status==='SUCCESS'&&typeof r.result.payload?.data?.runId==='string');
  const row={scenarioId:scene.scenarioId,prompt:scene.prompt,passed:turn.status==='SUCCESS'&&Object.values(checks).every(Boolean),status:turn.status,checks,elapsedMs:Date.now()-started,runId:turn.runId,replyText:turn.replyText,error:turn.error,intentDiagnostics:turn.intentDiagnostics,skillRuns:turn.skillRuns,view:projectAguiView(turn)};
  const prior=results.findIndex(r=>r.scenarioId===scene.scenarioId);if(prior<0)results.push(row);else results[prior]=row;
  fs.writeFileSync(file,JSON.stringify({purpose:'live-LLM-with-isolated-Mock-data-not-professional-validation',results},null,2)+'\n');
  fs.writeFileSync(summaryFile,JSON.stringify({purpose:'live-LLM-with-isolated-Mock-data-not-professional-validation',results:results.map(({view,skillRuns,...r})=>({...r,viewType:view?.type,skillRuns:skillRuns.map(s=>({skillId:s.skillId,status:s.result.status,error:s.result.error,payloadType:s.result.payload?.type,method:s.result.method,datasets:s.result.datasets,models:s.result.payload?.data?.models,visualization:s.result.payload?.visualization,rowCount:Array.isArray(s.result.payload?.data)?s.result.payload.data.length:undefined}))}))},null,2)+'\n');
  console.log('DONE',scene.scenarioId,row.passed,row.status,JSON.stringify(checks));
 }
 if(results.some(r=>!r.passed))process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1;});
