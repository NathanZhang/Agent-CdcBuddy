import {queryVisualizationSchema} from '@/contracts/query-visualization';
import {withResultStatistics} from '@/contracts/result-statistics';
import {saveQuerySource} from '@/application/geo/query-source-store';
import Ajv from 'ajv';
import {saveSpatialOutputs} from '@/application/geo/spatial-store';
import {publishSpatialOutputs} from '@/application/geo/spatial-output-service';
import {loadDatasetRegionBindings} from '@/infrastructure/geo/dataset-region-bindings';
import {createHash} from 'node:crypto';
import {ScopeError} from '@/application/agent/scope-guard';
import {annotationSkills} from '@/domains/common/map-annotation-skill';
import {mapSkills} from '@/domains/common/map-skills';
import {authorizeSkill,AuthorizationError} from '@/infrastructure/auth/authorization';
import {workflowSkills} from '@/domains/common/workflow-skills';
import { interactionSkills } from '@/domains/common/interaction-skills';
import type { SkillDefinition } from '@/contracts/skill-definition';
import type { AgentDomain } from '@/contracts/dataset';
import type { ExecutionContext } from '@/contracts/execution-context';
import { validateSkillResult,type SkillResult } from '@/contracts/skill-result';
import { loadDatasetManifest,resolveDatasetLocation } from '@/infrastructure/db/dataset-manifest';
import {assertDatasetReadable,assertResultSources,DatasetPolicyError} from '@/infrastructure/db/dataset-policy';
import { getDomainRepository } from '@/infrastructure/db/domain-repository';
import { getAppBusinessProvider } from '@/lib/db/app-business-provider';
import { vectorSkills } from '@/domains/vector/skills';
import { foodborneSkills } from '@/domains/foodborne/skills';
import { envSkills } from '@/domains/env/skills';
import { chronicSkills } from '@/domains/chronic/skills';
import { scopeFromArgs } from '@/domains/shared/skill-factory';
const ajv=new Ajv({allErrors:true,strict:false,strictNumbers:true});
export function listSkillDefinitions(domain:AgentDomain,options:{includeInternal?:boolean}={}):SkillDefinition[]{
  const factories={vector:vectorSkills,foodborne:foodborneSkills,env:envSkills,chronic:chronicSkills};
  if(!Object.hasOwn(factories,domain))throw new Error('Unknown domain');
  const workflows=workflowSkills(domain);
  return [...factories[domain]().filter(s=>!workflows.some(w=>w.id===s.id)),...interactionSkills(domain),...workflows,...mapSkills(domain),...annotationSkills(domain)].filter(skill=>options.includeInternal || skill.visibility!=='internal');
}
export function createSkillService(definitions:SkillDefinition[]){
  const catalog=new Map<string,SkillDefinition>();
  for(const definition of definitions){for(const id of [definition.id,...definition.aliases]){if(catalog.has(id))throw new Error(`Duplicate alias or ID: ${id}`);catalog.set(id,definition);}}
  return {executeSkill:async(id:string,args:Record<string,any>,providedContext:ExecutionContext):Promise<SkillResult>=>{
    const ctx={...providedContext};
    let stage='EXECUTION_FAILED';let definition=catalog.get(id);
    let datasets:import('@/contracts/dataset').DatasetRef[]=[];
    const fail=(code:string,message:string):SkillResult=>validateSkillResult({schemaVersion:'1',runId:ctx.runId,domain:ctx.domain,status:'FAILED',method:definition?.method ?? 'unregistered',datasets,payload:null,metrics:{},qualityFlags:[],error:{code,message,retryable:false}});
    try{
      if(ctx.signal?.aborted)return validateSkillResult({schemaVersion:'1',runId:ctx.runId,domain:ctx.domain,status:'CANCELLED',method:definition?.method ?? 'cancelled',datasets,payload:null,metrics:{},qualityFlags:[]});
      if(!ctx.principal.domainGrants.includes(ctx.domain))return fail('FORBIDDEN_DOMAIN','Domain access denied');
      if(!definition && id.startsWith('custom_skill_')){
        const custom=await getAppBusinessProvider().getCustomSkillById(id);
        if(custom){if(custom.domain!==ctx.domain)return fail('FORBIDDEN_DOMAIN','Stored custom skill belongs to another domain');if(custom.visibility!=='public' && custom.created_by!==ctx.principal.userId)return fail('FORBIDDEN_OWNER','Private skill access denied');
          definition={id,aliases:[],domain:ctx.domain,name:custom.name,requirementIds:[],availability:'available',inputSchema:{type:'object',additionalProperties:false,properties:{visualization:queryVisualizationSchema}},outputSchema:{type:'object',required:['type','data'],properties:{type:{const:'DATA_TABLE_VIEW'},data:{type:'array'}}},method:'stored-domain-query-v1',allowedOperations:['read'],execute:async(customArgs,context)=>{const data=getDomainRepository(context.domain).query(custom.sql_query,[],scopeFromArgs({sql:custom.sql_query,...customArgs},context));return {status:data.length?'SUCCESS':'NO_DATA',payload:data.length?{type:'DATA_TABLE_VIEW',title:custom.name,sql:custom.sql_query,data,...(customArgs.visualization?{visualization:customArgs.visualization}:{})}:null};}};
        }
      }
      if(!definition)return fail('UNKNOWN_SKILL','Unknown skill ID');
      if(definition.domain!==ctx.domain)return fail('FORBIDDEN_DOMAIN','Skill domain mismatch');
      if(definition.availability!=='available')return fail('CAPABILITY_UNAVAILABLE','This capability has not been implemented and verified');
      datasets=['local-administrative-map-v1','verified-map-annotation-v1'].includes(definition.method)?[]:loadDatasetManifest().filter(d=>d.domain===ctx.domain);
      stage='INVALID_INPUT';const input=ajv.compile(definition.inputSchema);if(!input(args))return fail(stage,`Skill input rejected: ${ajv.errorsText(input.errors)}`);
      authorizeSkill(definition,args,ctx);
      if(!['local-administrative-map-v1','verified-map-annotation-v1','persistent-evidence-workflow-v1','skill_session_manage-v1','skill_session_journal-v1','skill_catalog_manage-v1','skill_collection_manage-v1'].includes(definition.method))assertDatasetReadable(resolveDatasetLocation(ctx.domain),ctx.deploymentTier);
      stage='EXECUTION_FAILED';const execution=await definition.execute(args,ctx);
      stage='INVALID_OUTPUT';
      if(execution.payload!==null){const output=ajv.compile(definition.outputSchema);if(!output(execution.payload))return fail(stage,`Skill output rejected: ${ajv.errorsText(output.errors)}`);}
      datasets=execution.datasets ?? datasets;
      if(datasets.length)assertResultSources(datasets,ctx.deploymentTier);
      const validated=validateSkillResult({schemaVersion:'1',runId:ctx.runId,domain:ctx.domain,status:execution.status,method:definition.method,datasets,payload:withResultStatistics(execution.payload),metrics:execution.metrics ?? {},qualityFlags:execution.qualityFlags ?? [],...(execution.error?{error:execution.error}:{})});
      if(validated.payload&&ctx.callId&&['DATA_TABLE_VIEW','ANALYTICS_RESULT','MAP_ANNOTATION'].includes((validated.payload as any).type)){try{const bindings=definition.method==='verified-map-annotation-v1'?{sourceCRS:'EPSG:4326' as const}:loadDatasetRegionBindings(ctx.domain,datasets[0]?.version??loadDatasetManifest().find(d=>d.domain===ctx.domain)!.version);const outputs=publishSpatialOutputs({callId:ctx.callId,skillId:definition.id,skillName:definition.name,args,result:validated},{runId:ctx.runId,callId:ctx.callId,skillId:definition.id,method:definition.method,datasetRefs:validated.datasets,scopeFingerprint:ctx.approvedIntent?.fingerprint??createHash('sha256').update(JSON.stringify(scopeFromArgs({},ctx))).digest('hex'),sourceCRS:bindings.sourceCRS});if(outputs.length){(validated.payload as any).spatialOutputs=outputs;saveSpatialOutputs(outputs,ctx);}}catch(error){(validated.payload as any).spatialIssue={code:error instanceof ScopeError?error.code:error instanceof Error?error.message:'SPATIAL_OUTPUT_INVALID',message:error instanceof Error?error.message:'空间输出校验失败'};}}
      saveQuerySource(validated,ctx);return validated;
    }catch(error){return fail(error instanceof AuthorizationError||error instanceof ScopeError||error instanceof DatasetPolicyError?error.code:stage,error instanceof Error?error.message:'Execution failed');}
  }};
}
export async function executeSkill(id:string,args:Record<string,any>,ctx:ExecutionContext):Promise<SkillResult>{return createSkillService(listSkillDefinitions(ctx.domain,{includeInternal:true})).executeSkill(id,args,ctx);}
