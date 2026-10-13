import {listSkillDefinitions} from '@/application/skills/skill-service';
import {authorizeSkill,restrictColumns} from '@/infrastructure/auth/authorization';
import {getDomainRepository} from '@/infrastructure/db/domain-repository';
import {assertCachedQueryColumns} from '@/infrastructure/query/query-gateway';
import type {ExecutionContext} from '@/contracts/execution-context';
import type {SpatialOutput} from '@/contracts/spatial-output';
import {validateSpatialOutput} from '@/contracts/spatial-output';
import type {SpatialOutputRef} from '@/contracts/map-composition';
import {withBusinessDb} from '@/infrastructure/db/business-store';
import {approveIntent} from '@/application/agent/intent-guard';
export function saveSpatialOutputs(outputs:SpatialOutput[],ctx:ExecutionContext):void{
 if(!ctx.approvedIntent)return;withBusinessDb(db=>db.transaction(()=>{for(const o of outputs)db.prepare('INSERT OR REPLACE INTO biz_spatial_outputs VALUES(?,?,?,?,?,?,?,?,?)').run(o.source.runId,o.source.callId,o.outputId,ctx.principal.userId,ctx.principal.organizationId,ctx.domain,JSON.stringify(ctx.approvedIntent!.draft),JSON.stringify(o),Date.now());})());
}
export function readAuthorizedSpatialOutput(ref:SpatialOutputRef,ctx:ExecutionContext):SpatialOutput{return withBusinessDb(db=>{
 const row=db.prepare('SELECT * FROM biz_spatial_outputs WHERE run_id=? AND call_id=? AND output_id=? AND user_id=? AND organization_id=? AND domain=?').get(ref.runId,ref.callId,ref.outputId,ctx.principal.userId,ctx.principal.organizationId,ctx.domain) as any;if(!row)throw Error('FORBIDDEN_SOURCE');const approved=approveIntent(JSON.parse(row.scope_json),ctx);const output=validateSpatialOutput(JSON.parse(row.output_json));const definition=listSkillDefinitions(ctx.domain,{includeInternal:true}).find(s=>s.id===output.source.skillId);if(definition)authorizeSkill(definition,{},ctx);else if(!output.source.skillId.startsWith('custom_skill_'))throw Error('FORBIDDEN_SOURCE_CAPABILITY');
 if(['bounded-domain-query-v1','stored-domain-query-v1'].includes(output.source.method)){const query=db.prepare('SELECT payload_json FROM biz_query_sources WHERE run_id=? AND call_id=? AND user_id=? AND organization_id=? AND domain=?').get(ref.runId,ref.callId,ctx.principal.userId,ctx.principal.organizationId,ctx.domain) as any;if(!query)throw Error('FORBIDDEN_QUERY_SOURCE');const payload=JSON.parse(query.payload_json);assertCachedQueryColumns(payload.sql,restrictColumns(getDomainRepository(ctx.domain).getSchema(),ctx.principal),ctx.principal.role==='PUBLIC_VIEWER'&&payload.sourceRole!=='PUBLIC_VIEWER');}
if(output.source.scopeFingerprint!==approved.fingerprint)throw Error('SPATIAL_SOURCE_VERSION_CHANGED');return output;
 });}

export function listAuthorizedSpatialReferences(ctx:ExecutionContext){return withBusinessDb(db=>{const rows=db.prepare('SELECT run_id,call_id,output_id FROM biz_spatial_outputs WHERE user_id=? AND organization_id=? AND domain=? ORDER BY created_at DESC LIMIT 24').all(ctx.principal.userId,ctx.principal.organizationId,ctx.domain) as any[];return rows.flatMap(row=>{const ref={runId:row.run_id,callId:row.call_id,outputId:row.output_id};try{const o=readAuthorizedSpatialOutput(ref,ctx);return [{ref,skillId:o.source.skillId,scopeFingerprint:o.source.scopeFingerprint,renderings:o.renderings,semantics:o.semantics,precision:o.precision}];}catch{return [];}});});}
