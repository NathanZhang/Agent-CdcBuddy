import {createHash,randomUUID} from 'node:crypto';
import type {ExecutionContext} from '@/contracts/execution-context';
import {assertPrincipal,authorizeScope} from '@/infrastructure/auth/authorization';
import {withBusinessDb} from '@/infrastructure/db/business-store';
import {getDomainRepository} from '@/infrastructure/db/domain-repository';
import {scopeFromArgs} from '@/domains/shared/skill-factory';
import {workflowDataset} from '@/application/jobs/workflow-provenance';
import {validateImage} from './species-recognition';
function access(ctx:ExecutionContext){assertPrincipal(ctx);if(ctx.domain!=='env'||ctx.principal.role==='PUBLIC_VIEWER')throw Error('FORBIDDEN_ENV_SAMPLING');}
export function environmentTasks(ctx:ExecutionContext){access(ctx);return withBusinessDb(db=>(db.prepare('SELECT * FROM biz_environment_tasks WHERE user_id=? AND organization_id=? ORDER BY created_at DESC LIMIT 100').all(ctx.principal.userId,ctx.principal.organizationId) as any[]).filter(t=>(!ctx.principal.jurisdiction.city||t.city===ctx.principal.jurisdiction.city)&&(!ctx.principal.jurisdiction.district||t.district===ctx.principal.jurisdiction.district)));}
export function assignEnvironmentTasks(args:Record<string,any>,ctx:ExecutionContext){access(ctx);workflowDataset(ctx);const rows=getDomainRepository('env').query('SELECT sample_code,city,district,task_type FROM fact_env_mobile_tasks',[],scopeFromArgs(args,ctx));withBusinessDb(db=>db.transaction(()=>{for(const r of rows)db.prepare('INSERT OR IGNORE INTO biz_environment_tasks VALUES(?,?,?,?,?,?,?,?,?,NULL)').run(randomUUID(),ctx.principal.userId,ctx.principal.organizationId,r.city,r.district,r.sample_code,r.task_type,'PENDING',Date.now());})());return environmentTasks(ctx);}
export interface EnvironmentSample {clientKey:string;taskId?:string;city:string;district:string;sampleCode:string;sampledAt:string;indicator:'lead'|'turbidity'|'pm25';value:number;unit:'mg/L'|'NTU'|'ug/m3';photoDataUrl?:string;}
export function submitEnvironmentSample(input:EnvironmentSample,ctx:ExecutionContext){
 access(ctx);authorizeScope(input,ctx);workflowDataset(ctx);
 if(!input||!/^[-a-zA-Z0-9_]{8,100}$/.test(input.clientKey)||!/^[-a-zA-Z0-9_]{1,100}$/.test(input.sampleCode)||!input.city?.trim()||!input.district?.trim()||!Number.isFinite(input.value)||input.value<0||!['lead','turbidity','pm25'].includes(input.indicator)||({lead:'mg/L',turbidity:'NTU',pm25:'ug/m3'}[input.indicator]!==input.unit)||!Number.isFinite(Date.parse(input.sampledAt))||Date.parse(input.sampledAt)>Date.now()+300000)throw Error('INVALID_ENV_SAMPLE');
 const photoHash=input.photoDataUrl?validateImage(input.photoDataUrl):null;
 const canonical={clientKey:input.clientKey,taskId:input.taskId??null,city:input.city,district:input.district,sampleCode:input.sampleCode,sampledAt:new Date(input.sampledAt).toISOString(),indicator:input.indicator,value:input.value,unit:input.unit,photoHash};const hash=createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
 return withBusinessDb(db=>db.transaction(()=>{
 const prior=db.prepare('SELECT * FROM biz_environment_samples WHERE user_id=? AND organization_id=? AND client_key=?').get(ctx.principal.userId,ctx.principal.organizationId,input.clientKey) as any;
 if(prior){if(prior.payload_sha256!==hash)throw Error('IDEMPOTENCY_CONFLICT');return {sampleId:prior.sample_id,taskId:prior.task_id,status:'SUBMITTED',replayed:true,photoSha256:prior.photo_sha256};}
 if(input.taskId){const task=db.prepare('SELECT * FROM biz_environment_tasks WHERE task_id=? AND user_id=? AND organization_id=?').get(input.taskId,ctx.principal.userId,ctx.principal.organizationId) as any;if(!task||task.city!==input.city||task.district!==input.district||task.sample_code!==input.sampleCode)throw Error('FORBIDDEN_SAMPLE_TASK');if(task.status==='COMPLETED')throw Error('TASK_ALREADY_COMPLETED');}
 const id=randomUUID(),now=Date.now();db.prepare('INSERT INTO biz_environment_samples VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,ctx.principal.userId,ctx.principal.organizationId,input.clientKey,input.taskId??null,input.city,input.district,input.sampleCode,canonical.sampledAt,input.indicator,input.value,input.unit,input.photoDataUrl??null,photoHash,hash,now);
 if(input.taskId)db.prepare("UPDATE biz_environment_tasks SET status='COMPLETED',completed_at=? WHERE task_id=?").run(now,input.taskId);
 return {sampleId:id,taskId:input.taskId??null,status:'SUBMITTED',replayed:false,photoSha256:photoHash};
 }).immediate());
}
