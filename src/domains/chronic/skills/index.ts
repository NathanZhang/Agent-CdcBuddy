import { buildDomainSkills,scopeFromArgs } from '../../shared/skill-factory';
import { runAnalyticsEngine } from '@/lib/analytics/engine-bridge';
import { getDomainRepository } from '@/infrastructure/db/domain-repository';
export function chronicSkills(){return buildDomainSkills('chronic',{skill_icd10_nlp_inference:{availability:'available',method:'icd10-dictionary-candidate-v1',description:'根据实际输入检索本地字典候选，保留人工复核，不声称临床因果推理或编码准确率达标。',inputSchema:{type:'object',additionalProperties:false,anyOf:[{required:['certId']},{required:['inputChain']}],properties:{certId:{type:'string',minLength:1},inputChain:{type:'object',minProperties:1,additionalProperties:false,properties:{a:{type:'string'},b:{type:'string'},c:{type:'string'},d:{type:'string'}}}}},outputSchema:{type:'object',required:['type','inputDeathChain','inferredUnderlyingCause'],properties:{type:{const:'ICD10_INFERENCE_CARD'},inputDeathChain:{type:'object'},inferredUnderlyingCause:{type:['object','null']}}},allowedOperations:['read'],execute:async(args,ctx)=>{
  let inputChain=args.inputChain;
  if(!inputChain){const rows=getDomainRepository('chronic').query('SELECT cause_chain_a,cause_chain_b,cause_chain_c,cause_chain_d FROM fact_death_registry WHERE death_cert_id=?',[args.certId],scopeFromArgs(args,ctx));if(!rows.length)return {status:'NO_DATA',payload:null};inputChain={a:rows[0].cause_chain_a,b:rows[0].cause_chain_b,c:rows[0].cause_chain_c,d:rows[0].cause_chain_d};}
  const raw=await runAnalyticsEngine('icd10_nlp_inference',{inputChain},ctx);
  return {status:raw.status,payload:{type:'ICD10_INFERENCE_CARD',...raw},metrics:raw.metrics,qualityFlags:raw.qualityFlags,datasets:args.inputChain?[]:undefined};
}}});}
