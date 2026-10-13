import type {SkillDefinition} from '@/contracts/skill-definition';
import {runAnalytics} from '@/infrastructure/analytics/runner';
import {scopeFromArgs} from './skill-factory';
/** Reuses strict Python contract and retains real data/status rather than constructing legacy cards. */
export function analyticsSkill(task:string,method:string,name:string,properties:Record<string,any>,domain:SkillDefinition['domain']='vector'):Pick<SkillDefinition,'availability'|'name'|'description'|'method'|'allowedOperations'|'inputSchema'|'outputSchema'|'execute'>{
 return {availability:'available',name,description:`${name}；使用实际数据计算，结果与方法限制一并呈现。`,method,allowedOperations:['read'],inputSchema:{type:'object',additionalProperties:false,properties:{city:{type:'string',minLength:1},district:{type:'string',minLength:1,description:'仅填写具体区县；全市范围省略该参数，不填全市等占位值'},...properties}},outputSchema:{type:'object',additionalProperties:false,required:['type','title','data'],properties:{type:{const:'ANALYTICS_RESULT'},title:{type:'string'},data:{type:'object'},spatialOutputs:{type:'array'}}},execute:async(args,ctx)=>{
  const {domain:_,principal:_principal,allowedColumns:_columns,approvedIntent:_approved,...scope}=scopeFromArgs(args,ctx);
  const effectiveArgs:Record<string,any>={...args,...scope};
  if(_approved){effectiveArgs.approvedScope={domain,...scope,allowedColumns:_columns,...(task==='sewage_pathogen_trace'?{parameterFilters:['pathogen']}: {})};for(const field of ['category','speciesName','methodName','pathogenName','pesticideName','pathogen','pathogenType','diseaseName','basinName','pathogenId','clusterId']){const f=_approved.effectiveDataScope.filters[field];if(f?.operator==='eq')effectiveArgs[field]=f.values[0];else if(field==='category')effectiveArgs[field]=null;else delete effectiveArgs[field];}if(scope.to)effectiveArgs.asOf=scope.to;
   if(task==='satscan_cluster'){if(!scope.from||!scope.to||scope.from.slice(0,7)!==scope.to.slice(0,7))return {status:'INSUFFICIENT_DATA',payload:{type:'ANALYTICS_RESULT',title:name,data:{reason:'ANALYSIS_MONTH_REQUIRED: 扫描方法需要一个明确月份'}},qualityFlags:['explicit-analysis-month-required']};effectiveArgs.year=Number(scope.from.slice(0,4));effectiveArgs.month=Number(scope.from.slice(5,7));}
  }
  const result=await runAnalytics({task,domain,runId:ctx.runId,args:effectiveArgs},{signal:ctx.signal});
  return {...result,error:result.error??undefined,payload:result.payload===null?null:{type:'ANALYTICS_RESULT',title:name,data:result.payload}};
 }};
}
