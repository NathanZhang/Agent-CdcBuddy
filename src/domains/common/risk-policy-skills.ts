import {scopeFromArgs} from '@/domains/shared/skill-factory';
import {approveIntent} from '@/application/agent/intent-guard';
import type {SkillDefinition} from '@/contracts/skill-definition';
import type {AgentDomain} from '@/contracts/dataset';
import {analyticsSkill} from '@/domains/shared/analytics-skill';
import {submitJob,captureRetestQuery} from '@/application/jobs/job-service';
import {randomUUID} from 'node:crypto';

const ids:Record<AgentDomain,string[]>={vector:['skill_alert_push_dispatch','skill_disposal_workflow'],foodborne:['skill_outbreak_disposal_advice'],env:['skill_env_early_warning_disposal'],chronic:['skill_chronic_early_warning_disposal']};
export function riskPolicySkills(domain:AgentDomain):SkillDefinition[]{return ids[domain].map(id=>{
 const base=analyticsSkill(domain+'_assessment',domain+'-warning-workflow-v1','风险分级、干预依据与任务',{eventDate:{type:'string'},analysis:{enum:['signals','advice']},from:{type:'string'},to:{type:'string'},threshold:{type:'number',exclusiveMinimum:0},createTask:{type:'boolean',description:'默认只读分析。用户明确要求创建核查任务时设为true，返回持久任务ID；无需另调任务提交技能，不会自动审批或发送外部通知。'}},domain);
 return {id,domain,aliases:[],requirementIds:[],...base,description:'计算风险等级、干预依据、处置步骤和通知对象，食源性同时返回此前已结案历史病例。eventDate可指定当前事件日，历史资料按已批准查询范围读取。默认只读；createTask=true时同时创建可追踪核查任务并返回jobId，无需另外提交任务。本技能不发送短信或APP通知，也不自动审批。',allowedOperations:['read','write'],execute:async(args,ctx)=>{
  const output=await base.execute({...args,analysis:args.analysis??'signals'},ctx);
  if(output.status!=='SUCCESS'||!args.createTask)return output;
  const queryId={vector:'skill_monitoring_data_table',foodborne:'skill_foodborne_case_table',env:'skill_env_monitoring_table',chronic:'skill_chronic_monitoring_table'}[domain];
  const scope=scopeFromArgs(args,ctx),filters={...ctx.approvedIntent!.draft.filters};
  if(domain==='vector')for(const [field,value] of [['category','蚊'],['methodName','诱蚊灯法']]){
   const current=filters[field];
   if(current&&(current.operator!=='eq'||current.values[0]!==value))throw Error('RETEST_POLICY_SCOPE_MISMATCH');
   filters[field]={field:field as any,operator:'eq',values:[value]};
  }
  // Separate observed measurements keep each threshold's unit explicit. Each uses the
  // existing bounded query / review workflow; no subquery or synthetic aggregate needed.
  const plans=domain==='env'?[
   {key:'water',criterion:'饮水超标样本数',sql:'SELECT COUNT(*) AS value FROM fact_water_monitoring WHERE lead_val>0.01 OR arsenic_val>0.01 OR turbidity>1',threshold:0,unit:'records'},
   {key:'air',criterion:'PM2.5最高观测值',sql:'SELECT MAX(pm25) AS value FROM fact_air_climate_monitoring',threshold:Number(args.threshold??75),unit:'ug/m3'},
   {key:'heat',criterion:'最高气温观测值',sql:'SELECT MAX(temp_max) AS value FROM fact_air_climate_monitoring',threshold:35,unit:'degC'},
  ]:[{key:'main',criterion:domain==='vector'?'指定采样法平均捕获量':domain==='foodborne'?'授权范围病例数':'授权范围死亡登记数',sql:domain==='vector'?captureRetestQuery({category:'蚊',methodName:'诱蚊灯法'},'value'):`SELECT COUNT(*) AS value FROM ${domain==='foodborne'?'fact_foodborne_case':'fact_death_registry'}`,threshold:Number(args.threshold??5),unit:domain==='vector'?'captures/record':'records'}];
  const jobs=plans.map(plan=>{
   const jobContext={...ctx,approvedIntent:approveIntent({...ctx.approvedIntent!.draft,filters,queryBinding:{sql:plan.sql}},ctx)};
   const queryArgs={sql:plan.sql,...(scope.city?{city:scope.city}:{}),...(scope.district?{district:scope.district}:{}),...(args.from?{from:args.from}:{}),...(args.to?{to:args.to}:{})};
   const job=submitJob({idempotencyKey:ctx.runId+':risk-task:'+plan.key,interaction:{interactionId:randomUUID(),kind:'skill',userInput:'按已确认范围创建风险核查任务',resourceRef:{type:'skill',id:queryId,action:'execute'},attachments:[{type:'operation-input',args:queryArgs}]},city:scope.city,district:scope.district,rule:{field:'value',threshold:plan.threshold,clearBelow:0,minRetestHours:1,unit:plan.unit},...(domain==='vector'?{retestMeasurement:{category:'蚊',methodName:'诱蚊灯法'}}:{})},jobContext);
   return {jobId:job.job_id,job_id:job.job_id,status:job.status,criterion:plan.criterion,threshold:plan.threshold,unit:plan.unit};
  });
  (output.payload as any).data.job=jobs[0];
  (output.payload as any).data.jobs=jobs;
  return output;
 }} as SkillDefinition;
});}
