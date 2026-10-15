import type {AgentDomain} from '@/contracts/dataset';
import type {SkillDefinition} from '@/contracts/skill-definition';
import {getDomainRepository} from '@/infrastructure/db/domain-repository';
import {runAnalytics} from '@/infrastructure/analytics/runner';
import {queryInput,scopeFromArgs} from '@/domains/shared/skill-factory';

/** Same model and input contract in all agents; observations come only from scoped SQL. */
export function forecastSkill(domain:AgentDomain):SkillDefinition {
 return {id:'skill_arima_forecast',aliases:[],domain,name:'ARIMA 基础时序预测',description:'跨智能体复用的非负月度指标 ARIMA(1,1,1) 模型。通过受控 SQL 返回 period（YYYY-MM）、value 两列；至少18个连续月份，不自动补零。展示历史、未来预测和时间留出误差，不等同于业务风险预警。',requirementIds:[],availability:'available',method:'shared-arima-forecast-v1',allowedOperations:['read'],
 inputSchema:{...queryInput,required:['sql','unit'],properties:{city:queryInput.properties.city,district:queryInput.properties.district,from:queryInput.properties.from,to:queryInput.properties.to,sql:{...queryInput.properties.sql,description:queryInput.properties.sql.description+' 本技能只接受按月聚合的 period（YYYY-MM）和非负 value 两列，按 period 升序，最多200个月。不得用LLM编造序列。'},unit:{type:'string',minLength:1,maxLength:60},horizon:{type:'integer',minimum:1,maximum:12}}},
 outputSchema:{type:'object',required:['type','title','data'],properties:{type:{const:'ANALYTICS_RESULT'},title:{type:'string'},data:{type:'object'}}},
 execute:async(args,ctx)=>{
  const rows=getDomainRepository(domain).query(args.sql,[],scopeFromArgs(args,ctx));
  if(!rows.length)return {status:'NO_DATA',payload:null};
  const result=await runAnalytics({task:domain+'_arima_forecast',domain,runId:ctx.runId,args:{rows,unit:args.unit,horizon:args.horizon??3}},{signal:ctx.signal});
  return {...result,error:result.error??undefined,payload:result.payload===null?null:{type:'ANALYTICS_RESULT',title:'ARIMA 月度预测与验证',data:result.payload}};
 }};
}
