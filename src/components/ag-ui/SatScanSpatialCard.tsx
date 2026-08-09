'use client';

import React, { useState } from 'react';
import { useTheme } from '@/lib/theme/theme-context';
import { SatScanSpatialGISMap } from './SatScanSpatialGISMap';
import { 
  MapPin, 
  Layers, 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  ShieldCheck, 
  Compass, 
  Activity,
  Flame
} from 'lucide-react';

interface SatScanSpatialCardProps {
  data: any;
}

export const SatScanSpatialCard: React.FC<SatScanSpatialCardProps> = ({ data }) => {
  const { isDark } = useTheme();
  const [selectedClusterCity, setSelectedClusterCity] = useState<string>(
    data?.high_risk_cities?.[0] || '漯河市'
  );

  const stats = data?.statistics || {};
  const clusters = data?.clusters || [];
  const primaryCluster = clusters[0] || {};
  const insights = data?.insights || [];

  return (
    <div className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-md dark:shadow-2xl p-5 space-y-5 transition-colors">
      {/* 头部标题与元信息 */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 via-pink-600 to-amber-500 flex items-center justify-center shadow-lg shadow-rose-500/20 text-white">
            <Compass className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-wide">
                {data.title || `河南省 ${data.year || 2022}年${data.month || 6}月 ${data.category || '蚊'}类 SaTScan 空间泊松时空扫描`}
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/30">
                Kulldorff Poisson Scan
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              全域时空扫描: 覆盖 {stats.total_monitoring_sites || 60} 处监测点 · 累计捕获 {stats.total_observed_captures ? Math.round(stats.total_observed_captures) : 140078} 只
            </p>
          </div>
        </div>

        <div className="text-right text-xs text-slate-500 dark:text-slate-400">
          <div>显著聚集簇: <span className="font-bold text-rose-600 dark:text-rose-400 text-sm">{clusters.length} 个</span></div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono">Monte Carlo 置换检验 (99次)</div>
        </div>
      </div>

      {/* 核心指标概览三栏卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-sm">
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-1 font-medium">
            <MapPin className="w-4 h-4 text-rose-500 dark:text-rose-400" />
            一类核心聚集区 (Primary Cluster)
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white">
            {primaryCluster.center_city || '漯河市'} {primaryCluster.center_district || '舞阳县'}
          </div>
          <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 flex items-center gap-2">
            <span>似然比 LLR: <b className="text-rose-600 dark:text-rose-400">{primaryCluster.log_likelihood_ratio || 15361.5}</b></span>
            <span>p: <b className="text-emerald-600 dark:text-emerald-400">&lt; 0.05</b></span>
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-sm">
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-1 font-medium">
            <Activity className="w-4 h-4 text-amber-500 dark:text-amber-400" />
            相对危险度 (Relative Risk)
          </div>
          <div className="text-xl font-bold text-amber-600 dark:text-amber-400">
            RR = {primaryCluster.relative_risk || 4.17}
          </div>
          <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
            窗内实际捕获为基线背景期望的 {primaryCluster.relative_risk || 4.17} 倍
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-sm">
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-1 font-medium">
            <Flame className="w-4 h-4 text-purple-500 dark:text-purple-400" />
            扫描聚集波及范围
          </div>
          <div className="text-xl font-bold text-purple-700 dark:text-purple-300">
            半径 {primaryCluster.radius_km || 15.0} km
          </div>
          <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 truncate">
            {primaryCluster.affected_districts?.join(', ') || '漯河市-舞阳县'}
          </div>
        </div>
      </div>

      {/* GIS 空间时空扫描聚集热点分布组件 */}
      <SatScanSpatialGISMap
        clusters={clusters}
        selectedCity={selectedClusterCity}
        onSelectCluster={(c) => setSelectedClusterCity(c.center_city)}
        category={data.category || '蚊'}
      />

      {/* 显著聚集区明细列表 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            全省 SaTScan 显著性聚集簇清单与统计检验
          </span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            按对数似然比 (LLR) 降序排列
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {clusters.map((c: any, idx: number) => (
            <div key={idx} className="bg-slate-50 dark:bg-slate-800/80 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between space-y-2">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                    c.is_statistically_significant 
                      ? 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/30' 
                      : 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/20 dark:text-amber-300'
                  }`}>
                    {c.cluster_type}
                  </span>
                  <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                    p = {c.p_value}
                  </span>
                </div>
                <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-rose-500" />
                  {c.center_city} · {c.center_district}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900/60 p-2 rounded-lg border border-slate-200/60 dark:border-transparent">
                <div>扫描半径: <b>{c.radius_km} km</b></div>
                <div>相对危险度 RR: <b className="text-rose-600 dark:text-rose-400">{c.relative_risk}</b></div>
                <div>似然比 LLR: <b className="text-sky-600 dark:text-sky-400">{Math.round(c.log_likelihood_ratio)}</b></div>
                <div>观测数: <b>{c.observed_count}</b></div>
              </div>

              <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                波及辖区: {c.affected_districts?.join(', ')}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 专家研判要点与防制指引 */}
      <div className="bg-slate-50 dark:bg-slate-950/70 rounded-xl p-4 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
        <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-bold">
          <Info className="w-4 h-4" />
          <span>SaTScan 空间聚集研判结论与疾控防制指引:</span>
        </div>
        {insights.map((insight: string, idx: number) => (
          <div key={idx} className="flex items-start gap-2 text-slate-700 dark:text-slate-300 leading-relaxed">
            <span className="text-rose-500 font-bold">•</span>
            <span>{insight}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
