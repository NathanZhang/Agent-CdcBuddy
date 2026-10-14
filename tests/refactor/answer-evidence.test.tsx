import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {expect, it} from 'vitest';
import Database from 'better-sqlite3';
import {computeResultStatistics, withResultStatistics} from '@/contracts/result-statistics';
import {validateSkillResult} from '@/contracts/skill-result';
import type {SkillRun} from '@/contracts/agent-interaction';
import {buildAnswerEvidence, validateAnswerEvidence} from '@/application/agent/answer-evidence';
import {PROGRAMMATIC_ANALYSIS_INSTRUCTION} from '@/application/agent/answer-evidence';
import {executeSkill, listSkillDefinitions} from '@/application/skills/skill-service';
import {createMainAgent} from '@/application/agent/main-agent';
import {collectDispatch} from '@/application/dispatch/dispatch-service';
import {createDevelopmentContext} from '@/lib/skills/server-executor';
import {resolveDatasetLocation} from '@/infrastructure/db/dataset-manifest';
import {approveIntent} from '@/application/agent/intent-guard';
import {GenerativeComponentRenderer} from '@/components/ag-ui/GenerativeComponentRenderer';
import {SpeciesCompositionSummary} from '@/components/ag-ui/SpeciesCompositionSummary';
import {RECOMMENDATION_DATA_CASES} from './fixtures/recommendation-data-cases';

export const FLY_PROMPT = '查询河南省2020年7月9日至2025年11月5日家蝇抗药性生测记录，表格展示药剂、地市、日期、LC50、校正死亡率与登记抗性分类，保留缺失值。';
const flySql = 'SELECT p.pesticide_name AS "药剂", l.city AS "地市", f.date_id AS "日期", f.lc50 AS "LC50", f.corrected_mortality AS "校正死亡率", f.resistance_level AS "登记抗性分类" FROM fact_insecticide_resistance f JOIN dim_pesticide p ON f.pesticide_id=p.pesticide_id JOIN dim_location l ON f.location_id=l.location_id ORDER BY f.date_id DESC';
const ctx = () => {
  const context = createDevelopmentContext('vector');
  context.approvedIntent = approveIntent({task:'data_query', relation:'new', displayRegion:null, dataRegion:{includeCodes:['410000'],excludeCodes:[],catalogVersion:'local-boundaries-2026-10-13-v1'},time:{from:'2020-07-09',to:'2025-11-05'},filters:{speciesName:{field:'speciesName',operator:'eq',values:['家蝇']}},layerRequests:[],mapOperations:[],mapOptions:{basemap:'vec'}},context);
  return context;
};
function runFor(data: unknown, callId = 'query', type = 'DATA_TABLE_VIEW'): SkillRun {
  return {callId,skillId:'query',skillName:'查询',args:{},result:validateSkillResult({schemaVersion:'1',runId:'test',domain:'vector',status:'SUCCESS',method:'query',datasets:[],payload:withResultStatistics({type,data}),metrics:{},qualityFlags:[]})};
}

it('preserves duplicates and distinguishes null, absent and empty fields from zero/false', () => {
  const rows = [{a:0,b:false,c:null,d:''},{a:0,b:false,c:null},{a:0,b:false,c:null,d:''}];
  const table = computeResultStatistics(rows).tables[0];
  expect(table.rowCount).toBe(3);
  expect(table.columns).toEqual([{field:'a',presentCount:3,missingCount:0},{field:'b',presentCount:3,missingCount:0},{field:'c',presentCount:0,missingCount:3},{field:'d',presentCount:0,missingCount:3}]);
  expect(rows).toHaveLength(3);
});

it('rejects forged statistics at the result contract boundary', () => {
  const run = runFor([{n:73}]);
  (run.result.payload as any).statistics.tables[0].rowCount = 76;
  expect(() => validateSkillResult(run.result)).toThrow('statistics do not match');
});

it('rejects raw Arabic/Chinese counts, bogus references and contradictory missing-value claims', () => {
  const evidence = buildAnswerEvidence([runFor([{LC50:0,校正死亡率:null},{LC50:null,校正死亡率:null}])]);
  for (const text of ['查询到 **76 条**。','查询到７６条。','查询到七十六条。','{{evidence:unknown}}','{{evidence:r0t0','LC50 均为缺失。','LC50 无缺失值。','所有字段均为缺失。','各字段均无缺失值。','有效比例为百分之八十。']) expect(() => validateAnswerEvidence(text,evidence),text).toThrow();
  expect(validateAnswerEvidence('校正死亡率均为缺失。{{evidence:r0t0}}',evidence)).toContain('LC50：有效 1 行，缺失 1 行');
  expect(validateAnswerEvidence('LC50 部分缺失，校正死亡率均为缺失。',evidence)).toContain('部分缺失');
  expect(validateAnswerEvidence('**本次返回 2 行**。LC50：有效 1 行，缺失 1 行。',evidence)).toContain('本次返回 2 行');
  expect(()=>validateAnswerEvidence('本次返回 2 行。LC50：有效 2 行，缺失 1 行。',evidence)).toThrow();
});

it('keeps aggregate values separate from the number of returned groups and binds multiple calls', () => {
  const evidence = buildAnswerEvidence([runFor([{n:73}],'count'),runFor([{LC50:null},{LC50:1.386}],'detail')]);
  expect(validateAnswerEvidence('{{evidence:r0v0}}；{{evidence:r0t0}}；{{evidence:r1t0}}',evidence)).toBe('记录数：73；本次返回 1 行。各字段均无缺失值。；本次返回 2 行。LC50：有效 1 行，缺失 1 行。');
  expect(evidence.facts.find(fact=>fact.id==='r1t0')?.callId).toBe('detail');
  const nested = buildAnswerEvidence([runFor({sampleCount:73,groups:[{items:[{lc50:null},{lc50:0}]}]},'analysis','ANALYTICS_RESULT')]);
  expect(nested.tables.find(table=>table.path.join('.')==='data.groups.0.items')?.rowCount).toBe(2);
  expect(validateAnswerEvidence('{{evidence:r0v0}}',nested)).toBe('样本量：73');
});

it('summarizes full arrays rather than a spatial/model preview and ignores reused/failed calls', () => {
  const run = runFor(Array.from({length:73},()=>({LC50:null})));
  const evidence = buildAnswerEvidence([run,{...run,callId:'repeat',reusedFrom:'query'},{...run,callId:'failed',result:{...run.result,status:'FAILED',payload:null}}]);
  expect(evidence.tables).toHaveLength(1);
  expect(evidence.tables[0].rowCount).toBe(73);
  expect(validateAnswerEvidence('{{evidence:r0t0}}',evidence)).toContain('缺失 73 行');
});

it('gates NO_DATA counts and permits only known dates/identifiers alongside references', () => {
  const run = runFor([{date:'2024-10-09',LC50:1.386}]);
  const evidence = buildAnswerEvidence([run]);
  expect(validateAnswerEvidence('2024-10-09，LC50 见工作台。{{evidence:r0t0}}',evidence)).toContain('本次返回 1 行');
  expect(()=>validateAnswerEvidence('2025-10-09 有效记录 76 条。',evidence)).toThrow();
  const empty = buildAnswerEvidence([{...run,result:{...run.result,status:'NO_DATA',payload:null}}]);
  expect(()=>validateAnswerEvidence('查询到 76 条。',empty)).toThrow();
});

it('validates future result types, standalone metrics and results without any numerical evidence', () => {
  const future=runFor({total:73},'future','FUTURE_RESULT');
  const evidence=buildAnswerEvidence([future]);
  expect(validateAnswerEvidence('{{evidence:r0v0}}',evidence)).toBe('合计：73');
  expect(()=>validateAnswerEvidence('计算得到 76 条。',evidence)).toThrow();
  const noValues=runFor({reason:'程序尚未执行此指标'},'empty','ANALYTICS_RESULT');
  const none=buildAnswerEvidence([noValues]);
  expect(none.requiresValidation).toBe(true);expect(none.facts).toHaveLength(0);
  expect(()=>validateAnswerEvidence('平均值为 12。',none)).toThrow();
  expect(validateAnswerEvidence('该指标尚无程序结果。',none)).toBe('该指标尚无程序结果。');
  const metrics={...noValues,result:{...noValues.result,payload:{type:'FUTURE_RESULT'},metrics:{n:{value:73,evaluationKind:'computed' as const,datasetIds:[],definition:'SQL COUNT(*)'}}}};
  expect(validateAnswerEvidence('{{evidence:r0m0}}',buildAnswerEvidence([metrics]))).toContain('记录数：73');
  expect(()=>validateAnswerEvidence('查询到 76 条。',buildAnswerEvidence([{...noValues,result:{...noValues.result,status:'FAILED',payload:null}}]))).toThrow();
});

it('does not treat numerical assistant prose or summaries as program-calculated statistics', () => {
  const run=runFor({message:'有76条记录',summary:'有76条记录',replyText:'有76条记录',ratio:'45.21%'},'result');
  const evidence=buildAnswerEvidence([run]);
  expect(()=>validateAnswerEvidence('有76条记录',evidence)).toThrow();
  expect(validateAnswerEvidence('{{evidence:r0v0}}',evidence)).toContain('45.21%');
  const textOnly=buildAnswerEvidence([runFor({message:'76',summary:'76',replyText:'76'},'text')]);
  expect(textOnly.facts).toHaveLength(0);expect(()=>validateAnswerEvidence('记录数：76',textOnly)).toThrow();
});

it('requires a second actual SQL execution for a derived percentage; the LLM cannot calculate from rows', async () => {
  const context=ctx();let round=0;const queries:string[]=[];
  const agent=createMainAgent({listSkills:listSkillDefinitions,executeSkill:async(id,args,executionContext)=>{if(id==='skill_monitoring_data_table')queries.push(args.sql);return executeSkill(id,args,executionContext);},llm:{complete:async(request)=>{
    if(request.messages[0].content?.includes('你负责提炼会话标题'))return {role:'assistant',content:'{"title":"家蝇生测非缺失比例"}'};
    expect(request.messages[0].content).toContain(PROGRAMMATIC_ANALYSIS_INSTRUCTION);
    round++;
    if(round===1)return {role:'assistant',content:null,tool_calls:[{id:'rows',type:'function',function:{name:'skill_monitoring_data_table',arguments:JSON.stringify({sql:flySql})}}]};
    if(round===2){expect(()=>validateAnswerEvidence('占比：45.21%',buildAnswerEvidence([{callId:'rows',skillId:'query',skillName:'查询',args:{},result:JSON.parse(request.messages.find(message=>message.role==='tool')!.content!)}]))).toThrow();return {role:'assistant',content:'{"mode":"continue","reason":"明细未提供非缺失比例，需通过 SQL 程序实际计算"}'};}
    if(round===3)return {role:'assistant',content:null,tool_calls:[{id:'percentage',type:'function',function:{name:'skill_monitoring_data_table',arguments:'{"sql":"SELECT COUNT(lc50) * 100.0 / COUNT(*) AS percentage FROM fact_insecticide_resistance"}'}}]};
    return {role:'assistant',content:'{"mode":"answer","replyText":"非缺失比例由查询程序计算。{{evidence:r1v0}}"}'};
  }}});
  const turn=await collectDispatch(agent({interactionId:'programmatic-ratio',kind:'conversation',userInput:FLY_PROMPT+'计算 LC50 非缺失比例。'},context));
  expect(turn.status,turn.replyText).toBe('SUCCESS');expect(queries).toHaveLength(2);
  const result=turn.skillRuns[1].result.payload as any;
  expect(result.data[0].percentage).toBeCloseTo(33/73*100,8);
  expect(turn.replyText).toContain('45.21%');
});

it('replays the fly prompt against real rows, independently verifies COUNT/nulls, and repairs a 76-row hallucination without requerying', async () => {
  const context = ctx(); let queries = 0, corrections = 0;
  const events: any[] = [];
  const agent = createMainAgent({listSkills:listSkillDefinitions,executeSkill:async(id,args,executionContext)=>{if(id==='skill_monitoring_data_table')queries++;return executeSkill(id,args,executionContext);},llm:{complete:async(request)=>{
    if(request.messages[0].content?.includes('你负责提炼会话标题'))return {role:'assistant',content:'{"title":"河南省家蝇抗性记录"}'};
    if(request.tools)return {role:'assistant',content:null,tool_calls:[{id:'fly',type:'function',function:{name:'skill_monitoring_data_table',arguments:JSON.stringify({sql:flySql})}}]};
    corrections++;
    const replyText = corrections===1?'已查询到 76 条。':'已查询家蝇抗药性生测记录。{{evidence:r0t0}}';
    request.onDelta?.({type:'content',text:JSON.stringify({mode:'answer',replyText})});
    return {role:'assistant',content:JSON.stringify({mode:'answer',replyText})};
  }}});
  for await(const event of agent({interactionId:'fly-regression',kind:'conversation',userInput:FLY_PROMPT},context))events.push(event);
  const turn = await collectDispatch(events);
  expect(turn.status).toBe('SUCCESS'); expect(queries).toBe(1); expect(corrections).toBe(2);
  expect(turn.replyText).toContain('本次返回 73 行'); expect(turn.replyText).not.toContain('76');
  expect(turn.replyText).toContain('LC50：有效 33 行，缺失 40 行');
  expect(turn.replyText).toContain('校正死亡率：有效 0 行，缺失 73 行');
  expect(events.filter(event=>event.type==='content').map(event=>event.data.text).join('')).not.toContain('76');
  const payload = turn.agui[0].result.payload as any;
  expect(payload.statistics.tables[0].rowCount).toBe(payload.data.length);
  const db = new Database(resolveDatasetLocation('vector').path,{readonly:true});
  try {
    const independent = db.prepare("SELECT COUNT(*) AS n, COUNT(f.lc50) AS lc50, COUNT(f.corrected_mortality) AS mortality, COUNT(f.resistance_level) AS classification FROM fact_insecticide_resistance f JOIN dim_species s ON f.species_id=s.species_id JOIN dim_location l ON f.location_id=l.location_id JOIN dim_pesticide p ON f.pesticide_id=p.pesticide_id WHERE s.species_name='家蝇' AND l.province='河南省' AND f.date_id BETWEEN '2020-07-09' AND '2025-11-05'").get();
    expect(independent).toEqual({n:73,lc50:33,mortality:0,classification:0});
  } finally {db.close();}
  const html = renderToStaticMarkup(<GenerativeComponentRenderer view={payload}/>);
  expect(html).toContain('本次返回 73 行'); expect(html).toContain('LC50：有效 33 行，缺失 40 行');
});

it('fails a repeatedly incorrect answer, retains real data and publishes only a verified summary', async () => {
  const context = ctx();
  const agent = createMainAgent({listSkills:listSkillDefinitions,executeSkill,llm:{complete:async(request)=>request.tools?{role:'assistant',content:null,tool_calls:[{id:'fly',type:'function',function:{name:'skill_monitoring_data_table',arguments:JSON.stringify({sql:flySql})}}]}:{role:'assistant',content:'{"mode":"answer","replyText":"已查询到 76 条。"}'}}});
  const turn = await collectDispatch(agent({interactionId:'bad-summary',kind:'conversation',userInput:FLY_PROMPT},context));
  expect(turn.status).toBe('FAILED'); expect(turn.error?.code).toBe('ANSWER_EVIDENCE_MISMATCH');
  expect(turn.agui).toHaveLength(1); expect(turn.replyText).toContain('本次返回 73 行'); expect(turn.replyText).not.toContain('76');
});

it.each(['vector','foodborne','env','chronic'] as const)('adds identical statistics at the shared %s query boundary', async(domain) => {
  const sample = RECOMMENDATION_DATA_CASES.find(item=>item.domain===domain&&item.skillId.endsWith('_table'))!;
  const result = await executeSkill(sample.skillId,sample.args,createDevelopmentContext(domain));
  expect(result.status).toBe('SUCCESS');
  const payload = result.payload as any;
  expect(payload.statistics).toEqual(computeResultStatistics(payload.data));
  expect(payload.statistics.tables[0].rowCount).toBe(payload.data.length);
});

it('covers the resistance analysis skill, which uses a separate Python record-query path', async () => {
  const result = await executeSkill('skill_resistance_evaluation',{speciesName:'家蝇',asOf:'2025-11-05'},createDevelopmentContext('vector'));
  expect(result.status).toBe('SUCCESS');
  const payload = result.payload as any;
  const table = payload.statistics.tables.find((table:any)=>table.path.join('.')==='data.items');
  expect(table.rowCount).toBe(73);
  expect(table.columns.find((column:any)=>column.field==='lc50')).toEqual({field:'lc50',presentCount:33,missingCount:40});
});

it('covers custom SQL preview/registered execution and report counts using server evidence', async () => {
  const context = createDevelopmentContext('vector');
  const created = await executeSkill('skill_meta_custom_builder',{skillName:'证据统计预览',sqlQuery:'SELECT lc50 FROM fact_insecticide_resistance LIMIT 3'},context);
  expect(created.status,JSON.stringify(created.error)).toBe('SUCCESS');
  const preview = created.payload as any;
  expect(preview.statistics.tables[0].path).toEqual(['previewData']);
  expect(preview.statistics.tables[0].rowCount).toBe(3);
  const executed = await executeSkill(preview.skill.id,{},context);
  expect(executed.status).toBe('SUCCESS');
  expect((executed.payload as any).data).toEqual(preview.previewData);
  expect((executed.payload as any).statistics.tables[0].columns).toEqual(preview.statistics.tables[0].columns);
  const report = await executeSkill('skill_auto_report_gen',{},context);
  expect(report.status,JSON.stringify(report.error)).toBe('SUCCESS');
  const evidence = buildAnswerEvidence([{callId:'report',skillId:'skill_auto_report_gen',skillName:'报告',args:{},result:report}]);
  const recordCount = (report.payload as any).recordCount;
  expect(validateAnswerEvidence('{{evidence:r0v0}}',evidence).replaceAll(',','')).toBe(`记录数：${recordCount}`);
  expect(()=>validateAnswerEvidence('报告统计 76 条记录。',evidence)).toThrow();
});

it('uses Python-provided species totals in both the workbench and answer evidence', async () => {
  const result=await executeSkill('skill_species_composition',{category:'蚊',methodName:'诱蚊灯法',year:2024,asOf:'2024-12-31'},createDevelopmentContext('vector'));
  expect(result.status,JSON.stringify(result.error)).toBe('SUCCESS');
  const data=(result.payload as any).data;
  const db=new Database(resolveDatasetLocation('vector').path,{readonly:true});
  try {
    const independent=db.prepare("SELECT SUM(f.capture_count) AS totalCount,COUNT(DISTINCT s.species_name) AS speciesCount,COUNT(DISTINCT l.city) AS cityCount FROM fact_monitoring f JOIN dim_species s ON f.species_id=s.species_id JOIN dim_location l ON f.location_id=l.location_id JOIN dim_method m ON f.method_id=m.method_id WHERE f.capture_count>=0 AND s.category='蚊' AND m.method_name='诱蚊灯法' AND f.date_id BETWEEN '2024-01-01' AND '2024-12-31'").get();
    expect(data).toMatchObject(independent as object);
  } finally {db.close();}
  const evidence=buildAnswerEvidence([{callId:'composition',skillId:'skill_species_composition',skillName:'物种构成',args:{},result}]);
  expect(evidence.facts.find(fact=>fact.path.join('.')==='data.totalCount')?.value).toBe(data.totalCount);
  const html=renderToStaticMarkup(<SpeciesCompositionSummary data={{...data,items:data.items.slice(0,1)}}/>);
  expect(html).toContain('物种数量');expect(html).toContain(data.totalCount.toLocaleString('zh-CN'));
  const legacy=renderToStaticMarkup(<SpeciesCompositionSummary data={{items:[{speciesName:'test',totalCount:7,percentage:null}]}}/>);
  expect(legacy).toContain('未提供 / 未评估');
});
