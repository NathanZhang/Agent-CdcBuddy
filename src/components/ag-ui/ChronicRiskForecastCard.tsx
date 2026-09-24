'use client';

import React from 'react';
import { 
  HeartPulse, 
  TrendingUp, 
  ShieldCheck, 
  Activity, 
  Sparkles, 
  BarChart2, 
  ArrowRight,
  Layers,
  HelpCircle
} from 'lucide-react';

interface ChronicRiskForecastCardProps {
  data?: any;
}

export const ChronicRiskForecastCard: React.FC<ChronicRiskForecastCardProps> = ({ data = {} }) => {
  const cohortAnalyzed = data?.cohortAnalyzed || 2000;
  const accuracy = data?.modelAccuracy || 0.835;
  const accuracyText = data?.modelAccuracyCompliance || '达标 (83.5% >= 80.0% 规范标准)';
  const cohortSummary = data?.cohortRiskSummary || {
    average10YearRisk: '31.9%',
    highRiskProportion: '88.9%',
    stratification: '中高危群体集聚'
  };

  const featureImportances = data?.featureImportances || [
    { factor: '收缩压 (SBP ≥ 140 mmHg)', importance: 0.324, effect: '心脑血管急性事件首要促发因素' },
    { factor: '空腹血糖 (FPG ≥ 7.0 mmol/L)', importance: 0.252, effect: '微血管病变与靶器官损伤加速因子' },
    { factor: '体质指数 (BMI ≥ 28 肥胖)', importance: 0.186, effect: '代谢综合征与胰岛素抵抗基础' },
    { factor: '重度吸烟史 (≥20支/天)', importance: 0.145, effect: '血管内皮氧化应激与动脉硬化斑块破裂' },
    { factor: '直系亲属早发心梗/脑卒中史', importance: 0.093, effect: '遗传易感性倍增效应' }
  ];

  const complicationRules = data?.associationMiningComplications || [
    {
      premise: '高血压3级 + 2型糖尿病 (病程>5年)',
      consequence: '缺血性脑卒中 (脑梗死)',
      support: '14.2%',
      confidence: '68.5%',
      lift: 2.85,
      clinicalImplication: '双病共管患者应常规开展颈动脉超声筛查与降脂抗血小板强化干预。'
    },
    {
      premise: '2型糖尿病 + 早期微量白蛋白尿',
      consequence: '糖尿病视网膜病变 (NPDR)',
      support: '11.6%',
      confidence: '59.2%',
      lift: 3.12,
      clinicalImplication: '微血管病变具有强同质性，尿微量白蛋白阳性患者必须每年筛查眼底。'
    }
  ];

  const target = data?.preventiveTarget || '通过多重危险因素综合干预，可使高危个体 10 年心脑血管事件发生率下降 34.2%。';

  return (
    <div className="w-full bg-white dark:bg-slate-900 rounded-xl p-5 border border-pink-200 dark:border-pink-500/30 shadow-md space-y-5">
      {/* 头部态势栏 */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-pink-100 dark:bg-pink-500/20 text-pink-600 dark:text-pink-400 flex items-center justify-center font-bold">
            <HeartPulse className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>三大重大慢性病发病风险预测与并发症关联挖掘</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-300 font-medium">
                GBDT 预测 · 关联规则挖掘
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              队列分析样本：{cohortAnalyzed.toLocaleString()} 例随访患者 · China-PAR 10年心脑血管与恶性肿瘤风险建模
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="px-2.5 py-1 rounded-md bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-500/30">
            预测准确率: {accuracyText}
          </span>
          <span className="px-2.5 py-1 rounded-md bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 font-bold border border-rose-200 dark:border-rose-500/30">
            高危个体占比: {cohortSummary.highRiskProportion}
          </span>
        </div>
      </div>

      {/* GBDT 风险权重重要性 */}
      <div className="bg-slate-50 dark:bg-slate-950/80 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-800 dark:text-slate-200">
          <span className="flex items-center gap-1.5 text-pink-600 dark:text-pink-400">
            <BarChart2 className="w-4 h-4" /> GBDT 模型：心脑血管急性事件发病危险因素重要性权重
          </span>
        </div>

        <div className="space-y-2">
          {featureImportances.map((item: any, idx: number) => (
            <div key={idx} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-700 dark:text-slate-300 font-medium">{item.factor}</span>
                <span className="text-pink-600 dark:text-pink-400 font-bold">
                  {(item.importance * 100).toFixed(1)}% · <span className="text-[11px] text-slate-400 font-normal">{item.effect}</span>
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    idx === 0 ? 'bg-rose-500' : idx === 1 ? 'bg-pink-500' : 'bg-purple-500'
                  }`}
                  style={{ width: `${Math.min(100, item.importance * 100 * 2.8)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 并发症关联规则挖掘 (Apriori) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
          <span className="flex items-center gap-1.5 text-pink-600 dark:text-pink-400">
            <Layers className="w-4 h-4" /> 慢性病共病并发症规律关联挖掘 (Association Rules)
          </span>
          <span className="text-[11px] text-slate-400 font-normal">基于 Apriori 强关联规则挖掘</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {complicationRules.map((rule: any, idx: number) => (
            <div 
              key={idx}
              className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 text-xs"
            >
              <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-2">
                <span className="font-bold text-slate-900 dark:text-slate-100">{rule.premise}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300 font-bold">
                  提升度 (Lift): {rule.lift}
                </span>
              </div>
              <div className="space-y-1 text-slate-600 dark:text-slate-400">
                <div className="flex justify-between">
                  <span>高危并发症趋向:</span>
                  <span className="font-bold text-rose-600 dark:text-rose-400">{rule.consequence}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span>支持度 (Support): {rule.support}</span>
                  <span>置信度 (Confidence): {rule.confidence}</span>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200 dark:border-slate-800">
                  临床防控价值: {rule.clinicalImplication}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 综合防控靶向目标 */}
      <div className="bg-pink-50/60 dark:bg-pink-950/20 p-3.5 rounded-lg border border-pink-200 dark:border-pink-500/30 flex items-start gap-2.5 text-xs">
        <Sparkles className="w-4 h-4 text-pink-600 flex-shrink-0 mt-0.5" />
        <div className="text-slate-700 dark:text-slate-300">
          <span className="font-bold text-pink-800 dark:text-pink-300">靶向综合防控建议：</span>
          <span className="ml-1">{target}</span>
        </div>
      </div>
    </div>
  );
};
