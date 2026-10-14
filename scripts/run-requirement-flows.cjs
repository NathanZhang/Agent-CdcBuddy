/** Execute the exact displayed prompts through the main agent and real skill runner.
 * Only an explicitly isolated Mock bundle is writable. No external message delivery.
 */
require('./register-runtime.cjs');
require('@next/env').loadEnvConfig(process.cwd());
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const bundle=path.resolve(process.argv[2]??'.mock-data/requirement-verified');
Object.assign(process.env,{DEPLOYMENT_TIER:'demo',DATASET_REGION_BINDINGS_PATH:path.join(bundle,'region-bindings.json'),DATASET_MANIFEST_PATH:path.join(bundle,'manifest.json'),APP_BUSINESS_DB_PATH:path.join(bundle,'simulation-business.db'),CDC_SIMULATION_CONFIG:path.join(bundle,'simulation.json')});
for(const d of ['VECTOR','FOODBORNE','ENV','CHRONIC'])delete process.env['DATASET_'+d+'_PATH'];
const {isolatedSimulationSources}=require('../src/infrastructure/db/simulation-policy.ts');
const {loadDatasetManifest}=require('../src/infrastructure/db/dataset-manifest.ts');
const {createDevelopmentContext}=require('../src/lib/skills/server-executor.ts');
const {executeSkill,listSkillDefinitions}=require('../src/application/skills/skill-service.ts');
const {createMainAgent}=require('../src/application/agent/main-agent.ts');
const {collectDispatch}=require('../src/application/dispatch/dispatch-service.ts');
const scenes=require('../config/requirement-scenarios.json');
const expectations=require('../tests/fixtures/requirement-expectations.json');
function verifyOutputs(scene,turn){
 const steps=expectations.find(e=>e.requirementId===scene.requirementId).steps;
 const businessRuns=turn.skillRuns.filter(r=>!['skill_map_display','skill_session_journal'].includes(r.skillId));
 const views=[{},...businessRuns.filter(r=>r.result.payload).map(r=>({...r.result.payload,status:r.result.status}))], checks=[];
 const assert=(ok,name)=>checks.push({name,passed:Boolean(ok)});
 if(scene.deferred){assert(businessRuns.some(r=>r.skillId==='skill_catalog_manage'&&r.result.status==='SUCCESS'&&r.result.payload?.standardSkills?.some(s=>s.id==='skill_env_ocr_entry'&&s.availability==='planned')),'explicitly-deferred');return checks;}
 const matches=(r,step)=>r.skillId===step?.skillId||(r.result.method?.endsWith('-warning-workflow-v1')||r.result.method==='sectioned-monitoring-report-v2')&&listSkillDefinitions(scene.domain).find(d=>d.id===step?.skillId)?.method===r.result.method;
 for(const step of steps)assert(businessRuns.some(r=>matches(r,step)),'requested-capability-'+step.skillId);
 for(const step of steps)assert(businessRuns.some(r=>matches(r,step)&&['SUCCESS','REVIEW_REQUIRED'].includes(r.result.status)),'step-result-present-'+step.skillId);
 const primary=businessRuns.findLast(r=>matches(r,steps[0])&&(!steps[0]?.args?.analysis||!r.args.analysis||r.args.analysis===steps[0].args.analysis)&&r.result.payload)?.result.payload??{};
 const d=primary.data??primary;
 const required={23:['models'],24:['items','clusters'],25:['predictions'],26:['items'],27:['grid','monitoringPoints'],28:['signals'],29:['signals'],30:['models'],32:['history','forecasts'],33:[],36:['clusters'],37:['models'],38:['edges','associations','caseLinks'],39:['signals','historicalCases'],40:['cities','trend','foodTop10','events','details'],43:['rows'],44:['rows'],45:['models','stations'],46:['groups'],47:['stations','traceEdges'],48:['rows'],49:['rows'],50:['rows'],51:['forecasts'],52:['rows'],53:['rows','adjacencyEdges'],54:['signals'],55:['signals'],57:['sources','sensitivity'],58:['tasks'],59:['defects'],61:[],62:['districts'],63:['clusters'],64:['individuals'],65:['rules'],66:['highRiskList'],67:['clusters'],68:[],69:['events'],70:['signals'],71:['signals'],74:['signals'],75:['individuals'],76:['clusters']}[scene.requirementId]??[];
 for(const key of required)assert(Array.isArray(d[key])&&d[key].length>0,'nonempty-'+key);
 if(scene.requirementId===36)assert(businessRuns.some(r=>r.result.payload?.data?.caseDetails?.length||r.skillId==='skill_foodborne_case_table'&&r.result.status==='SUCCESS'&&r.result.payload?.data?.length),'candidate-case-details');
 if(scene.requirementId===59)assert(d.checks?.some(r=>r.rule==='missing-cause-or-code')&&d.checks?.some(r=>r.rule==='possible-duplicate-person-date'),'explicit-missing-and-duplicate-checks');
 if([23,30,37,45].includes(scene.requirementId))for(const model of d.models??[])assert(model.history?.length>=18&&model.forecasts?.length>0&&Number.isFinite(model.validation?.rmse),'fitted-model-and-heldout-error');
 if([25,44,48,51,64,66,68].includes(scene.requirementId))assert(d.validation&&Object.values(d.validation).some(v=>Number.isFinite(v)||(v&&typeof v==='object'&&Object.values(v).some(Number.isFinite))),'measured-heldout-validation');
 if([50,62].includes(scene.requirementId)){const model=d.forecast??d.trend;assert(model?.forecasts?.length>0&&Number.isFinite(model?.validation?.rmse),'forecast-with-heldout-error');}
 if([27,28,29,39,54,55,70,74,75,76].includes(scene.requirementId))assert(views.some(v=>v.data?.job?.jobId),'persisted-investigation-job');
 if([34,41,56,72].includes(scene.requirementId))assert(d.reportId&&d.artifact&&d.recordCount>0&&d.sections?.some(s=>s.chart),'archived-report-with-chart-and-download');
 if(scene.requirementId===30)assert(d.models?.length&&d.models.every(m=>m.history?.at(-1)?.period==='2024-12'&&m.forecasts?.map(p=>p.period).join(',')==='2025-01,2025-02'),'requested-training-cutoff-and-forecast-months');
 if(scene.requirementId===31)assert(Number.isFinite(d.exposureIndex)&&d.pcrSamples>0,'computed-exposure-index');
 if(scene.requirementId===33)assert(businessRuns.some(r=>r.skillId==='skill_monitoring_data_table'&&r.result.payload?.data?.length)&&businessRuns.some(r=>r.result.payload?.data?.knowledge?.length),'database-and-sourced-knowledge');
 if(scene.requirementId===40){assert(d.mapComposition?.layers?.[0]?.output?.geometry?.features?.length>0,'regional-case-map-with-real-geometry');assert(d.drilldown?.city==='郑州市'&&d.drilldown.details?.length>0&&d.drilldown.details.every(row=>row.city==='郑州市'),'city-drilldown-details-with-province-map');}
 if(scene.requirementId===35)assert(d.type==='COLLECTION_FORM','vision-collection-entry');
 if(scene.requirementId===60)assert(d.categoryCandidates?.length>=3&&d.parsedCertificate?.categoryCount===2047&&d.status==='REVIEW_REQUIRED','auditable-category-candidates');
 if(scene.requirementId===61)assert(d.causeGraph?.reportedEdges?.length&&d.engineResult?.selectionStatus&&d.review?.autoFinalized===false&&d.status==='REVIEW_REQUIRED','explicit-iris-result-or-blocker');
 if(scene.requirementId===53)assert(Number.isFinite(d.moranI),'computed-spatial-statistic');
 if(scene.requirementId===57)assert(d.scenarioPm25<d.baselinePm25&&Number.isFinite(d.estimatedAvoidedVisits),'computed-intervention-difference');
 if(scene.requirementId===66)assert(d.regionalRegistry?.length&&d.highRiskList?.every(r=>/肿瘤|癌/.test(r.disease_name))&&Number.isFinite(d.detectionRate)&&Number.isFinite(d.benefitCostRatio),'tumor-cohort-population-and-assumed-cost-benefit');
 if(scene.requirementId===68)assert(d.decisionTree&&d.features?.includes('protective_equipment'),'fitted-explainable-injury-tree');
 if(scene.requirementId===73){assert(d.type==='REPORT_TEMPLATE_EDITOR','template-management-entry');assert(businessRuns.some(r=>r.result.payload?.result?.version>=2),'template-saved-and-revised');assert(businessRuns.some(r=>r.result.payload?.type==='AUTO_GENERATED_REPORT'&&r.result.payload.template?.id&&r.result.payload.artifact),'template-reused-in-export');}
 return checks;
}
(async()=>{
 if(!isolatedSimulationSources(loadDatasetManifest()))throw Error('Explicit isolated Mock configuration required');
 const llmMode=process.env.REQUIREMENT_LLM_MODE??'live';
 if(!['live','contract'].includes(llmMode))throw Error('REQUIREMENT_LLM_MODE must be live or contract');
 const liveClient=llmMode==='live'?require('../src/infrastructure/llm/client.ts').createLLMClient():undefined;
 let activeScene,phaseCalls,modelExchanges,requestedSteps=false;
 const agent=createMainAgent({enableRegionIntent:true,listSkills:listSkillDefinitions,executeSkill,llm:{complete:async request=>{
  const phase=request.phase==='intent'?'intent':request.tools?.length?'planning':request.messages[0].content.includes('你负责提炼会话标题')?'title':request.messages[0].content.includes('操作意图校验')?'write-authorization':'synthesis';
  phaseCalls.push(phase);console.log(new Date().toISOString(),activeScene.requirementId,'LLM',phase);
  if(liveClient){const reply=await liveClient.complete(request);modelExchanges.push({phase,...reply});return reply;}
  // CI protocol double only: fixture expectations never enter the application runtime.
  if(phase==='intent'){
   const expectation=expectations.find(e=>e.requirementId===activeScene.requirementId),steps=expectation.steps,args=expectation.scope??steps[0]?.args??{};
   const evidence={source:'current',quote:activeScene.prompt},clear={op:'clear',evidence};
   let from=args.from,to=args.to??args.asOf;
   if(args.year){from=String(args.year)+'-'+String(args.month??1).padStart(2,'0')+'-01';to=args.month?new Date(Date.UTC(args.year,args.month,0)).toISOString().slice(0,10):String(args.year)+'-12-31';}
   if(to&&!from)from='2020-01-01';
   const time=from&&to?{op:'set',value:{from,to},evidence}:clear,filters={};
   const {searchRegionCandidates}=require('../src/infrastructure/geo/region-catalog.ts');
   const city=args.city&&activeScene.prompt.includes(args.city)?searchRegionCandidates(args.city).candidates[0]:undefined;
   const region=args.district&&activeScene.prompt.includes(args.district)?searchRegionCandidates(args.district,city?.code).candidates[0]:city;
   const dataRegion=region?{op:'set',value:{includeCandidateIds:[region.code],excludeCandidateIds:[]},evidence}:clear;
   for(const field of ['category','speciesName','methodName','pathogenName','pesticideName','pathogen','pathogenType','diseaseName','basinName','pathogenId','clusterId'])if((args[field]||(field==='category'&&activeScene.prompt.includes('蚊类')?'蚊':undefined))&&activeScene.prompt.includes(String(args[field]??'蚊')))filters[field]={op:'set',value:{field,operator:'eq',values:[args[field]??'蚊']},evidence};
   return {role:'assistant',content:JSON.stringify({task:'analysis',relation:'new',displayRegion:clear,dataRegion,time,filters,layerRequests:[],mapOperations:[],mapOptions:{basemap:'vec'}})};
  }
  if(phase==='title')return {role:'assistant',content:'{"title":"场景链路合约测试"}'};
  if(phase==='write-authorization')return {role:'assistant',content:'{"authorized":true,"reason":"合成验收操作"}'};
  if(activeScene.requirementId===73){
   const returned=request.messages.filter(m=>m.role==='tool').map(m=>JSON.parse(m.content));
   const saved=returned.find(r=>r.payload?.result?.template_id)?.payload.result;
   if(phase==='planning'){
    const definition={name:saved?'死因慢病伤害验收月报修订版':'死因慢病伤害验收月报',period:'month',sections:['overview','trend','regions','specific','advice','provenance']};
    const calls=saved?[['skill_report_templates',{action:'save',templateId:saved.template_id,version:saved.version,definition}],['skill_chronic_death_report',{templateId:saved.template_id,period:'month'}]]:[['skill_report_templates',{action:'save',definition}]];
    return {role:'assistant',content:null,tool_calls:calls.map(([name,args],i)=>({id:'template-'+returned.length+'-'+i,type:'function',function:{name,arguments:JSON.stringify(args)}}))};
   }
   if(phase==='synthesis'&&saved&&!returned.some(r=>r.payload?.type==='AUTO_GENERATED_REPORT'))return {role:'assistant',content:'{"mode":"continue","reason":"按照原始请求修改已创建模板并复用导出"}'};
  }
  if(phase==='planning'&&!requestedSteps){requestedSteps=true;return {role:'assistant',content:null,tool_calls:expectations.find(e=>e.requirementId===activeScene.requirementId).steps.map((step,i)=>({id:'contract-step-'+i,type:'function',function:{name:step.skillId,arguments:JSON.stringify(Object.fromEntries(Object.entries(step.args).filter(([key])=>!['city','district','from','to','asOf','year','month','category','speciesName','methodName','pathogenName','pesticideName','pathogen','pathogenType','diseaseName','basinName','pathogenId','clusterId'].includes(key))))}}))};}
  return {role:'assistant',content:JSON.stringify({mode:'answer',replyText:activeScene.deferred?'OCR 按要求暂缓。':'合约测试已接收技能结果；此答复为测试替身，不能作为真实模型研判证据。'})};
 }}});
 const resultFile=path.join(bundle,process.env.REQUIREMENT_RESULT_FILE||'scenario-execution.json');
 const evidence=process.env.REQUIREMENT_RESUME==='1'&&fs.existsSync(resultFile)?JSON.parse(fs.readFileSync(resultFile,'utf8')).results:[];
 for(const row of evidence){
  const scene=scenes.find(s=>s.requirementId===row.requirementId);
  if(!scene){row.passed=false;continue;}
  row.checks=[...verifyOutputs(scene,row),...row.checks.filter(c=>['llm-intent-invoked','llm-planning-invoked','llm-synthesis-invoked','conversation-persisted','nonempty-conclusion','model-conclusion-with-evidence'].includes(c.name))];
  row.passed=row.llmMode===llmMode&&row.prompt===scene.prompt&&row.status===row.expectedStatus&&row.checks.every(c=>c.passed)&&!row.replyText?.startsWith('查询结果如下，完整明细可在工作台查看。');
 }
 const selected=process.env.REQUIREMENT_IDS?.trim()?process.env.REQUIREMENT_IDS.split(',').map(Number):undefined;
 for(const scene of scenes){if(selected&&!selected.includes(scene.requirementId))continue;if(process.env.REQUIREMENT_DOMAIN&&scene.domain!==process.env.REQUIREMENT_DOMAIN)continue;
  if(evidence.some(row=>row.requirementId===scene.requirementId&&row.prompt===scene.prompt&&row.passed))continue;
  activeScene=scene;phaseCalls=[];modelExchanges=[];requestedSteps=false;
  const start=Date.now();const ctx=createDevelopmentContext(scene.domain);
  const events=[];for await(const event of agent({interactionId:crypto.randomUUID(),kind:'conversation',userInput:scene.prompt},ctx))events.push(event);
  const turn=await collectDispatch(events);
  const expected=[60,61].includes(scene.requirementId)?'REVIEW_REQUIRED':'SUCCESS';
  const checks=verifyOutputs(scene,turn);
  checks.push({name:'llm-intent-invoked',passed:phaseCalls.includes('intent')},{name:'llm-planning-invoked',passed:phaseCalls.includes('planning')},{name:'llm-synthesis-invoked',passed:phaseCalls.includes('synthesis')},{name:'conversation-persisted',passed:Boolean(turn.session?.id)},{name:'nonempty-conclusion',passed:Boolean(turn.replyText?.trim())});
  if(llmMode==='live')checks.push({name:'model-conclusion-with-evidence',passed:!turn.replyText.startsWith('查询结果如下，完整明细可在工作台查看。')});
  const entry={checks,requirementId:scene.requirementId,domain:scene.domain,prompt:scene.prompt,status:turn.status,expectedStatus:expected,passed:turn.status===expected&&checks.every(c=>c.passed),llmMode,thinkingEnabled:process.env.SILICONFLOW_ENABLE_THINKING!=='false',reasoningEffort:process.env.SILICONFLOW_REASONING_EFFORT??'default',phaseCalls,modelExchanges,intentSummary:turn.intentSummary,answerDiagnostics:turn.answerDiagnostics,reasoningText:turn.reasoningText,replyText:turn.replyText,session:turn.session,elapsedMs:Date.now()-start,runId:turn.runId,error:turn.error,agui:turn.agui,mapComposition:turn.mapComposition,skillRuns:turn.skillRuns};const prior=evidence.findIndex(row=>row.requirementId===scene.requirementId);if(prior>=0)evidence[prior]=entry;else evidence.push(entry);evidence.sort((a,b)=>a.requirementId-b.requirementId);
  console.log(scene.requirementId,scene.domain,turn.status,entry.elapsedMs,turn.error?.message??'',checks.filter(c=>!c.passed));
  fs.writeFileSync(resultFile,JSON.stringify({purpose:'mock-business-flow-not-external-scientific-validation',llmMode,executedAt:new Date().toISOString(),results:evidence},null,2));
 }
 fs.writeFileSync(resultFile,JSON.stringify({purpose:'mock-business-flow-not-external-scientific-validation',llmMode,executedAt:new Date().toISOString(),results:evidence},null,2));
 if(evidence.some(e=>!e.passed))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
