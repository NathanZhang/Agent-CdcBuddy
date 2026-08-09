'use client';

import React, { useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { useTheme } from '@/lib/theme/theme-context';
import { 
  TrendingUp, 
  AlertTriangle, 
  Clock, 
  Info, 
  ShieldCheck, 
  Activity,
  Layers,
  ChevronRight
} from 'lucide-react';

interface LSTMPredictorCardProps {
  data: any;
}

export const LSTMPredictorCard: React.FC<LSTMPredictorCardProps> = ({ data }) => {
  const { isDark } = useTheme();
  const predictions = data?.predictions || {};
  const cities = Object.keys(predictions).length > 0 ? Object.keys(predictions) : ['郑州市', '信阳市', '南阳市', '洛阳市'];
  
  const [selectedCity, setSelectedCity] = useState<string>(
    data?.generative_ui?.selected_city || cities[0] || '郑州市'
  );
  const [isHilApproved, setIsHilApproved] = useState<boolean>(false);

  const currentCityForecast = predictions[selectedCity] || Object.values(predictions)[0] || { forecast_series: [] };
  const forecastSeries = currentCityForecast.forecast_series || [];
  const insights = data?.insights || [];

  // ECharts 7~14天 LSTM 预测与 95% 带状置信区间
  const dates = forecastSeries.map((s: any) => s.date || `第${s.day}天`);
  const predictedValues = forecastSeries.map((s: any) => s.predicted_density);
  const lowerBounds = forecastSeries.map((s: any) => s.ci_lower);
  const upperBounds = forecastSeries.map((s: any) => s.ci_upper);

  const echartsOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
      borderColor: isDark ? '#6366f1' : '#4f46e5',
      textStyle: { color: isDark ? '#f8fafc' : '#0f172a', fontSize: 12 },
      extraCssText: isDark ? '' : 'box-shadow: 0 4px 16px rgba(0,0,0,0.12);',
      formatter: function (params: any) {
        let res = `<div class="font-bold mb-1">${params[0].axisValue} 预测</div>`;
        params.forEach((item: any) => {
          if (item.seriesName === '点估计预测密度') {
            res += `<div class="flex items-center gap-2"><span style="color:${item.color}">●</span> ${item.seriesName}: <b>${item.value} 只/灯</b></div>`;
          } else if (item.seriesName === '95% 置信区间上界') {
            res += `<div class="text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}">置信带: [${lowerBounds[item.dataIndex]} ~ ${item.value}]</div>`;
          }
        });
        return res;
      }
    },
    legend: {
      data: ['点估计预测密度', '95% 置信区间上界', '历史基线均值'],
      textStyle: { color: isDark ? '#94a3b8' : '#64748b', fontSize: 11 },
      top: 0
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
      data: dates,
      axisLine: { lineStyle: { color: isDark ? '#475569' : '#cbd5e1' } },
      axisLabel: { color: isDark ? '#94a3b8' : '#64748b', fontSize: 11 }
    },
    yAxis: {
      type: 'value',
      name: '密度 (只/灯·夜)',
      nameTextStyle: { color: isDark ? '#94a3b8' : '#64748b', fontSize: 11 },
      splitLine: { lineStyle: { color: isDark ? '#334155' : '#e2e8f0', type: 'dashed' } },
      axisLabel: { color: isDark ? '#94a3b8' : '#64748b', fontSize: 11 }
    },
    series: [
      {
        name: '历史基线均值',
        type: 'line',
        data: forecastSeries.map(() => currentCityForecast.historical_baseline || 8.0),
        lineStyle: { color: isDark ? '#94a3b8' : '#64748b', type: 'dotted', width: 2 },
        symbol: 'none'
      },
      {
        name: '95% 置信区间下界',
        type: 'line',
        data: lowerBounds,
        lineStyle: { opacity: 0 },
        stack: 'confidence-band',
        symbol: 'none'
      },
      {
        name: '95% 置信区间上界',
        type: 'line',
        data: upperBounds.map((u: number, idx: number) => Math.max(0, u - (lowerBounds[idx] || 0))),
        lineStyle: { opacity: 0 },
        areaStyle: {
          color: isDark ? 'rgba(99, 102, 241, 0.2)' : 'rgba(79, 70, 229, 0.15)'
        },
        stack: 'confidence-band',
        symbol: 'none'
      },
      {
        name: '点估计预测密度',
        type: 'line',
        data: predictedValues,
        smooth: true,
        lineStyle: { color: isDark ? '#818cf8' : '#4f46e5', width: 3 },
        itemStyle: { color: isDark ? '#6366f1' : '#4338ca' },
        markPoint: {
          data: [{ type: 'max', name: '预测峰值', itemStyle: { color: '#ef4444' } }]
        }
      }
    ]
  };

  return (
    <div className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-md dark:shadow-2xl p-5 space-y-5 transition-colors">
      {/* 头部标题与地市选择 */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-600 to-sky-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-wide">
                {data.title || `【LSTM 深度时序外推】未来 ${data.forecast_days || 7} 天病媒密度走势与置信区间`}
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-500/30">
                4-Gate LSTM Recurrent Net
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              基于过去 60 天真实监测密度与温湿度协变量训练 · 输出 95% 动态扩散置信带
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400">切换目标城市:</span>
          <select
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 focus:outline-none focus:border-indigo-500 shadow-sm font-semibold"
          >
            {cities.map((city) => (
              <option key={city} value={city}>{city}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 核心指标概览三栏卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-sm">
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-1 font-medium">
            <Activity className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
            历史基线本底均值
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white">
            {currentCityForecast.historical_baseline || 8.5} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">只/灯</span>
          </div>
          <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
            过去 60 天滚动滑动均值
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-sm">
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-1 font-medium">
            <TrendingUp className="w-4 h-4 text-rose-500 dark:text-rose-400" />
            外推预测峰值 (Peak Density)
          </div>
          <div className="text-xl font-bold text-rose-600 dark:text-rose-400">
            {currentCityForecast.peak_density || 16.5} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">只/灯</span>
          </div>
          <div className="text-[11px] text-rose-600 dark:text-rose-400 mt-1 flex items-center gap-1 font-semibold">
            <AlertTriangle className="w-3.5 h-3.5" />
            {currentCityForecast.peak_date} 达到极值 ({currentCityForecast.trend_direction})
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-sm">
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-1 font-medium">
            <Layers className="w-4 h-4 text-sky-500 dark:text-sky-400" />
            95% 置信区间扩散宽度
          </div>
          <div className="text-xl font-bold text-sky-600 dark:text-sky-400">
            ±{((upperBounds[upperBounds.length - 1] || 20) - (lowerBounds[lowerBounds.length - 1] || 10)).toFixed(1)} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">带状扩散</span>
          </div>
          <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
            置信区间: [{lowerBounds[lowerBounds.length - 1]} ~ {upperBounds[upperBounds.length - 1]}]
          </div>
        </div>
      </div>

      {/* ECharts 图表 */}
      <div className="bg-slate-50/80 dark:bg-slate-950/70 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-2">
          【LSTM 时序外推】{selectedCity} 未来 {data.forecast_days || 7} 天日级密度走势预测曲线 (带 95% 置信带)
        </div>
        <div className="w-full h-72">
          <ReactECharts option={echartsOption} style={{ height: '100%', width: '100%' }} />
        </div>
      </div>

      {/* 多地市预测列表对比 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
        {Object.entries(predictions).map(([city, info]: [string, any]) => (
          <button
            key={city}
            onClick={() => setSelectedCity(city)}
            className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
              selectedCity === city
                ? 'bg-indigo-50 border-indigo-300 dark:bg-indigo-950/60 dark:border-indigo-500/60 shadow'
                : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:border-indigo-300'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-slate-900 dark:text-white">{city}</span>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                info.exceeds_red_threshold
                  ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300'
                  : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
              }`}>
                {info.trend_direction}
              </span>
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-300">
              峰值: <b className="text-rose-600 dark:text-rose-400">{info.peak_density}</b> ({info.peak_date?.slice(5)})
            </div>
          </button>
        ))}
      </div>

      {/* 专家研判要点 */}
      <div className="bg-slate-50 dark:bg-slate-950/70 rounded-xl p-4 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
        <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-bold">
          <Info className="w-4 h-4" />
          <span>LSTM 深度时序研判建议与模型说明:</span>
        </div>
        {insights.map((insight: string, idx: number) => (
          <div key={idx} className="flex items-start gap-2 text-slate-700 dark:text-slate-300 leading-relaxed">
            <span className="text-indigo-500 font-bold">•</span>
            <span>{insight}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
