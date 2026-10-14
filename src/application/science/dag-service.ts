import {randomUUID} from 'node:crypto';
import type {ExecutionContext} from '@/contracts/execution-context';
import type {ArtifactRef} from '@/contracts/scientific-artifact';
import type {SciencePlan,CompiledSciencePlan,ScienceCheckpoint} from '@/contracts/scientific-dag';
import {assertPrincipal} from '@/infrastructure/auth/authorization';
import {principalForUser} from '@/infrastructure/auth/session';
import {getDeploymentTier} from '@/application/config/deployment-tier';
import {loadDatasetManifest,resolveDatasetLocation} from '@/infrastructure/db/dataset-manifest';
import {assertDatasetReadable,assertResultSources} from '@/infrastructure/db/dataset-policy';
import {withBusinessDb} from '@/infrastructure/db/business-store';
import {freezeJobScope,restoreJobScope} from '@/application/jobs/frozen-scope';
import {compileSciencePlan} from './dag-compiler';
import {readScientificArtifact,scientificHash} from './artifact-store';
import {executeScienceOperation,operationOutputs,type ScienceOperation} from './operations';
interface RunRow {run_id:string;user_id:string;organization_id:string;domain:string;source_role:string;principal_json:string;scope_json:string;dataset_refs_json:string;plan_json:string;plan_hash:string;status:string;lease_token:string|null;lease_until:number|null;error:string|null;created_at:number;}
interface NodeRow {node_id:string;status:ScienceCheckpoint['status'];attempts:number;retries:number;next_attempt_at:number;output_json:string|null;error:string|null;}
const leaseMs=15000;
function event(db:Parameters<Parameters<typeof withBusinessDb>[0]>[0],runId:string,type:string,nodeId:string|null=null,details:unknown={}){db.prepare('INSERT INTO biz_science_events(run_id,node_id,type,details_json,created_at) VALUES(?,?,?,?,?)').run(runId,nodeId,type,JSON.stringify(details),Date.now());}
function ownedRun(runId:string,ctx:ExecutionContext):RunRow{
 assertPrincipal(ctx);if(ctx.domain!=='vector'||ctx.principal.role==='PUBLIC_VIEWER')throw Error('FORBIDDEN_SCIENCE_DAG');
 const row=withBusinessDb(db=>db.prepare('SELECT * FROM biz_science_runs WHERE run_id=? AND user_id=? AND organization_id=? AND domain=?').get(runId,ctx.principal.userId,ctx.principal.organizationId,ctx.domain)) as RunRow|undefined;
 if(!row)throw Error('FORBIDDEN_SCIENCE_RUN_OWNER');if(row.source_role!==ctx.principal.role)throw Error('FORBIDDEN_SCIENCE_ROLE_CHANGED');
 ctx.approvedIntent=restoreJobScope(JSON.parse(row.scope_json),ctx);return row;
}
function planFor(row:RunRow,ctx:ExecutionContext):CompiledSciencePlan{
 const datasets=loadDatasetManifest().filter(d=>d.domain===ctx.domain);if(scientificHash(datasets)!==scientificHash(JSON.parse(row.dataset_refs_json)))throw Error('DAG_DATASET_VERSION_CHANGED');assertResultSources(datasets,ctx.deploymentTier);
 const plan=JSON.parse(row.plan_json);if(scientificHash(plan)!==row.plan_hash)throw Error('DAG_PLAN_INTEGRITY_FAILED');const recompiled=compileSciencePlan(plan,ctx);if(scientificHash(recompiled)!==row.plan_hash)throw Error('DAG_COMPILER_VERSION_CHANGED');return recompiled;
}
function nodeRows(runId:string):NodeRow[]{return withBusinessDb(db=>db.prepare('SELECT * FROM biz_science_nodes WHERE run_id=?').all(runId)) as NodeRow[];}
function checkOutputs(nodes:NodeRow[],ctx:ExecutionContext){for(const node of nodes)if(node.status==='SUCCEEDED'){if(!node.output_json)throw Error('DAG_CHECKPOINT_INVALID');const ref=JSON.parse(node.output_json) as ArtifactRef;readScientificArtifact(ref,ctx,{kind:ref.kind});}}
export function submitSciencePlan(plan:SciencePlan,requestKey:string,ctx:ExecutionContext){
 if(!requestKey.trim()||requestKey.length>200)throw Error('DAG_REQUEST_KEY_REQUIRED');const compiled=compileSciencePlan(plan,ctx),hash=scientificHash(compiled);
 const datasets=loadDatasetManifest().filter(d=>d.domain===ctx.domain);assertDatasetReadable(resolveDatasetLocation(ctx.domain),ctx.deploymentTier);assertResultSources(datasets,ctx.deploymentTier);
 return withBusinessDb(db=>db.transaction(()=>{
  const prior=db.prepare('SELECT * FROM biz_science_runs WHERE user_id=? AND organization_id=? AND domain=? AND request_key=?').get(ctx.principal.userId,ctx.principal.organizationId,ctx.domain,requestKey) as RunRow|undefined;
  if(prior){if(scientificHash(JSON.parse(prior.dataset_refs_json))!==scientificHash(datasets)||prior.plan_hash!==hash||prior.source_role!==ctx.principal.role||JSON.parse(prior.scope_json).fingerprint!==ctx.approvedIntent!.fingerprint)throw Error('DAG_IDEMPOTENCY_CONFLICT');return {runId:prior.run_id,status:prior.status,reused:true};}
  const id=randomUUID(),now=Date.now();db.prepare('INSERT INTO biz_science_runs(run_id,user_id,organization_id,domain,source_role,principal_json,scope_json,dataset_refs_json,plan_json,plan_hash,request_key,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,ctx.principal.userId,ctx.principal.organizationId,ctx.domain,ctx.principal.role,JSON.stringify(ctx.principal),JSON.stringify(freezeJobScope(ctx.approvedIntent!)),JSON.stringify(datasets),JSON.stringify(compiled),hash,requestKey,'QUEUED',now,now);
  for(const node of compiled.nodes)db.prepare('INSERT INTO biz_science_nodes(run_id,node_id,status) VALUES(?,?,?)').run(id,node.id,'PENDING');event(db,id,'COMPILED',null,{planHash:hash,nodes:compiled.nodes.length});return {runId:id,status:'QUEUED',reused:false};
 }).immediate());
}
export function scienceRunStatus(runId:string,ctx:ExecutionContext){const row=ownedRun(runId,ctx),plan=planFor(row,ctx),nodes=nodeRows(runId);let checkpointError:string|null=null;try{checkOutputs(nodes,ctx);}catch(error){checkpointError=error instanceof Error?error.message:'DAG_CHECKPOINT_INVALID';}return {runId,status:row.status,error:row.error,checkpointError,nodes:plan.nodes.map(n=>{const state=nodes.find(s=>s.node_id===n.id)!;return {nodeId:n.id,operation:n.operation,window:n.window,status:state.status,attempts:state.attempts,output:state.output_json?JSON.parse(state.output_json):null,error:state.error};}),events:withBusinessDb(db=>db.prepare('SELECT node_id,type,details_json,created_at FROM biz_science_events WHERE run_id=? ORDER BY event_id DESC LIMIT 100').all(runId))};}
export function cancelScienceRun(runId:string,ctx:ExecutionContext){ownedRun(runId,ctx);return withBusinessDb(db=>db.transaction(()=>{
 const row=db.prepare('SELECT status,lease_until FROM biz_science_runs WHERE run_id=?').get(runId) as any;if(['SUCCEEDED','FAILED','CANCELLED'].includes(row.status))return {runId,status:row.status};
 const active=row.lease_until>Date.now(),status=active?'CANCEL_REQUESTED':'CANCELLED';db.prepare('UPDATE biz_science_runs SET status=?,updated_at=? WHERE run_id=?').run(status,Date.now(),runId);
 if(!active){db.prepare('UPDATE biz_science_runs SET lease_token=NULL,lease_until=NULL WHERE run_id=?').run(runId);db.prepare("UPDATE biz_science_nodes SET status='CANCELLED' WHERE run_id=? AND status IN ('PENDING','RUNNING','RETRY_WAIT')").run(runId);}event(db,runId,status);return {runId,status};
 }).immediate());}
export function resumeScienceRun(runId:string,ctx:ExecutionContext){const row=ownedRun(runId,ctx);if(row.created_at+7*86400000<=Date.now())throw Error('DAG_RUN_EXPIRED');planFor(row,ctx);checkOutputs(nodeRows(runId),ctx);return withBusinessDb(db=>db.transaction(()=>{
 const current=db.prepare('SELECT status,lease_until FROM biz_science_runs WHERE run_id=?').get(runId) as any;if(!['FAILED','CANCELLED'].includes(current.status)||current.lease_until>Date.now())throw Error('DAG_RESUME_NOT_READY');
 db.prepare("UPDATE biz_science_nodes SET status='PENDING',retries=0,next_attempt_at=0,error=NULL WHERE run_id=? AND status IN ('FAILED','CANCELLED','RETRY_WAIT','RUNNING')").run(runId);
 db.prepare("UPDATE biz_science_runs SET status='QUEUED',lease_token=NULL,lease_until=NULL,error=NULL,updated_at=? WHERE run_id=?").run(Date.now(),runId);event(db,runId,'RESUMED');return {runId,status:'QUEUED'};
 }).immediate());}
function claimScienceRun(owner:string):RunRow|undefined{return withBusinessDb(db=>db.transaction(()=>{
 const now=Date.now();
 // Cancellation of an abandoned worker cannot wait for that process to return.
 const abandoned=db.prepare("SELECT run_id FROM biz_science_runs WHERE status='CANCEL_REQUESTED' AND lease_until<=?").all(now) as {run_id:string}[];
 for(const r of abandoned){db.prepare("UPDATE biz_science_nodes SET status='CANCELLED' WHERE run_id=? AND status IN ('PENDING','RUNNING','RETRY_WAIT')").run(r.run_id);db.prepare("UPDATE biz_science_runs SET status='CANCELLED',lease_token=NULL,lease_until=NULL WHERE run_id=?").run(r.run_id);event(db,r.run_id,'CANCELLED');}
 const row=db.prepare("SELECT r.* FROM biz_science_runs r WHERE r.status IN ('QUEUED','RUNNING') AND (r.lease_until IS NULL OR r.lease_until<=?) AND (EXISTS (SELECT 1 FROM biz_science_nodes n WHERE n.run_id=r.run_id AND n.status IN ('PENDING','RUNNING')) OR NOT EXISTS (SELECT 1 FROM biz_science_nodes n WHERE n.run_id=r.run_id AND n.status='RETRY_WAIT' AND n.next_attempt_at>?)) ORDER BY r.updated_at,r.created_at LIMIT 1").get(now,now) as RunRow|undefined;if(!row)return;
 const token=owner+':'+randomUUID();db.prepare("UPDATE biz_science_runs SET status='RUNNING',lease_token=?,lease_until=?,updated_at=? WHERE run_id=?").run(token,now+leaseMs,now,row.run_id);
 for(const n of db.prepare("SELECT node_id FROM biz_science_nodes WHERE run_id=? AND status='RUNNING'").all(row.run_id) as {node_id:string}[]){db.prepare("UPDATE biz_science_nodes SET status='RETRY_WAIT',retries=retries+1,next_attempt_at=0,error='WORKER_LEASE_EXPIRED' WHERE run_id=? AND node_id=?").run(row.run_id,n.node_id);event(db,row.run_id,'LEASE_RECOVERED',n.node_id);}
 return {...row,status:'RUNNING',lease_token:token,lease_until:now+leaseMs};
 }).immediate());}
function condition(ref:ArtifactRef,test:'has-members'|'empty'|'finite',ctx:ExecutionContext):boolean{
 const a=readScientificArtifact(ref,ctx,{kind:ref.kind}),d=a.data as any;
 if(test==='finite'){const values=a.ref.kind==='FeatureMatrix'?d.values.flat():d.series.flatMap((s:any)=>s.points.map((p:any)=>p.value));return values.length>0&&values.every((v:any)=>typeof v==='number'&&Number.isFinite(v));}
 const count=a.ref.kind==='ScanResult'?d.clusters.reduce((n:number,c:any)=>n+c.locationKeys.length,0):a.ref.kind==='SelectionSet'?d.locationKeys.length:d.assignments.length;return test==='empty'?count===0:count>0;
}
/** One leased node per tick. All externally visible checkpoints use the lease token as a fence. */
export async function runScienceWorkerTick(owner:string,execute=executeScienceOperation){
 const row=claimScienceRun(owner);if(!row)return {worked:false};const id=row.run_id,token=row.lease_token!;const controller=new AbortController();let ctx:ExecutionContext|undefined,nodeId:string|undefined;
 const heartbeat=()=>withBusinessDb(db=>{const state=db.prepare('SELECT status,lease_token FROM biz_science_runs WHERE run_id=?').get(id) as any;if(state?.lease_token!==token||state.status!=='RUNNING'){controller.abort();return false;}return db.prepare('UPDATE biz_science_runs SET lease_until=? WHERE run_id=? AND lease_token=?').run(Date.now()+leaseMs,id,token).changes===1;});
 const timer=setInterval(()=>{try{heartbeat();}catch{controller.abort();}},2000);
 const commit=(operation:(db:Parameters<Parameters<typeof withBusinessDb>[0]>[0])=>void)=>withBusinessDb(db=>db.transaction(()=>{const current=db.prepare('SELECT status,lease_token FROM biz_science_runs WHERE run_id=?').get(id) as any;if(current.lease_token!==token||current.status!=='RUNNING')throw Error('SCIENCE_LEASE_LOST');operation(db);}).immediate());
 try{
  const stored=JSON.parse(row.principal_json),tier=getDeploymentTier();if(stored.mode!=='authenticated'&&tier==='pilot')throw Error('FORBIDDEN_SCIENCE_DEVELOPMENT_PRINCIPAL');
  const principal=stored.mode==='authenticated'?principalForUser(stored.userId):stored;ctx={runId:id,domain:'vector',deploymentTier:tier,principal,signal:controller.signal,deadlineAt:Date.now()+120000,frozenScopeExecution:true};
  if(row.created_at+7*86400000<=Date.now())throw Error('DAG_RUN_EXPIRED');ctx.scientificArtifactExpiresAt=row.created_at+7*86400000;
  ownedRun(id,ctx);const plan=planFor(row,ctx),states=nodeRows(id);checkOutputs(states,ctx);const byId=new Map(states.map(n=>[n.node_id,n]));
  const node=plan.nodes.find(n=>['PENDING','RETRY_WAIT'].includes(byId.get(n.id)!.status)&&byId.get(n.id)!.next_attempt_at<=Date.now()&&[...Object.values(n.inputs),...(n.when?[n.when.node]:[])].every(dep=>['SUCCEEDED','SKIPPED'].includes(byId.get(dep)!.status)));
  if(!node){if(states.every(n=>['SUCCEEDED','SKIPPED'].includes(n.status))){commit(db=>{db.prepare("UPDATE biz_science_runs SET status='SUCCEEDED',updated_at=? WHERE run_id=?").run(Date.now(),id);event(db,id,'SUCCEEDED');});return {worked:true,runId:id,status:'SUCCEEDED'};}if(states.some(n=>n.status==='RETRY_WAIT'&&n.next_attempt_at>Date.now()))return {worked:false,runId:id,status:'WAITING_RETRY'};throw Error('DAG_NO_RUNNABLE_NODE');}
  nodeId=node.id;const state=byId.get(nodeId)!;
  if(state.retries>=node.retry.maxAttempts)throw Error('DAG_RETRIES_EXHAUSTED');
  const deps=[...Object.values(node.inputs),...(node.when?[node.when.node]:[])];const skip=deps.some(d=>byId.get(d)!.status==='SKIPPED')||node.when&&!condition(JSON.parse(byId.get(node.when.node)!.output_json!),node.when.test,ctx);
  if(skip){commit(db=>{db.prepare("UPDATE biz_science_nodes SET status='SKIPPED',finished_at=? WHERE run_id=? AND node_id=?").run(Date.now(),id,nodeId!);event(db,id,'SKIPPED',nodeId!,{reason:'condition-or-upstream-skip'});});return {worked:true,runId:id,nodeId,status:'SKIPPED'};}
  commit(db=>{db.prepare("UPDATE biz_science_nodes SET status='RUNNING',attempts=attempts+1,started_at=?,error=NULL WHERE run_id=? AND node_id=?").run(Date.now(),id,nodeId!);event(db,id,'NODE_STARTED',nodeId!);});
  ctx.callId=nodeId;const inputs=Object.fromEntries(Object.entries(node.inputs).map(([port,dep])=>[port,JSON.parse(byId.get(dep)!.output_json!)]));
  const artifact=await execute(node.operation as ScienceOperation,inputs,node.operation==='measurements'?{...plan.scope,...node.params}:node.params,node.window,ctx);
  controller.signal.throwIfAborted();if(ctx.principal.mode==='authenticated'){ctx.principal=principalForUser(ctx.principal.userId);ownedRun(id,ctx);}if(!heartbeat())throw Error('SCIENCE_LEASE_LOST');if(artifact.ref.kind!==operationOutputs[node.operation as ScienceOperation]||artifact.timeWindow.from!==node.window.from||artifact.timeWindow.to!==node.window.to)throw Error('DAG_OUTPUT_CONTRACT_INVALID');readScientificArtifact(artifact.ref,ctx,{kind:artifact.ref.kind});
  commit(db=>{db.prepare("UPDATE biz_science_nodes SET status='SUCCEEDED',output_json=?,finished_at=? WHERE run_id=? AND node_id=?").run(JSON.stringify(artifact.ref),Date.now(),id,nodeId!);event(db,id,'NODE_SUCCEEDED',nodeId!,{artifactRef:artifact.ref,qualityFlags:artifact.qualityFlags});});
  return {worked:true,runId:id,nodeId,status:'SUCCEEDED'};
 }catch(error){
  const message=error instanceof Error?error.message:'DAG_EXECUTION_FAILED';withBusinessDb(db=>db.transaction(()=>{
   const current=db.prepare('SELECT status,lease_token FROM biz_science_runs WHERE run_id=?').get(id) as any;if(current.lease_token!==token||!['RUNNING','CANCEL_REQUESTED'].includes(current.status))return;
   if(current.status==='CANCEL_REQUESTED'){db.prepare("UPDATE biz_science_nodes SET status='CANCELLED' WHERE run_id=? AND status IN ('PENDING','RUNNING','RETRY_WAIT')").run(id);db.prepare("UPDATE biz_science_runs SET status='CANCELLED' WHERE run_id=?").run(id);event(db,id,'CANCELLED',nodeId??null);return;}
   let failedPlan:CompiledSciencePlan|undefined;try{const candidate=JSON.parse(row.plan_json);if(Array.isArray(candidate.nodes))failedPlan=candidate;}catch{/* Integrity errors must themselves remain persistable. */}
   const node=failedPlan?.nodes.find(n=>n.id===nodeId),state=nodeId?db.prepare('SELECT retries FROM biz_science_nodes WHERE run_id=? AND node_id=?').get(id,nodeId) as any:null;
   const retryable=['KERNEL_TIMEOUT','KERNEL_PROCESS_FAILED','SQLITE_BUSY','MEASUREMENT_DEADLINE'].some(code=>message.startsWith(code));
   if(node&&retryable&&state.retries+1<node.retry.maxAttempts){db.prepare("UPDATE biz_science_nodes SET status='RETRY_WAIT',retries=retries+1,next_attempt_at=?,error=? WHERE run_id=? AND node_id=?").run(Date.now()+node.retry.delayMs,message,id,nodeId!);event(db,id,'NODE_RETRY',nodeId!,{error:message});}
   else {if(nodeId)db.prepare("UPDATE biz_science_nodes SET status='FAILED',error=?,finished_at=? WHERE run_id=? AND node_id=?").run(message,Date.now(),id,nodeId);db.prepare("UPDATE biz_science_runs SET status='FAILED',error=? WHERE run_id=?").run(message,id);event(db,id,'FAILED',nodeId??null,{error:message});}
  }).immediate());return {worked:true,runId:id,nodeId,status:'RETRY_OR_FAILED',error:message};
 }finally{clearInterval(timer);withBusinessDb(db=>db.prepare('UPDATE biz_science_runs SET lease_token=NULL,lease_until=NULL,updated_at=? WHERE run_id=? AND lease_token=?').run(Date.now(),id,token));}
}
