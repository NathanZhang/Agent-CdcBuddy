'use client';
import React,{useState} from 'react';
import {fieldLabel,formatValue,qualityLabel} from '@/features/workbench/result-presentation';

type Row=Record<string,unknown>;
const isObject=(value:unknown):value is Row=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const nested=(value:unknown)=>value!==null&&typeof value==='object';
export function MetricGrid({entries}:{entries:[string,unknown][]}) {
 return <dl className="grid grid-cols-2 xl:grid-cols-4 gap-3">{entries.map(([key,value])=><div key={key} className="min-w-0 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/70 p-4"><dt className="text-xs text-slate-500 dark:text-slate-400">{fieldLabel(key)}</dt><dd className="mt-2 text-lg font-semibold tabular-nums break-words text-slate-900 dark:text-slate-100">{formatValue(value,key)}</dd></div>)}</dl>;
}
export function ResultTable({rows,caption}:{rows:Row[];caption?:string}) {
 const [page,setPage]=useState(0);const size=10;const pages=Math.max(1,Math.ceil(rows.length/size));const current=Math.min(page,pages-1);
 const columns=Array.from(new Set(rows.flatMap(row=>Object.keys(row))));
 if(!rows.length)return <p className="p-4 text-sm text-slate-500">暂无明细</p>;
 return <div className="min-w-0 max-w-full"><div className="overflow-auto max-h-[460px] rounded-xl border border-slate-200 dark:border-slate-800"><table className="w-full text-sm text-left border-collapse">
 {caption&&<caption className="sr-only">{caption}</caption>}
 <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800"><tr>{columns.map(key=><th scope="col" key={key} title={key} className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-300 whitespace-nowrap">{fieldLabel(key)}</th>)}</tr></thead>
 <tbody className="divide-y divide-slate-200 dark:divide-slate-800">{rows.slice(current*size,(current+1)*size).map((row,index)=><tr key={index} className="even:bg-slate-50/70 dark:even:bg-slate-900/50 hover:bg-sky-50/60 dark:hover:bg-sky-950/30">{columns.map(key=><td key={key} className={`px-4 py-3 align-top ${typeof row[key]==='number'?'text-right tabular-nums':'text-slate-700 dark:text-slate-300'}`}>
 {nested(row[key])?<details className="min-w-32"><summary className="cursor-pointer whitespace-nowrap text-xs text-sky-700 dark:text-sky-400">查看详情{Array.isArray(row[key])?`（${row[key].length} 项）`:''}</summary><div className="mt-3 min-w-64 max-w-xl"><ResultDataView value={row[key]} field={key}/></div></details>:<span className="block min-w-12 max-w-md break-words">{formatValue(row[key],key)}</span>}
 </td>)}</tr>)}</tbody></table></div>
 {pages>1&&<div className="flex items-center justify-between gap-2 pt-3 text-xs text-slate-500"><span>共 {rows.length} 项 · 第 {current+1} / {pages} 页</span><div className="flex gap-3"><button className="disabled:opacity-40" disabled={current===0} onClick={()=>setPage(current-1)}>上一页</button><button className="disabled:opacity-40" disabled={current===pages-1} onClick={()=>setPage(current+1)}>下一页</button></div></div>}
 </div>;
}
export function ResultDataView({value,field=''}:{value:unknown;field?:string}):React.ReactNode {
 if(field==='qualityFlags'&&Array.isArray(value))return <ul className="space-y-1 text-xs text-amber-700 dark:text-amber-300">{value.map((flag,i)=><li key={i}>{qualityLabel(String(flag))}</li>)}</ul>;
 if(Array.isArray(value)){
  if(!value.length)return <p className="text-sm text-slate-500">暂无明细</p>;
  if(value.every(isObject))return <ResultTable rows={value} caption={fieldLabel(field)}/>;
  return <ul className="flex flex-wrap gap-2">{value.map((item,index)=><li key={index} className="rounded-lg bg-slate-100 dark:bg-slate-800 px-3 py-2 text-sm"><ResultDataView value={item}/></li>)}</ul>;
 }
 if(isObject(value)){
  const entries=Object.entries(value).filter(([key])=>key!=='type');
  const scalars=entries.filter(([,item])=>!nested(item));const sections=entries.filter(([,item])=>nested(item));
  return <div className="space-y-5 min-w-0">{!!scalars.length&&<MetricGrid entries={scalars}/>} {sections.map(([key,item])=><section key={key} className="min-w-0"><h4 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-200">{fieldLabel(key)}{Array.isArray(item)&&<span className="ml-2 text-xs font-normal text-slate-500">{item.length} 项</span>}</h4><ResultDataView value={item} field={key}/></section>)}</div>;
 }
 return <span className="text-sm break-words">{formatValue(value,field)}</span>;
}
