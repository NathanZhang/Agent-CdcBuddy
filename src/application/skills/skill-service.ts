import Ajv from 'ajv';
import { interactionSkills } from '@/domains/common/interaction-skills';
import type { SkillDefinition } from '@/contracts/skill-definition';
import type { AgentDomain } from '@/contracts/dataset';
import type { ExecutionContext } from '@/contracts/execution-context';
import { validateSkillResult,type SkillResult } from '@/contracts/skill-result';
import { loadDatasetManifest } from '@/infrastructure/db/dataset-manifest';
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
  return [...factories[domain](),...interactionSkills(domain)].filter(skill=>options.includeInternal || skill.visibility!=='internal');
}
export function createSkillService(definitions:SkillDefinition[]){
  const catalog=new Map<string,SkillDefinition>();
  for(const definition of definitions){for(const id of [definition.id,...definition.aliases]){if(catalog.has(id))throw new Error(`Duplicate alias or ID: ${id}`);catalog.set(id,definition);}}
  return {executeSkill:async(id:string,args:Record<string,any>,ctx:ExecutionContext):Promise<SkillResult>=>{
    let stage='EXECUTION_FAILED';let definition=catalog.get(id);
    let datasets=loadDatasetManifest().filter(d=>d.domain===ctx.domain);
    const fail=(code:string,message:string):SkillResult=>validateSkillResult({schemaVersion:'1',runId:ctx.runId,domain:ctx.domain,status:'FAILED',method:definition?.method ?? 'unregistered',datasets,payload:null,metrics:{},qualityFlags:[],error:{code,message,retryable:false}});
    try{
      if(ctx.signal?.aborted)return validateSkillResult({schemaVersion:'1',runId:ctx.runId,domain:ctx.domain,status:'CANCELLED',method:definition?.method ?? 'cancelled',datasets,payload:null,metrics:{},qualityFlags:[]});
      if(!ctx.principal.domainGrants.includes(ctx.domain))return fail('FORBIDDEN_DOMAIN','Domain access denied');
      if(!definition && id.startsWith('custom_skill_')){
        const custom=await getAppBusinessProvider().getCustomSkillById(id);
        if(custom){if(custom.domain!==ctx.domain)return fail('FORBIDDEN_DOMAIN','Stored custom skill belongs to another domain');if(custom.visibility!=='public' && custom.created_by!==ctx.principal.userId)return fail('FORBIDDEN_OWNER','Private skill access denied');
          definition={id,aliases:[],domain:ctx.domain,name:custom.name,requirementIds:[],availability:'available',inputSchema:{type:'object',additionalProperties:false},outputSchema:{type:'object',required:['type','data'],properties:{type:{const:'DATA_TABLE_VIEW'},data:{type:'array'}}},method:'stored-domain-query-v1',allowedOperations:['read'],execute:async(_args,context)=>{const data=getDomainRepository(context.domain).query(custom.sql_query,[],scopeFromArgs({},context));return {status:data.length?'SUCCESS':'NO_DATA',payload:data.length?{type:'DATA_TABLE_VIEW',title:custom.name,sql:custom.sql_query,data}:null};}};
        }
      }
      if(!definition)return fail('UNKNOWN_SKILL','Unknown skill ID');
      if(definition.domain!==ctx.domain)return fail('FORBIDDEN_DOMAIN','Skill domain mismatch');
      if(definition.availability!=='available')return fail('CAPABILITY_UNAVAILABLE','This capability has not been implemented and verified');
      stage='INVALID_INPUT';const input=ajv.compile(definition.inputSchema);if(!input(args))return fail(stage,`Skill input rejected: ${ajv.errorsText(input.errors)}`);
      stage='EXECUTION_FAILED';const execution=await definition.execute(args,ctx);
      stage='INVALID_OUTPUT';
      if(execution.payload!==null){const output=ajv.compile(definition.outputSchema);if(!output(execution.payload))return fail(stage,`Skill output rejected: ${ajv.errorsText(output.errors)}`);}
      datasets=execution.datasets ?? datasets;
      return validateSkillResult({schemaVersion:'1',runId:ctx.runId,domain:ctx.domain,status:execution.status,method:definition.method,datasets,payload:execution.payload,metrics:execution.metrics ?? {},qualityFlags:execution.qualityFlags ?? [],...(execution.error?{error:execution.error}:{})});
    }catch(error){return fail(stage,error instanceof Error?error.message:'Execution failed');}
  }};
}
export async function executeSkill(id:string,args:Record<string,any>,ctx:ExecutionContext):Promise<SkillResult>{return createSkillService(listSkillDefinitions(ctx.domain,{includeInternal:true})).executeSkill(id,args,ctx);}
