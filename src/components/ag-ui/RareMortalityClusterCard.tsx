'use client';

import React from 'react';
import ReactECharts from 'echarts-for-react';
import { useTheme } from '@/lib/theme/theme-context';
import { 
  AlertTriangle, 
  MapPin, 
  TrendingUp, 
  Clock, 
  ShieldAlert, 
  Activity, 
  Sparkles,
  Users
} from 'lucide-react';

interface RareMortalityClusterCardProps {
  data?: any;
}

export const RareMortalityClusterCard: React.FC<RareMortalityClusterCardProps> = ({ data = {} }) => {
  const { isDark } = useTheme();
  const target = data?.analysisTarget || '河南省全域';
  const rareClusters = data?.rareMortalityClustersDetected || [
    {
      clusterId: 'RARE-郑州市-金水区-2026',
      city: '郑州市',
      district: '金水区',
      pathogenOrDisease: '散发型克雅氏病 (Creutzfeldt-Jakob Disease)',
      standardIcd10: 'A81.0',
      caseCount: 3,
      triggerThreshold: 3,
      windowPeriod: '2026-08-15 ~ 2026-08-19',
      riskLevel: '一级预警 (极高风险)',
      alertReason: '该区县在两周内异常激增 3 例同类极低频神经变性/感染死因，触发短期聚集阈值 (≥3例)。',
      epidemiologicalAdvice: '紧急启动省地县三级联合流调专班，开展同源暴露溯源与接触者追踪。'
    }
  ];

  const arimaTrend = data?.arimaMortalityTrend || [];
  const dbscanClusters = data?.dbscanSpatialClusters || [];

  // ECharts ARIMA 全死因月度死亡时序消长与未来3个月预测
  const months = arimaTrend.map((t: any) => t.month);
  let lastHistIdx = -1;
  arimaTrend.forEach((t: any, idx: number) => {
    if (!t.isPredicted) lastHistIdx = idx;
  });

  const historicalRates = arimaTrend.map((t: any) => {
    if (!t.isPredicted) return t.crudeMortalityRatePer100k;
    return null;
  });

  const predictedRates = arimaTrend.map((t: any, idx: number) => {
    if (idx === lastHistIdx) return t.crudeMortalityRatePer100k;
    if (t.isPredicted) return t.crudeMortalityRatePer100k;
    return null;
  });

  const echartsOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
      borderColor: isDark ? '#f59e0b' : '#fbbf24',
      textStyle: { color: isDark ? '#f8fafc' : '#0f172a', fontSize: 12 },
      extraCssText: isDark ? '' : 'box-shadow: 0 4px 16px rgba(0,0,0,0.12);',
      formatter: (params: any) => {
        const idx = params[0]?.dataIndex ?? 0;
        const pt = arimaTrend[idx];
        if (!pt) return '';
        return `
          <div style="font-weight:bold;margin-bottom:4px;display:flex;align-items:center;justify-content:space-between;gap:8px;">
            <span>${pt.month} ${pt.isPredicted ? '前瞻预测' : '实测死亡登记'}</span>
            ${pt.isPredicted ? '<span style="font-size:10px;padding:1px 6px;border-radius:4px;background:rgba(245,158,11,0.15);color:#f59e0b;font-weight:bold;">ARIMA推演</span>' : ''}
          </div>
          <div style="font-size:12px;line-height:1.6;">
            <div><span style="color:#f43f5e;margin-right:4px;">●</span>粗死亡率: <b style="color:#f43f5e">${pt.crudeMortalityRatePer100k} / 10万</b></div>
            <div style="color:${isDark ? '#94a3b8' : '#64748b'};">报告死亡人数: <b>${pt.reportedDeaths?.toLocaleString()} 例</b></div>
          </div>
        `;
      }
    },
    legend: {
      data: ['历史死亡率 (1/10万)', 'ARIMA前瞻推演 (未来3月)'],
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
      data: months,
      axisLine: { lineStyle: { color: isDark ? '#475569' : '#cbd5e1' } },
      axisLabel: { 
        color: isDark ? '#94a3b8' : '#64748b', 
        fontSize: 11,
        formatter: (val: string) => val.slice(5)
      }
    },
    yAxis: {
      type: 'value',
      name: '粗死亡率 (1/10万)',
      nameTextStyle: { color: isDark ? '#94a3b8' : '#64748b', fontSize: 11 },
      splitLine: { lineStyle: { color: isDark ? '#334155' : '#e2e8f0', type: 'dashed' } },
      axisLabel: { color: isDark ? '#94a3b8' : '#64748b', fontSize: 11 }
    },
    series: [
      {
        name: '历史死亡率 (1/10万)',
        type: 'line',
        data: historicalRates,
        smooth: 0.3,
        lineStyle: { color: '#f43f5e', width: 3 },
        itemStyle: { 
          color: '#f43f5e',
          borderColor: isDark ? '#0f172a' : '#ffffff',
          borderWidth: 2
        },
        symbol: 'circle',
        symbolSize: 6,
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: isDark ? 'rgba(244, 63, 94, 0.35)' : 'rgba(244, 63, 94, 0.2)' },
              { offset: 1, color: 'rgba(244, 63, 94, 0.01)' }
            ]
          }
        }
      },
      {
        name: 'ARIMA前瞻推演 (未来3月)',
        type: 'line',
        data: predictedRates,
        smooth: 0.3,
        lineStyle: { color: '#f59e0b', width: 3, type: 'dashed' },
        itemStyle: { 
          color: '#f59e0b',
          borderColor: isDark ? '#0f172a' : '#ffffff',
          borderWidth: 2
        },
        symbol: 'circle',
        symbolSize: 6,
        markPoint: {
          data: [
            {
              type: 'max',
              name: '预测达峰',
              symbol: 'pin',
              symbolSize: 40,
              itemStyle: { color: '#d97706' },
              label: {
                formatter: (p: any) => `${p.value}`,
                fontSize: 10,
                color: '#fff',
                fontWeight: 'bold',
                offset: [0, -3]
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
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>全死因时序动态图谱与罕见死因短期聚集探测雷达</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 font-medium">
                ARIMA 时序 · DBSCAN 空间聚类
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              目标区域：{target} · 罕见低频死因（克雅氏病/狂犬病/炭疽）异常聚集智能预警
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="px-2.5 py-1 rounded-md bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 font-bold border border-rose-200 dark:border-rose-500/30">
            罕见死因聚集: {rareClusters.length} 起
          </span>
          <span className="px-2.5 py-1 rounded-md bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold border border-amber-200 dark:border-amber-500/30">
            聚集阈值: ≥3 例/窗口
          </span>
        </div>
      </div>

      {/* 罕见死因异常聚集专报卡片 (首要关注) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-bold text-rose-700 dark:text-rose-400">
          <span className="flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-rose-600" /> 短期高危罕见死因聚集异常信号 (Rare Mortality Clusters)
          </span>
          <span className="text-[11px] text-slate-400 font-normal">触发自动响应与督办流程</span>
        </div>

        <div className="space-y-2.5">
          {rareClusters.map((cluster: any, idx: number) => (
            <div 
              key={idx}
              className="bg-rose-50/60 dark:bg-rose-950/20 p-4 rounded-xl border border-rose-300 dark:border-rose-500/40 space-y-2.5 text-xs shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rose-200 dark:border-rose-500/30 pb-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                    {cluster.pathogenOrDisease}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded bg-rose-600 text-white font-mono font-bold">
                    ICD-10: {cluster.standardIcd10}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-300 font-medium">
                    <MapPin className="w-3.5 h-3.5 text-rose-500" /> {cluster.city} · {cluster.district}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-rose-600 dark:text-rose-400 font-bold">
                    两周内报告 {cluster.caseCount} 例
                  </span>
                  <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300 text-[10px] font-bold">
                    {cluster.riskLevel}
                  </span>
                </div>
              </div>

              <div className="space-y-1 text-slate-700 dark:text-slate-300">
                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-[11px]">
                  <Clock className="w-3.5 h-3.5" /> 监测时间窗: {cluster.windowPeriod}
                </div>
                <p className="leading-relaxed text-slate-800 dark:text-slate-200">
                  <span className="font-semibold text-rose-700 dark:text-rose-400">触发原因：</span>
                  {cluster.alertReason}
                </p>
                <p className="leading-relaxed text-slate-600 dark:text-slate-400">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">流调指导建议：</span>
                  {cluster.epidemiologicalAdvice}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ARIMA 时序全死因趋势 */}
      {arimaTrend.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-800 dark:text-slate-200">
            <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
              <TrendingUp className="w-4 h-4" /> ARIMA 全死因月度死亡时序消长规律与未来3个月预测
            </span>
            <span className="text-[11px] text-slate-400">虚线高亮为模型前瞻推演</span>
          </div>

          <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
            {/* ECharts ARIMA 全死因月度死亡时序消长折线图 */}
            <div className="h-56 w-full">
              <ReactECharts 
                option={echartsOption} 
                style={{ height: '100%', width: '100%' }} 
              />
            </div>

            {/* 最近月份点估计与预测快速指标胶囊 */}
            <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5 pt-2 border-t border-slate-200 dark:border-slate-800">
              {arimaTrend.slice(-10).map((pt: any, i: number) => (
                <div 
                  key={i} 
                  className={`p-2 rounded-lg text-center transition-all ${
                    pt.isPredicted 
                      ? 'bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-500/50 shadow-sm' 
                      : 'bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800'
                  }`}
                >
                  <div className={`text-[10px] font-medium ${pt.isPredicted ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-slate-500'}`}>
                    {pt.month.slice(5)}月
                  </div>
                  <div className={`text-xs font-black mt-0.5 ${pt.isPredicted ? 'text-amber-600 dark:text-amber-400' : 'text-slate-800 dark:text-slate-200'}`}>
                    {pt.crudeMortalityRatePer100k}
                  </div>
                  <div className="text-[9px] text-slate-400 mt-0.5 truncate" title={`${pt.reportedDeaths}例`}>
                    {pt.reportedDeaths}例
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* DBSCAN 空间聚类重点区县 */}
      {dbscanClusters.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
            <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
              <MapPin className="w-4 h-4" /> DBSCAN 空间高死亡风险区域聚类结果
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
            {dbscanClusters.slice(0, 4).map((c: any, i: number) => (
              <div 
                key={i}
                className="bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs"
              >
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-900 dark:text-slate-100">{c.city} · {c.district}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 font-bold">
                    {c.clusterCategory.slice(0, 7)}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  优势死因: <span className="text-slate-700 dark:text-slate-300">{c.dominantCauses}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
