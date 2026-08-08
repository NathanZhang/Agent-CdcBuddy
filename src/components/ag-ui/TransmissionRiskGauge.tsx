'use client';

import React from 'react';
import ReactECharts from 'echarts-for-react';
import { useTheme } from '@/lib/theme/theme-context';
import { Gauge } from 'lucide-react';

interface TransmissionRiskProps {
  data: {
    city: string;
    diseaseName: string;
    riskScore: number;
    riskLevel: string;
    breakdown: {
      vectorDensityIndex: number;
      pathogenPrevalenceIndex: number;
      populationExposureIndex: number;
      climateSuitabilityIndex: number;
    };
    assessmentSummary: string;
  };
}

export const TransmissionRiskGauge: React.FC<TransmissionRiskProps> = ({ data }) => {
  const { isDark } = useTheme();

  const option = {
    backgroundColor: 'transparent',
    series: [
      {
        type: 'gauge',
        startAngle: 180,
        endAngle: 0,
        center: ['50%', '75%'],
        radius: '100%',
        min: 0,
        max: 100,
        splitNumber: 5,
        axisLine: {
          lineStyle: {
            width: 16,
            color: [
              [0.3, '#10b981'],
              [0.6, '#eab308'],
              [0.8, '#f97316'],
              [1, '#ef4444']
            ]
          }
        },
        pointer: {
          icon: 'path://M12.8,0.7l12,40.1H0.7L12.8,0.7z',
          length: '12%',
          width: 14,
          offsetCenter: [0, '-60%'],
          itemStyle: { color: isDark ? '#38bdf8' : '#0284c7' }
        },
        axisTick: { length: 8, lineStyle: { color: 'auto', width: 1.5 } },
        splitLine: { length: 14, lineStyle: { color: 'auto', width: 2.5 } },
        axisLabel: { color: isDark ? '#94a3b8' : '#64748b', fontSize: 11, distance: -38 },
        title: {
          offsetCenter: [0, '-20%'],
          fontSize: 14,
          color: isDark ? '#e2e8f0' : '#1e293b',
          fontWeight: 'bold'
        },
        detail: {
          fontSize: 32,
          offsetCenter: [0, '0%'],
          valueAnimation: true,
          formatter: '{value}',
          color: isDark ? '#38bdf8' : '#0284c7',
          fontWeight: 'bolder'
        },
        data: [{ value: data.riskScore, name: '综合传播风险指数' }]
      }
    ]
  };

  return (
    <div className="w-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-xl p-5 border border-slate-200 dark:border-fuchsia-500/20 shadow-sm dark:shadow-xl flex flex-col gap-4 transition-colors">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-fuchsia-50 text-fuchsia-600 border border-fuchsia-200 dark:bg-fuchsia-500/10 dark:text-fuchsia-400 dark:border-fuchsia-500/30">
            <Gauge className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              {data.city} · {data.diseaseName} 综合传播风险量化评估
              <span className="text-xs px-2 py-0.5 rounded-full bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200 dark:bg-fuchsia-500/20 dark:text-fuchsia-300 dark:border-fuchsia-500/30 font-medium">
                {data.riskLevel}
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">构建"病媒密度 × 病原携带率 × 人群暴露指数"传播动力学模型</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
        <div className="h-56">
          <ReactECharts option={option} style={{ width: '100%', height: '100%' }} />
        </div>

        <div className="space-y-2.5 text-xs">
          <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex justify-between items-center">
            <span className="text-slate-500 dark:text-slate-400">病媒密度指数 (Vector Density):</span>
            <span className="font-mono font-bold text-rose-600 dark:text-rose-400">{data.breakdown.vectorDensityIndex} / 100</span>
          </div>
          <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex justify-between items-center">
            <span className="text-slate-500 dark:text-slate-400">病原阳性率指数 (Pathogen Prevalence):</span>
            <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{data.breakdown.pathogenPrevalenceIndex} / 100</span>
          </div>
          <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex justify-between items-center">
            <span className="text-slate-500 dark:text-slate-400">人群暴露度指数 (Population Exposure):</span>
            <span className="font-mono font-bold text-sky-600 dark:text-sky-400">{data.breakdown.populationExposureIndex} / 100</span>
          </div>
          <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex justify-between items-center">
            <span className="text-slate-500 dark:text-slate-400">气候适宜度指数 (Climate Suitability):</span>
            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{data.breakdown.climateSuitabilityIndex} / 100</span>
          </div>
        </div>
      </div>

      <div className="p-3 bg-slate-50 dark:bg-slate-950/80 rounded-lg border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300">
        <span className="text-fuchsia-600 dark:text-fuchsia-400 font-semibold block mb-1">🔍 综合研判结论:</span>
        <p className="leading-relaxed">{data.assessmentSummary}</p>
      </div>
    </div>
  );
};
