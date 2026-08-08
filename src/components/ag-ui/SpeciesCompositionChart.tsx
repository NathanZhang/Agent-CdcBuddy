'use client';

import React from 'react';
import ReactECharts from 'echarts-for-react';
import { SpeciesCompositionItem } from '@/lib/db/data-provider';
import { useTheme } from '@/lib/theme/theme-context';
import { PieChart as PieIcon, Award } from 'lucide-react';

interface SpeciesCompositionProps {
  data: {
    category: string;
    city: string;
    items: SpeciesCompositionItem[];
    dominantSpecies: string;
    shannonWienerIndex: number;
  };
}

export const SpeciesCompositionChart: React.FC<SpeciesCompositionProps> = ({ data }) => {
  const { isDark } = useTheme();

  const pieData = data.items.map(item => ({
    name: item.speciesName,
    value: item.totalCount
  }));

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} 只 ({d}%)',
      backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
      borderColor: isDark ? '#0284c7' : '#c7d2fe',
      textStyle: { color: isDark ? '#fff' : '#0f172a' },
      extraCssText: isDark ? '' : 'box-shadow: 0 4px 12px rgba(0,0,0,0.1);'
    },
    legend: {
      orient: 'vertical',
      right: '5%',
      top: 'center',
      textStyle: { color: isDark ? '#94a3b8' : '#64748b', fontSize: 12 }
    },
    series: [
      {
        name: '种群构成比',
        type: 'pie',
        radius: ['42%', '72%'],
        center: ['40%', '50%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 8,
          borderColor: isDark ? '#0f172a' : '#ffffff',
          borderWidth: 2
        },
        label: {
          show: false,
          position: 'center'
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 16,
            fontWeight: 'bold',
            color: isDark ? '#38bdf8' : '#4f46e5'
          }
        },
        labelLine: { show: false },
        data: pieData
      }
    ]
  };

  return (
    <div className="w-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-xl p-5 border border-slate-200 dark:border-indigo-500/20 shadow-sm dark:shadow-xl flex flex-col gap-4 transition-colors">
      {/* 头部 */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/30">
            <PieIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              {data.city} · {data.category}类优势种群识别与构成比
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-500/30 font-medium">
                Shannon 指数 H={data.shannonWienerIndex}
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">基于 K-Means 聚类与构成比空间分异特征分析</p>
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-500/30 text-xs">
          <Award className="w-4 h-4 text-amber-500 dark:text-amber-400" />
          <span className="text-slate-600 dark:text-slate-300">绝对优势种:</span>
          <span className="font-bold text-indigo-700 dark:text-indigo-300">{data.dominantSpecies}</span>
        </div>
      </div>

      {/* 饼图与表格分栏 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
        <div className="h-64">
          <ReactECharts option={option} style={{ width: '100%', height: '100%' }} />
        </div>

        {/* 种群列表与分布 */}
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {data.items.map((item, idx) => (
            <div key={idx} className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-xs hover:border-indigo-400 dark:hover:border-indigo-500/40 transition-colors">
              <div>
                <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 dark:bg-indigo-400"></span>
                  <span>{item.speciesName}</span>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 italic">({item.latinName})</span>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  累计捕获: <span className="font-mono text-sky-600 dark:text-sky-400 font-semibold">{item.totalCount.toLocaleString()}</span> 只
                </div>
              </div>
              <div className="text-right">
                <span className="text-sm font-bold font-mono text-indigo-600 dark:text-indigo-300">{item.percentage}%</span>
                <span className="block text-[10px] text-slate-400 dark:text-slate-500">种群占比</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
