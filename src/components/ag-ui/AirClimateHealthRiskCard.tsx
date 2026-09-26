'use client';

import React from 'react';
import ReactECharts from 'echarts-for-react';
import { useTheme } from '@/lib/theme/theme-context';
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
  const { isDark } = useTheme();
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

  // 提取 DLNM 滞后相对危险度 (RR) 及 95% CI 数据配置 ECharts
  const lagLabels = dlnmCurve.map((pt: any) => `Lag ${pt.lagDay}`);
  const rrValues = dlnmCurve.map((pt: any) => Number(pt.relativeRiskRR));
  const ciLowers = dlnmCurve.map((pt: any) => Number(pt.ci95Low));
  const ciUppers = dlnmCurve.map((pt: any) => Number(pt.ci95High));
  
  let peakIdx = 0;
  let maxRR = -Infinity;
  rrValues.forEach((val: number, i: number) => {
    if (val > maxRR) {
      maxRR = val;
      peakIdx = i;
    }
  });

  const echartsOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
      borderColor: isDark ? '#f43f5e' : '#fb7185',
      textStyle: { color: isDark ? '#f8fafc' : '#0f172a', fontSize: 12 },
      extraCssText: isDark ? '' : 'box-shadow: 0 4px 16px rgba(0,0,0,0.12);',
      formatter: (params: any) => {
        const idx = params[0]?.dataIndex ?? 0;
        const pt = dlnmCurve[idx];
        if (!pt) return '';
        const isPeak = idx === peakIdx;
        return `
          <div style="font-weight:bold;margin-bottom:4px;display:flex;align-items:center;justify-content:space-between;gap:8px;">
            <span>Lag ${pt.lagDay} 天效应</span>
            ${isPeak ? '<span style="font-size:10px;padding:1px 6px;border-radius:4px;background:rgba(244,63,94,0.15);color:#f43f5e;font-weight:bold;">效应峰值</span>' : ''}
          </div>
          <div style="font-size:12px;line-height:1.6;">
            <div><span style="color:#f43f5e;margin-right:4px;">●</span>相对危险度 (RR): <b style="color:#f43f5e">${Number(pt.relativeRiskRR).toFixed(2)} 倍</b></div>
            <div style="color:${isDark ? '#94a3b8' : '#64748b'};">95% 置信区间: [${Number(pt.ci95Low).toFixed(2)} ~ ${Number(pt.ci95High).toFixed(2)}]</div>
            ${pt.desc ? `<div style="font-size:11px;color:${isDark ? '#cbd5e1' : '#475569'};margin-top:4px;padding-top:4px;border-top:1px dashed ${isDark ? '#334155' : '#e2e8f0'};">${pt.desc}</div>` : ''}
          </div>
        `;
      }
    },
    legend: {
      data: ['相对危险度 (RR)', '95% 置信区间 (CI)'],
      textStyle: { color: isDark ? '#94a3b8' : '#64748b', fontSize: 11 },
      top: 0,
      right: 10
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '10%',
      top: '18%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: lagLabels,
      axisLine: { lineStyle: { color: isDark ? '#475569' : '#cbd5e1' } },
      axisLabel: { color: isDark ? '#94a3b8' : '#64748b', fontSize: 11 }
    },
    yAxis: {
      type: 'value',
      name: '相对危险度 (RR)',
      min: 0.85,
      max: 1.8,
      nameTextStyle: { color: isDark ? '#94a3b8' : '#64748b', fontSize: 11 },
      splitLine: { lineStyle: { color: isDark ? '#334155' : '#e2e8f0', type: 'dashed' } },
      axisLabel: { color: isDark ? '#94a3b8' : '#64748b', fontSize: 11 }
    },
    series: [
      {
        name: '95% 置信区间下界',
        type: 'line',
        data: ciLowers,
        lineStyle: { opacity: 0 },
        stack: 'confidence-band',
        symbol: 'none'
      },
      {
        name: '95% 置信区间 (CI)',
        type: 'line',
        data: ciUppers.map((u: number, idx: number) => +(Math.max(0, u - (ciLowers[idx] || 0))).toFixed(4)),
        lineStyle: { opacity: 0 },
        areaStyle: {
          color: isDark ? 'rgba(244, 63, 94, 0.18)' : 'rgba(244, 63, 94, 0.12)'
        },
        stack: 'confidence-band',
        symbol: 'none'
      },
      {
        name: '相对危险度 (RR)',
        type: 'line',
        data: rrValues,
        smooth: 0.35,
        lineStyle: { color: '#f43f5e', width: 3 },
        itemStyle: { 
          color: '#f43f5e',
          borderColor: isDark ? '#0f172a' : '#ffffff',
          borderWidth: 2
        },
        symbol: 'circle',
        symbolSize: 7,
        markPoint: {
          data: [
            {
              type: 'max',
              name: '峰值',
              symbol: 'pin',
              symbolSize: 42,
              itemStyle: { color: '#e11d48' },
              label: {
                formatter: (p: any) => `${p.value}`,
                fontSize: 10,
                color: '#ffffff',
                fontWeight: 'bold',
                offset: [0, -3]
              }
            }
          ]
        },
        markLine: {
          symbol: ['none', 'none'],
          silent: true,
          data: [
            {
              yAxis: 1.0,
              lineStyle: {
                color: isDark ? '#64748b' : '#94a3b8',
                type: 'dashed',
                width: 1.5
              },
              label: {
                position: 'insideEndTop',
                formatter: '基准无风险线 (RR=1.0)',
                color: isDark ? '#94a3b8' : '#64748b',
                fontSize: 10
              }
            }
          ]
        }
      }
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

        {/* ECharts DLNM 滞后相对危险度 (RR) 曲线与 95% CI 带状图 */}
        <div className="h-56 w-full">
          <ReactECharts 
            option={echartsOption} 
            style={{ height: '100%', width: '100%' }} 
          />
        </div>

        {/* 0~7 天各滞后日点估计与 95% CI 快速指标胶囊 */}
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5 pt-2 border-t border-slate-200 dark:border-slate-800">
          {dlnmCurve.map((pt: any, idx: number) => {
            const isPeak = idx === peakIdx;
            const rr = Number(pt.relativeRiskRR);

            return (
              <div 
                key={idx} 
                className={`p-2 rounded-lg text-center transition-all ${
                  isPeak 
                    ? 'bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-500/50 shadow-sm' 
                    : 'bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800'
                }`}
              >
                <div className={`text-[10px] font-medium ${isPeak ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-slate-500'}`}>
                  Lag {pt.lagDay}
                </div>
                <div className={`text-xs font-black mt-0.5 ${isPeak ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-slate-200'}`}>
                  {rr.toFixed(2)}
                </div>
                <div className="text-[9px] text-slate-400 mt-0.5 truncate" title={`95% CI: ${pt.ci95Low}~${pt.ci95High}`}>
                  {pt.ci95Low}~{pt.ci95High}
                </div>
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
