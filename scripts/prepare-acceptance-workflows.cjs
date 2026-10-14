// Real application operations against the explicitly isolated Mock business database.
require('./register-runtime.cjs');
const fs=require('node:fs'),path=require('node:path');
const {isolatedSimulationSources}=require('../src/infrastructure/db/simulation-policy.ts');
const {loadDatasetManifest}=require('../src/infrastructure/db/dataset-manifest.ts');
const {createDevelopmentContext}=require('../src/lib/skills/server-executor.ts');
const {submitJob,getJob,reviewJob,captureRetestQuery}=require('../src/application/jobs/job-service.ts');
const {runWorkerTick}=require('../src/application/jobs/worker-service.ts');
const {executeSkill}=require('../src/application/skills/skill-service.ts');
const {deliverInApp}=require('../src/infrastructure/events/outbox.ts');
(async()=>{
 if(!isolatedSimulationSources(loadDatasetManifest()))throw Error('Explicit isolated demo configuration required');
 const specs={vector:['skill_monitoring_data_table',captureRetestQuery({category:'蚊',methodName:'诱蚊灯法'},'value'),'skill_auto_report_gen'],foodborne:['skill_foodborne_case_table','SELECT COUNT(*) AS value FROM fact_foodborne_case','skill_foodborne_report_export'],env:['skill_env_monitoring_table','SELECT COUNT(*) AS value FROM fact_water_monitoring','skill_auto_report_gen'],chronic:['skill_chronic_monitoring_table','SELECT COUNT(*) AS value FROM fact_death_registry','skill_chronic_death_report']};
 const outputs=[];
 for(const [domain,[skillId,sql,reportSkill]] of Object.entries(specs)){
  const ctx=createDevelopmentContext(domain);
  const input={idempotencyKey:'requirement-acceptance-v1',city:'郑州市',district:'金水区',interaction:{interactionId:'acceptance-'+domain,kind:'skill',userInput:'模拟数据验收统计',resourceRef:{type:'skill',id:skillId,action:'execute'},attachments:[{type:'operation-input',args:{sql,city:'郑州市',district:'金水区'}}]},rule:{field:'value',threshold:0,clearBelow:0,minRetestHours:1,unit:domain==='vector'?'captures/record':'records'},...(domain==='vector'?{retestMeasurement:{category:'蚊',methodName:'诱蚊灯法'}}:{})};
  const job=submitJob(input,ctx);
  if(job.status==='QUEUED')await runWorkerTick('acceptance-seed');
  const state=getJob(job.job_id,ctx);
  if(state.status==='WAITING_REVIEW')reviewJob(job.job_id,'approve',ctx);
  else if(state.status!=='APPROVED')throw Error(`${domain}: ${state.status}: ${state.error??''}`);
  // Only the demo user's own in-app inbox is populated; no external delivery channel.
  deliverInApp();
  const report=await executeSkill(reportSkill,{city:'郑州市',district:'金水区',reportTitle:'模拟数据验收摘要 · '+domain},createDevelopmentContext(domain));
  if(report.status!=='SUCCESS')throw Error(JSON.stringify(report.error));
  const exported=await executeSkill('skill_artifact_export',{format:'markdown',reportId:report.payload.reportId},createDevelopmentContext(domain));
  if(exported.status!=='SUCCESS')throw Error(JSON.stringify(exported.error));
  outputs.push({domain,jobId:job.job_id,status:getJob(job.job_id,ctx).status,reportId:report.payload.reportId,artifact:exported.payload});
 }
 const file=path.join(path.dirname(process.env.CDC_SIMULATION_CONFIG),'workflow-evidence.json');
 fs.writeFileSync(file,JSON.stringify({purpose:'mock-engineering-demo-not-professional-acceptance',outputs},null,2));
 console.log(JSON.stringify(outputs.map(({domain,status,jobId})=>({domain,status,jobId})),null,2));
})().catch(error=>{console.error(error.message);process.exitCode=1;});
