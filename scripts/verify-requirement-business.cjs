/** Follow-up acceptance: real persistence/export/state transitions, isolated Mock only. */
require('./register-runtime.cjs');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const bundle=path.resolve(process.argv[2]??'.mock-data/requirement-verified');
Object.assign(process.env,{DEPLOYMENT_TIER:'demo',DATASET_MANIFEST_PATH:path.join(bundle,'manifest.json'),DATASET_REGION_BINDINGS_PATH:path.join(bundle,'region-bindings.json'),APP_BUSINESS_DB_PATH:path.join(bundle,'simulation-business.db'),CDC_SIMULATION_CONFIG:path.join(bundle,'simulation.json')});
for(const d of ['VECTOR','FOODBORNE','ENV','CHRONIC'])delete process.env['DATASET_'+d+'_PATH'];
const {createDevelopmentContext}=require('../src/lib/skills/server-executor.ts');
const {executeSkill}=require('../src/application/skills/skill-service.ts');
const {withBusinessDb,getArtifact}=require('../src/infrastructure/db/business-store.ts');
const {assignEnvironmentTasks,submitEnvironmentSample,environmentTasks}=require('../src/application/mobile/environment-sampling.ts');
const {templates,generateReport}=require('../src/application/reports/report-service.ts');
const {runWorkerTick}=require('../src/application/jobs/worker-service.ts');
const {getJob,reviewJob}=require('../src/application/jobs/job-service.ts');
const {submitRetest}=require('../src/application/tickets/ticket-service.ts');
const {deliverInApp}=require('../src/infrastructure/events/outbox.ts');
const {loadDatasetManifest}=require('../src/infrastructure/db/dataset-manifest.ts');
const {isolatedSimulationSources}=require('../src/infrastructure/db/simulation-policy.ts');
const pixel='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII=';
(async()=>{
 assert(isolatedSimulationSources(loadDatasetManifest()));const evidence={purpose:'isolated-mock-business-acceptance',checks:[]};
 for(const domain of ['vector','foodborne','env','chronic']){
  const ctx=createDevelopmentContext(domain);const definition={name:'验收可复用模板 '+domain,period:'month',sections:['overview','trend','regions','specific','provenance']};
  const created=templates('save',{definition},ctx);const updated=templates('save',{templateId:created.template_id,version:1,definition:{...definition,name:definition.name+' v2'}},ctx);
  assert.equal(updated.version,2);assert.throws(()=>templates('save',{templateId:created.template_id,version:1,definition},ctx),/VERSION_CONFLICT/);
  assert.throws(()=>templates('get',{templateId:created.template_id},{...ctx,principal:{...ctx.principal,organizationId:'other'}}),/NOT_FOUND/);
  const report=await generateReport({templateId:created.template_id},ctx);assert.equal(report.status,'SUCCESS');assert.equal(report.payload.template.version,2);assert(report.payload.sections.length>=5);
  const file=getArtifact(report.payload.artifact.artifactId,ctx);assert(file.content.toString().includes('<svg'));assert(file.content.toString().includes('模拟')||file.content.toString().includes('mock'));
  const markdown=await executeSkill('skill_artifact_export',{format:'markdown',reportId:report.payload.reportId},createDevelopmentContext(domain));assert.equal(markdown.status,'SUCCESS',JSON.stringify(markdown.error));assert(getArtifact(markdown.payload.artifactId,ctx).content.length>100);
  templates('delete',{templateId:created.template_id,version:2},ctx);assert.throws(()=>templates('get',{templateId:created.template_id},ctx),/NOT_FOUND/);
  evidence.checks.push({domain,flow:'template create/update/conflict/reuse/report/archive/export/delete',reportId:report.payload.reportId,htmlArtifact:report.payload.artifact,markdownArtifact:markdown.payload,passed:true});
 }
 const env=createDevelopmentContext('env');assignEnvironmentTasks({city:'郑州市',district:'金水区'},env);let task=environmentTasks(env).find(t=>t.status==='PENDING');
 if(!task)throw Error('Fresh acceptance bundle required: no pending environmental tasks');
 const sample={clientKey:require('node:crypto').randomUUID(),taskId:task.task_id,city:task.city,district:task.district,sampleCode:task.sample_code,sampledAt:new Date().toISOString(),indicator:'lead',value:.01,unit:'mg/L',photoDataUrl:pixel};
 const saved=submitEnvironmentSample(sample,env),replayed=submitEnvironmentSample(sample,env);assert.equal(saved.sampleId,replayed.sampleId);assert.equal(replayed.replayed,true);
 assert.throws(()=>submitEnvironmentSample({...sample,value:.02},env),/CONFLICT/);assert.equal(environmentTasks(env).find(t=>t.task_id===task.task_id).status,'COMPLETED');
 assert.throws(()=>submitEnvironmentSample({...sample,clientKey:require('node:crypto').randomUUID()},{...env,principal:{...env.principal,userId:'other'}}),/FORBIDDEN/);
 const persisted=withBusinessDb(db=>db.prepare('SELECT * FROM biz_environment_samples WHERE sample_id=?').get(saved.sampleId));assert.equal(persisted.photo_data_url,pixel);assert.equal(persisted.photo_sha256,saved.photoSha256);
 evidence.checks.push({domain:'env',flow:'task -> cached payload -> sync -> persisted photo -> idempotent replay -> completed',sampleId:saved.sampleId,taskId:task.task_id,photoSha256:saved.photoSha256,passed:true});
 // Run actual queued query jobs; professional approval is only exercised in this isolated demo.
 let count=0;while(withBusinessDb(db=>db.prepare("SELECT COUNT(*) n FROM biz_jobs WHERE status='QUEUED'").get()).n&&count++<100){const tick=await runWorkerTick('requirement-business-acceptance');if(tick.status==='RETRY_OR_FAILED')throw Error(JSON.stringify(tick));}
 const jobs=withBusinessDb(db=>db.prepare('SELECT * FROM biz_jobs ORDER BY created_at').all());let vectorTicket;
 for(const job of jobs){const ctx=createDevelopmentContext(job.domain);const state=getJob(job.job_id,ctx);if(state.status==='WAITING_REVIEW'){const ticket=reviewJob(job.job_id,'approve',ctx);if(job.domain==='vector'&&job.city==='郑州市'&&job.district==='金水区')vectorTicket=ticket;}else assert(['APPROVED','COMPLETED'].includes(state.status),state.status);}
 const delivered=deliverInApp();const messages=withBusinessDb(db=>db.prepare('SELECT domain,COUNT(*) AS messages FROM biz_inbox GROUP BY domain').all());assert.equal(messages.length,4);
 evidence.checks.push({flow:'real queued analysis -> waiting review -> approval -> in-app delivery',jobs:jobs.length,delivered,messages,passed:true,externalChannelsSent:0});
 if(vectorTicket){
  // Advance a controlled JS clock, not persisted timestamps or source measurements.
  const RealDate=Date,offset=2*3600000;global.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[RealDate.now()+offset]));}static now(){return RealDate.now()+offset;}};
  try{const ctx=createDevelopmentContext('vector');const collection=await executeSkill('skill_collection_manage',{action:'submit',record:{city:'郑州市',district:'金水区',category:'蚊',speciesName:'白纹伊蚊',methodName:'诱蚊灯法',captureCount:0,weatherTemp:25}},ctx);assert.equal(collection.status,'SUCCESS',JSON.stringify(collection.error));const retest=submitRetest(vectorTicket.ticket_id,{sourceRecordId:collection.payload.record.submission_id},ctx);assert.equal(retest.ticketStatus,'RESOLVED');evidence.checks.push({flow:'collected retest -> time/unit/provenance validation -> resolved ticket',clock:'controlled +2h simulation clock; no timestamp rows rewritten',...retest,passed:true});}finally{global.Date=RealDate;}
 }else throw Error('Vector scoped ticket missing');
 fs.writeFileSync(path.join(bundle,'business-execution.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
