import type {SkillDefinition} from '@/contracts/skill-definition';
import {runAnalytics} from '@/infrastructure/analytics/runner';
import {scopeFromArgs} from './skill-factory';
/** Reuses strict Python contract and retains real data/status rather than constructing legacy cards. */
export function analyticsSkill(task:string,method:string,name:string,properties:Record<string,any>,domain:SkillDefinition['domain']='vector'):Pick<SkillDefinition,'availability'|'name'|'description'|'method'|'allowedOperations'|'inputSchema'|'outputSchema'|'execute'>{
 return {availability:'available',name,description:`${name}；使用实际数据计算，结果与方法限制一并呈现。`,method,allowedOperations:['read'],inputSchema:{type:'object',additionalProperties:false,properties:{city:{type:'string',minLength:1},district:{type:'string',minLength:1,description:'仅填写具体区县；全市范围省略该参数，不填全市等占位值'},...properties}},outputSchema:{type:'object',additionalProperties:false,required:['type','title','data'],properties:{type:{const:'ANALYTICS_RESULT'},title:{type:'string'},data:{type:'object'}}},execute:async(args,ctx)=>{
  const {domain:_,principal:_principal,allowedColumns:_columns,...scope}=scopeFromArgs(args,ctx);
  const result=await runAnalytics({task,domain,runId:ctx.runId,args:{...args,...scope}},{signal:ctx.signal});
  return {...result,error:result.error??undefined,payload:result.payload===null?null:{type:'ANALYTICS_RESULT',title:name,data:result.payload}};
 }};
}
