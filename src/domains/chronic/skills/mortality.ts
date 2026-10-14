import type {SkillDefinition} from '@/contracts/skill-definition';
import {getDomainRepository} from '@/infrastructure/db/domain-repository';
import {runAnalyticsEngine} from '@/lib/analytics/engine-bridge';
import {scopeFromArgs} from '../../shared/skill-factory';

const line = {type:'string',maxLength:4000};
const sourceQuery = 'SELECT cause_chain_a,cause_chain_b,cause_chain_c,cause_chain_d,age,gender FROM fact_death_registry WHERE death_cert_id=?';

export const mortalitySkill: Partial<SkillDefinition> = {
 name:'死因文本解析与 Iris/MUSE 编码（需复核）',
 availability:'available',method:'icd10-iris-mortality-v2',
 description:'保留证明书原文、第一/二部分及多病种，检索三位类目候选；通过配置的 Iris 5/MUSE 进行 ICD-10 根本死因选择。类目表不代替完整规则，所有结果需人工复核。',
 inputSchema:{type:'object',additionalProperties:false,
  oneOf:[{required:['certId'],not:{anyOf:[{required:['text']},{required:['inputChain']}]}},
   {required:['text'],not:{anyOf:[{required:['certId']},{required:['inputChain']}]}},
   {required:['inputChain'],not:{anyOf:[{required:['certId']},{required:['text']}]}}],
  properties:{mode:{enum:['dictionary','graph']},entryMode:{enum:['text','code']},
   certId:{type:'string',minLength:1,maxLength:100},text:{type:'string',minLength:1,maxLength:12000},
   inputChain:{type:'object',minProperties:1,additionalProperties:false,properties:{a:line,b:line,c:line,d:line,e:line,part2:line}},
   demographics:{type:'object',additionalProperties:false,properties:{
    sex:{enum:['1','2','9']},age:{type:'object',additionalProperties:false,required:['value','unit'],properties:{value:{type:'integer',minimum:0,maximum:100000},unit:{enum:['Y','M','D','H','N']}}},
    mannerOfDeath:{enum:[0,1,2,3,4,5,6,8,9]},pregnancy:{enum:['0','1','2','3','9']},pregnancyContributeDeath:{enum:['0','1','2']},
    stillbirth:{enum:['1','N','U']},completedWeeks:{type:'string',pattern:'^[0-9]{1,2}$'},birthWeight:{type:'string',pattern:'^[0-9]{1,4}$'},ageOfMother:{type:'string',pattern:'^[0-9]{1,2}$'},conditionMother:line,externalFreeText:line,
   }},
  }},
 outputSchema:{type:'object',required:['type','title','data'],properties:{type:{const:'ANALYTICS_RESULT'},title:{type:'string'},data:{type:'object'}}},
 allowedOperations:['read'],
 execute:async(args,ctx)=>{
  let inputChain=args.inputChain;
  let demographics=args.demographics;
  if(args.certId){
   const rows=getDomainRepository('chronic').query(sourceQuery,[args.certId],scopeFromArgs({...args,sql:sourceQuery},ctx));
   if(!rows.length)return {status:'NO_DATA',payload:null};
   const r=rows[0]; inputChain={a:r.cause_chain_a??'',b:r.cause_chain_b??'',c:r.cause_chain_c??'',d:r.cause_chain_d??''};
   demographics={sex:r.gender==='男'?'1':r.gender==='女'?'2':'9',...(Number.isInteger(r.age)?{age:{value:r.age,unit:'Y'}}:{}),...demographics};
  }
  const raw=await runAnalyticsEngine('icd10_nlp_inference',{...(inputChain?{inputChain}:{text:args.text}),demographics,mode:args.mode??'dictionary',entryMode:args.entryMode??'text'},ctx);
  return {status:raw.status,payload:{type:'ANALYTICS_RESULT',title:'死因文本与 ICD-10 编码复核',data:raw},metrics:raw.metrics,qualityFlags:raw.qualityFlags,datasets:args.certId?undefined:[]};
 },
};
