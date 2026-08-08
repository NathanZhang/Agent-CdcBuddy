'use client';

import React from 'react';
import ReactECharts from 'echarts-for-react';
import { useTheme } from '@/lib/theme/theme-context';
import { Dna, AlertOctagon } from 'lucide-react';

interface ResistanceEvolutionProps {
  data: {
    speciesName: string;
    pesticideName: string;
    evolutionYears: string[];
    kdrGeneFrequency: number[];
    resistanceRatio: number[];
    warningAlert: string;
  };
}

export const ResistanceEvolutionChart: React.FC<ResistanceEvolutionProps> = ({ data }) => {
  const { isDark } = useTheme();

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
      borderColor: isDark ? '#a855f7' : '#e9d5ff',
      textStyle: { color: isDark ? '#fff' : '#0f172a' },
      extraCssText: isDark ? '' : 'box-shadow: 0 4px 12px rgba(0,0,0,0.1);'
    },
    legend: {
      data: ['KDR 耐药基因频率 (0-1.0)', '抗性倍数 (倍)'],
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
      data: data.evolutionYears,
      axisLine: { lineStyle: { color: isDark ? '#334155' : '#cbd5e1' } },
      axisLabel: { color: isDark ? '#94a3b8' : '#64748b' }
    },
    yAxis: [
      {
        type: 'value',
        name: '基因频率',
        min: 0,
        max: 1.0,
        axisLine: { lineStyle: { color: isDark ? '#334155' : '#cbd5e1' } },
        splitLine: { lineStyle: { color: isDark ? 'rgba(51, 65, 85, 0.4)' : 'rgba(226, 232, 240, 0.8)' } },
        axisLabel: { color: isDark ? '#a855f7' : '#9333ea' }
      },
      {
        type: 'value',
        name: '抗性倍数 (倍)',
        position: 'right',
        splitLine: { show: false },
        axisLine: { lineStyle: { color: isDark ? '#334155' : '#cbd5e1' } },
        axisLabel: { color: '#ec4899' }
      }
    ],
    series: [
      {
        name: 'KDR 耐药基因频率 (0-1.0)',
        type: 'line',
        smooth: true,
        data: data.kdrGeneFrequency,
        itemStyle: { color: '#a855f7' },
        lineStyle: { width: 3 }
      },
      {
        name: '抗性倍数 (倍)',
        type: 'bar',
        yAxisIndex: 1,
        data: data.resistanceRatio,
        itemStyle: { color: isDark ? 'rgba(236, 72, 153, 0.6)' : 'rgba(236, 72, 153, 0.75)' },
        barWidth: 20
      }
    ]
  };

  return (
    <div className="w-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-xl p-5 border border-slate-200 dark:border-purple-500/20 shadow-sm dark:shadow-xl flex flex-col gap-4 transition-colors">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-purple-50 text-purple-600 border border-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/30">
            <Dna className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              {data.speciesName} 对 {data.pesticideName} 基因演化预测模型
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-500/30 font-medium">
                1年内耐药暴发预警
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">基于历史抗药性及用药频次，通过贝叶斯网络模型预测基因频率突变</p>
          </div>
        </div>
      </div>

      <div className="w-full h-72">
        <ReactECharts option={option} style={{ width: '100%', height: '100%' }} />
      </div>

      <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-500/40 rounded-lg flex items-start gap-2.5 text-xs text-red-800 dark:text-red-200">
        <AlertOctagon className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">{data.warningAlert}</p>
      </div>
    </div>
  );
};
