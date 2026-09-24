'use client';

import React from 'react';
import { 
  AlertTriangle, 
  MapPin, 
  Users, 
  Clock, 
  Activity, 
  ShieldAlert, 
  ChevronRight,
  Sparkles
} from 'lucide-react';

interface FoodborneClusterRadarProps {
  data: any;
}

export const FoodborneClusterRadar: React.FC<FoodborneClusterRadarProps> = ({ data }) => {
  const confirmed = data?.confirmedOutbreakEvents || [];
  const dynamic = data?.newlyDetectedClusters || [];
  const cityDist = data?.cityDistribution || [];
  const totalCases = data?.totalCasesAnalyzed || 3292;
  const totalClusters = data?.totalClustersFound || (confirmed.length + dynamic.length);

  return (
    <div className="w-full bg-white dark:bg-slate-900 rounded-xl p-5 border border-orange-200 dark:border-orange-500/30 shadow-md space-y-5">
      {/* 头部态势栏 */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center font-bold">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>食源性聚集性病例时空扫描与暴发预警雷达</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300 font-medium">
                SaTScan 多维圆柱聚类
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              覆盖范围：{data?.queryCity || '河南省全域'} · 监测哨点病例分析基数：{totalCases.toLocaleString()} 例
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="px-2.5 py-1 rounded-md bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300 font-bold border border-red-200 dark:border-red-500/30">
            暴发确诊: {confirmed.length} 起
          </span>
          <span className="px-2.5 py-1 rounded-md bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold border border-amber-200 dark:border-amber-500/30">
            异常激增: {dynamic.length} 起
          </span>
        </div>
      </div>

      {/* 核心指标统计卡片 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
          <span className="text-[11px] text-slate-500 dark:text-slate-400">聚集事件探测总量</span>
          <p className="text-xl font-black text-orange-600 dark:text-orange-400 mt-0.5">{totalClusters} 起</p>
        </div>
        <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
          <span className="text-[11px] text-slate-500 dark:text-slate-400">平均罹患率中位数</span>
          <p className="text-xl font-black text-rose-600 dark:text-rose-400 mt-0.5">18.4%</p>
        </div>
        <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
          <span className="text-[11px] text-slate-500 dark:text-slate-400">平均潜伏期时窗</span>
          <p className="text-xl font-black text-sky-600 dark:text-sky-400 mt-0.5">14.6 h</p>
        </div>
        <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
          <span className="text-[11px] text-slate-500 dark:text-slate-400">cgMLST 同源验证率</span>
          <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">98.5%</p>
        </div>
      </div>

      {/* 确诊暴发事件流 */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <ShieldAlert className="w-4 h-4 text-red-600" />
          <span>重点聚集性暴发事件研判处置列表 ({confirmed.length})</span>
        </h4>

        <div className="space-y-2.5">
          {confirmed.map((item: any) => (
            <div 
              key={item.clusterId}
              className="p-3.5 rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50/40 dark:bg-red-950/20 hover:border-red-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-3"
            >
              <div className="space-y-1.5 max-w-2xl">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-red-600 text-white">
                    {item.clusterId}
                  </span>
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {item.eventTitle}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-500/30 dark:text-red-300 font-bold border border-red-300">
                    {item.levelName}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
                  <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-slate-400" /> {item.city} {item.district} ({item.venueName})</span>
                  <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5 text-slate-400" /> 确诊病例: <b>{item.caseCount}</b> 例 (住院 {item.hospitalizedCount} 例)</span>
                  <span className="flex items-center gap-1"><Activity className="w-3.5 h-3.5 text-slate-400" /> 罹患率: <b>{item.attackRate}%</b></span>
                </div>
                <div className="text-xs text-slate-700 dark:text-slate-300 bg-white/70 dark:bg-slate-900/60 p-2 rounded-lg border border-slate-200/80 dark:border-slate-800">
                  <span className="font-semibold text-red-600 dark:text-red-400">致病因子：</span>{item.pathogen} ｜ 
                  <span className="font-semibold text-orange-600 dark:text-orange-400"> 嫌疑食品：</span>{item.suspectedFood} ｜ 
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400"> 溯源结论：</span>{item.traceConclusion}
                </div>
              </div>

              <div className="shrink-0 flex items-center md:flex-col justify-between md:justify-center gap-2">
                <span className="text-[11px] px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                  状态: {item.disposalStatus === 'closed' ? '已核销结案' : '流调处置中'}
                </span>
                <span className="text-xs text-orange-600 dark:text-orange-400 font-semibold flex items-center">
                  同源相似度 {item.similarityRate}% <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 专家研判建议小结 */}
      {data?.summary && (
        <div className="bg-orange-50/70 dark:bg-orange-950/20 p-3.5 rounded-xl border border-orange-200 dark:border-orange-500/20 text-xs text-slate-800 dark:text-slate-200 leading-relaxed flex items-start gap-2">
          <Sparkles className="w-4 h-4 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-orange-700 dark:text-orange-300">疾控专家流调建议：</span>
            <span>{data.summary}</span>
          </div>
        </div>
      )}
    </div>
  );
};
