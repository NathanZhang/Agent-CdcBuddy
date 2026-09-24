'use client';

import React from 'react';
import ReactECharts from 'echarts-for-react';
import { FileText, TrendingUp, AlertCircle, ShieldAlert } from 'lucide-react';

interface FoodRiskRankingChartProps {
  data: any;
}

export const FoodRiskRankingChart: React.FC<FoodRiskRankingChartProps> = ({ data }) => {
  const ranking = data?.ranking || [];
  const chart = data?.chartData || {};

  const option = {
    title: {
      text: '进食暴露食品比值比 (Odds Ratio, OR) 与关联强度分析',
      subtext: 'OR > 1.0 表示正相关致病危险因素 · OR ≥ 2.0 具有高度统计显著性',
      left: 'center',
      textStyle: { fontSize: 13, fontWeight: 'bold' }
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'value',
      name: '比值比 (OR)',
      splitLine: { lineStyle: { type: 'dashed' } }
    },
    yAxis: {
      type: 'category',
      data: chart.categories || [],
      axisLabel: { fontSize: 11 }
    },
    series: [
      {
        name: '比值比 (Odds Ratio)',
        type: 'bar',
        data: chart.oddsRatioValues || [],
        itemStyle: {
          color: (params: any) => {
            const v = params.value;
            if (v >= 3.0) return '#ef4444';
            if (v >= 1.5) return '#f97316';
            return '#0ea5e9';
          },
          borderRadius: [0, 4, 4, 0]
        },
        label: {
          show: true,
          position: 'right',
          formatter: '{c}'
        },
        markLine: {
          data: [{ xAxis: 1.0, name: '基线无效线 (OR=1.0)' }],
          lineStyle: { color: '#64748b', type: 'dashed' }
        }
      }
    ]
  };

  return (
    <div className="w-full bg-white dark:bg-slate-900 rounded-xl p-5 border border-indigo-200 dark:border-indigo-500/30 shadow-md space-y-4">
      {/* 头部 */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>可疑进食暴露食品归因分析与高风险食品 TOP10</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 font-medium">
                Apriori 暴露比值比 (OR) 回归
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              区域范围：{data?.queryCity || '河南省全域'} · 融合病例就诊进食史与全省食品安全监督抽检结果
            </p>
          </div>
        </div>
      </div>

      {/* ECharts 水平条形图 */}
      <div className="w-full h-[320px] rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
        <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />
      </div>

      {/* 排行表格 */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
              <th className="py-2 px-3">排位</th>
              <th className="py-2 px-3">高风险食品名称</th>
              <th className="py-2 px-3">大类归属</th>
              <th className="py-2 px-3">暴露病例数</th>
              <th className="py-2 px-3">阳性检出率</th>
              <th className="py-2 px-3">比值比 (OR)</th>
              <th className="py-2 px-3">抽检不合格率</th>
              <th className="py-2 px-3">风险等级</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
            {ranking.map((item: any) => (
              <tr key={item.rank} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td className="py-2 px-3 font-bold font-mono">#{item.rank}</td>
                <td className="py-2 px-3 font-semibold">{item.foodName}</td>
                <td className="py-2 px-3 text-slate-500">{item.categoryName}</td>
                <td className="py-2 px-3">{item.caseCount} 例</td>
                <td className="py-2 px-3">{item.positiveRate}%</td>
                <td className="py-2 px-3 font-bold text-indigo-600 dark:text-indigo-400">{item.oddsRatio}</td>
                <td className="py-2 px-3">{item.samplingUnqualifiedRate}%</td>
                <td className="py-2 px-3">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    item.riskLevel === '极高危' ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300' :
                    item.riskLevel === '高危' ? 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300' :
                    'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300'
                  }`}>
                    {item.riskLevel}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 专家研判小结 */}
      {data?.summary && (
        <div className="bg-indigo-50/70 dark:bg-indigo-950/20 p-3 rounded-lg text-xs text-slate-800 dark:text-slate-200 leading-relaxed flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-indigo-600 shrink-0" />
          <span><b>食品安全风险归因预警：</b>{data.summary}</span>
        </div>
      )}
    </div>
  );
};
