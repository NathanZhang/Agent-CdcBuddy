'use client';

import React from 'react';
import ReactECharts from 'echarts-for-react';
import { DensityTrendPoint } from '@/lib/db/data-provider';
import { useTheme } from '@/lib/theme/theme-context';
import { TrendingUp, Thermometer, Droplets, Info } from 'lucide-react';

interface DensityTrendChartProps {
  data: {
    category: string;
    speciesName: string;
    city: string;
    trend: DensityTrendPoint[];
    r2Score: number;
    weatherCorrelation: { tempCorr: number; humidityCorr: number };
    insights: string[];
  };
}

export const DensityTrendChart: React.FC<DensityTrendChartProps> = ({ data }) => {
  const { isDark } = useTheme();

  const dates = data.trend.map(t => t.date);
  const historical = data.trend.map(t => t.historicalValue !== undefined ? t.historicalValue : null);
  const predicted = data.trend.map(t => t.predictedValue !== undefined ? t.predictedValue : null);
  const temps = data.trend.map(t => t.avgTemp !== undefined ? t.avgTemp : null);

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
      borderColor: isDark ? '#0284c7' : '#bae6fd',
      textStyle: { color: isDark ? '#f8fafc' : '#0f172a', fontSize: 12 },
      axisPointer: { type: 'cross' },
      extraCssText: isDark ? '' : 'box-shadow: 0 4px 12px rgba(0,0,0,0.1);'
    },
    legend: {
      data: ['历史实测密度', 'ARIMA预测密度 (未来3月)', '气温 (℃)'],
      textStyle: { color: isDark ? '#94a3b8' : '#64748b' },
      top: 0
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '15%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: dates,
      axisLine: { lineStyle: { color: isDark ? '#334155' : '#cbd5e1' } },
      axisLabel: { color: isDark ? '#94a3b8' : '#64748b', fontSize: 11 }
    },
    yAxis: [
      {
        type: 'value',
        name: '密度 (只/台次)',
        nameTextStyle: { color: isDark ? '#38bdf8' : '#0284c7' },
        axisLine: { lineStyle: { color: isDark ? '#334155' : '#cbd5e1' } },
        splitLine: { lineStyle: { color: isDark ? 'rgba(51, 65, 85, 0.4)' : 'rgba(226, 232, 240, 0.8)' } },
        axisLabel: { color: isDark ? '#94a3b8' : '#64748b' }
      },
      {
        type: 'value',
        name: '气温 (℃)',
        nameTextStyle: { color: isDark ? '#f59e0b' : '#d97706' },
        position: 'right',
        splitLine: { show: false },
        axisLine: { lineStyle: { color: isDark ? '#334155' : '#cbd5e1' } },
        axisLabel: { color: isDark ? '#f59e0b' : '#d97706' }
      }
    ],
    series: [
      {
        name: '历史实测密度',
        type: 'line',
        smooth: true,
        data: historical,
        itemStyle: { color: '#0284c7' },
        lineStyle: { width: 3 },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: isDark ? 'rgba(2, 132, 199, 0.4)' : 'rgba(2, 132, 199, 0.25)' },
              { offset: 1, color: 'rgba(2, 132, 199, 0.01)' }
            ]
          }
        }
      },
      {
        name: 'ARIMA预测密度 (未来3月)',
        type: 'line',
        smooth: true,
        data: predicted,
        itemStyle: { color: '#ec4899' },
        lineStyle: { width: 3, type: 'dashed' },
        markPoint: {
          data: [{ type: 'max', name: '预测峰值' }]
        }
      },
      {
        name: '气温 (℃)',
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        data: temps,
        itemStyle: { color: isDark ? '#f59e0b' : '#d97706' },
        lineStyle: { width: 1.5, type: 'dotted' }
      }
    ]
  };

  return (
    <div className="w-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-xl p-5 border border-slate-200 dark:border-sky-500/20 shadow-sm dark:shadow-xl flex flex-col gap-4 transition-colors">
      {/* 头部标题与元数据 */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-sky-50 text-sky-600 border border-sky-200 dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-500/30">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              {data.city} · {data.category}类（{data.speciesName}）种群动态消长与时序预测
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30 font-medium">
                R²={data.r2Score} 拟合优度
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">基于 ARIMA/LSTM 与气象时空插值特征，预测误差率≤10%</p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30 font-medium">
            <Thermometer className="w-3.5 h-3.5" />
            <span>气温相关性: +{data.weatherCorrelation.tempCorr}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-cyan-50 text-cyan-700 border border-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-300 dark:border-cyan-500/30 font-medium">
            <Droplets className="w-3.5 h-3.5" />
            <span>湿度相关性: +{data.weatherCorrelation.humidityCorr}</span>
          </div>
        </div>
      </div>

      {/* ECharts 图表 */}
      <div className="w-full h-80">
        <ReactECharts option={option} style={{ width: '100%', height: '100%' }} />
      </div>

      {/* 专家研判要点 */}
      <div className="bg-slate-50 dark:bg-slate-950/70 rounded-lg p-3 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 space-y-1.5">
        <div className="flex items-center gap-1.5 text-sky-600 dark:text-sky-400 font-semibold mb-1">
          <Info className="w-4 h-4" />
          <span>智能体研判与防控建议:</span>
        </div>
        {data.insights.map((insight, idx) => (
          <div key={idx} className="flex items-start gap-2">
            <span className="text-sky-600 dark:text-sky-400 font-bold">•</span>
            <span>{insight}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
