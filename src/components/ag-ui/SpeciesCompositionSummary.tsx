'use client';
import React from 'react';
import {formatValue} from '@/features/workbench/result-presentation';
import {MetricGrid,ResultTable,ResultDataView} from './ResultDataView';

type Species={speciesName:string;latinName?:string;category?:string;totalCount:number;percentage:number|null;cityBreakdown?:{city:string;count:number}[]};
export function SpeciesCompositionSummary({data}:{data:{items:Species[];totalCount?:number;speciesCount?:number;cityCount?:number;clusterCount?:number;dominantSpecies?:string|null;shannonWienerIndex?:number|null;clusters?:unknown[]}}) {
 const items=data.items;const cities=Array.from(new Set(items.flatMap(item=>(item.cityBreakdown??[]).map(row=>row.city)))).sort((a,b)=>a.localeCompare(b,'zh-CN'));
 const cityRows=cities.map(city=>({city,...Object.fromEntries(items.map(item=>[item.speciesName,item.cityBreakdown?.find(row=>row.city===city)?.count??null]))}));
 return <div className="space-y-6">
 <MetricGrid entries={[
  ['totalCount',data.totalCount],['speciesCount',data.speciesCount],['dominantSpecies',data.dominantSpecies],['shannonWienerIndex',data.shannonWienerIndex],
 ]}/>
 <section className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
  <header className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap gap-2 items-center justify-between"><h4 className="font-semibold text-sm">物种构成</h4><span className="text-xs text-slate-500">按捕获数量统计 · 占比合计基于当前结果</span></header>
  <div className="p-4 grid grid-cols-1 xl:grid-cols-2 gap-6">
   <div className="space-y-4">{items.length?items.slice(0,6).map((item,index)=><div key={item.speciesName}>
    <div className="flex items-baseline justify-between gap-3 text-sm"><span className="font-medium">{item.speciesName}<span className="ml-2 text-xs text-slate-500">{formatValue(item.totalCount)} 只</span></span><strong className="text-sky-700 dark:text-sky-400 tabular-nums">{formatValue(item.percentage,'percentage')}</strong></div>
    <div className="mt-2 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden" aria-hidden="true"><div className={`h-full rounded-full ${['bg-sky-500','bg-teal-500','bg-indigo-400','bg-amber-400'][index%4]}`} style={{width:`${typeof item.percentage==='number'?Math.max(0,Math.min(100,item.percentage)):0}%`}}/></div>
   </div>):<p className="text-sm text-slate-500">暂无物种构成数据</p>}{items.length>6&&<p className="text-xs text-slate-500 pt-2 border-t border-slate-200 dark:border-slate-800">展示前 6 项，其余 {items.length-6} 项可在明细表翻页查看。</p>}
   </div>
   <div className="min-w-0"><ResultTable caption="物种统计明细" rows={items.map(item=>({speciesName:item.speciesName,latinName:item.latinName,totalCount:item.totalCount,percentage:item.percentage}))}/></div>
  </div>
 </section>
 <section className="min-w-0"><div className="flex flex-wrap justify-between items-center gap-2 mb-3"><h4 className="text-sm font-semibold">地市物种对比</h4><span className="text-xs text-slate-500">{formatValue(data.cityCount)} 个地市 · 单位：只</span></div><ResultTable rows={cityRows} caption="各地市各物种捕获数量"/><p className="mt-2 text-xs text-slate-500">未提供的地市物种组合保留缺测状态，不计为零。</p></section>
 {!!data.clusters?.length&&<details className="rounded-xl border border-slate-200 dark:border-slate-800 p-4"><summary className="text-sm font-medium cursor-pointer">探索性聚类 · {formatValue(data.clusterCount)} 组</summary><p className="my-3 text-xs text-slate-500">按采样方法分组，簇编号不代表风险等级。</p><ResultDataView value={data.clusters} field="clusters"/></details>}
 </div>;
}
