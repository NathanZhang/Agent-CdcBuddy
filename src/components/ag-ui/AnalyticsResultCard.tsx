 'use client';
import React,{useState} from 'react';
import {MapCanvas} from './MapCanvas';
import {QueryResultVisualization} from './QueryResultVisualization';
import {BarChart3,Info} from 'lucide-react';
import {useFunctionalInteraction} from '@/features/workbench/use-workbench-controller';
import {methodLabel,qualityLabel,statusLabel,inputFailureText} from '@/features/workbench/result-presentation';
import {ResultDataView} from './ResultDataView';
import {SpeciesCompositionSummary} from './SpeciesCompositionSummary';
import {MortalityCodingReview} from './MortalityCodingReview';
import {ResultStatisticsSummary} from './ResultStatisticsSummary';
function WorkflowActions({value}:{value:any}){const interact=useFunctionalInteraction();const [record,setRecord]=useState('');const id=value?.job_id ?? value?.jobId;return <div className="space-y-2">{Array.isArray(value?.jobs)&&value.jobs.map((j:any)=><button key={j.job_id} className="block text-blue-600" onClick={()=>void interact({type:'workflow.read',args:{action:'read',jobId:j.job_id},prompt:'调用 skill_job_manage 读取所选任务。'})}>{j.job_id} · {statusLabel(j.status)}</button>)}{id&&value.status==='WAITING_REVIEW'&&<div className="flex gap-3"><button onClick={()=>void interact({type:'approval.decide',id,args:{decision:'approve'}})}>专业审批通过</button><button onClick={()=>void interact({type:'approval.decide',id,args:{decision:'reject'}})}>拒绝审批</button></div>}{value?.ticket_id&&value.status==='OPEN'&&<div><input aria-label="已采集复测记录ID" value={record} onChange={e=>setRecord(e.target.value)}/><button disabled={!record.trim()} onClick={()=>void interact({type:'workflow.retest',args:{ticketId:value.ticket_id,sourceRecordId:record},prompt:'调用 skill_retest_submit 提交已采集复测证据。'})}>提交复测证据</button></div>}</div>;}

export function AnalyticsResultCard({data}:{data:any}) {
 const [showRaw,setShowRaw]=useState(false);const interact=useFunctionalInteraction();
 const original=data.data??{};const payload=typeof original.reason==='string'?{...original,reason:inputFailureText(original.reason)}:original;
 const flags=Array.from(new Set<string>([...(data.qualityFlags??[]),...(payload.qualityFlags??[])]));
 const species=data.method==='method-separated-kmeans-capture-v1'&&Array.isArray(payload.items);
 const mortality=payload.method==='icd10-iris-mortality-v2';
 const series=[...(Array.isArray(payload.models)?payload.models:[]),...(payload.trend?.history?[payload.trend]:[]),...(payload.forecast?.history?[payload.forecast]:[])];
 const displayed=Object.fromEntries(Object.entries(payload).filter(([key])=>!['type','method','status','qualityFlags','steps','filters','mapComposition'].includes(key)));
 return <section className="min-w-0 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm overflow-hidden">
  <header className="p-5 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-sky-50 to-white dark:from-sky-950/40 dark:to-slate-950">
   <div className="flex flex-wrap items-start gap-3"><span className="p-2 rounded-xl bg-sky-100 dark:bg-sky-900/50 text-sky-600 dark:text-sky-400"><BarChart3 size={20}/></span><div className="flex-1 min-w-0"><h3 className="text-base font-semibold">{data.title||'分析结果'}</h3><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{methodLabel(payload.method??data.method??'')}</p></div>{(data.status||payload.status)&&<span className="rounded-full px-2.5 py-1 text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">{statusLabel(data.status||payload.status)}</span>}</div>
  </header>
  <div className="p-4 sm:p-5 space-y-5">
   {!mortality&&<ResultStatisticsSummary statistics={data.statistics&&{...data.statistics,tables:data.statistics.tables.filter((t:any)=>!t.path.includes('mapComposition'))}}/>}
   {!data.suppressSpatialMap&&data.method==='observed-capture-idw-v1'&&Array.isArray(payload.monitoringPoints)&&<QueryResultVisualization rows={payload.monitoringPoints.map((point:any)=>({...point,label:point.street||point.district||point.city||point.id}))} spec={{kind:'map',latKey:'lat',lonKey:'lon',labelKey:'label',valueKey:'value',unit:'捕获量 / 记录'}}/>}
   {['autoregression-seasonal-capture-v1','gradient-boosting-capture-v1'].includes(data.method)&&payload.groups?.map((g:any,i:number)=><section key={i}><h4 className="text-sm font-semibold">{g.methodName} · 历史观测</h4><QueryResultVisualization rows={g.history??[]} spec={{kind:'line',xKey:'period',yKey:'value',unit:'只/记录'}}/><h4 className="text-sm font-semibold mt-3">预测（非观测值）</h4><QueryResultVisualization rows={g.forecasts??[]} spec={{kind:'line',xKey:'period',yKey:'value',unit:'只/记录'}}/></section>)}
   {payload.method==='food-dashboard-drilldown-v1'&&<section className="space-y-3">{payload.mapComposition&&<MapCanvas composition={payload.mapComposition}/>} <QueryResultVisualization rows={payload.trend??[]} spec={{kind:'line',xKey:'period',yKey:'cases',unit:'例'}}/><p>选择城市查看病例与事件明细：</p>{payload.cities?.map((r:any)=><button className="mr-3 text-sky-600 underline" key={r.city} onClick={()=>void interact({type:'skill.execute',id:'skill_foodborne_dashboard',args:{...payload.filters,city:r.city}})}>{r.city}（{r.cases} 例）</button>)}</section>}
   {mortality?<MortalityCodingReview data={payload}/>:species?<SpeciesCompositionSummary data={payload}/>:<ResultDataView value={displayed}/>}
   {series.filter((m:any)=>m.history&&m.forecasts).map((m:any,i:number)=><section key={i}><h4>{m.stationId??m.city??''} {m.model} · 历史与预测</h4><QueryResultVisualization rows={[...m.history.map((r:any)=>({...r,series:'历史'})),...m.forecasts.map((r:any)=>({...r,series:'预测'}))]} spec={{kind:'line',xKey:'period',yKey:'value',unit:payload.unit??'模型输出'}}/></section>)}
   {Array.isArray(payload.stations)&&payload.stations.some((s:any)=>typeof s.latitude==='number')&&<QueryResultVisualization rows={payload.stations} spec={{kind:'map',latKey:'latitude',lonKey:'longitude',labelKey:payload.stations[0].station_name?'station_name':'plant_id'}}/>}
   {payload.knowledge?.map((k:any)=><article key={k.id} className="p-3 border rounded"><h4>{k.title}</h4><p>{k.summary}</p><a className="text-sky-600 underline" href={k.sourceUrl} target="_blank" rel="noreferrer">{k.sourceTitle}</a><small> · 核对日期 {k.reviewedAt}</small></article>)}
   <WorkflowActions value={payload}/>
   {!!flags.length&&<aside className="rounded-xl border border-amber-200 dark:border-amber-900/70 bg-amber-50/80 dark:bg-amber-950/20 p-4"><h4 className="flex items-center gap-2 text-xs font-semibold text-amber-800 dark:text-amber-300"><Info size={14}/>数据口径与方法限制</h4><ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-amber-800 dark:text-amber-200/80">{flags.map(flag=><li key={flag}>{qualityLabel(flag)}</li>)}</ul></aside>}
   <details onToggle={event=>setShowRaw(event.currentTarget.open)} className="text-xs text-slate-500 border-t border-slate-200 dark:border-slate-800 pt-3"><summary className="cursor-pointer">技术信息与原始结果</summary><p className="mt-3 break-all">方法标识：{data.method??payload.method??'未提供'}</p><pre className="mt-2 p-3 max-h-72 overflow-auto rounded-lg bg-slate-100 dark:bg-slate-900">{showRaw?JSON.stringify(payload,null,2):null}</pre></details>
  </div>
 </section>;
}
