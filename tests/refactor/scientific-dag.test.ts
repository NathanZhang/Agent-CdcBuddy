import {it,expect,beforeEach,afterEach} from 'vitest';
import {mkdtempSync,rmSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import Database from 'better-sqlite3';
import {observedWorkflowFixture} from './fixtures/observed-workflow-context';
import {createDevelopmentContext} from '@/lib/skills/server-executor';
import {readDatasetLocations} from '@/infrastructure/db/dataset-manifest';
import {withBusinessDb} from '@/infrastructure/db/business-store';
import {compileSciencePlan} from '@/application/science/dag-compiler';
import {submitSciencePlan,scienceRunStatus,cancelScienceRun,resumeScienceRun,runScienceWorkerTick} from '@/application/science/dag-service';
import {executeScienceOperation} from '@/application/science/operations';
import {readScientificArtifact,scientificHash} from '@/application/science/artifact-store';
import {registerSamplingEvent} from '@/application/science/measurements';
import {executeSkill,listSkillDefinitions} from '@/application/skills/skill-service';
import {createUser} from '@/infrastructure/auth/session';
import {runWorkerTick} from '@/application/jobs/worker-service';
import type {SciencePlan} from '@/contracts/scientific-dag';
let dir:string,restore:()=>void;const previous=process.env.APP_BUSINESS_DB_PATH;
const ctx=()=>createDevelopmentContext('vector');
const scope={city:'郑州市',district:'金水区',from:'2024-04-01',to:'2024-06-30',category:'蚊',methodName:'诱蚊灯法'};
function plan():SciencePlan{return {version:'1',scope,nodes:[
 {id:'history',operation:'measurements',inputs:{},params:{}},
 {id:'scan',operation:'scan',inputs:{measurements:'history'},window:{from:'2024-06-01',to:'2024-06-30'},params:{simulations:99,seed:42,exposure:'record'}},
 {id:'members',operation:'scan-select',inputs:{scan:'scan'},params:{}},
 {id:'matrix',operation:'features',inputs:{measurements:'history',selection:'members'},window:{from:'2024-06-01',to:'2024-06-30'},params:{metric:'capture-per-record',features:['metric']},when:{node:'members',test:'has-members'}},
 {id:'clusters',operation:'kmeans',inputs:{matrix:'matrix'},params:{k:3,seed:42},when:{node:'matrix',test:'finite'}},
 {id:'fixed',operation:'cluster-select',inputs:{clusters:'clusters'},params:{}},
 {id:'series',operation:'series',inputs:{measurements:'history',selection:'fixed'},window:{from:'2024-04-01',to:'2024-06-30'},params:{metric:'capture-per-record',frequency:'month'}}
]};}
function sourceDb(){return new Database(readDatasetLocations().find(d=>d.domain==='vector')!.path);}
beforeEach(()=>{dir=mkdtempSync(join(tmpdir(),'cdc-dag-'));process.env.APP_BUSINESS_DB_PATH=join(dir,'business.db');restore=observedWorkflowFixture(dir);const db=sourceDb();
 db.prepare("INSERT INTO dim_species VALUES('s2','蚊','淡色库蚊','test2')").run();
 for(let month=4;month<=5;month++)db.prepare('INSERT INTO dim_date VALUES(?,?,?,?,?)').run(`2024-0${month}-15`,2024,month,15,'夏');
 db.transaction(()=>{for(let i=0;i<8;i++){
  db.prepare("INSERT INTO dim_location(location_id,city,district,latitude,longitude) VALUES(?,'郑州市','金水区',?,?)").run('dag-'+i,i<4?34.81:34.84+(i-4)*.01,i<4?113.72:113.75+(i-4)*.01);
  for(let month=4;month<=6;month++)for(const species of ['s','s2'])db.prepare("INSERT INTO fact_monitoring(monitoring_id,date_id,location_id,species_id,method_id,capture_count,sampling_unit) VALUES(?,?,?,?,'m',?,1)").run(`dag-${i}-${month}-${species}`,`2024-0${month}-15`,'dag-'+i,species,month===6&&i<4?[2000,3000,4500,6500][i]:10+i);
 }})();db.close();});
afterEach(()=>{restore();if(previous===undefined)delete process.env.APP_BUSINESS_DB_PATH;else process.env.APP_BUSINESS_DB_PATH=previous;rmSync(dir,{recursive:true,force:true});});
async function drain(id:string){for(let i=0;i<40;i++){const result=await runScienceWorkerTick('test-worker');if(['SUCCEEDED','FAILED'].includes(scienceRunStatus(id,ctx()).status))break;if(!result.worked)break;}return scienceRunStatus(id,ctx());}
it('compiles typed child windows, orders unsorted nodes, and rejects graph/type/scope/parameter errors',()=>{
 const good=plan();good.nodes.reverse();expect(compileSciencePlan(good,ctx()).nodes[0].id).toBe('history');
 const invalids:[(p:SciencePlan)=>void,string][]=[
 [p=>p.nodes.push(structuredClone(p.nodes[0])),'DAG_DUPLICATE_NODE'],
 [p=>p.nodes[1].inputs.measurements='scan','DAG_CYCLE'],
 [p=>p.nodes[1].inputs.measurements='unknown','DAG_UNKNOWN_DEPENDENCY'],
 [p=>p.nodes[1].inputs.measurements='members','DAG_CYCLE'],
 [p=>p.nodes[6].inputs.selection='scan','DAG_ARTIFACT_TYPE_MISMATCH'],
 [p=>p.nodes[1].window!.from='2024-03-01','DAG_TIME_WIDENING'],
 [p=>p.nodes[1].window!.from='2024-02-30','DAG_TIME_WIDENING'],
 [p=>p.nodes[1].params.dbPath='/tmp/anything','DAG_PARAMETERS_INVALID'],
 [p=>{p.nodes[1].params.exposure='effort';},'MEASUREMENT_UNIT_REQUIRED'],
 [p=>p.nodes[0].when={node:'history',test:'empty'},'DAG_CYCLE'],
 [p=>p.nodes[6].when={node:'history',test:'finite'},'DAG_CONDITION_TYPE_INVALID'],
 [p=>p.nodes[4].operation='lstm','CAPABILITY_UNAVAILABLE']
 ];for(const [mutate,error] of invalids){const input=plan();mutate(input);expect(()=>compileSciencePlan(input,ctx())).toThrow(error);}
 const sourceConflict=plan();sourceConflict.nodes.push({id:'other',operation:'measurements',inputs:{},params:{}});sourceConflict.nodes[6].inputs.measurements='other';expect(()=>compileSciencePlan(sourceConflict,ctx())).toThrow('DAG_SELECTION_SOURCE_MISMATCH');
 const tooNarrow=plan();tooNarrow.nodes[0].window={from:'2024-06-01',to:'2024-06-30'};expect(()=>compileSciencePlan(tooNarrow,ctx())).toThrow('DAG_TIME_WIDENING');
});
it('persists the genuine scan → member → matrix → K-Means → fixed history chain with effort denominators',async()=>{
 const db=sourceDb();const groups=new Map<string,string[]>();for(const r of db.prepare('SELECT monitoring_id,date_id,location_id FROM fact_monitoring').all() as any[]){const key=r.date_id+':'+r.location_id;groups.set(key,[...(groups.get(key)??[]),r.monitoring_id]);}db.close();
 for(const [key,recordIds] of groups)registerSamplingEvent({...scope,recordIds,sourceEventKey:key,effortValue:8,effortUnit:'trap-hour',evidence:'人工核对测试采样单，两个物种共用一次8小时布灯'},ctx());
 const input=plan();input.nodes[1].params={exposure:'effort',effortUnit:'trap-hour',simulations:99};for(const n of [input.nodes[3],input.nodes[6]])n.params={...n.params,metric:'capture-per-effort',effortUnit:'trap-hour'};
 const submitted=submitSciencePlan(input,'chain',ctx());expect(submitSciencePlan(input,'chain',ctx()).reused).toBe(true);const changed=plan();expect(()=>submitSciencePlan(changed,'chain',ctx())).toThrow('DAG_IDEMPOTENCY_CONFLICT');
 const completed=await drain(submitted.runId);expect(completed.status,JSON.stringify(completed)).toBe('SUCCEEDED');expect(completed.nodes.every(n=>n.status==='SUCCEEDED')).toBe(true);
 const scan=readScientificArtifact(completed.nodes.find(n=>n.nodeId==='scan')!.output,ctx(),{kind:'ScanResult'});expect(scan.data.exposureUnit).toBe('trap-hour');expect(scan.data.clusters[0].locationKeys).toHaveLength(4);
 const cluster=readScientificArtifact(completed.nodes.find(n=>n.nodeId==='clusters')!.output,ctx(),{kind:'ClusterSet'});expect(cluster.data.k).toBe(3);expect(cluster.data.assignments).toHaveLength(4);expect(cluster.data.columns[0].unit).toBe('capture/trap-hour');
 const series=readScientificArtifact(completed.nodes.find(n=>n.nodeId==='series')!.output,ctx(),{kind:'SeriesSet',requireFinite:true,requireFullPeriods:true,frequency:'month',unit:'capture/trap-hour'});expect(series.data.series).toHaveLength(8);expect(series.qualityFlags).toEqual([]);expect(series.timeWindow).toEqual({from:scope.from,to:scope.to});expect(series.data.series.every(s=>s.points.length===3)).toBe(true);
 const snapshot=series.ref;expect((await runScienceWorkerTick('other')).worked).toBe(false);expect(scienceRunStatus(submitted.runId,ctx()).nodes.at(-1)!.output).toEqual(snapshot);
});
it('takes the explicit empty branch, persists skipped dependent nodes and never invents hotspots',async()=>{
 const db=sourceDb();db.exec('UPDATE fact_monitoring SET capture_count=2');db.close();const input=plan();input.nodes.push({id:'nohotspots',operation:'scan-select',inputs:{scan:'scan'},params:{},when:{node:'scan',test:'empty'}});
 const {runId}=submitSciencePlan(input,'empty',ctx());const completed=await drain(runId);expect(completed.status).toBe('SUCCEEDED');expect(completed.nodes.find(n=>n.nodeId==='matrix')!.status).toBe('SKIPPED');expect(completed.nodes.find(n=>n.nodeId==='series')!.status).toBe('SKIPPED');expect(completed.nodes.find(n=>n.nodeId==='nohotspots')!.status).toBe('SUCCEEDED');
 const scan=readScientificArtifact(completed.nodes.find(n=>n.nodeId==='scan')!.output,ctx(),{kind:'ScanResult'});expect(scan.data.clusters).toEqual([]);
});
it('retries transient failures only, caps attempts, and resumes from successful checkpoints',async()=>{
 const input=plan();input.nodes[0].retry={maxAttempts:2,delayMs:0};const {runId}=submitSciencePlan(input,'retry',ctx());
 const failed=async()=>{throw Error('KERNEL_TIMEOUT');};expect((await runScienceWorkerTick('a',failed)).status).toBe('RETRY_OR_FAILED');expect(scienceRunStatus(runId,ctx()).nodes[0].status).toBe('RETRY_WAIT');
 await runScienceWorkerTick('a',failed);expect(scienceRunStatus(runId,ctx()).status).toBe('FAILED');resumeScienceRun(runId,ctx());await runScienceWorkerTick('a');const ref=scienceRunStatus(runId,ctx()).nodes[0].output;
 await runScienceWorkerTick('a',async()=>{throw Error('SCAN_COORDINATES_REQUIRED');});expect(scienceRunStatus(runId,ctx()).status).toBe('FAILED');resumeScienceRun(runId,ctx());expect((await drain(runId)).status).toBe('SUCCEEDED');expect(scienceRunStatus(runId,ctx()).nodes[0].output).toEqual(ref);expect(scienceRunStatus(runId,ctx()).nodes[0].attempts).toBe(3);
});
it('cancels queued work, aborts active work, preserves successful nodes and supports explicit resume',async()=>{
 const {runId}=submitSciencePlan(plan(),'cancel',ctx());expect(cancelScienceRun(runId,ctx()).status).toBe('CANCELLED');expect((await runScienceWorkerTick('a')).worked).toBe(false);resumeScienceRun(runId,ctx());await runScienceWorkerTick('a');const ref=scienceRunStatus(runId,ctx()).nodes[0].output;
 let started!:()=>void;const ready=new Promise<void>(r=>started=r);const work=runScienceWorkerTick('a',async(_op,_inputs,_params,_window,context)=>{started();return new Promise((_resolve,reject)=>context.signal!.addEventListener('abort',()=>reject(Error('SCIENCE_CANCELLED')),{once:true}));});
 await ready;expect((await runScienceWorkerTick('b')).worked).toBe(false);expect(cancelScienceRun(runId,ctx()).status).toBe('CANCEL_REQUESTED');expect(()=>resumeScienceRun(runId,ctx())).toThrow('DAG_RESUME_NOT_READY');await work;
 expect(scienceRunStatus(runId,ctx()).status).toBe('CANCELLED');resumeScienceRun(runId,ctx());expect((await drain(runId)).status).toBe('SUCCEEDED');expect(scienceRunStatus(runId,ctx()).nodes[0].output).toEqual(ref);
});
it('recovers expired leases and fences stale workers instead of committing their output',async()=>{
 const {runId}=submitSciencePlan(plan(),'lease',ctx());let start!:()=>void,release!:()=>void;const ready=new Promise<void>(r=>start=r),paused=new Promise<void>(r=>release=r);
 const work=runScienceWorkerTick('old',async(op,inputs,params,window,context)=>{start();await paused;return executeScienceOperation(op,inputs,params,window,context);});await ready;
 withBusinessDb(db=>db.prepare('UPDATE biz_science_runs SET lease_until=0 WHERE run_id=?').run(runId));await runScienceWorkerTick('new');const checkpoint=scienceRunStatus(runId,ctx()).nodes[0].output;release();await work;expect(scienceRunStatus(runId,ctx()).nodes[0].output).toEqual(checkpoint);expect(scienceRunStatus(runId,ctx()).events.some((e:any)=>e.type==='LEASE_RECOVERED')).toBe(true);expect((await drain(runId)).status).toBe('SUCCEEDED');
});
it('revalidates owner, role, scope, dataset and artifact expiry on read/resume/worker',async()=>{
 const {runId}=submitSciencePlan(plan(),'auth',ctx());const foreign=ctx();foreign.principal={...foreign.principal,userId:'other'};expect(()=>cancelScienceRun(runId,foreign)).toThrow('FORBIDDEN_SCIENCE_RUN_OWNER');
 const changedRole=ctx();changedRole.principal={...changedRole.principal,role:'CITY_EXPERT',jurisdiction:{city:'郑州市'}};expect(()=>scienceRunStatus(runId,changedRole)).toThrow('FORBIDDEN_SCIENCE_ROLE_CHANGED');
 await runScienceWorkerTick('a');cancelScienceRun(runId,ctx());withBusinessDb(db=>db.prepare('UPDATE biz_scientific_artifacts SET expires_at=1').run());expect(()=>resumeScienceRun(runId,ctx())).toThrow('ARTIFACT_EXPIRED');
});
it('detects plan tampering, fails insufficient data without synthetic repairs and integrates the regular Worker',async()=>{
 const input=plan();input.nodes=[input.nodes[0],input.nodes[1]];const {runId}=submitSciencePlan(input,'worker',ctx());expect((await runWorkerTick('regular')).worked).toBe(true);
 withBusinessDb(db=>db.prepare('UPDATE biz_science_runs SET plan_json=? WHERE run_id=?').run('{}',runId));const tick=await runScienceWorkerTick('a');expect(tick.error).toBe('DAG_PLAN_INTEGRITY_FAILED');
 const short=plan();short.nodes[0].params.maxRecords=1;const next=submitSciencePlan(short,'truncated',ctx());await runScienceWorkerTick('a');expect(scienceRunStatus(next.runId,ctx()).error).toBe('ARTIFACT_INCOMPLETE');
});
it('exposes artifact kernels and DAG as unified validated skills while LSTM stays unavailable',async()=>{
 const compile=await executeSkill('skill_scientific_dag',{action:'compile',plan:plan()},ctx());expect(compile.status,JSON.stringify(compile.error)).toBe('SUCCESS');
 const {runId}=submitSciencePlan(plan(),'entry',ctx());await runScienceWorkerTick('a');const ref=scienceRunStatus(runId,ctx()).nodes[0].output;
 const scan=await executeSkill('skill_scientific_scan',{inputs:{measurements:ref},params:{exposure:'record',simulations:99},window:{from:'2024-06-01',to:'2024-06-30'}},ctx());expect(scan.status).toBe('SUCCESS');
 const selection=await executeSkill('skill_scan_member_select',{inputs:{scan:(scan.payload as any).data.artifactRef},params:{}},ctx());expect(selection.status).toBe('SUCCESS');
 const matrix=await executeSkill('skill_feature_matrix_build',{measurementsRef:ref,selectionRef:(selection.payload as any).data.artifactRef,metric:'capture-per-record',features:['metric']},ctx());expect(matrix.status).toBe('SUCCESS');
 const clusters=await executeSkill('skill_scientific_kmeans',{inputs:{matrix:(matrix.payload as any).data.artifactRef},params:{k:3}},ctx());expect(clusters.status).toBe('SUCCESS');
 expect(listSkillDefinitions('vector').filter(s=>/lstm/i.test(s.id)).every(s=>s.availability==='planned')).toBe(true);expect(listSkillDefinitions('vector').find(s=>s.id==='skill_composable_workflow')).toMatchObject({availability:'available',implementationStatus:'partial',validationStatus:'contract'});
 expect(scientificHash((compile.payload as any).data.plan)).toHaveLength(64);
});

it('revalidates live authenticated identities and source metadata before the first node',async()=>{
 const principal=createUser({username:'dag-worker-user',password:'phase-three-test-passphrase',role:'CITY_EXPERT',organizationId:'dag-org',domainGrants:['vector'],jurisdiction:{city:'郑州市'}});
 const owner={...ctx(),principal};const {runId}=submitSciencePlan(plan(),'live-auth',owner);
 withBusinessDb(db=>db.prepare('UPDATE biz_users SET disabled=1 WHERE user_id=?').run(principal.userId));
 const result=await runScienceWorkerTick('live');expect(result.error).toBe('User disabled or missing');expect(withBusinessDb(db=>db.prepare('SELECT status FROM biz_science_runs WHERE run_id=?').get(runId))).toEqual({status:'FAILED'});
 const next=submitSciencePlan(plan(),'metadata-change',ctx());const file=process.env.DATASET_MANIFEST_PATH!,before=readFileSync(file,'utf8'),manifest=JSON.parse(before);manifest.find((d:any)=>d.domain==='vector').asOf='2026-10-13';writeFileSync(file,JSON.stringify(manifest));
 expect((await runScienceWorkerTick('live')).error).toBe('DAG_DATASET_VERSION_CHANGED');writeFileSync(file,before);expect(scienceRunStatus(next.runId,ctx()).status).toBe('FAILED');
});
it('forbids future member selection in earlier histories and keeps one selected cluster fixed',async()=>{
 const invalid=plan();invalid.nodes[6].window!.to='2024-05-31';expect(()=>compileSciencePlan(invalid,ctx())).toThrow('DAG_MEMBERSHIP_LOOKAHEAD');
 const input=plan();input.nodes[5].params.labels=[0];const {runId}=submitSciencePlan(input,'subset',ctx());const complete=await drain(runId);expect(complete.status).toBe('SUCCEEDED');
 const fixed=readScientificArtifact(complete.nodes.find(n=>n.nodeId==='fixed')!.output,ctx(),{kind:'SelectionSet'});
 const history=readScientificArtifact(complete.nodes.at(-1)!.output,ctx(),{kind:'SeriesSet',requireFinite:true});expect(fixed.data.locationKeys.length).toBeGreaterThan(0);expect(fixed.data.locationKeys.length).toBeLessThan(4);expect([...new Set(history.data.series.map(s=>s.locationKey))].sort()).toEqual(fixed.data.locationKeys);
});
it('honours retry delays and run retention without extending an old checkpoint',async()=>{
 const input=plan();input.nodes[0].retry={maxAttempts:3,delayMs:60000};const {runId}=submitSciencePlan(input,'delay',ctx());
 await runScienceWorkerTick('a',async()=>{throw Error('KERNEL_TIMEOUT');});expect((await runScienceWorkerTick('b')).worked).toBe(false);
 withBusinessDb(db=>db.prepare('UPDATE biz_science_nodes SET next_attempt_at=0 WHERE run_id=?').run(runId));await runScienceWorkerTick('a');const status=scienceRunStatus(runId,ctx());
 const artifact=readScientificArtifact(status.nodes[0].output,ctx(),{kind:'Measurements'});const created=withBusinessDb(db=>db.prepare('SELECT created_at FROM biz_science_runs WHERE run_id=?').get(runId)) as any;expect(artifact.expiresAt).toBe(created.created_at+7*86400000);
 cancelScienceRun(runId,ctx());withBusinessDb(db=>db.prepare('UPDATE biz_science_runs SET created_at=? WHERE run_id=?').run(Date.now()-8*86400000,runId));expect(()=>resumeScienceRun(runId,ctx())).toThrow('DAG_RUN_EXPIRED');
});

it('runs an independent ready branch while another node waits for retry',async()=>{
 const input=plan();input.nodes[0].retry={maxAttempts:3,delayMs:60000};input.nodes.push({id:'independent',operation:'measurements',inputs:{},params:{}});
 const {runId}=submitSciencePlan(input,'independent-retry',ctx());await runScienceWorkerTick('a',async()=>{throw Error('KERNEL_TIMEOUT');});await runScienceWorkerTick('b');
 const status=scienceRunStatus(runId,ctx());expect(status.nodes.find(n=>n.nodeId==='history')!.status).toBe('RETRY_WAIT');expect(status.nodes.find(n=>n.nodeId==='independent')!.status).toBe('SUCCEEDED');expect((await runScienceWorkerTick('b')).status).toBe('WAITING_RETRY');
 withBusinessDb(db=>db.prepare('UPDATE biz_science_nodes SET next_attempt_at=0 WHERE run_id=?').run(runId));expect((await drain(runId)).status).toBe('SUCCEEDED');
});
it('checks live identity again before committing a node completed during revocation',async()=>{
 const principal=createUser({username:'dag-revoke-user',password:'phase-three-test-passphrase',role:'CITY_EXPERT',organizationId:'dag-org',domainGrants:['vector'],jurisdiction:{city:'郑州市'}});
 const {runId}=submitSciencePlan(plan(),'mid-revoke',{...ctx(),principal});let started!:()=>void,release!:()=>void;const ready=new Promise<void>(r=>started=r),hold=new Promise<void>(r=>release=r);
 const work=runScienceWorkerTick('live',async(op,inputs,params,window,context)=>{const artifact=await executeScienceOperation(op,inputs,params,window,context);started();await hold;return artifact;});await ready;
 withBusinessDb(db=>db.prepare('UPDATE biz_users SET disabled=1 WHERE user_id=?').run(principal.userId));release();expect((await work).error).toBe('User disabled or missing');
 expect(withBusinessDb(db=>db.prepare('SELECT status,output_json FROM biz_science_nodes WHERE run_id=? AND node_id=?').get(runId,'history'))).toEqual({status:'FAILED',output_json:null});
});
