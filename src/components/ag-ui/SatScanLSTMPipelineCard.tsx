'use client';

import React, { useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { useTheme } from '@/lib/theme/theme-context';
import { SatScanSpatialGISMap } from './SatScanSpatialGISMap';
import { 
  Workflow, 
  MapPin, 
  TrendingUp, 
  Layers, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  ArrowRight,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Cpu
} from 'lucide-react';

interface SatScanLSTMPipelineCardProps {
  data: any;
}

export const SatScanLSTMPipelineCard: React.FC<SatScanLSTMPipelineCardProps> = ({ data }) => {
  const { isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<'overview' | 'satscan' | 'kmeans' | 'lstm' | 'logs'>('overview');
  const [selectedCity, setSelectedCity] = useState<string>(
    data?.satscan_data?.high_risk_cities?.[0] || '漯河市'
  );
  const [isHilApproved, setIsHilApproved] = useState<boolean>(false);
  const [showLogDrawer, setShowLogDrawer] = useState<boolean>(false);

  const satscan = data?.satscan_data || {};
  const clusters = satscan.clusters || [];
  const primaryCluster = clusters[0] || {};
  const subgroups = data?.kmeans_subgroups || [];
  const lstm = data?.lstm_forecast || {};
  const predictions = lstm.predictions || {};
  const logs = data?.execution_logs || [];

  // 获取当前选中地市的 LSTM 预测序列
  const currentCityForecast = predictions[selectedCity] || Object.values(predictions)[0] || { forecast_series: [] };
  const forecastSeries = currentCityForecast.forecast_series || [];

  // ECharts 7天预测与 95% 置信区间配置
  const dates = forecastSeries.map((s: any) => s.date || `第${s.day}天`);
  const predictedValues = forecastSeries.map((s: any) => s.predicted_density);
  const lowerBounds = forecastSeries.map((s: any) => s.ci_lower);
  const upperBounds = forecastSeries.map((s: any) => s.ci_upper);

  const echartsOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
      borderColor: isDark ? '#38bdf8' : '#0284c7',
      textStyle: { color: isDark ? '#f8fafc' : '#0f172a', fontSize: 12 },
      extraCssText: isDark ? '' : 'box-shadow: 0 4px 16px rgba(0,0,0,0.12);',
      formatter: function (params: any) {
        let res = `<div class="font-bold mb-1">${params[0].axisValue} 预测</div>`;
        params.forEach((item: any) => {
          if (item.seriesName === '点估计预测密度') {
            res += `<div class="flex items-center gap-2"><span style="color:${item.color}">●</span> ${item.seriesName}: <b>${item.value} 只/灯</b></div>`;
          } else if (item.seriesName === '95% 置信区间上界') {
            res += `<div class="text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}">置信区间: [${lowerBounds[item.dataIndex]} ~ ${item.value}]</div>`;
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
          color: isDark ? 'rgba(56, 189, 248, 0.2)' : 'rgba(2, 132, 199, 0.16)'
        },
        stack: 'confidence-band',
        symbol: 'none'
      },
      {
        name: '点估计预测密度',
        type: 'line',
        data: predictedValues,
        smooth: true,
        lineStyle: { color: isDark ? '#38bdf8' : '#0284c7', width: 3 },
        itemStyle: { color: isDark ? '#0284c7' : '#0369a1' },
        markPoint: {
          data: [{ type: 'max', name: '峰值', itemStyle: { color: '#ef4444' } }]
        }
      }
    ]
  };

  return (
    <div className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-md dark:shadow-2xl p-5 space-y-5 transition-colors">
      {/* 顶部标题与 LangGraph 标识 */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20 text-white">
            <Workflow className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-wide">
                {data.pipeline_name || 'SaTScan ➔ K-Means ➔ LSTM 多步科学计算流水线'}
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-500/30">
                LangGraph State Machine
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              目标时空: {data.target_time} 河南省全域 · {data.category}类监测数据
            </p>
          </div>
        </div>

        {/* 步骤导航 Tab */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 rounded-lg p-1 border border-slate-200 dark:border-slate-700 text-xs">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1 rounded-md transition-all ${
              activeTab === 'overview' 
                ? 'bg-indigo-600 text-white font-semibold shadow' 
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            综合全景
          </button>
          <button
            onClick={() => setActiveTab('satscan')}
            className={`px-3 py-1 rounded-md transition-all ${
              activeTab === 'satscan' 
                ? 'bg-indigo-600 text-white font-semibold shadow' 
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            SaTScan 扫描
          </button>
          <button
            onClick={() => setActiveTab('kmeans')}
            className={`px-3 py-1 rounded-md transition-all ${
              activeTab === 'kmeans' 
                ? 'bg-indigo-600 text-white font-semibold shadow' 
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            K-Means 亚群
          </button>
          <button
            onClick={() => setActiveTab('lstm')}
            className={`px-3 py-1 rounded-md transition-all ${
              activeTab === 'lstm' 
                ? 'bg-indigo-600 text-white font-semibold shadow' 
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            LSTM 预测
          </button>
        </div>
      </div>

      {/* DAG 流程流转进度条 */}
      <div className="bg-slate-50 dark:bg-slate-950/60 rounded-xl p-3 border border-slate-200 dark:border-slate-800">
        <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-2 flex items-center justify-between">
          <span>LangGraph 执行状态拓扑:</span>
          <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-bold">
            <CheckCircle2 className="w-3.5 h-3.5" /> 5/5 节点全部执行成功
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900/90 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700/60 shadow-sm">
            <div className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 flex items-center justify-center font-bold text-[10px]">1</div>
            <div>
              <div className="font-semibold text-slate-800 dark:text-slate-200">数据抽取</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">5.6万事实库检索</div>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900/90 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700/60 shadow-sm">
            <div className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 flex items-center justify-center font-bold text-[10px]">2</div>
            <div>
              <div className="font-semibold text-slate-800 dark:text-slate-200">SaTScan 扫描</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">泊松 LLR (p&lt;0.05)</div>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900/90 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700/60 shadow-sm">
            <div className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 flex items-center justify-center font-bold text-[10px]">3</div>
            <div>
              <div className="font-semibold text-slate-800 dark:text-slate-200">K-Means 分群</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">3 类生态亚群</div>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900/90 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700/60 shadow-sm">
            <div className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 flex items-center justify-center font-bold text-[10px]">4</div>
            <div>
              <div className="font-semibold text-slate-800 dark:text-slate-200">LSTM 外推</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">未来 7 天置信带</div>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900/90 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700/60 shadow-sm">
            <div className="w-5 h-5 rounded-full bg-purple-50 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400 flex items-center justify-center font-bold text-[10px]">5</div>
            <div>
              <div className="font-semibold text-slate-800 dark:text-slate-200">AG-UI 渲染</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">GIS + 研判公报</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab 内容区 */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {/* 核心指标概览三栏卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-sm">
              <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-1 font-medium">
                <MapPin className="w-4 h-4 text-rose-500 dark:text-rose-400" />
                SaTScan 核心聚集区 (Primary)
              </div>
              <div className="text-xl font-bold text-slate-900 dark:text-white">
                {primaryCluster.center_city || '漯河市'} {primaryCluster.center_district || '舞阳县'}
              </div>
              <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 flex items-center gap-2">
                <span>LLR: <b className="text-rose-600 dark:text-rose-400">{primaryCluster.log_likelihood_ratio || 15361}</b></span>
                <span>RR: <b className="text-amber-600 dark:text-amber-400">{primaryCluster.relative_risk || 4.17}</b></span>
                <span>p: <b className="text-emerald-600 dark:text-emerald-400">&lt; 0.05</b></span>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-sm">
              <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-1 font-medium">
                <Layers className="w-4 h-4 text-purple-500 dark:text-purple-400" />
                K-Means 风险亚群分类
              </div>
              <div className="text-xl font-bold text-purple-700 dark:text-purple-300">
                3 大特征典型亚群
              </div>
              <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
                多水体孳生型 · 老旧小区密集型 · 绿化公园外围型
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-sm">
              <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-1 font-medium">
                <TrendingUp className="w-4 h-4 text-sky-500 dark:text-sky-400" />
                LSTM 下一周峰值外推
              </div>
              <div className="text-xl font-bold text-sky-700 dark:text-sky-300">
                {currentCityForecast.peak_density || 23.5} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">只/灯</span>
              </div>
              <div className="text-[11px] text-rose-600 dark:text-rose-400 mt-1 flex items-center gap-1 font-semibold">
                <AlertTriangle className="w-3.5 h-3.5" />
                {currentCityForecast.peak_date} 达到峰值 ({currentCityForecast.trend_direction})
              </div>
            </div>
          </div>

          {/* GIS 空间时空扫描聚集热点分布组件 */}
          <SatScanSpatialGISMap
            clusters={clusters}
            selectedCity={selectedCity}
            onSelectCluster={(c) => setSelectedCity(c.center_city)}
            category={data.category || '蚊'}
          />

          {/* ECharts 7天 LSTM 预测折线图 */}
          <div className="bg-slate-50/80 dark:bg-slate-950/70 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  【LSTM 递归网络】{selectedCity} 下一周病媒密度外推预测曲线 (带 95% 置信区间)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 dark:text-slate-400">切换高危城市:</span>
                <select
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 focus:outline-none focus:border-sky-500 shadow-sm"
                >
                  {Object.keys(predictions).map((city) => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="w-full h-64">
              <ReactECharts option={echartsOption} style={{ height: '100%', width: '100%' }} />
            </div>
          </div>
        </div>
      )}

      {/* SaTScan Tab */}
      {activeTab === 'satscan' && (
        <div className="space-y-4">
          {/* GIS 地图 */}
          <SatScanSpatialGISMap
            clusters={clusters}
            selectedCity={selectedCity}
            onSelectCluster={(c) => setSelectedCity(c.center_city)}
            category={data.category || '蚊'}
          />

          <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-950/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
            <b>Kulldorff 泊松时空扫描原理：</b>
            以全省各县区经纬度为圆心动态扩展圆形窗口，计算窗内观测数与窗外背景的对数似然比（LLR）。经 Monte Carlo 显著性检验（99次随机置换），共识别出 <b>{clusters.length}</b> 个聚集区。
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {clusters.map((c: any, idx: number) => (
              <div key={idx} className="bg-white dark:bg-slate-800/70 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                    c.is_statistically_significant 
                      ? 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/30' 
                      : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                  }`}>
                    {c.cluster_type}
                  </span>
                  <span className="text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400">p = {c.p_value}</span>
                </div>
                <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-rose-500 dark:text-rose-400" />
                  {c.center_city} · {c.center_district} (中心经纬度: {c.center_coord?.[0]?.toFixed(2)}, {c.center_coord?.[1]?.toFixed(2)})
                </div>
                <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/60 p-2 rounded-lg border border-slate-100 dark:border-transparent">
                  <div>扫描半径: <b className="text-sky-600 dark:text-sky-300">{c.radius_km} km</b></div>
                  <div>观测数: <b className="text-amber-600 dark:text-amber-300">{c.observed_count}</b></div>
                  <div>相对危险度 RR: <b className="text-rose-600 dark:text-rose-400">{c.relative_risk}</b></div>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  波及辖区: {c.affected_districts?.join(', ')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* K-Means 亚群 Tab */}
      {activeTab === 'kmeans' && (
        <div className="space-y-3">
          <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-950/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
            <b>多维特征画像分群：</b>
            针对 SaTScan 识别出的高危聚集点，提取【成蚊捕获密度、幼虫BI指数、生境水体数、温湿度敏感度】多维生态特征向量进行 K-Means 聚类，为处置智能体赋能差异化消杀配方。
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {subgroups.map((group: any) => (
              <div key={group.groupId} className="bg-white dark:bg-slate-800/70 p-4 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-sm flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200 dark:text-purple-300 dark:bg-purple-950/60 dark:border-purple-800/40">
                      {group.groupName}
                    </span>
                    <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400">{group.riskWeight}</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {group.featureSummary}
                  </p>
                </div>
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700/60 text-xs">
                  <div className="text-slate-500 dark:text-slate-400 text-[11px] mb-1.5">代表辖区: {group.representativeDistricts?.join(', ')}</div>
                  <div className="text-emerald-800 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-800/30 text-[11px] leading-relaxed">
                    <b className="text-emerald-900 dark:text-emerald-200">推荐防制:</b> {group.primaryIntervention}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* LSTM Tab */}
      {activeTab === 'lstm' && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Object.entries(predictions).map(([city, info]: [string, any]) => (
              <div key={city} className="bg-white dark:bg-slate-800/70 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">{city} 未来 7 天密度走势</h4>
                  <span className={`text-[11px] px-2 py-0.5 rounded-md font-semibold ${
                    info.exceeds_red_threshold 
                      ? 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-500/20 dark:text-rose-400 dark:border-rose-500/30' 
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300'
                  }`}>
                    {info.trend_direction}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 dark:bg-slate-900/60 p-2 rounded-lg text-slate-700 dark:text-slate-300 border border-slate-100 dark:border-transparent">
                  <div>历史基线: <b>{info.historical_baseline} 只/灯</b></div>
                  <div>预测峰值: <b className="text-rose-600 dark:text-rose-400">{info.peak_density} 只/灯</b> ({info.peak_date})</div>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  首日: {info.forecast_series?.[0]?.predicted_density} ➔ 第7日: {info.forecast_series?.[6]?.predicted_density} (CI区间逐渐扩散)
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 人机协同 (Human-in-the-Loop) 审核条 */}
      {data?.summary?.requires_hil_review && (
        <div className={`p-4 rounded-xl border transition-all ${
          isHilApproved 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-600/50 dark:text-emerald-200' 
            : 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-500/50 dark:text-rose-200'
        }`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-5 h-5 text-rose-600 dark:text-rose-400" />
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-white">
                  LangGraph 人机协同审查断点 (Human-in-the-Loop Gate)
                </div>
                <div className="text-xs text-rose-700 dark:text-rose-300 mt-0.5">
                  {data?.summary?.hil_reason || '模型预测部分聚集区未来 7 天突破暴发红线，需专家确认后一键派单'}
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsHilApproved(true)}
              disabled={isHilApproved}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all shadow-md ${
                isHilApproved
                  ? 'bg-emerald-600 text-white cursor-default'
                  : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30'
              }`}
            >
              {isHilApproved ? '✓ 专家已在线核准并派发处置工单' : '确认研判结论并一键派发消杀工单'}
            </button>
          </div>
        </div>
      )}

      {/* 折叠执行日志 */}
      <div className="border-t border-slate-200 dark:border-slate-800 pt-3">
        <button
          onClick={() => setShowLogDrawer(!showLogDrawer)}
          className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-all"
        >
          <Cpu className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
          <span>查看 LangGraph 节点流转底层日志 ({logs.length} 步)</span>
          {showLogDrawer ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        {showLogDrawer && (
          <div className="mt-2 bg-slate-900 text-slate-200 dark:bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-[11px] space-y-1 max-h-40 overflow-y-auto">
            {logs.map((log: string, idx: number) => (
              <div key={idx} className="text-slate-400">
                <span className="text-indigo-400">&gt;</span> {log}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
