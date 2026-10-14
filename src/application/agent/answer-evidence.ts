import type {SkillRun} from '@/contracts/agent-interaction';
import {computeResultStatistics, resultStatisticsSource, tableStatisticsText, type TableStatistics, type ResultStatistics} from '@/contracts/result-statistics';
import {fieldLabel, formatValue} from '@/features/workbench/result-presentation';

export interface AnswerFact {
  id: string;
  callId: string;
  path: string[];
  text: string;
  value?: number;
}
export interface AnswerEvidence {
  requiresValidation: boolean;
  facts: AnswerFact[];
  tables: TableStatistics[];
  dates: string[];
  identifiers: string[];
}
const isObject = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
// Presentation metadata and cached assistant prose cannot become numerical
// analysis evidence. Large map geometry is rendered directly by the workbench.
const nonAnalysisFields = new Set(['type','schemaVersion','runId','callId','domain','status','method','title','summary','replyText','reasoningText','text','content','message','reason','explanation','warnings','qualityFlags','definition','content_markdown','contentMarkdown','sql','sqlQuery','sql_query','inputSchema','outputSchema','parametersSchema','geometry','coordinates','bbox','spatialOutputs','statistics','generativeViewSnapshot','generative_view_snapshot','last_generative_view']);
const namedValueFields = new Set(['label','name','speciesName','species_name','diseaseName','disease_name','pathogenName','pathogen_name','pathogen','pesticideName','pesticide_name','methodName','method_name','foodName','food_name','category','injuryType','injury_type']);
const identifierFields = new Set(['code','candidateCode','candidateCodes','standardIcd10','classification','CodingVersion','rulesVersion','dictionaryVersion','upstream','downstream','MLST','mlst','serotype','stType','id']);
const groupingFields = new Set([...namedValueFields,'city','district','date','date_id','month','year','period','月份','年月','日期','地市','区县','物种','物种名称','采样方法','药剂']);
const escapeMarkdown = (text:string):string => text.replace(/[\\`*_{}[\]<>|]/g,'\\$&').replace(/[\r\n]+/g,' ');

export const PROGRAMMATIC_ANALYSIS_INSTRUCTION = '统计分析执行规则：LLM 仅负责理解需求、选择/调用已登记程序或技能以及解释实际返回结果。禁止 LLM 自己数数、累加、求均值、算比例、差值、增长率、倍数、最值、排名或推断未执行的模型指标；这些统计和分析必须由 SQL 查询程序、Python 分析程序或对应技能实际执行。不得把自己算出的数值填进工具参数、SELECT 常量或报告，冒充程序统计。若本轮工具没有返回所需派生指标，必须继续调用能够实际计算该指标的技能（按 mode=continue 请求追加工具），不能只依据原始明细或已有数字自行计算。没有对应能力、数据不足或执行失败时明确说明，不能补造结果。程序计算的记录数、缺失值统计和全部指标由工作台与对话共同引用；数值结论必须对应实际运行、来源路径和指标定义。';

/** References are bound to a call and a path, never to a pool of acceptable numbers.
 * Table references expand to a complete labelled summary, so row counts and
 * missing counts cannot accidentally be exchanged. Numeric values are labelled too. */
export function buildAnswerEvidence(runs: SkillRun[]): AnswerEvidence {
  const facts: AnswerFact[] = [], tables: TableStatistics[] = [], dates = new Set<string>(), identifiers = new Set<string>(['LC50', 'LC90', 'R2', 'R²', 'ICD10', 'ICD-10', 'PM2.5','PM25','PM10','O3','NO2','SO2','CO2']);
  const seen = new Set<string>();
  runs.forEach((run, runIndex) => {
    if (run.result.status === 'NO_DATA' && !run.reusedFrom) {
      facts.push({id: `r${runIndex}empty`, callId: run.callId, path: [], text: '本次技能查询未返回数据，无法据此推断无风险或字段均无缺失。'});
      return;
    }
    if (run.reusedFrom || seen.has(run.callId) || !['SUCCESS', 'INSUFFICIENT_DATA', 'REVIEW_REQUIRED'].includes(run.result.status)) return;
    seen.add(run.callId);
    identifiers.add(run.result.method);
    for(const dataset of run.result.datasets??[])if(/^\d{4}-\d{2}-\d{2}/.test(dataset.asOf))dates.add(dataset.asOf.slice(0,10));
    const payload = run.result.payload;
    if (!isObject(payload)) return;
    const knownSource = resultStatisticsSource(payload);
    const source = knownSource ?? (payload.type === 'AUTO_GENERATED_REPORT' ? {data:{recordCount:payload.recordCount,reportId:payload.reportId,sections:payload.sections},path:[]} : {data:payload,path:[]});
    // Use the server's full-payload statistics, never a model's spatial preview.
    // Older recorded results may need compatibility statistics computed here.
    const statistics = knownSource ? payload.statistics as ResultStatistics ?? computeResultStatistics(source.data,source.path) : {tables:[]};
    statistics.tables.forEach((table, index) => {
      tables.push(table);
      facts.push({id: `r${runIndex}t${index}`, callId: run.callId, path: table.path, text: tableStatisticsText(table, fieldLabel)});
      table.columns.forEach(column => { identifiers.add(column.field); identifiers.add(fieldLabel(column.field)); });
    });
    let valueIndex = 0;
    const visit = (value: unknown, path: string[], context:Record<string,unknown> = {}): void => {
      const key = path.at(-1)!;
      const groupedText = (labelledValue:string):string => {
        const labels=Object.entries(context).filter(([field,item])=>field!==key&&groupingFields.has(field)&&(typeof item==='string'||typeof item==='number'));
        return [...labels.map(([field,item])=>`${escapeMarkdown(fieldLabel(field))}：${escapeMarkdown(formatValue(item,field))}`),labelledValue].join('；');
      };
      if (typeof value === 'number') {
        if(!Number.isFinite(value))return;
        if(['leadHours','hours','windowHours'].includes(key))identifiers.add(value+'小时');
        facts.push({id: `r${runIndex}v${valueIndex++}`, callId: run.callId, path, value, text: groupedText(`${escapeMarkdown(fieldLabel(key))}：${formatValue(value, key)}`)});
      } else if (typeof value === 'string') {
        if (/^\d{4}-\d{2}(?:-\d{2}(?:[T ][\d:.Z+-]+)?)?$/.test(value)) {dates.add(value);dates.add(value.slice(0,10));if(/^\d{2}:\d{2}/.test(value.slice(11))){dates.add(value.slice(11));dates.add(value.slice(11,16));}}
        else if ((namedValueFields.has(path.at(-1)??'')||identifierFields.has(path.at(-1)??'')||identifierFields.has(path.at(-2)??'')||/(?:_id|_code|Id|Ids|Code)$/.test(path.at(-1)??'')) && value.length <= 100 && /\d/.test(value) && /[a-z\u4e00-\u9fff]/i.test(value)) identifiers.add(value);
        else if (/^[+-]?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?%?$/.test(value) && Number.isFinite(Number(value.replace(/%$/,'')))) {
          facts.push({id:`r${runIndex}v${valueIndex++}`,callId:run.callId,path,text:groupedText(`${escapeMarkdown(fieldLabel(key))}：${formatValue(value,key)}`)});
        }
      } else if (Array.isArray(value)) {
        // Summaries cover every returned row; numeric comparisons preview only
        // the first ten per collection, as full details belong in the workbench.
        if(['history','forecasts'].includes(key)&&value.length&&value.every(item=>isObject(item)&&/^\d{4}-\d{2}$/.test(String(item.month??item.period??'')))){const months=new Set(value.map(item=>String((item as any).month??(item as any).period))).size;identifiers.add(months+'个月');const chinese=['','一','两','三','四','五','六','七','八','九','十','十一','十二'][months];if(chinese)identifiers.add(chinese+'个月');}
        if(key==='weights'&&value.length&&value.every(item=>typeof item==='number')){const count=['','一','两','三','四','五','六','七','八','九','十'][value.length]??String(value.length);for(const suffix of ['项得分','项评分','项指标','项短板'])identifiers.add(count+suffix);}
        if(key==='lagCorrelationTrend'&&value.length&&value.every(item=>isObject(item)&&Number.isInteger(item.lagDays))){const lags=value.map(item=>(item as {lagDays:number}).lagDays),from=Math.min(...lags),to=Math.max(...lags);for(const dash of ['—','–','-','至'])identifiers.add(from+dash+to+'天滞后窗口');}
        const top=/Top(\d+)$/i.exec(key);if(top&&value.length<=Number(top[1]))identifiers.add('TOP'+top[1]);
        value.slice(0, 10).forEach((item, index) => visit(item, [...path, String(index)]));
      } else if (isObject(value)) {
        if(Object.hasOwn(value,'lower95')&&Object.hasOwn(value,'upper95'))for(const label of ['95%可信区间','95%置信区间','95%区间'])identifiers.add(label);
        Object.entries(value).forEach(([key, item]) => {if(nonAnalysisFields.has(key))return;identifiers.add(key); identifiers.add(fieldLabel(key)); visit(item, [...path, key],value);});
      }
    };
    visit(source.data, source.path);
    // Quoted certificate spans are source text, not newly computed clinical numbers.
    const certificate=isObject(source.data)?source.data.parsedCertificate:undefined;
    if(isObject(certificate)&&Array.isArray(certificate.rows))for(const row of certificate.rows){
      if(!isObject(row))continue;
      for(const literal of [row.position,row.text,...(Array.isArray(row.entities)?row.entities.filter(isObject).map(entity=>entity.text):[])])if(typeof literal==='string'&&literal.length<=200&&/\d/.test(literal)&&!/^\d+$/.test(literal))identifiers.add(literal);
    }
    if(isObject(source.data)&&typeof source.data.method==='string')identifiers.add(source.data.method);
    if(payload.type==='AUTO_GENERATED_REPORT'&&Array.isArray(payload.sections))for(const section of payload.sections){if(isObject(section)&&typeof section.heading==='string')for(const match of section.heading.matchAll(/TOP\d+/g))identifiers.add(match[0]);}
    if(typeof payload.date==='string'&&/^\d{4}-\d{2}-\d{2}/.test(payload.date))dates.add(payload.date.slice(0,10));
    if (isObject(payload.scope)) Object.values(payload.scope).forEach(value => {if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) dates.add(value);});
    Object.entries(run.result.metrics).forEach(([key, metric]) => {
      if (metric.value !== null && metric.evaluationKind !== 'unvalidated') facts.push({id: `r${runIndex}m${valueIndex++}`, callId: run.callId, path: ['metrics', key], value: metric.value, text: `${fieldLabel(key)}：${formatValue(metric.value, key)}（${metric.definition}）`});
    });
  });
  return {requiresValidation:runs.length>0,facts, tables, dates: [...dates], identifiers: [...identifiers].filter(value => (/\d/.test(value)||/^[一两三四五六七八九十]+(?:个月|项(?:得分|评分|指标|短板))$/.test(value)) && !/^\d+$/.test(value))};
}

export const ANSWER_EVIDENCE_INSTRUCTION = '服务器为查询和分析结果计算了统计证据。replyText 应先回答用户要求的业务指标与分组结果，再说明数据支持的变化、差异与限制，不以返回行数或缺失值统计代替业务总结。所有业务数值（记录数、缺失数、有效数、比例、分析指标、表格数值等）必须用 {{evidence:证据id}} 引用下方 answerEvidence，或逐字引用证据 text 中带字段名的完整统计句，不得自行计数、计算或填写其他数字/中文数量。引用会由服务器展开成带字段名及分组信息的真实数值；表格统计引用会展开成返回行数和各缺失字段的有效/缺失数。只引用与当前 callId 和 path 对应的证据，不跨工具混用。日期可使用工具结果/批准范围内的 YYYY-MM-DD；LC50 等字段名称保留。引用展开为完整的带字段名的句子，请将引用独立放在列表项中，不把整句引用当作某个计数嵌入语句或表格单元。返回行数仅指本次返回数据，不代表全部匹配记录；聚合查询的一行不能称为一条原始监测记录。完整明细在工作台展示，对话只引用与问题相关的关键指标，不逐行重写。证据引用、数值校验、JSON修正属于内部处理，replyText 不解释这些技术过程。';

/** A model formatting failure must not replace real query data with diagnostics.
 * This fallback only renders labelled program results; it invents no conclusions. */
export function verifiedBusinessSummary(runs:SkillRun[],evidence:AnswerEvidence):string|undefined {
 const sections:string[]=[];
 for(const run of runs){
  if(run.reusedFrom||!['SUCCESS','INSUFFICIENT_DATA','REVIEW_REQUIRED','NO_DATA'].includes(run.result.status))continue;
  const facts=evidence.facts.filter(fact=>fact.callId===run.callId);
  if(!facts.length)continue;
  const values=facts.filter(fact=>!/^r\d+t\d+$/.test(fact.id)&&!/(?:^|_)(?:id|lat|lon|latitude|longitude)$/i.test(fact.path.at(-1)??''));
  const summaries=facts.filter(fact=>/^r\d+t\d+$/.test(fact.id));
  const selected=[...values.slice(0,12),...summaries.slice(0,2)];
  if(!selected.length)continue;
  const limit=run.result.status==='INSUFFICIENT_DATA'?'\n\n当前数据不足以完成所请求的全部分析。':run.result.status==='REVIEW_REQUIRED'?'\n\n结果仍需专业复核。':'';
  // Validate business prose before adding the registered skill name: a name
  // such as Text2SQL contains a digit but is trusted presentation metadata.
  const body=validateAnswerEvidence(selected.map(fact=>`- {{evidence:${fact.id}}}`).join('\n')+limit,evidence);
  sections.push(`### ${escapeMarkdown(run.skillName)}\n\n${body}`);
 }
 if(!sections.length)return;
 return `查询结果如下，完整明细可在工作台查看。\n\n${sections.join('\n\n')}`;
}

export class AnswerEvidenceError extends Error {}

/** Fail closed: no unbound business numbers, unknown references or contradictory
 * all-missing/no-missing assertions may reach HTTP, SSE, history or the workbench. */
export function validateAnswerEvidence(text: string, evidence: AnswerEvidence): string {
  const byId = new Map(evidence.facts.map(fact => [fact.id, fact]));
  const pattern = /\{\{evidence:([^{}]+)\}\}/g;
  let remaining = text.replace(pattern, (_match, id: string) => {
    if (!byId.has(id)) throw new AnswerEvidenceError(`未知统计证据引用：${id}`);
    return '';
  });
  if (/\{\{|\}\}/.test(remaining)) throw new AnswerEvidenceError('统计证据引用格式不完整');
  if (!evidence.requiresValidation && !evidence.facts.length) return text;
  const sentences = remaining.split(/[。；，,\n]/);
  // List ordinals are formatting, not business facts.
  const normalize = (value: string) => value.normalize('NFKC').replace(/\*\*|__|`|\s/g,'').toLowerCase();
  remaining = remaining.normalize('NFKC').replace(/^\s*(?:#{1,6}\s+)?(?:\*\*)?\d+[.)、](?:\*\*)?\s+/gm, '');
  remaining = normalize(remaining);
  // Compatible models may quote the labelled server text instead of its ID.
  // Verify whole labelled propositions, never accept a bare number just because
  // that number occurs somewhere else in the result.
  const propositions = evidence.facts.flatMap(fact => /^r\d+t\d+$/.test(fact.id) ? fact.text.split(/[。；]/) : [fact.text]).map(normalize).filter(Boolean).sort((a,b)=>b.length-a.length);
  for (const proposition of propositions) remaining = remaining.split(proposition).join('');
  // A date range is a label, not a computed business count. Both endpoints
  // must occur in the same evidenced year before shorter month labels are removed.
  const knownMonths=new Set(evidence.dates.filter(date=>/^\d{4}-\d{2}/.test(date)).map(date=>date.slice(0,7)));
  remaining=remaining.replace(/(?:(\d{4})年)?(\d{1,2})[—–至到-](\d{1,2})月/g,(label,year,from,to)=>{
    const years=year?[year]:[...new Set([...knownMonths].map(date=>date.slice(0,4)))];
    return Number(from)<=Number(to)&&years.some(y=>knownMonths.has(y+'-'+from.padStart(2,'0'))&&knownMonths.has(y+'-'+to.padStart(2,'0')))?'':label;
  });
  const dateLabels=evidence.dates.filter(date=>/^\d{4}-\d{2}(?:-\d{2})?$/.test(date)).flatMap(date=>{const [year,month,day]=date.split('-');return [year+'年',...(month?[year+'年'+Number(month)+'月',Number(month)+'月']:[]),...(day?[year+'年'+Number(month)+'月'+Number(day)+'日',Number(month)+'月'+Number(day)+'日']:[])];});
  for (const literal of [...dateLabels, ...evidence.dates, ...evidence.identifiers].sort((a, b) => b.length - a.length)) remaining = remaining.split(normalize(literal)).join('');
  const unbound=/\d|[零〇一二两三四五六七八九十百千万亿]+\s*(?:条|行|个|例|份|只|项|成|倍)|百分之/.exec(remaining);
  if(unbound)throw new AnswerEvidenceError('业务数值必须引用服务器统计证据，禁止直接填写或自行计数；未绑定片段：'+remaining.slice(Math.max(0,unbound.index-15),unbound.index+35));
  for (const sentence of sentences.filter(sentence=>/(?:所有|全部|各)(?:字段|指标)/.test(sentence))) {
    const columns=evidence.tables.flatMap(table=>table.columns);
    if (/(?:均|全部|全都)(?:为|是)?缺失|无有效值/.test(sentence)&&(!columns.length||columns.some(column=>column.presentCount>0)))throw new AnswerEvidenceError('返回数据并非所有字段缺失');
    if (/无缺失|没有缺失|(?:均|全部)(?:为|是)?有效/.test(sentence)&&(!columns.length||columns.some(column=>column.missingCount>0)))throw new AnswerEvidenceError('返回数据存在缺失字段');
  }
  for (const table of evidence.tables) for (const column of table.columns) {
    const names = [column.field, fieldLabel(column.field)];
    for (const sentence of sentences.filter(sentence => names.some(name => sentence.includes(name)))) {
      if (/(?:均|全部|全都)(?:为|是)?缺失|均无有效值|无有效值/.test(sentence) && column.presentCount > 0) throw new AnswerEvidenceError(`${fieldLabel(column.field)} 并非全部缺失`);
      if (/无缺失|没有缺失|(?:均|全部)(?:为|是)?有效/.test(sentence) && column.missingCount > 0) throw new AnswerEvidenceError(`${fieldLabel(column.field)} 存在缺失值`);
    }
  }
  return text.replace(pattern, (_match, id: string) => byId.get(id)!.text);
}

/** Bounded evidence context; full facts remain available to server validation and UI. */
export function modelEvidence(evidence:AnswerEvidence):AnswerFact[]{
 const selected:AnswerFact[]=[];
 for(const callId of new Set(evidence.facts.map(f=>f.callId))){
  const facts=evidence.facts.filter(f=>f.callId===callId);
  const priority=facts.filter(f=>/^r\d+t\d+$/.test(f.id)||f.path.length<=2||f.path.some(p=>['validation','metrics','threshold','job'].includes(p)));
  const chosen=new Map([...priority,...facts].map(f=>[f.id,f]));
  selected.push(...[...chosen.values()].slice(0,60));
 }
 return selected;
}
