import {generateReport as executeReport} from '@/application/reports/report-service';
import {customVisualization} from '@/application/skills/custom-visualization';
import {approveStructuredIntent} from '@/application/agent/structured-intent';
import {searchRegionCandidates} from '@/infrastructure/geo/region-catalog';
import {loadDatasetRegionBindings} from '@/infrastructure/geo/dataset-region-bindings';
import {assertSkillMatchesIntent,compileScopedFilters,assertSqlMatchesIntent} from '@/application/agent/scope-guard';
import { queryVisualizationSchema } from '@/contracts/query-visualization';
import {authorizeScope,restrictColumns} from '@/infrastructure/auth/authorization';
import { randomUUID } from 'node:crypto';
import { STANDARD_SKILLS } from '@/lib/skills/registry';
import requirements from '../../../config/skill-requirements.json';
import aliasMap from '../../../config/skill-aliases.json';
import type { AgentDomain } from '@/contracts/dataset';
import type { SkillDefinition, SkillExecution } from '@/contracts/skill-definition';
import type { ExecutionContext } from '@/contracts/execution-context';
import { getDomainRepository } from '@/infrastructure/db/domain-repository';
import { getAppBusinessProvider } from '@/lib/db/app-business-provider';
const queryIds=['skill_monitoring_data_table','skill_foodborne_case_table','skill_env_monitoring_table','skill_chronic_monitoring_table'];
const builderIds=['skill_meta_custom_builder','skill_foodborne_custom_builder','skill_env_custom_builder','skill_chronic_custom_builder'];
const reportIds=['skill_auto_report_gen','skill_foodborne_report_export','skill_chronic_death_report'];
export const queryInput={type:'object',description:'执行受控只读查询，始终返回明细表；提供 visualization 后同时显示地图或图表，无需为明细表重复查询。',additionalProperties:false,required:['sql'],properties:{visualization:queryVisualizationSchema,sql:{type:'string',description:'单个 SQLite SELECT，最多4张表（含主表，最多3个JOIN），禁止子查询、CTE、UNION、事实表之间的JOIN。JOIN ON只支持两表字段的单个等值条件。本轮已批准的地域、日期和业务筛选均由服务端视图绑定，SQL不要重复WHERE筛选，也不要额外HAVING或CASE WHEN筛选；仅编写投影、分组、聚合、排序和LIMIT。不要为筛选年月关联日期维表。中文列别名必须用双引号包裹，或使用英文别名；GROUP BY和ORDER BY中的中文别名也要加双引号。日期范围优先使用事实表日期列的 MIN/MAX。病媒 fact_monitoring.date_id 是 YYYY-MM-DD 格式的日期文本，可直接 MIN(f.date_id)/MAX(f.date_id)；无需关联日期维表或拼接 year/month/day，以免未补零的文本排序导致错误日期范围。按实际点位汇总时必须按点位主键（如dim_location.location_id）GROUP BY，并SELECT该主键、在地图visualization.idKey指定；不能仅按街道和坐标合并不同点位。单位为只/记录时，COUNT(*)表示事实记录次数，应注明不能等同于独立采样访次。只支持 COUNT、AVG、SUM、MIN、MAX、ROUND、SUBSTR、SUBSTRING、STRFTIME、DATE、DATETIME、COALESCE、IFNULL、NULLIF、ABS、CAST、TOTAL、LENGTH、LOWER、UPPER，禁止 printf 等其他函数。最多返回200行。',minLength:1,maxLength:20000},query:{type:'string'},city:{type:'string',minLength:1,description:'只填具体地级市（如郑州市）。查询河南省或全省时省略 city，禁止把省名当作城市筛选。'},district:{type:'string',minLength:1},from:{type:'string'},to:{type:'string'}}};
const tableOutput={type:'object',required:['type','data'],properties:{type:{const:'DATA_TABLE_VIEW'},data:{type:'array',items:{type:'object'}}}};
export function normalizeProvinceCity(city?:string):string|undefined {
  return ['河南','河南省','全省','全域','全省全景','河南省全域'].includes(city?.trim() ?? '')?undefined:city;
}
export function scopeFromArgs(args:Record<string,any>,ctx:ExecutionContext) {
  if(!ctx.approvedIntent)ctx.approvedIntent=approveStructuredIntent(args,ctx);
  if(ctx.approvedIntent.domain!==ctx.domain||ctx.approvedIntent.owner.userId!==ctx.principal.userId||ctx.approvedIntent.owner.organizationId!==ctx.principal.organizationId)throw new Error('FORBIDDEN_INTENT_OWNER');
  const candidates=args.city?searchRegionCandidates(args.city).candidates:[];
  const canonical:Record<string,any>=candidates.length===1&&candidates[0].level==='city'?{...args,city:candidates[0].name}:{...args};
  if(candidates.length===1&&candidates[0].level==='county'){canonical.city=undefined;canonical.district=candidates[0].name;}
  if(candidates.length===1&&candidates[0].level==='province')canonical.city=undefined;
  if(args.district){const parent=candidates[0]?.level==='city'?candidates[0].code:ctx.principal.jurisdiction.city?searchRegionCandidates(ctx.principal.jurisdiction.city).candidates[0]?.code:undefined;const districts=searchRegionCandidates(args.district,parent).candidates;if(districts.length!==1)throw new Error('REGION_UNRESOLVED');canonical.district=loadDatasetRegionBindings(ctx.domain,ctx.approvedIntent.datasetVersion).regions.find(r=>r.code===districts[0].code)?.district??districts[0].name;}
  authorizeScope(canonical,ctx);
  if(ctx.approvedIntent){const bindings=loadDatasetRegionBindings(ctx.domain,ctx.approvedIntent.datasetVersion);assertSkillMatchesIntent(canonical,ctx.approvedIntent,bindings);if(args.sql)assertSqlMatchesIntent(args.sql,ctx.approvedIntent,bindings);if(args.sqlQuery)assertSqlMatchesIntent(args.sqlQuery,ctx.approvedIntent,bindings);const scoped=compileScopedFilters(ctx.approvedIntent,bindings);const single=scoped.regionPaths.length===1?scoped.regionPaths[0]:{};return {...scoped,...single,approvedIntent:ctx.approvedIntent,principal:ctx.principal,domain:ctx.domain,allowedColumns:ctx.principal.role==='PUBLIC_VIEWER'?restrictColumns(getDomainRepository(ctx.domain).getSchema(),ctx.principal):undefined};}
  throw new Error('FORBIDDEN_INTENT');
}
async function executeQuery(args:Record<string,any>,ctx:ExecutionContext):Promise<SkillExecution> {
  const started=Date.now();
  const data=getDomainRepository(ctx.domain).query(args.sql,[],scopeFromArgs(args,ctx));
  return {status:data.length?'SUCCESS':'NO_DATA',payload:data.length?{type:'DATA_TABLE_VIEW',title:'监测数据查询',query:args.query ?? args.sql,sql:args.sql,scope:Object.fromEntries(Object.entries(scopeFromArgs(args,ctx)).filter(([key])=>!['principal','allowedColumns','approvedIntent'].includes(key))),executionTimeMs:Date.now()-started,data,...(args.visualization?{visualization:args.visualization}:{})}:null};
}
async function executeBuilder(args:Record<string,any>,ctx:ExecutionContext):Promise<SkillExecution> {
  const data=getDomainRepository(ctx.domain).query(args.sqlQuery,[],scopeFromArgs(args,ctx));
  if(args.chartType&&args.chartType!=='table'&&!args.visualization)throw Error('VISUALIZATION_CONFIG_REQUIRED: 请配置图表字段或选择表格');
  const visualization=customVisualization(args.visualization,args.chartType??'table',data,args.sqlQuery,ctx);
  const id=`custom_skill_${randomUUID()}`;
  const skill={id,name:args.skillName,description:args.description ?? '',category:'custom',domain:ctx.domain,sqlQuery:args.sqlQuery,chartType:args.chartType ?? 'table',visualization,recommendedPrompts:[`执行已保存的自定义技能“${args.skillName}”，展示查询结果及已配置的图表。`],visibility:args.visibility ?? 'private',createdBy:ctx.principal.userId,createdAt:new Date().toISOString()};
  await getAppBusinessProvider().saveCustomSkill({skill_id:id,name:skill.name,description:skill.description,category:skill.category,domain:ctx.domain,sql_query:skill.sqlQuery,chart_type:skill.chartType,visualization_json:visualization?JSON.stringify(visualization):null,recommended_prompts:skill.recommendedPrompts.join(';'),visibility:skill.visibility,created_by:skill.createdBy,created_at:skill.createdAt});
  return {status:'SUCCESS',payload:{type:'CUSTOM_SKILL_CREATED',skill,previewData:data}};
}
export function buildDomainSkills(domain:AgentDomain,handlers:Record<string,Partial<SkillDefinition>>={}):SkillDefinition[] {
  return STANDARD_SKILLS.filter(s=>s.domain===domain || s.domain==='common').map(original=>{
    const definition:SkillDefinition={id:original.id,aliases:(aliasMap as Record<string,string[]>)[original.id] ?? [],domain,name:original.name,description:original.description,requirementIds:(requirements as Record<string,number[]>)[original.id] ?? [],availability:'planned',inputSchema:{...(original.parametersSchema ?? {type:'object',properties:{}}),additionalProperties:false},outputSchema:{type:'object'},method:'not-implemented',allowedOperations:[],execute:async()=>{throw new Error('Capability unavailable');}};
    if(queryIds.includes(original.id))Object.assign(definition,{name:'Text2SQL 查询与图表',description:'以自然语言查询当前智能体授权数据，展示统计表及折线、柱状、饼图或地图。共享查询引擎，数据、字段和地域权限按领域隔离。',availability:'available',inputSchema:queryInput,outputSchema:tableOutput,method:'bounded-domain-query-v1',allowedOperations:['read'],execute:executeQuery});
    if(builderIds.includes(original.id))Object.assign(definition,{availability:'available',inputSchema:{type:'object',additionalProperties:false,required:['skillName','sqlQuery'],properties:{skillName:{type:'string',minLength:1,maxLength:100},sqlQuery:{type:'string',minLength:1,maxLength:20000},description:{type:'string'},visualization:queryVisualizationSchema,chartType:{enum:['trend','bar','pie','map','table']},visibility:{enum:['public','private']},city:{type:'string'},district:{type:'string'}}},outputSchema:{type:'object',required:['type','skill','previewData'],properties:{type:{const:'CUSTOM_SKILL_CREATED'},skill:{type:'object',required:['id','domain','sqlQuery']},previewData:{type:'array'}}},method:'validated-custom-skill-create-v1',allowedOperations:['read','write'],execute:executeBuilder});
    if(reportIds.includes(original.id))Object.assign(definition,{name:'监测专题与综合报告',description:'生成实际统计趋势、区域分布及专题章节，归档并提供下载文件。省略templateId即使用内置标准模板；不需要另行查询明细或创建模板。',availability:'available',inputSchema:{type:'object',additionalProperties:false,properties:{city:{type:'string'},district:{type:'string'},from:{type:'string'},to:{type:'string'},reportTitle:{type:'string'},templateId:{type:'string',description:'仅可填写模板列表实际返回的ID；未指定个人模板时必须省略，自动使用内置标准模板，禁止编造default等ID。'},period:{enum:['day','week','month','year']}}},outputSchema:{type:'object',required:['type','reportId','sections'],properties:{type:{const:'AUTO_GENERATED_REPORT'},reportId:{type:'string'},sections:{type:'array',items:{type:'object',required:['heading','content']}}}},method:'sectioned-monitoring-report-v2',allowedOperations:['read','write'],execute:executeReport});
    if(original.id==='skill_auto_report_gen')definition.requirementIds=domain==='env'?[56]:domain==='foodborne'?[41]:domain==='chronic'?[72]:[34];
    return {...definition,...handlers[original.id]};
  });
}
