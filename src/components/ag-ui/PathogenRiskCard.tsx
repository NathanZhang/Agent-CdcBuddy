'use client';

import React from 'react';
import { PathogenRiskItem } from '@/lib/db/data-provider';
import { AlertTriangle, Microscope } from 'lucide-react';

interface PathogenRiskProps {
  data: {
    items?: PathogenRiskItem[];
    highRiskLocations?: { city: string; district: string; pathogen: string; speciesName?: string; rate: number }[];
    associationRules?: { antecedent: string; consequent: string; support: number; confidence: number; lift: number; ruleDesc: string }[];
    summaryAdvice?: string;
  };
}

export const PathogenRiskCard: React.FC<PathogenRiskProps> = ({ data }) => {
  const items = data?.items || [];
  const highRiskLocations = data?.highRiskLocations || [];
  const associationRules = data?.associationRules || [];
  const summaryAdvice = data?.summaryAdvice || '当前监测周期内全省病原体 PCR 阳性检出率整体处于常态低风险区间。';

  const totalTested = items.reduce((sum, it) => sum + (Number(it.testedCount) || 0), 0);
  const totalPositives = items.reduce((sum, it) => sum + (Number(it.positiveCount) || 0), 0);
  const overallRate = totalTested > 0 ? ((totalPositives / totalTested) * 100).toFixed(2) : '0.00';
  const uniqueDistricts = Array.from(new Set(items.map(it => `${it.city}${it.district}`))).length;

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

      {/* 核心指标统计卡片条 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-slate-50 dark:bg-slate-950/70 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">检测总组批数</div>
          <div className="text-lg font-bold font-mono text-slate-900 dark:text-slate-100 mt-0.5">
            {items.length} <span className="text-xs font-normal text-slate-500">组批</span>
          </div>
        </div>
        <div className="bg-slate-50 dark:bg-slate-950/70 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">累计核酸检测批次</div>
          <div className="text-lg font-bold font-mono text-sky-600 dark:text-sky-400 mt-0.5">
            {totalTested} <span className="text-xs font-normal text-slate-500">批次</span>
          </div>
        </div>
        <div className="bg-slate-50 dark:bg-slate-950/70 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">PCR 阳性样本总量</div>
          <div className="text-lg font-bold font-mono text-rose-600 dark:text-rose-400 mt-0.5">
            {totalPositives} <span className="text-xs font-normal text-slate-500">份</span>
          </div>
        </div>
        <div className="bg-slate-50 dark:bg-slate-950/70 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">综合阳性检出率</div>
          <div className="text-lg font-bold font-mono text-amber-600 dark:text-amber-400 mt-0.5">
            {overallRate}% <span className="text-[10px] font-normal text-slate-500">({uniqueDistricts}区县)</span>
          </div>
        </div>
      </div>

      {/* 高风险标靶警告条 */}
      {highRiskLocations.length > 0 && (
        <div className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-500/40 rounded-lg flex items-center gap-3 text-xs text-red-800 dark:text-red-200">
          <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
          <div className="flex-1">
            <span className="font-bold text-red-700 dark:text-red-300">高阳性率预警靶标: </span>
            {highRiskLocations.map((h, i) => (
              <span key={i} className="inline-block mr-3">
                📍 {h.city}{h.district} · <span className="font-semibold text-rose-700 dark:text-rose-300">{h.pathogen}</span> (阳性率 <span className="font-mono font-bold text-slate-900 dark:text-white">{h.rate}%</span>)
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 样本检测明细卡片网格 */}
      {items.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[380px] overflow-y-auto pr-1">
          {items.slice(0, 9).map((item, idx) => (
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
      ) : (
        <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-xs text-center text-slate-500">
          当前检索条件下未发现阳性携带记录，请调整筛选条件或扩大排查范围。
        </div>
      )}

      {/* Apriori 关联规则挖掘面板 */}
      {associationRules.length > 0 && (
        <div className="bg-slate-50 dark:bg-slate-950/60 rounded-lg p-3 border border-slate-200 dark:border-slate-800 text-xs space-y-2">
          <span className="text-sky-600 dark:text-sky-400 font-semibold block">🔗 Apriori 频繁项集与媒介宿主关联规则:</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {associationRules.slice(0, 4).map((rule, rIdx) => (
              <div key={rIdx} className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px]">
                <div className="font-medium text-slate-800 dark:text-slate-200">{rule.ruleDesc}</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 flex gap-3">
                  <span>支持度: <strong className="font-mono">{(rule.support * 100).toFixed(2)}%</strong></span>
                  <span>提升度: <strong className="font-mono text-sky-600 dark:text-sky-400">{rule.lift}x</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 专家处置通报 */}
      <div className="bg-slate-50 dark:bg-slate-950/80 rounded-lg p-3 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300">
        <span className="text-rose-600 dark:text-rose-400 font-semibold block mb-1">📋 流行病学研判指导:</span>
        <p className="leading-relaxed">{summaryAdvice}</p>
      </div>
    </div>
  );
};
