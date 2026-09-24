'use client';

import React from 'react';
import { 
  SunMedium, 
  Wind, 
  Activity, 
  AlertTriangle, 
  ShieldCheck, 
  Thermometer, 
  Clock, 
  Users, 
  Sparkles,
  TrendingUp
} from 'lucide-react';

interface AirClimateHealthRiskCardProps {
  data?: any;
}

export const AirClimateHealthRiskCard: React.FC<AirClimateHealthRiskCardProps> = ({ data = {} }) => {
  const city = data?.city || '焦作市';
  const current = data?.currentMonitoring || {
    aqi: 79,
    airQualityLevel: '良',
    pm25: 72.2,
    ozone8h: 104.4,
    maxTemperature: 29.3,
    currentPediatricOutpatients: 187,
    currentElderlyOutpatients: 78
  };
  const dlnm = data?.dlnmModelEvaluation || {
    lagPeakDay: 'Lag 2 (暴露后第2天效应最强)',
    peakRelativeRiskRR: 1.45,
    interpretation: '在当前重度空气暴露条件下，PM2.5对儿童呼吸道门诊就诊的相对危险度达 1.45 倍，发病高峰将在暴发后 48 小时显现。'
  };
  const dlnmCurve = data?.dlnmLagCurve || [
    { lagDay: 0, relativeRiskRR: 1.12, ci95Low: 1.04, ci95High: 1.21, desc: '急性接触即时效应' },
    { lagDay: 1, relativeRiskRR: 1.28, ci95Low: 1.15, ci95High: 1.42, desc: '气道炎症初期激发' },
    { lagDay: 2, relativeRiskRR: 1.45, ci95Low: 1.28, ci95High: 1.63, desc: '门诊就诊效应达峰' },
    { lagDay: 3, relativeRiskRR: 1.34, ci95Low: 1.19, ci95High: 1.51, desc: '亚急性炎症持续' },
    { lagDay: 4, relativeRiskRR: 1.22, ci95Low: 1.08, ci95High: 1.36, desc: '效应逐步衰减' },
    { lagDay: 5, relativeRiskRR: 1.14, ci95Low: 1.01, ci95High: 1.26, desc: '低水平迁延' },
    { lagDay: 6, relativeRiskRR: 1.06, ci95Low: 0.98, ci95High: 1.15, desc: '接近基线' },
    { lagDay: 7, relativeRiskRR: 1.02, ci95Low: 0.95, ci95High: 1.09, desc: '回归基线' }
  ];
  const warning72h = data?.earlyWarning72Hours || {
    isAlertTriggered: true,
    warningLevel: 'orange',
    warningTitle: `${city}未来 72 小时极端高温与复合污染健康风险二级预警`,
    leadTimeHours: 72,
    targetVulnerablePopulations: [
      '0~6岁低龄儿童 (呼吸道过敏与哮喘高发)',
      '65岁以上老年群体 (冠心病/脑梗/高血压高危)'
    ],
    forecastTimeline: [
      { time: '未来24小时', predictedTempMax: 39.2, predictedAqi: 210, pediatricOutpatientSurge: '+42%', cardioOutpatientSurge: '+35%' },
      { time: '未来48小时', predictedTempMax: 40.5, predictedAqi: 225, pediatricOutpatientSurge: '+68%', cardioOutpatientSurge: '+58%' },
      { time: '未来72小时', predictedTempMax: 38.6, predictedAqi: 185, pediatricOutpatientSurge: '+38%', cardioOutpatientSurge: '+29%' }
    ],
    protectiveProtocols: [
      '发布托幼机构及中小学校暂停户外大课间体育活动的健康指引；',
      '建议心血管慢病患者全天开启室内空气净化与空调温湿度调控(26℃为宜)；',
      '联动社区卫生服务中心储备急救硝酸甘油与速效哮喘吸入剂。'
    ]
  };

  return (
    <div className="w-full bg-white dark:bg-slate-900 rounded-xl p-5 border border-amber-200 dark:border-amber-500/30 shadow-md space-y-5">
      {/* 头部态势栏 */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
            <SunMedium className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>空气污染暴露评估与 72h 极端气候健康防护预警</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 font-medium">
                DLNM 滞后非线性 · GBDT
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              当前研判重点城市：{city} · 脆弱人群（儿童哮喘与心血管慢病）健康暴露
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="px-2.5 py-1 rounded-md bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold border border-amber-200 dark:border-amber-500/30">
            提前预警期: {warning72h.leadTimeHours} 小时
          </span>
          <span className="px-2.5 py-1 rounded-md bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 font-bold border border-rose-200 dark:border-rose-500/30">
            峰值 RR: {dlnm.peakRelativeRiskRR} 倍
          </span>
        </div>
      </div>

      {/* 实时气象与门诊基线指标 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
          <span className="text-[11px] text-slate-500 dark:text-slate-400">实时 AQI 指数</span>
          <p className="text-xl font-black text-amber-600 dark:text-amber-400 mt-0.5">{current.aqi}</p>
          <span className="text-[10px] text-slate-400">空气质量: {current.airQualityLevel}</span>
        </div>
        <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
          <span className="text-[11px] text-slate-500 dark:text-slate-400">PM2.5 / 臭氧 O3 浓度</span>
          <p className="text-xl font-black text-sky-600 dark:text-sky-400 mt-0.5">{current.pm25} / {current.ozone8h}</p>
          <span className="text-[10px] text-slate-400">单位: μg/m³</span>
        </div>
        <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
          <span className="text-[11px] text-slate-500 dark:text-slate-400">最高环境气温</span>
          <p className="text-xl font-black text-rose-600 dark:text-rose-400 mt-0.5">{current.maxTemperature} ℃</p>
          <span className="text-[10px] text-slate-400">热浪风险监测</span>
        </div>
        <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
          <span className="text-[11px] text-slate-500 dark:text-slate-400">哨点呼吸/心血管门诊</span>
          <p className="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-0.5">{current.currentPediatricOutpatients} / {current.currentElderlyOutpatients}</p>
          <span className="text-[10px] text-slate-400">日门诊例数基线</span>
        </div>
      </div>

      {/* DLNM 分布滞后非线性模型效应曲线 */}
      <div className="bg-slate-50 dark:bg-slate-950/80 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-800 dark:text-slate-200">
          <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
            <TrendingUp className="w-4 h-4" /> DLNM 模型：重污染暴露后 0~7 天相对危险度 (RR) 滞后衰减曲线
          </span>
          <span className="text-[11px] text-slate-400">滞后达峰期：{dlnm.lagPeakDay}</span>
        </div>

        <div className="flex items-end justify-between gap-1.5 h-32 pt-2 px-2">
          {dlnmCurve.map((pt: any, idx: number) => {
            const isPeak = idx === 2;
            const rr = Number(pt.relativeRiskRR);
            const heightPct = Math.max(15, Math.round(((rr - 1.0) / 0.5) * 85 + 15));

            return (
              <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative">
                <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8 px-1.5 py-0.5 rounded bg-slate-800 text-white text-[10px] pointer-events-none whitespace-nowrap z-10">
                  RR={rr.toFixed(2)} (95% CI: {pt.ci95Low}~{pt.ci95High})
                </div>
                <span className={`text-[10px] font-bold ${isPeak ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`}>
                  {rr.toFixed(2)}
                </span>
                <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-t-md h-full flex items-end">
                  <div 
                    className={`w-full rounded-t-md transition-all duration-500 ${
                      isPeak 
                        ? 'bg-rose-500 shadow-md shadow-rose-500/30' 
                        : 'bg-amber-400 dark:bg-amber-600/70 hover:bg-amber-500'
                    }`}
                    style={{ height: `${heightPct}%` }}
                  />
                </div>
                <span className={`text-[10px] ${isPeak ? 'text-rose-600 font-bold' : 'text-slate-500'}`}>
                  Lag{pt.lagDay}
                </span>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed border-t border-slate-200 dark:border-slate-800 pt-2">
          <span className="font-semibold text-slate-800 dark:text-slate-200">流行病学效应解读：</span>
          {dlnm.interpretation}
        </p>
      </div>

      {/* 72 小时高温极端气候预警时间线 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
          <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
            <Clock className="w-4 h-4" /> 未来 72 小时极端高温热浪与复合污染预警演变推演
          </span>
          <span className="text-[11px] text-rose-600 dark:text-rose-400 font-bold">
            {warning72h.warningTitle}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {warning72h.forecastTimeline.map((item: any, idx: number) => (
            <div 
              key={idx}
              className={`p-3 rounded-xl border text-xs space-y-2 ${
                idx === 1 
                  ? 'bg-rose-50/60 dark:bg-rose-950/20 border-rose-300 dark:border-rose-500/40 shadow-sm' 
                  : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800'
              }`}
            >
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-900 dark:text-slate-100">{item.time}</span>
                <span className="text-rose-600 font-bold text-[11px]">{item.predictedTempMax} ℃</span>
              </div>
              <div className="space-y-1 text-slate-600 dark:text-slate-400">
                <div className="flex justify-between">
                  <span>预测 AQI 指数:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{item.predictedAqi}</span>
                </div>
                <div className="flex justify-between">
                  <span>儿童呼吸门诊激增:</span>
                  <span className="font-bold text-rose-600 dark:text-rose-400">{item.pediatricOutpatientSurge}</span>
                </div>
                <div className="flex justify-between">
                  <span>老年心血管门诊激增:</span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">{item.cardioOutpatientSurge}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 脆弱人群精准防护指引 */}
      <div className="bg-amber-50/60 dark:bg-amber-950/20 p-3.5 rounded-lg border border-amber-200 dark:border-amber-500/30 space-y-2 text-xs">
        <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
          <ShieldCheck className="w-4 h-4 text-amber-600" />
          <span>重点脆弱人群多部门协同干预措施与健康指南：</span>
        </div>
        <div className="space-y-1 text-slate-700 dark:text-slate-300">
          {warning72h.protectiveProtocols.map((p: string, i: number) => (
            <div key={i} className="flex items-start gap-1.5">
              <span className="text-amber-600 font-bold">•</span>
              <span>{p}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
