import {beforeAll,afterAll,beforeEach,afterEach,it,expect,vi} from 'vitest';
import fs from 'node:fs';import path from 'node:path';import {tmpdir} from 'node:os';import {execFileSync,spawnSync} from 'node:child_process';
import Database from 'better-sqlite3';
import {observedWorkflowFixture} from './fixtures/observed-workflow-context';
import {resolveDatasetLocation} from '@/infrastructure/db/dataset-manifest';
import {assertDatasetReadable,acquireDatasetLease} from '@/infrastructure/db/dataset-policy';
import {getDomainRepository} from '@/infrastructure/db/domain-repository';
import {readiness} from '@/application/config/readiness';
import {createDevelopmentContext} from '@/lib/skills/server-executor';
import {executeSkill} from '@/application/skills/skill-service';
import {createAnalyticsRunner} from '@/infrastructure/analytics/runner';
import {submitJob,reviewJob,completeAnalysis} from '@/application/jobs/job-service';
import {configureSchedule,enqueueDue} from '@/application/jobs/scheduler';
import {runWorkerTick} from '@/application/jobs/worker-service';
import {deliverInApp} from '@/infrastructure/events/outbox';
import {withBusinessDb,saveArtifact,getArtifact,recordAgentTurn,getRecordedTurn} from '@/infrastructure/db/business-store';
import {authorizeHistoryView} from '@/application/agent/history-authorization';
import {submitRetest} from '@/application/tickets/ticket-service';
import type {ExecutionContext} from '@/contracts/execution-context';
let dir:string,restoreSource:()=>void,observed:any,mock:any,observedManifest:string,mockManifest:string,registryPath:string;
const python=path.join(process.cwd(),'.venv/bin/python');
const baseline=createDevelopmentContext('vector');
const policyContext=():ExecutionContext=>({...baseline,runId:crypto.randomUUID(),deploymentTier:'pilot',principal:{...baseline.principal,mode:'authenticated'}});
function select(file:string){process.env.DATASET_MANIFEST_PATH=file;}
const query='SELECT AVG(f.capture_count) AS value FROM fact_monitoring f JOIN dim_species s ON f.species_id=s.species_id JOIN dim_method m ON f.method_id=m.method_id WHERE s.category=\'蚊\' AND m.method_name=\'诱蚊灯法\'';
function jobInput(){return {idempotencyKey:crypto.randomUUID(),city:'郑州市',interaction:{interactionId:crypto.randomUUID(),kind:'skill' as const,userInput:'统计',resourceRef:{type:'skill',id:'skill_monitoring_data_table',action:'execute'},attachments:[{type:'operation-input',args:{sql:query,city:'郑州市'}}]},rule:{field:'value',threshold:1,clearBelow:1,minRetestHours:24,unit:'captures/record'}};}
beforeAll(()=>{
 dir=fs.mkdtempSync(path.join(tmpdir(),'cdc-mock-policy-'));restoreSource=observedWorkflowFixture(dir);observedManifest=process.env.DATASET_MANIFEST_PATH!;observed=resolveDatasetLocation('vector');
 const file=path.join(dir,'mock.db');
 execFileSync(python,['-c',`import sys,sqlite3,json
from analytics_engine.mock_lifecycle import generation
from pathlib import Path
with generation(sys.argv[1],'vector',7,'scripts/init_vector_mock.py'):
 c=sqlite3.connect(sys.argv[1]);c.executescript(Path('analytics_engine/mock_schemas/vector.sql').read_text());c.executescript("INSERT INTO dim_location(location_id,province,city,district,street,latitude,longitude) VALUES('l','河南省','郑州市','金水区','Mock',34.8,113.7);INSERT INTO dim_species VALUES('s','蚊','白纹伊蚊','test');INSERT INTO dim_method VALUES('m','诱蚊灯法');INSERT INTO dim_date VALUES('2024-06-15',2024,6,15,'夏');INSERT INTO fact_monitoring(monitoring_id,date_id,location_id,species_id,method_id,capture_count,sampling_unit) VALUES('f','2024-06-15','l','s','m',99,1);");c.commit();c.close()
`,file],{cwd:process.cwd(),env:{...process.env,DEPLOYMENT_TIER:'demo'}});
 mock={...observed,origin:'mock',path:file};mockManifest=path.join(dir,'mock.json');fs.writeFileSync(mockManifest,JSON.stringify([mock]));registryPath=path.join(dir,'.mock-audit/mock-registry.sqlite3');
});
afterAll(()=>{restoreSource();fs.rmSync(dir,{recursive:true,force:true});});
beforeEach(()=>{vi.stubEnv('DEPLOYMENT_TIER','local');vi.stubEnv('APP_BUSINESS_DB_PATH',path.join(dir,crypto.randomUUID()+'.db'));select(observedManifest);});
afterEach(()=>{select(observedManifest);vi.unstubAllEnvs();});
it('rejects declared Mock in the server repository, skills, analytics and readiness',async()=>{
 select(mockManifest);vi.stubEnv('DEPLOYMENT_TIER','pilot');
 expect(()=>resolveDatasetLocation('vector')).toThrow(/正式|模拟/);
 expect(()=>getDomainRepository('vector').getSchema()).toThrow();
 expect((await executeSkill('skill_monitoring_data_table',{sql:query},policyContext())).error?.code).toBe('MOCK_PRODUCTION_FORBIDDEN');
 const runner=createAnalyticsRunner();expect((await runner.runAnalytics({task:'species_clustering',domain:'vector',runId:'blocked'})).status).toBe('FAILED');expect(runner.getStats().started).toBe(0);
 expect(readiness({domain:'vector',tier:'pilot',businessPath:process.env.APP_BUSINESS_DB_PATH!,datasetPath:mock.path,llmConfigured:true,origin:'https://test.example'}).ready).toBe(false);
});
it('uses the server production default and refuses a forged local execution context',async()=>{
 select(mockManifest);delete process.env.DEPLOYMENT_TIER;vi.stubEnv('NODE_ENV','production');
 const ctx={...policyContext(),deploymentTier:'local' as const};
 expect((await executeSkill('skill_monitoring_data_table',{sql:query},ctx)).error?.code).toBe('MOCK_PRODUCTION_FORBIDDEN');
});
it('an explicit local tier cannot bypass a production build, while explicit demo stays isolated',()=>{
 select(mockManifest);vi.stubEnv('NODE_ENV','production');vi.stubEnv('DEPLOYMENT_TIER','local');
 expect(()=>resolveDatasetLocation('vector')).toThrow();
 vi.stubEnv('DEPLOYMENT_TIER','demo');expect(()=>resolveDatasetLocation('vector')).not.toThrow();
 expect(()=>submitJob(jobInput(),{...baseline,deploymentTier:'demo'})).toThrow();
});
it('a pilot context cannot read Mock even if a local process supplied it',async()=>{
 select(mockManifest);expect((await executeSkill('skill_monitoring_data_table',{sql:query},policyContext())).error?.code).toBe('MOCK_PRODUCTION_FORBIDDEN');
});
it('database markers reject relabelling, path overrides and copied Mock files',()=>{
 expect(()=>assertDatasetReadable({...mock,origin:'observed'})).toThrow(/改标/);
 vi.stubEnv('DATASET_VECTOR_PATH',mock.path);expect(()=>resolveDatasetLocation('vector')).toThrow(/改标/);
 const copied=path.join(dir,'copied-mock.db');fs.copyFileSync(mock.path,copied);expect(()=>assertDatasetReadable({...observed,path:copied},'pilot')).toThrow();
});
it('a Node read lease blocks cleanup and releases even after a query fails',()=>{
 select(mockManifest);const release=acquireDatasetLease(mock);
 const db=new Database(registryPath);try{expect((db.prepare('SELECT COUNT(*) n FROM mock_leases').get() as any).n).toBe(1);}finally{db.close();}
 const markerDb=new Database(mock.path,{readonly:true});const marker=JSON.parse((markerDb.prepare('SELECT metadata_json FROM _cdc_mock_provenance').get() as any).metadata_json);markerDb.close();
 const output=spawnSync(python,['scripts/cleanup-mock.py','--audit-dir',path.dirname(registryPath),'--dataset-id',marker.datasetId,'--active-manifest',observedManifest],{cwd:process.cwd(),env:{...process.env,DEPLOYMENT_TIER:'demo',DATASET_MANIFEST_PATH:observedManifest},encoding:'utf8',stdio:['ignore','pipe','pipe']});
 expect(JSON.parse(output.stdout).results[0].status).toBe('REFUSED');release();
 expect(()=>getDomainRepository('vector').query('SELECT missing FROM fact_monitoring',[],{domain:'vector'})).toThrow();
 const check=new Database(registryPath);try{expect((check.prepare('SELECT COUNT(*) n FROM mock_leases').get() as any).n).toBe(0);}finally{check.close();}
});
it('Mock cannot submit a formal task, report, sampling record or legacy alert',async()=>{
 select(mockManifest);const ctx=createDevelopmentContext('vector');
 expect(()=>submitJob(jobInput(),ctx)).toThrow();
 for(const [id,args] of [['skill_job_manage',{action:'submit',input:jobInput()}],['skill_auto_report_gen',{}],['skill_collection_manage',{action:'submit',record:{city:'郑州市',district:'金水区',category:'蚊',speciesName:'白纹伊蚊',captureCount:0}}]] as const)expect((await executeSkill(id,args,ctx)).status).toBe('FAILED');
 const {getAppBusinessProvider}=await import('@/lib/db/app-business-provider');
 await expect(getAppBusinessProvider().saveEarlyWarningEvent({} as any)).rejects.toThrow();
 await expect(getAppBusinessProvider().createDisposalTicket({} as any)).rejects.toThrow();
 expect(withBusinessDb(db=>['biz_jobs','biz_generated_reports','biz_mobile_submissions','biz_outbox','biz_workflow_tickets','biz_early_warning_events'].map(t=>(db.prepare('SELECT COUNT(*) n FROM '+t).get() as any).n))).toEqual([0,0,0,0,0,0]);
});
it('allows real-source query/workflow submission and rejects a caller-supplied Mock source identity',async()=>{
 const ctx=createDevelopmentContext('vector');expect((await executeSkill('skill_monitoring_data_table',{sql:query},ctx)).status).toBe('SUCCESS');
 const submitted=submitJob({...jobInput(),sourceDataset:mock},ctx);expect(JSON.parse(submitted.input_json).sourceDataset.origin).toBe('observed');
});
it('rejects historical Mock evidence after the active source changes to observed',()=>{
 const ctx=createDevelopmentContext('vector'),input=jobInput(),j=submitJob(input,ctx);
 const result:any={runId:ctx.runId,interactionId:'poisoned',status:'SUCCESS',replyText:'Mock',agui:[],skillRuns:[{callId:'c',skillId:'skill_monitoring_data_table',skillName:'Mock',args:{},result:{status:'SUCCESS',method:'bounded-domain-query-v1',datasets:[mock],payload:{data:[{value:99}]}}}]};
 recordAgentTurn(input.interaction,result,ctx);withBusinessDb(db=>db.prepare("UPDATE biz_jobs SET status='RUNNING',lease_owner='worker' WHERE job_id=?").run(j.job_id));
 expect(()=>completeAnalysis(j.job_id,ctx.runId,ctx)).toThrow();
 withBusinessDb(db=>db.prepare("UPDATE biz_jobs SET status='WAITING_REVIEW',result_json=? WHERE job_id=?").run(JSON.stringify(result),j.job_id));
 expect(()=>reviewJob(j.job_id,'approve',ctx)).toThrow();expect(()=>getRecordedTurn(ctx.runId,policyContext())).toThrow();
 expect(withBusinessDb(db=>(db.prepare('SELECT COUNT(*) n FROM biz_workflow_tickets').get() as any).n)).toBe(0);
});
it('legacy Mock jobs cannot dispatch, approve, notify or resolve a ticket',async()=>{
 const ctx=createDevelopmentContext('vector'),j=submitJob(jobInput(),ctx);const stored=JSON.parse(j.input_json);stored.sourceDataset=mock;
 withBusinessDb(db=>{db.prepare('UPDATE biz_jobs SET input_json=? WHERE job_id=?').run(JSON.stringify(stored),j.job_id);db.prepare('INSERT INTO biz_workflow_tickets VALUES(?,?,?,?,?,?,?,?,?,NULL)').run('tainted-ticket',j.job_id,ctx.principal.userId,'vector','郑州市','金水区','OPEN',ctx.principal.userId,Date.now());db.prepare('INSERT INTO biz_outbox VALUES(?,?,?,?,?,?,?,?,NULL)').run('tainted-event',j.job_id,ctx.principal.userId,'vector','in_app','PENDING','{}',Date.now());});
 expect(()=>reviewJob(j.job_id,'approve',ctx)).toThrow();expect(()=>submitRetest('tainted-ticket',{sourceRecordId:'real'},ctx)).toThrow();
 expect(deliverInApp()).toBe(0);expect(withBusinessDb(db=>(db.prepare('SELECT COUNT(*) n FROM biz_inbox').get() as any).n)).toBe(0);
 await runWorkerTick('tainted-worker');expect(withBusinessDb(db=>(db.prepare('SELECT COUNT(*) n FROM biz_agent_runs').get() as any).n)).toBe(0);
});
it('a persisted Mock schedule cannot be converted into a real-source job after switching datasets',()=>{
 const ctx=createDevelopmentContext('vector'),schedule=configureSchedule(jobInput(),60,ctx);
 withBusinessDb(db=>{const row=db.prepare('SELECT input_json FROM biz_job_schedules WHERE schedule_id=?').get(schedule.scheduleId) as any;const input=JSON.parse(row.input_json);input.sourceDataset=mock;db.prepare('UPDATE biz_job_schedules SET input_json=?,next_at=0 WHERE schedule_id=?').run(JSON.stringify(input),schedule.scheduleId);});
 enqueueDue();
 expect(withBusinessDb(db=>db.prepare('SELECT active FROM biz_job_schedules WHERE schedule_id=?').get(schedule.scheduleId))).toEqual({active:0});
 expect(withBusinessDb(db=>db.prepare('SELECT COUNT(*) n FROM biz_jobs').get())).toEqual({n:1});
});
it('Mock artifacts and session snapshots remain excluded in production after a source switch',()=>{
 const ctx=createDevelopmentContext('vector');const artifact=saveArtifact({fileName:'模拟.csv',mimeType:'text/csv',content:Buffer.from('Mock'),source:{datasets:[mock]}},ctx);
 expect(getArtifact(artifact.artifactId,ctx).content.toString()).toBe('Mock');expect(()=>getArtifact(artifact.artifactId,policyContext())).toThrow();
 expect(()=>authorizeHistoryView({type:'DATA_TABLE_VIEW',datasets:[mock],data:[{n:99}]},policyContext())).toThrow();
 expect(authorizeHistoryView({type:'MAP_VIEW'},policyContext())).toEqual({type:'MAP_VIEW'});
});
it('demo CSV bytes retain a Mock origin column and cannot be downloaded in formal mode',async()=>{
 select(mockManifest);const ctx=createDevelopmentContext('vector');
 const result=await executeSkill('skill_artifact_export',{format:'csv',sql:'SELECT COUNT(*) AS n FROM fact_monitoring'},ctx);
 expect(result.status).toBe('SUCCESS');const payload=result.payload as any;
 expect(payload.fileName).toContain('模拟数据');
 const content=getArtifact(payload.artifactId,ctx).content.toString();
 expect(content).toContain('__cdc_data_origin');expect(content).toContain('"mock"');
 select(observedManifest);expect(()=>getArtifact(payload.artifactId,policyContext())).toThrow();
});
