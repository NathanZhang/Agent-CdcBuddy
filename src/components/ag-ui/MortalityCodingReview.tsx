'use client';
import React,{useEffect,useState} from 'react';
import {useFunctionalInteraction} from '@/features/workbench/use-workbench-controller';

const positions:Record<string,string>={a:'第一部分 (a) 直接导致死亡',b:'第一部分 (b)',c:'第一部分 (c)',d:'第一部分 (d)',e:'第一部分 (e)',part2:'第二部分 其他重要情况'};
const engineLabels:Record<string,string>={PARSING_ONLY:'已解析，尚未进行根本死因选择',ENGINE_NOT_CONFIGURED:'待接入 Iris/MUSE 引擎及规则表',INPUT_REVIEW_REQUIRED:'需补齐或更正证明书',ENGINE_ERROR:'引擎执行失败，保留人工复核',ENGINE_REJECTED:'Iris 已退回，需人工处理',CANDIDATE_READY:'Iris 候选已返回，尚未签署'};
const issueLabels:Record<string,string>={'iris-age-requires-years-or-days':'Iris 年龄字段仅接受岁或日，请由填报人确认，不能自动换算月龄','missing-age':'未填写年龄','missing-sex':'未填写性别','missing-manner-of-death':'未填写死亡方式','non-affirmed-diagnosis':'存在否定或不确定诊断，请核对原文','ambiguous-category':'存在多个候选类目','unmapped-diagnosis':'存在未匹配词条，需机构字典或编码员处理','unsupported-code-or-national-extension':'含未知编码或国家扩展码，不能直接送入WHO编码模式','gap-in-part-one':'第一部分分行有缺口','missing-part-one':'缺少第一部分','duplicate-certificate-position':'同一位置重复出现','unassigned-text-before-certificate':'分行前还有未归属文字','unstructured-causal-order-requires-review':'叙述性因果次序需人工分行','arrow-order-requires-review':'请确认箭头按直接死因到起始疾病排列','code-mode-requires-explicit-codes-only':'编码模式每行只能填写已核对的编码'};
export function MortalityCodingReview({data}:{data:any}){
 const interact=useFunctionalInteraction();
 const [chain,setChain]=useState<Record<string,string>>(data.inputDeathChain??{});
 const [demographics,setDemographics]=useState(data.demographics??{});
 const [entryMode,setEntryMode]=useState(data.entryMode??'text');
 const [confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 useEffect(()=>{setChain(data.inputDeathChain??{});setDemographics(data.demographics??{});setEntryMode(data.entryMode??'text');setConfirmed(false);setMessage('');},[data]);
 const changed=()=>{setConfirmed(false);setMessage('已修改；显示的分析结果仍对应上次提交。请重新解析或调用引擎。');};
 const run=async(mode:'dictionary'|'graph')=>{
  setBusy(true);setMessage('');
  try{
   const inputChain=Object.fromEntries(Object.entries(chain).filter(([,v])=>v.trim()));
   const result=await interact({type:'skill.execute',id:'skill_icd10_nlp_inference',args:{mode,entryMode,inputChain,demographics},prompt:mode==='graph'?'对已核对的证明书调用 Iris/MUSE，保留人工复核。':'重新解析修改后的死因文本。'});
   if(!result||result.status==='FAILED')setMessage(result?.replyText??'执行失败，输入仍保留。');
  }catch{setMessage('执行失败，输入仍保留，请重试。');}finally{setBusy(false);}
 };
 return <section className="space-y-4" aria-label="死因编码人工复核">
  <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-950 dark:bg-amber-950 dark:text-amber-100">
   <p className="font-semibold">{engineLabels[data.engineResult?.selectionStatus]??'待人工复核'}</p>
   <p className="text-sm">三位类目用于分类检索。根本死因只接受 Iris/MUSE 输出，全部结果保持待复核，未写入正式死因登记。</p>
  </div>
  {data.inferredUnderlyingCause&&<p className="font-semibold">引擎候选：{data.inferredUnderlyingCause.standardIcd10} · {data.inferredUnderlyingCause.diseaseName}（名称为三位类目名称）</p>}
  <div className="overflow-x-auto"><table className="w-full text-left text-sm" aria-label="逐行死因解析"><thead><tr>{['位置','原文','实体与类目候选','病程'].map(t=><th key={t} className="border-b p-2">{t}</th>)}</tr></thead><tbody>{(data.parsedCertificate?.rows??[]).map((r:any,i:number)=><tr key={i}><td className="border-b p-2">{r.position==='part2'?'第二部分':r.position}</td><td className="border-b p-2">{r.text}</td><td className="border-b p-2">{r.entities?.map((e:any,j:number)=><p key={j}>{e.text} · {({negated:'否定，不作为肯定诊断',uncertain:'不确定',reported:'原文报告'} as Record<string,string>)[e.assertion]} · {e.candidateCodes.join(' / ')}</p>)}{!r.entities?.length&&(r.explicitCodes?.length?r.explicitCodes.map((e:any)=>e.code).join(' / '):'未匹配，需复核')}</td><td className="border-b p-2">{r.durations?.map((d:any)=>d.text).join('、')||'未提供'}</td></tr>)}</tbody></table></div>
  <p className="text-xs text-slate-500">类目来源：{data.parsedCertificate?.catalogue?.sourceFile??'未提供'} · {data.parsedCertificate?.categoryCount??0} 条；原表版本未注明，三位类目不用于补全细分编码。</p>
  {!!data.inputIssues?.length&&<ul className="list-disc pl-5 text-sm">{data.inputIssues.map((s:string)=><li key={s}>{issueLabels[s]??s}</li>)}</ul>}
  {data.engineResult?.ident&&<div className="text-sm"><p>Iris 状态：{data.engineResult.ident.Status}；退回原因：{data.engineResult.ident.Reject}</p><p>编码版本：{data.engineResult.ident.CodingVersion}</p><p>工作批次：{data.engineResult.workLot??'未提供'}</p><p>{data.engineResult.ruleTraceNote}</p></div>}
  <details className="space-y-3"><summary className="cursor-pointer font-semibold">核对并修改证明书</summary>
  <div className="grid gap-2 sm:grid-cols-2">{Object.entries(positions).map(([key,label])=><label className="block text-sm" key={key}>{label}<textarea aria-label={label} maxLength={4000} rows={2} value={chain[key]??''} onChange={e=>{setChain({...chain,[key]:e.target.value});changed();}} className="mt-1 block w-full rounded border p-2 bg-transparent"/></label>)}</div>
  <div className="flex flex-wrap gap-3 text-sm">
   <label>性别<select aria-label="证明书性别" value={demographics.sex??''} onChange={e=>{const next={...demographics};if(e.target.value)next.sex=e.target.value;else delete next.sex;setDemographics(next);changed();}} className="ml-2 border p-2 bg-transparent"><option value="">请选择</option><option value="1">男</option><option value="2">女</option><option value="9">未知</option></select></label>
   <label>年龄<input aria-label="死亡年龄" type="number" min="0" value={demographics.age?.value??''} onChange={e=>{const next={...demographics};if(e.target.value==='')delete next.age;else next.age={value:Number(e.target.value),unit:next.age?.unit??'Y'};setDemographics(next);changed();}} className="ml-2 w-24 border p-2 bg-transparent"/></label>
   <select disabled={!demographics.age} aria-label="年龄单位" value={demographics.age?.unit??'Y'} onChange={e=>{setDemographics({...demographics,age:{value:demographics.age?.value??0,unit:e.target.value}});changed();}} className="border p-2 bg-transparent">{[['Y','岁'],['M','月'],['D','日'],['H','小时'],['N','分钟']].map(([k,l])=><option value={k} key={k}>{l}</option>)}</select>
   <label>死亡方式<select aria-label="死亡方式" value={demographics.mannerOfDeath??''} onChange={e=>{const next={...demographics};if(e.target.value==='')delete next.mannerOfDeath;else next.mannerOfDeath=Number(e.target.value);setDemographics(next);changed();}} className="ml-2 border p-2 bg-transparent">{[['','请选择'],['0','疾病'],['1','他杀'],['2','意外'],['3','调查中'],['4','自杀'],['5','无法确定'],['6','未知'],['8','法律干预'],['9','战争']].map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></label>
   <label>输入模式<select aria-label="Iris 输入模式" value={entryMode} onChange={e=>{setEntryMode(e.target.value);changed();}} className="ml-2 border p-2 bg-transparent"><option value="text">疾病文本（机构字典编码）</option><option value="code">人工已编码（仅填 ICD-10 编码）</option></select></label>
  </div>
  <details className="text-sm"><summary>孕产与围生期补充信息</summary><div className="flex flex-wrap gap-3 pt-2">{[['pregnancy','妊娠情况',[['0','死亡时怀孕'],['1','产后42日内'],['2','产后43日到1年'],['3','未怀孕'],['9','未知']]],['stillbirth','死胎',[['1','是'],['N','否'],['U','未知']]]].map(([key,label,options]:any)=><label key={key}>{label}<select aria-label={label} value={demographics[key]??''} onChange={e=>{const next={...demographics};if(e.target.value)next[key]=e.target.value;else delete next[key];setDemographics(next);changed();}} className="ml-2 border p-2 bg-transparent"><option value="">未提供</option>{options.map(([k,l]:string[])=><option key={k} value={k}>{l}</option>)}</select></label>)}{[['completedWeeks','孕周'],['birthWeight','出生体重（克）'],['ageOfMother','母亲年龄']].map(([key,label])=><label key={key}>{label}<input aria-label={label} value={demographics[key]??''} onChange={e=>{const next={...demographics};if(e.target.value)next[key]=e.target.value;else delete next[key];setDemographics(next);changed();}} className="ml-2 w-24 border p-2 bg-transparent"/></label>)}</div></details>
  <label className="block text-sm"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> 已核对分行、第二部分、年龄、性别及死亡方式；允许按配置调用 Iris 进行候选判定</label>
  <div className="flex gap-3"><button disabled={busy} onClick={()=>void run('dictionary')} className="border rounded px-3 py-2">重新解析</button><button disabled={busy||!confirmed} onClick={()=>void run('graph')} className="rounded bg-sky-700 px-3 py-2 text-white disabled:opacity-40">调用 Iris/MUSE</button></div>
  <p role="status" className="text-sm">{message}</p>
  </details>
 </section>;
}
