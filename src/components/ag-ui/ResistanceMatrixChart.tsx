'use client';

import React from 'react';
import { ResistanceMatrixItem } from '@/lib/db/data-provider';
import { ShieldAlert, RefreshCw } from 'lucide-react';

interface ResistanceMatrixProps {
  data: {
    items: ResistanceMatrixItem[];
    rotationSuggestions: string[];
  };
}

export const ResistanceMatrixChart: React.FC<ResistanceMatrixProps> = ({ data }) => {
  return (
    <div className="w-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-xl p-5 border border-slate-200 dark:border-amber-500/20 shadow-sm dark:shadow-xl flex flex-col gap-4 transition-colors">
      {/* 头部 */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-amber-50 text-amber-600 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              杀虫剂抗药性生物测定矩阵与消杀轮换方案
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30 font-medium">
                毒力回归 LC50 评估
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">结合抗药性级别（敏感/低抗/中抗/高抗），智能生成消杀轮换处方</p>
          </div>
        </div>
      </div>

      {/* 抗药性矩阵列表 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {data.items.slice(0, 6).map((item, idx) => {
          const isHigh = item.resistanceLevel === '高抗';
          const isMedium = item.resistanceLevel === '中抗';
          const isLow = item.resistanceLevel === '低抗';

          return (
            <div 
              key={idx} 
              className={`p-3.5 rounded-lg border flex flex-col justify-between gap-2 transition-all ${
                isHigh ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-500/50' : (
                  isMedium ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-500/50' : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800'
                )
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono block">{item.city} · {item.sampleYear}年测定</span>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">{item.speciesName}</h4>
                  <span className="text-xs text-sky-600 dark:text-sky-400 font-medium">{item.pesticideName}</span>
                </div>
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                  isHigh ? 'bg-red-600 text-white animate-pulse' : (
                    isMedium ? 'bg-amber-500 text-white dark:text-slate-950' : (
                      isLow ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 dark:border dark:border-blue-500/30' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border dark:border-emerald-500/30'
                    )
                  )
                }`}>
                  {item.resistanceLevel}
                </span>
              </div>

              <div className="text-xs space-y-1 bg-white/80 dark:bg-slate-950/80 p-2 rounded border border-slate-200 dark:border-slate-800/80">
                {item.lc50 && (
                  <div className="flex justify-between text-slate-500 dark:text-slate-400">
                    <span>LC50 致死中浓度:</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200 font-semibold">{item.lc50} mg/L</span>
                  </div>
                )}
                {item.correctedMortality !== undefined && (
                  <div className="flex justify-between text-slate-500 dark:text-slate-400">
                    <span>校正死亡率:</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200 font-semibold">{item.correctedMortality}%</span>
                  </div>
                )}
                <div className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 pt-1 border-t border-slate-200 dark:border-slate-800">
                  <span className="text-amber-600 dark:text-amber-400 font-semibold">处置对策: </span>
                  {item.guidelineRecommendation}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 专家用药轮换建议 */}
      <div className="bg-slate-50 dark:bg-slate-950/80 rounded-lg p-3.5 border border-amber-200 dark:border-amber-500/30 text-xs text-slate-700 dark:text-slate-300 space-y-2">
        <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-bold">
          <RefreshCw className="w-4 h-4" />
          <span>国家卫生健康委与省疾控中心消杀药剂轮换策略:</span>
        </div>
        {data.rotationSuggestions.map((sug, idx) => (
          <div key={idx} className="flex items-start gap-2 leading-relaxed">
            <span className="text-amber-600 dark:text-amber-400 font-bold">•</span>
            <span>{sug}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
