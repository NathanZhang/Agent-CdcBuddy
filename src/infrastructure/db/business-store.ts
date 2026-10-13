import {assertResultSources} from './dataset-policy';
import {turnDatasetRefs} from '@/application/jobs/workflow-provenance';
import {assertPrincipal,restrictColumns} from '@/infrastructure/auth/authorization';
import {assertCachedQueryColumns} from '@/infrastructure/query/query-gateway';
import {getDomainRepository} from './domain-repository';
import {readAuthorizedQuerySource} from '@/application/geo/query-source-store';
import {ensureBusinessInitialized} from './migrations';
import Database from 'better-sqlite3';
import { createHash,randomUUID } from 'node:crypto';
import path from 'node:path';
import type { ExecutionContext } from '@/contracts/execution-context';
import type { AgentTurnResult,AgentInteraction } from '@/contracts/agent-interaction';
export function withBusinessDb<T>(operation:(db:Database.Database)=>T):T{
 const file=path.resolve(process.env.APP_BUSINESS_DB_PATH ?? path.join(process.cwd(),'app_business.db'));ensureBusinessInitialized(file);const db=new Database(file,{fileMustExist:true});
 try{return operation(db);}finally{db.close();}
}
export function recordAgentTurn(interaction:AgentInteraction,result:AgentTurnResult,ctx:ExecutionContext){return withBusinessDb(db=>{db.prepare('INSERT OR REPLACE INTO biz_agent_runs VALUES(?,?,?,?,?,?)').run(ctx.runId,ctx.principal.userId,ctx.domain,JSON.stringify(interaction),JSON.stringify(result),new Date().toISOString());});}
export function getRecordedTurn(runId:string,ctx:ExecutionContext):{interaction:AgentInteraction;result:AgentTurnResult}{return withBusinessDb(db=>{const row=db.prepare('SELECT * FROM biz_agent_runs WHERE run_id=? AND user_id=? AND domain=?').get(runId,ctx.principal.userId,ctx.domain) as any;if(!row)throw new Error('Recorded run not found or unauthorized');const result=JSON.parse(row.result_json);if([...result.skillRuns.map((s:any)=>s.result),...(result.agui??[]).map((a:any)=>a.result)].some((e:any)=>e.payload!==null&&!['local-administrative-map-v1','verified-map-annotation-v1','skill_session_manage-v1','skill_session_journal-v1','skill_catalog_manage-v1'].includes(e.method)))assertResultSources(turnDatasetRefs(result),ctx.deploymentTier);return {interaction:JSON.parse(row.interaction_json),result};});}
export function saveArtifact(input:{fileName:string;mimeType:string;content:Buffer;source:unknown;city?:string;district?:string},ctx:ExecutionContext){return withBusinessDb(db=>{
 assertResultSources((input.source as any)?.datasets??(input.source as any)?.metadata?.datasets,ctx.deploymentTier);
 const id=randomUUID();const sha256=createHash('sha256').update(input.content).digest('hex');
 const fileName=Array.from(input.fileName).filter(char=>char.charCodeAt(0)>=32).join('').slice(0,160);if(!fileName)throw new Error('Invalid artifact filename');
 db.prepare('INSERT INTO biz_artifacts VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(id,ctx.principal.userId,ctx.domain,input.city ?? ctx.principal.jurisdiction.city ?? null,input.district ?? ctx.principal.jurisdiction.district ?? null,fileName,input.mimeType,input.content,sha256,JSON.stringify({...input.source as object,authorization:{userId:ctx.principal.userId,organizationId:ctx.principal.organizationId,role:ctx.principal.role}}),new Date().toISOString());
 return {artifactId:id,fileName,mimeType:input.mimeType,byteLength:input.content.byteLength,sha256,downloadUrl:`/api/artifacts/${id}`};
 });}
export function getArtifact(id:string,ctx:ExecutionContext):{content:Buffer;file_name:string;mime_type:string}{assertPrincipal(ctx);return withBusinessDb(db=>{const row=db.prepare('SELECT * FROM biz_artifacts WHERE artifact_id=? AND user_id=? AND domain=?').get(id,ctx.principal.userId,ctx.domain) as any;if(!row || (ctx.principal.jurisdiction.city && row.city!==ctx.principal.jurisdiction.city)||(ctx.principal.jurisdiction.district && row.district!==ctx.principal.jurisdiction.district))throw new Error('Artifact not found or unauthorized');const source=JSON.parse(row.source_json);assertResultSources(source.datasets??source.metadata?.datasets,ctx.deploymentTier);if(source.authorization&&(source.authorization.userId!==ctx.principal.userId||source.authorization.organizationId!==ctx.principal.organizationId))throw Error('FORBIDDEN_ARTIFACT_OWNER');if(source.sourceRunId&&source.sourceCallId)readAuthorizedQuerySource(source.sourceRunId,source.sourceCallId,ctx);else if(source.sql)assertCachedQueryColumns(source.sql,restrictColumns(getDomainRepository(ctx.domain).getSchema(),ctx.principal),ctx.principal.role==='PUBLIC_VIEWER'&&(source.authorization?.role??source.scope?.principal?.role)!=='PUBLIC_VIEWER');else if(source.authorization&&source.authorization.role!==ctx.principal.role)throw Error('FORBIDDEN_ARTIFACT_ROLE_CHANGED');if(createHash('sha256').update(row.content).digest('hex')!==row.sha256)throw new Error('Artifact integrity check failed');return row;});}
