import {randomUUID} from 'node:crypto';
import type {ExecutionContext} from '@/contracts/execution-context';
import {withBusinessDb,saveArtifact} from '@/infrastructure/db/business-store';
import {getDomainRepository} from '@/infrastructure/db/domain-repository';
import {scopeFromArgs} from '@/domains/shared/skill-factory';
import {workflowDataset} from '@/application/jobs/workflow-provenance';
import {getAppBusinessProvider} from '@/lib/db/app-business-provider';
import {assertPrincipal} from '@/infrastructure/auth/authorization';
export const sectionKeys=['overview','trend','regions','specific','advice','provenance'] as const;
export interface ReportTemplate {name:string;period:'day'|'week'|'month'|'year';sections:string[];}
function assertTemplate(v:ReportTemplate){if(!v||typeof v.name!=='string'||!v.name.trim()||v.name.length>100||!['day','week','month','year'].includes(v.period)||!Array.isArray(v.sections)||!v.sections.length||v.sections.some(s=>!sectionKeys.includes(s as any))||new Set(v.sections).size!==v.sections.length)throw Error('INVALID_REPORT_TEMPLATE');}
export function templates(action:string,args:Record<string,any>,ctx:ExecutionContext){
 assertPrincipal(ctx);if(ctx.principal.role==='PUBLIC_VIEWER')throw Error('FORBIDDEN_TEMPLATE');
 return withBusinessDb(db=>{
 const owner=[ctx.principal.userId,ctx.principal.organizationId,ctx.domain];
 if(action==='list')return db.prepare('SELECT * FROM biz_report_templates WHERE user_id=? AND organization_id=? AND domain=? ORDER BY updated_at DESC').all(...owner);
 const existing=args.templateId?db.prepare('SELECT * FROM biz_report_templates WHERE template_id=? AND user_id=? AND organization_id=? AND domain=?').get(args.templateId,...owner) as any:undefined;
 if(args.templateId&&!existing)throw Error('TEMPLATE_NOT_FOUND');
 if(action==='get')return existing;
 if(action==='delete'){if(!existing||args.version!==existing.version)throw Error('TEMPLATE_VERSION_CONFLICT');db.prepare('DELETE FROM biz_report_templates WHERE template_id=? AND version=?').run(args.templateId,args.version);return {templateId:args.templateId,deleted:true};}
 if(action!=='save')throw Error('INVALID_TEMPLATE_ACTION');assertTemplate(args.definition);
 if(existing){if(existing.version!==args.version)throw Error('TEMPLATE_VERSION_CONFLICT');const n=db.prepare('UPDATE biz_report_templates SET name=?,definition_json=?,version=version+1,updated_at=? WHERE template_id=? AND version=?').run(args.definition.name,JSON.stringify(args.definition),Date.now(),args.templateId,args.version);if(n.changes!==1)throw Error('TEMPLATE_VERSION_CONFLICT');return {...existing,name:args.definition.name,definition_json:JSON.stringify(args.definition),version:existing.version+1};}
 const id=randomUUID();db.prepare('INSERT INTO biz_report_templates VALUES(?,?,?,?,?,?,?,?)').run(id,...owner,args.definition.name,1,JSON.stringify(args.definition),Date.now());return {template_id:id,version:1,name:args.definition.name,definition_json:JSON.stringify(args.definition)};
 });
}
const facts={vector:['fact_monitoring','date_id'],foodborne:['fact_foodborne_case','visit_date'],env:['fact_water_monitoring','monitoring_date'],chronic:['fact_death_registry','death_date']} as const;
const escape=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
function tableMarkdown(rows:any[]){if(!rows.length)return '当前范围无记录。';const cols=Object.keys(rows[0]);return ['| '+cols.join(' | ')+' |','| '+cols.map(()=>'---').join(' | ')+' |',...rows.map(r=>'| '+cols.map(c=>String(r[c]??'').replaceAll('|','／')).join(' | ')+' |')].join('\n');}
export async function generateReport(args:Record<string,any>,ctx:ExecutionContext){
 const scope=scopeFromArgs(args,ctx),dataset=workflowDataset(ctx);let template:ReportTemplate={name:'监测综合报告',period:args.period??'month',sections:[...sectionKeys]};let templateVersion:any=null;
 if(args.templateId){const row=templates('get',args,ctx);template=JSON.parse(row.definition_json);templateVersion={id:row.template_id,version:row.version};}assertTemplate(template);
 const q=(sql:string)=>getDomainRepository(ctx.domain).query(sql,[],scope),[fact,date]=facts[ctx.domain];
 const total=q(`SELECT COUNT(*) AS records FROM ${fact}`)[0]?.records;
 if(!total)return {status:'NO_DATA' as const,payload:null};
 const periodExpr=template.period==='day'?`SUBSTR(${date},1,10)`:template.period==='week'?`STRFTIME('%Y-W%W',${date})`:template.period==='year'?`SUBSTR(${date},1,4)`:`SUBSTR(${date},1,7)`;
 const trend=q(`SELECT ${periodExpr} AS period, COUNT(*) AS recordCount FROM ${fact} GROUP BY ${periodExpr} ORDER BY period`);
 const regions=ctx.domain==='vector'?q('SELECT l.city,l.district,COUNT(*) AS recordCount FROM fact_monitoring f JOIN dim_location l ON f.location_id=l.location_id GROUP BY l.city,l.district ORDER BY recordCount DESC'):q(`SELECT city,district,COUNT(*) AS recordCount FROM ${fact} GROUP BY city,district ORDER BY recordCount DESC`);
 const sections:any[]=[{key:'overview',heading:'监测概况',content:`当前授权范围内 ${total} 条记录，统计周期：${{day:'日',week:'周',month:'月',year:'年'}[template.period]}。范围 ${scope.city??'授权辖区'} ${scope.district??''}；时间 ${scope.from??'起始数据'} 至 ${scope.to??'最新数据'}。`},{key:'trend',heading:'监测趋势',content:tableMarkdown(trend),rows:trend,chart:{kind:'line',xKey:'period',yKey:'recordCount',unit:'条'}},{key:'regions',heading:'重点区域分布',content:tableMarkdown(regions.slice(0,20)),rows:regions,chart:{kind:'bar',xKey:'district',yKey:'recordCount',unit:'条'}}];
 const details:{heading:string;rows:any[]}[]=[];
 if(ctx.domain==='chronic'){
  details.push({heading:'死因顺位与潜在减寿年数（75岁阈值，重新按年龄计算）',rows:q('SELECT icd10_category,COUNT(*) AS deaths,SUM(MAX(0,75-age)) AS ypll FROM fact_death_registry GROUP BY icd10_category ORDER BY deaths DESC')});
  details.push({heading:'慢病报告病例趋势（非患病率分母）',rows:q('SELECT SUBSTR(diagnosed_date,1,7) AS period,COUNT(*) AS cases FROM fact_chronic_cases GROUP BY SUBSTR(diagnosed_date,1,7) ORDER BY period')});
  details.push({heading:'伤害类型构成',rows:q('SELECT injury_type,COUNT(*) AS cases FROM fact_injury_surveillance GROUP BY injury_type ORDER BY cases DESC')});
  details.push({heading:'伤害高发场所TOP5',rows:q('SELECT injury_place,COUNT(*) AS cases FROM fact_injury_surveillance GROUP BY injury_place ORDER BY cases DESC LIMIT 5')});
 }else if(ctx.domain==='env')details.push({heading:'饮水安全指标与健康风险输入',rows:q('SELECT sample_type,AVG(turbidity) AS turbidity,AVG(arsenic_val) AS arsenicMgL,AVG(is_standard_met) AS complianceFraction FROM fact_water_monitoring GROUP BY sample_type')});
 else if(ctx.domain==='foodborne')details.push({heading:'聚集事件简报',rows:q('SELECT event_title,start_time,case_count,confirmed_pathogen,suspected_food,disposal_status FROM fact_outbreak_event ORDER BY start_time DESC LIMIT 20')});
 else details.push({heading:'优势物种',rows:q('SELECT s.species_name,SUM(f.capture_count) AS captures FROM fact_monitoring f JOIN dim_species s ON f.species_id=s.species_id GROUP BY s.species_name ORDER BY captures DESC')});
 for(const d of details)sections.push({key:'specific',heading:d.heading,content:tableMarkdown(d.rows),rows:d.rows});
 sections.push({key:'advice',heading:'核查与处置建议',content:'优先核查记录较集中的区域及异常指标；建立调查任务并补充复测证据。数据为Mock时，本报告仅用于流程演示。计数不能替代发病率、因果结论或模型准确率验证。'},{key:'provenance',heading:'数据来源与方法',content:`数据集 ${dataset.id}，版本 ${dataset.version}，来源 ${dataset.origin}。模板 ${template.name}，版本 ${templateVersion?.version??'内置1'}。按实际记录重新聚合，不使用预填风险结论。`});
 const selected=sections.filter(s=>template.sections.includes(s.key)),title=args.reportTitle??`${scope.city??'授权辖区'}${template.name}`,reportId='report_'+randomUUID(),summary=`已汇总 ${total} 条记录并生成 ${selected.length} 个章节。`;
 const markdown=`# ${title}\n\n${summary}\n\n`+selected.map(s=>`## ${s.heading}\n\n${s.content}`).join('\n\n');
 const metadata={domain:ctx.domain,scope,datasets:[dataset],template:templateVersion,organizationId:ctx.principal.organizationId,method:'sectioned-monitoring-report-v2'};
 await getAppBusinessProvider().saveReport({report_id:reportId,title,author:ctx.principal.userId,city:scope.city,district:scope.district,metadata_json:JSON.stringify(metadata),report_type:'MONITORING_REPORT',summary,content_markdown:markdown});
 const chartSvg=(rows:any[])=>{const max=Math.max(1,...rows.map(r=>Number(r.recordCount)||0));return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 180" role="img"><polyline fill="none" stroke="#0284c7" stroke-width="2" points="${rows.map((r,i)=>`${10+i*580/Math.max(1,rows.length-1)},${160-140*Number(r.recordCount)/max}`).join(' ')}"/></svg>`;};
 const html=`<!doctype html><html lang="zh"><meta charset="UTF-8"><title>${escape(title)}</title><style>body{font:15px sans-serif;max-width:960px;margin:40px auto;color:#123}section{break-inside:avoid;margin:24px 0}pre{white-space:pre-wrap;font:13px sans-serif}svg{max-width:600px}</style><h1>${escape(title)}</h1><p>${escape(summary)}</p>${selected.map(s=>`<section><h2>${escape(s.heading)}</h2>${s.chart?chartSvg(s.rows):''}<pre>${escape(s.content)}</pre></section>`).join('')}</html>`;
 const artifact=saveArtifact({fileName:title+'.html',mimeType:'text/html; charset=utf-8',content:Buffer.from(html),source:metadata,city:scope.city,district:scope.district},ctx);
 return {status:'SUCCESS' as const,payload:{type:'AUTO_GENERATED_REPORT',recordCount:Number(total),reportId,archiveStatus:'archived',presentationStatus:'workbench-ready',title,date:new Date().toISOString(),author:ctx.principal.userId,summary,sections:selected,template:templateVersion,artifact},datasets:[dataset]};
}
