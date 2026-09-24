'use client';

import React from 'react';
import { 
  SlidersHorizontal, 
  TrendingDown, 
  Heart, 
  Users, 
  DollarSign, 
  Sparkles, 
  CheckCircle2, 
  ShieldCheck,
  Building
} from 'lucide-react';

interface EnvScenarioSimulationCardProps {
  data?: any;
}

export const EnvScenarioSimulationCard: React.FC<EnvScenarioSimulationCardProps> = ({ data = {} }) => {
  const config = data?.scenarioConfig || {
    scenarioType: 'industrial_emission_cut',
    scenarioName: '重点工矿聚集区排污限产与深部治理工程',
    targetArea: '焦作市中站区工业集聚区',
    emissionCutPercentage: '30.0%',
    simulationHorizon: '未来12个月推演'
  };

  const outcomes = data?.environmentalOutcomes || {
    predictedAqiDecrease: '-12.8 点',
    predictedPm25Decrease: '-9.8 μg/m³',
    predictedWaterComplianceIncrease: '+4.3%',
    airQualityPassDaysGain: 7
  };

  const benefits = data?.quantifiedHealthBenefits || {
    avoidedPediatricRespiratoryOutpatients: '426 人次/年',
    avoidedCardiovascularAcuteEvents: '114 例/年',
    avoidedPrematureDeathsAnnual: '8 人/年',
    estimatedEconomicBenefitWanRMB: '¥255.0 万元 (医疗费用与减损工时)'
  };

  const policyInsight = data?.policyInsight || '情景推演表明：若对【焦作市中站区工业集聚区】实施 30.0% 的工业综合减排，不仅可使区域重污染天数减少 3 天，更能直接避免约 114 例心脑血管急性事件发生，卫生经济学净收益达 255.0 万元。';

  return (
    <div className="w-full bg-white dark:bg-slate-900 rounded-xl p-5 border border-purple-200 dark:border-purple-500/30 shadow-md space-y-5">
      {/* 头部态势栏 */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
            <SlidersHorizontal className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>环境干预政策健康效益量化情景推演引擎</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300 font-medium">
                多源暴露响应 · 卫生经济学评价
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              推演方案：{config.scenarioName} · 目标区域：{config.targetArea}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="px-2.5 py-1 rounded-md bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 font-bold border border-purple-200 dark:border-purple-500/30">
            综合减排幅度: {config.emissionCutPercentage}
          </span>
          <span className="px-2.5 py-1 rounded-md bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-500/30">
            推演周期: {config.simulationHorizon}
          </span>
        </div>
      </div>

      {/* 环境指标改善预期 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-800 dark:text-slate-200">
          <span className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400">
            <TrendingDown className="w-4 h-4" /> 1. 环境质量预期改善指标 (Predicted Environmental Outcomes)
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">预测 AQI 综合改善</span>
            <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{outcomes.predictedAqiDecrease}</p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">预测 PM2.5 浓度降幅</span>
            <p className="text-xl font-black text-sky-600 dark:text-sky-400 mt-0.5">{outcomes.predictedPm25Decrease}</p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">预测水质达标率提升</span>
            <p className="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-0.5">{outcomes.predictedWaterComplianceIncrease}</p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">优良空气天数净增加</span>
            <p className="text-xl font-black text-purple-600 dark:text-purple-400 mt-0.5">+{outcomes.airQualityPassDaysGain} 天</p>
          </div>
        </div>
      </div>

      {/* 量化健康与卫生经济学收益 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-800 dark:text-slate-200">
          <span className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400">
            <Heart className="w-4 h-4 text-rose-500" /> 2. 人群健康效应与卫生经济学净收益 (Quantified Health Benefits)
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-rose-50/50 dark:bg-rose-950/20 p-3.5 rounded-xl border border-rose-200 dark:border-rose-500/30 space-y-1 text-xs">
            <span className="text-slate-500 dark:text-slate-400">避免儿童呼吸道门诊</span>
            <p className="text-lg font-bold text-rose-600 dark:text-rose-400">{benefits.avoidedPediatricRespiratoryOutpatients}</p>
            <span className="text-[10px] text-slate-400">显著降低学龄前儿童哮喘发作</span>
          </div>

          <div className="bg-amber-50/50 dark:bg-amber-950/20 p-3.5 rounded-xl border border-amber-200 dark:border-amber-500/30 space-y-1 text-xs">
            <span className="text-slate-500 dark:text-slate-400">避免心血管急性事件</span>
            <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{benefits.avoidedCardiovascularAcuteEvents}</p>
            <span className="text-[10px] text-slate-400">避免急性心梗与脑卒中抢救</span>
          </div>

          <div className="bg-emerald-50/50 dark:bg-emerald-950/20 p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-500/30 space-y-1 text-xs">
            <span className="text-slate-500 dark:text-slate-400">避免超额过早死亡</span>
            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{benefits.avoidedPrematureDeathsAnnual}</p>
            <span className="text-[10px] text-slate-400">脆弱人群生命年拯救</span>
          </div>

          <div className="bg-purple-50/50 dark:bg-purple-950/20 p-3.5 rounded-xl border border-purple-200 dark:border-purple-500/30 space-y-1 text-xs">
            <span className="text-slate-500 dark:text-slate-400">预估卫生经济学净收益</span>
            <p className="text-lg font-bold text-purple-600 dark:text-purple-400">{benefits.estimatedEconomicBenefitWanRMB}</p>
            <span className="text-[10px] text-slate-400">直接医疗费用与减损工时</span>
          </div>
        </div>
      </div>

      {/* 政策决策智库见解 */}
      <div className="bg-purple-50/60 dark:bg-purple-950/20 p-3.5 rounded-lg border border-purple-200 dark:border-purple-500/30 flex items-start gap-2.5 text-xs">
        <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
        <div className="text-slate-700 dark:text-slate-300">
          <span className="font-bold text-purple-800 dark:text-purple-300">疾控决策智库研判：</span>
          <span className="ml-1 leading-relaxed">{policyInsight}</span>
        </div>
      </div>
    </div>
  );
};
