'use client';

import React from 'react';
import { 
  GitBranch, 
  Layers, 
  MapPin, 
  AlertTriangle, 
  CheckCircle2, 
  Activity, 
  ShieldCheck, 
  ArrowRight,
  Sparkles
} from 'lucide-react';

interface RiverBasinPollutionChainCardProps {
  data?: any;
}

export const RiverBasinPollutionChainCard: React.FC<RiverBasinPollutionChainCardProps> = ({ data = {} }) => {
  const basinName = data?.basinName || '黄河流域河南段';
  const sectionsCount = data?.sectionsMonitoredCount || 32;
  const transferChain = data?.transferChain || [
    {
      mediaLayer: '1. 地表水环境介质',
      keyIndicator: '溶解态铅 (Pb) / 镉 (Cd)',
      averageConcentration: '0.0199 mg/L (铅), 0.0022 mg/L (镉)',
      environmentalQualityStandard: 'GB 3838-2002 Ⅲ类地表水 (铅≤0.05, 镉≤0.005)',
      status: '局部支流汇流断面轻度超标'
    },
    {
      mediaLayer: '2. 灌溉农田土壤介质',
      keyIndicator: '土壤有效态镉 (Cd)',
      averageConcentration: '0.239 mg/kg',
      environmentalQualityStandard: 'GB 15618-2018 农用地土壤风险筛选值 (≤0.3 mg/kg)',
      status: '经长期灌溉富集达筛选值 1.4~1.8 倍'
    },
    {
      mediaLayer: '3. 粮食作物与人群食物链',
      keyIndicator: '小麦籽粒铅 (Pb) / 镉 (Cd) 残留',
      averageConcentration: '0.105 mg/kg',
      environmentalQualityStandard: 'GB 2762-2022 食品安全国家标准 (≤0.2 mg/kg)',
      status: '受累区小麦富集系数超标率 14.5%'
    }
  ];

  const spatialAuto = data?.spatialAutocorrelation || {
    globalMoransI: 0.428,
    zScore: 4.15,
    pValue: 0.0001,
    spatialAutocorrelationPattern: '显著空间正相关 (具有明确的高高聚集区)',
    highHighHotspots: [
      { city: '洛阳市', district: '吉利区', riskType: '白河沿岸工矿灌渠重金属迁移链', cancerIncidenceRate: '58.4/10万' },
      { city: '焦作市', district: '中站区', riskType: '工业集聚区外排雨水渗漏与土壤镉沉积', cancerIncidenceRate: '52.1/10万' }
    ]
  };

  const recommendation = data?.decisionRecommendation || '实施流域多介质协同阻断：1) 关停白河支流高镉废水非法排放口；2) 推广施用石灰质土壤钝化剂降镉；3) 对高高集聚区居民饮用水实施双水源替代。';

  return (
    <div className="w-full bg-white dark:bg-slate-900 rounded-xl p-5 border border-indigo-200 dark:border-indigo-500/30 shadow-md space-y-5">
      {/* 头部态势栏 */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
            <GitBranch className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>四河流域跨介质重金属污染链与空间聚集分析</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 font-medium">
                水-土-粮链条 · Moran's I
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              目标流域：{basinName} · 断面监测样点：{sectionsCount} 处
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="px-2.5 py-1 rounded-md bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-500/30">
            Moran's I: {spatialAuto.globalMoransI}
          </span>
          <span className="px-2.5 py-1 rounded-md bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-500/30">
            Z值: {spatialAuto.zScore} (P&lt;0.001)
          </span>
        </div>
      </div>

      {/* 跨介质重金属转移链条 (Water -> Soil -> Wheat) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-800 dark:text-slate-200">
          <span className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
            <Layers className="w-4 h-4" /> "水体铅镉 ➔ 农田土壤 ➔ 粮食作物 ➔ 人群暴露" 跨介质富集演化链
          </span>
          <span className="text-[11px] text-slate-400">多介质环境毒理学评估</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {transferChain.map((chain: any, idx: number) => (
            <div 
              key={idx}
              className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 text-xs relative"
            >
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                  {chain.mediaLayer}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-bold">
                  环节 {idx + 1}
                </span>
              </div>
              <div className="space-y-1 text-slate-600 dark:text-slate-400">
                <div className="flex justify-between">
                  <span>关键超标因子:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{chain.keyIndicator}</span>
                </div>
                <div className="flex justify-between">
                  <span>实测平均浓度:</span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">{chain.averageConcentration}</span>
                </div>
                <div className="text-[11px] text-slate-400 border-t border-slate-200 dark:border-slate-800 pt-1">
                  评价标准: {chain.environmentalQualityStandard}
                </div>
                <div className="text-amber-600 dark:text-amber-400 font-medium">
                  {chain.status}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 空间自相关高高集聚区 (High-High Hotspots) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
          <span className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
            <MapPin className="w-4 h-4" /> 空间自相关 Moran's I 高高集聚风险区 (High-High Cluster Hotspots)
          </span>
          <span className="text-[11px] text-indigo-600 dark:text-indigo-400">
            {spatialAuto.spatialAutocorrelationPattern}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {spatialAuto.highHighHotspots.map((spot: any, i: number) => (
            <div 
              key={i}
              className="bg-amber-50/50 dark:bg-amber-950/20 p-3.5 rounded-xl border border-amber-200 dark:border-amber-500/30 space-y-2 text-xs"
            >
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-rose-500" />
                  {spot.city} · {spot.district}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300 font-bold">
                  高高聚集区
                </span>
              </div>
              <div className="space-y-1 text-slate-600 dark:text-slate-400">
                <div className="flex justify-between">
                  <span>风险成因特征:</span>
                  <span className="text-slate-800 dark:text-slate-200 font-medium">{spot.riskType}</span>
                </div>
                <div className="flex justify-between">
                  <span>粗肿瘤发病率水平:</span>
                  <span className="text-rose-600 dark:text-rose-400 font-bold">{spot.cancerIncidenceRate}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 协同防控决策建议 */}
      <div className="bg-indigo-50/60 dark:bg-indigo-950/20 p-3.5 rounded-lg border border-indigo-200 dark:border-indigo-500/30 flex items-start gap-2.5 text-xs">
        <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" />
        <div className="text-slate-700 dark:text-slate-300">
          <span className="font-bold text-indigo-800 dark:text-indigo-300">流域综合治理与协同阻断决策：</span>
          <span className="ml-1">{recommendation}</span>
        </div>
      </div>
    </div>
  );
};
