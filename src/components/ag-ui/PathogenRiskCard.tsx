'use client';

import React from 'react';
import { PathogenRiskItem } from '@/lib/db/data-provider';
import { AlertTriangle, Microscope } from 'lucide-react';

interface PathogenRiskProps {
  data: {
    items: PathogenRiskItem[];
    highRiskLocations: { city: string; district: string; pathogen: string; rate: number }[];
    summaryAdvice: string;
  };
}

export const PathogenRiskCard: React.FC<PathogenRiskProps> = ({ data }) => {
  return (
    <div className="w-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-xl p-5 border border-slate-200 dark:border-rose-500/20 shadow-sm dark:shadow-xl flex flex-col gap-4 transition-colors">
      {/* 头部 */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-rose-50 text-rose-600 border border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/30">
            <Microscope className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              病媒生物病原体 PCR 检测与传播风险评估
              <span className="text-xs px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/30 font-medium">
                分子生物学核酸筛查
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">实时挖掘登革病毒、乙脑病毒、恙虫病东方体、汉坦病毒阳性携带风险</p>
          </div>
        </div>
      </div>

      {/* 高风险标靶警告条 */}
      {data.highRiskLocations.length > 0 && (
        <div className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-500/40 rounded-lg flex items-center gap-3 text-xs text-red-800 dark:text-red-200">
          <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
          <div className="flex-1">
            <span className="font-bold text-red-700 dark:text-red-300">高阳性率预警靶标: </span>
            {data.highRiskLocations.map((h, i) => (
              <span key={i} className="inline-block mr-3">
                📍 {h.city}{h.district} · <span className="font-semibold text-rose-700 dark:text-rose-300">{h.pathogen}</span> (阳性率 <span className="font-mono font-bold text-slate-900 dark:text-white">{h.rate}%</span>)
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 样本检测明细卡片网格 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {data.items.slice(0, 6).map((item, idx) => (
          <div key={idx} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-xs flex flex-col justify-between gap-2">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">{item.city} · {item.district}</span>
                <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">{item.pathogenName}</h4>
                <span className="text-xs text-slate-500 dark:text-slate-400">{item.speciesName}</span>
              </div>
              <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                item.riskLevel === '极高风险' ? 'bg-red-600 text-white' : (
                  item.riskLevel === '高风险' ? 'bg-orange-500 text-white' : (
                    item.riskLevel === '中风险' ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 dark:border dark:border-amber-500/40' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border dark:border-emerald-500/40'
                  )
                )
              }`}>
                {item.riskLevel}
              </span>
            </div>

            <div className="space-y-1 bg-white dark:bg-slate-900/80 p-2 rounded border border-slate-200 dark:border-slate-800">
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>PCR 阳性样本:</span>
                <span className="font-mono font-bold text-rose-600 dark:text-rose-400">{item.positiveCount} / {item.testedCount} 批次</span>
              </div>
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>阳性携带率:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{item.positivityRate}%</span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200 dark:border-slate-800">
                关联传染病: <span className="text-sky-700 dark:text-sky-300 font-medium">{item.associatedDisease}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 专家处置通报 */}
      <div className="bg-slate-50 dark:bg-slate-950/80 rounded-lg p-3 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300">
        <span className="text-rose-600 dark:text-rose-400 font-semibold block mb-1">📋 流行病学研判指导:</span>
        <p className="leading-relaxed">{data.summaryAdvice}</p>
      </div>
    </div>
  );
};
