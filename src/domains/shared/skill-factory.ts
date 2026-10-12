import { queryVisualizationSchema } from '@/contracts/query-visualization';
import {authorizeScope,restrictColumns} from '@/infrastructure/auth/authorization';
import { loadDatasetManifest } from '@/infrastructure/db/dataset-manifest';
import { randomUUID } from 'node:crypto';
import { STANDARD_SKILLS } from '@/lib/skills/registry';
import requirements from '../../../config/skill-requirements.json';
import aliasMap from '../../../config/skill-aliases.json';
import type { AgentDomain } from '@/contracts/dataset';
import type { SkillDefinition, SkillExecution } from '@/contracts/skill-definition';
import type { ExecutionContext } from '@/contracts/execution-context';
import { getDomainRepository } from '@/infrastructure/db/domain-repository';
import { getAppBusinessProvider } from '@/lib/db/app-business-provider';
const table:Record<AgentDomain,string>={vector:'fact_monitoring',foodborne:'fact_foodborne_case',env:'fact_water_monitoring',chronic:'fact_death_registry'};
const queryIds=['skill_monitoring_data_table','skill_foodborne_case_table','skill_env_monitoring_table','skill_chronic_monitoring_table'];
const builderIds=['skill_meta_custom_builder','skill_foodborne_custom_builder','skill_env_custom_builder','skill_chronic_custom_builder'];
const reportIds=['skill_auto_report_gen','skill_foodborne_report_export','skill_chronic_death_report'];
const queryInput={type:'object',description:'执行受控只读查询，始终返回明细表；提供 visualization 后同时显示地图或图表，无需为明细表重复查询。',additionalProperties:false,required:['sql'],properties:{visualization:queryVisualizationSchema,sql:{type:'string',description:'单个 SQLite SELECT，最多4张表（含主表，最多3个JOIN），禁止子查询、CTE、UNION、事实表之间的JOIN。JOIN ON只支持两表字段的单个等值条件，其他条件写在WHERE。优先直接筛选事实表的日期字段，避免仅为筛选年月额外关联日期维表。中文列别名必须用双引号包裹，或使用英文别名；GROUP BY和ORDER BY中的中文别名也要加双引号。最多返回200行。',minLength:1,maxLength:20000},query:{type:'string'},city:{type:'string',minLength:1},district:{type:'string',minLength:1},from:{type:'string'},to:{type:'string'}}};
const tableOutput={type:'object',required:['type','data'],properties:{type:{const:'DATA_TABLE_VIEW'},data:{type:'array',items:{type:'object'}}}};
export function scopeFromArgs(args:Record<string,any>,ctx:ExecutionContext) {
  authorizeScope(args,ctx);
  const allowedColumns=ctx.principal.role==='PUBLIC_VIEWER'?restrictColumns(getDomainRepository(ctx.domain).getSchema(),ctx.principal):undefined;
  return {principal:ctx.principal,allowedColumns,domain:ctx.domain,city:ctx.principal.jurisdiction.city ?? args.city,district:ctx.principal.jurisdiction.district ?? args.district,from:args.from,to:args.to};
}
async function executeQuery(args:Record<string,any>,ctx:ExecutionContext):Promise<SkillExecution> {
  const started=Date.now();
  const data=getDomainRepository(ctx.domain).query(args.sql,[],scopeFromArgs(args,ctx));
  return {status:data.length?'SUCCESS':'NO_DATA',payload:data.length?{type:'DATA_TABLE_VIEW',title:'监测数据查询',query:args.query ?? args.sql,sql:args.sql,scope:scopeFromArgs(args,ctx),executionTimeMs:Date.now()-started,data,...(args.visualization?{visualization:args.visualization}:{})}:null};
}
async function executeBuilder(args:Record<string,any>,ctx:ExecutionContext):Promise<SkillExecution> {
  const data=getDomainRepository(ctx.domain).query(args.sqlQuery,[],scopeFromArgs(args,ctx));
  const id=`custom_skill_${randomUUID()}`;
  const skill={id,name:args.skillName,description:args.description ?? '',category:'custom',domain:ctx.domain,sqlQuery:args.sqlQuery,chartType:args.chartType ?? 'table',recommendedPrompts:[`执行 ${args.skillName}`],visibility:args.visibility ?? 'private',createdBy:ctx.principal.userId,createdAt:new Date().toISOString()};
  await getAppBusinessProvider().saveCustomSkill({skill_id:id,name:skill.name,description:skill.description,category:skill.category,domain:ctx.domain,sql_query:skill.sqlQuery,chart_type:skill.chartType,recommended_prompts:skill.recommendedPrompts.join(';'),visibility:skill.visibility,created_by:skill.createdBy,created_at:skill.createdAt});
  return {status:'SUCCESS',payload:{type:'CUSTOM_SKILL_CREATED',skill,previewData:data}};
}
async function executeReport(args:Record<string,any>,ctx:ExecutionContext):Promise<SkillExecution> {
  const scope=scopeFromArgs(args,ctx);
  const rows=getDomainRepository(ctx.domain).query(`SELECT COUNT(*) AS sampleCount FROM ${table[ctx.domain]}`,[],scope);
  const count=Number(rows[0]?.sampleCount ?? 0);
  if(count===0)return {status:'NO_DATA',payload:null};
  const title=args.reportTitle ?? `${scope.city ?? '全域'}监测统计报告`;
  const summary=`当前范围内监测记录 ${count} 条。报告仅包含已执行的统计，不包含未验证模型结论。`;
  const sections=[{heading:'监测范围与统计',content:`领域：${ctx.domain}；城市：${scope.city ?? '全域'}；区县：${scope.district ?? '全辖区'}；记录数：${count}。`},{heading:'数据与评估限制',content:'统计汇总不代表预测模型达到准确率要求。'}];
  const reportId=`report_${randomUUID()}`;
  await getAppBusinessProvider().saveReport({report_id:reportId,title,author:ctx.principal.userId,city:scope.city,district:scope.district,metadata_json:JSON.stringify({domain:ctx.domain,scope,datasets:loadDatasetManifest().filter(d=>d.domain===ctx.domain),method:'persisted-descriptive-report-v1'}),report_type:'MONITORING_SUMMARY',summary,content_markdown:sections.map(s=>`### ${s.heading}\n${s.content}`).join('\n\n')});
  return {status:'SUCCESS',payload:{type:'AUTO_GENERATED_REPORT',reportId,title,date:new Date().toISOString(),author:ctx.principal.userId,summary,sections},qualityFlags:['descriptive-summary-only']};
}
export function buildDomainSkills(domain:AgentDomain,handlers:Record<string,Partial<SkillDefinition>>={}):SkillDefinition[] {
  return STANDARD_SKILLS.filter(s=>s.domain===domain || s.domain==='common').map(original=>{
    const definition:SkillDefinition={id:original.id,aliases:(aliasMap as Record<string,string[]>)[original.id] ?? [],domain,name:original.name,description:original.description,requirementIds:(requirements as Record<string,number[]>)[original.id] ?? [],availability:'planned',inputSchema:{...(original.parametersSchema ?? {type:'object',properties:{}}),additionalProperties:false},outputSchema:{type:'object'},method:'not-implemented',allowedOperations:[],execute:async()=>{throw new Error('Capability unavailable');}};
    if(queryIds.includes(original.id))Object.assign(definition,{availability:'available',inputSchema:queryInput,outputSchema:tableOutput,method:'bounded-domain-query-v1',allowedOperations:['read'],execute:executeQuery});
    if(builderIds.includes(original.id))Object.assign(definition,{availability:'available',inputSchema:{type:'object',additionalProperties:false,required:['skillName','sqlQuery'],properties:{skillName:{type:'string',minLength:1,maxLength:100},sqlQuery:{type:'string',minLength:1,maxLength:20000},description:{type:'string'},chartType:{enum:['trend','bar','pie','map','table']},visibility:{enum:['public','private']},city:{type:'string'},district:{type:'string'}}},outputSchema:{type:'object',required:['type','skill','previewData'],properties:{type:{const:'CUSTOM_SKILL_CREATED'},skill:{type:'object',required:['id','domain','sqlQuery']},previewData:{type:'array'}}},method:'validated-custom-skill-create-v1',allowedOperations:['read','write'],execute:executeBuilder});
    if(reportIds.includes(original.id))Object.assign(definition,{availability:'available',inputSchema:{type:'object',additionalProperties:false,properties:{city:{type:'string'},district:{type:'string'},from:{type:'string'},to:{type:'string'},reportTitle:{type:'string'}}},outputSchema:{type:'object',required:['type','reportId','sections'],properties:{type:{const:'AUTO_GENERATED_REPORT'},reportId:{type:'string'},sections:{type:'array',items:{type:'object',required:['heading','content']}}}},method:'persisted-descriptive-report-v1',allowedOperations:['read','write'],execute:executeReport});
    if(original.id==='skill_auto_report_gen')definition.requirementIds=domain==='env'?[56]:domain==='foodborne'?[41]:domain==='chronic'?[72]:[34];
    return {...definition,...handlers[original.id]};
  });
}
