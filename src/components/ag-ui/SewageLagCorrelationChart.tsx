'use client';

import React from 'react';
import { 
  Activity, 
  GitCommit, 
  Clock, 
  MapPin, 
  AlertTriangle, 
  CheckCircle2, 
  TrendingUp, 
  Sparkles,
  ArrowRight
} from 'lucide-react';

interface SewageLagCorrelationChartProps {
  data?: any;
}

export const SewageLagCorrelationChart: React.FC<SewageLagCorrelationChartProps> = ({ data = {} }) => {
  const city = data?.city || '郑州市';
  const pathogen = data?.monitoredPathogen || '诺如病毒';
  const lagWindow = data?.optimalLagWindow || {
    bestLagDays: 6,
    maxPearsonR: 0.912,
    conclusion: '污水中【诺如病毒】浓度异常提前哨点医院门诊量峰值 6 天显现，具备极高的流行病学早期预警窗口期。'
  };
  const lagTrend = data?.lagCorrelationTrend || [
    { lagDays: 0, pearsonCorrelation: 0.78, significanceP: 0.025 },
    { lagDays: 2, pearsonCorrelation: 0.82, significanceP: 0.001 },
    { lagDays: 4, pearsonCorrelation: 0.812, significanceP: 0.001 },
    { lagDays: 6, pearsonCorrelation: 0.912, significanceP: 0.001 },
    { lagDays: 8, pearsonCorrelation: 0.812, significanceP: 0.001 },
    { lagDays: 10, pearsonCorrelation: 0.82, significanceP: 0.001 },
    { lagDays: 12, pearsonCorrelation: 0.78, significanceP: 0.025 },
    { lagDays: 14, pearsonCorrelation: 0.74, significanceP: 0.025 }
  ];
  const sources = data?.reverseTracingSources || [
    {
      subzoneName: '金水区龙子湖大学园区汇水支网',
      detectedConcentration: '2.45×10⁴ copies/L',
      flowContributionRate: '28.5%',
      suspectedFacility: '高密度高校学生宿舍及集中餐饮集水管段',
      upstreamRiskLevel: '高危 (一级预警)',
      tracingStatus: '已锁定异常排泄管段并实施消杀'
    },
    {
      subzoneName: '金水区未来路农贸商圈集水分区',
      detectedConcentration: '1.28×10⁴ copies/L',
      flowContributionRate: '19.2%',
      suspectedFacility: '海鲜水产批发交易区化粪池溢流口',
      upstreamRiskLevel: '较重 (二级预警)',
      tracingStatus: '已下发管网复测工单'
    }
  ];
  const suggestedAction = data?.suggestedAction || '立即对锁定的上游高校集水井与批发市场重点排污节点实施含氯消毒剂在线加压冲洗，对波及片区开展症状主动监测。';

  return (
    <div className="w-full bg-white dark:bg-slate-900 rounded-xl p-5 border border-teal-200 dark:border-teal-500/30 shadow-md space-y-5">
      {/* 头部态势栏 */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-teal-100 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>城市污水病原时序滞后关联分析与 GIS 拓扑反向溯源</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300 font-medium">
                时序互相关 · 管网拓扑
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              目标地市：{city} · 目标病原：{pathogen} · 关联哨点门诊数据
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="px-2.5 py-1 rounded-md bg-teal-100 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300 font-bold border border-teal-200 dark:border-teal-500/30">
            最佳提前预警期: {lagWindow.bestLagDays} 天
          </span>
          <span className="px-2.5 py-1 rounded-md bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-500/30">
            相关系数 r: {lagWindow.maxPearsonR}
          </span>
        </div>
      </div>

      {/* 预警窗口核心结论 */}
      <div className="bg-teal-50/70 dark:bg-teal-950/20 p-4 rounded-xl border border-teal-200 dark:border-teal-500/30 space-y-2">
        <div className="flex items-center gap-2 text-xs font-bold text-teal-700 dark:text-teal-300">
          <Clock className="w-4 h-4" />
          <span>流行病学早期预警窗口研判结论</span>
        </div>
        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
          {lagWindow.conclusion}
        </p>
      </div>

      {/* 0-14 天时序滞后相关曲线 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-800 dark:text-slate-200">
          <span className="flex items-center gap-1.5 text-teal-600 dark:text-teal-400">
            <TrendingUp className="w-4 h-4" /> 污水病毒浓度与门诊病例 0~14 天 Pearson 滞后相关系数分布
          </span>
          <span className="text-[11px] text-slate-400">P &lt; 0.001 极显著相关</span>
        </div>

        <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
          <div className="flex items-end justify-between gap-1.5 h-36 pt-4 px-2">
            {lagTrend.map((item: any, i: number) => {
              const isPeak = item.lagDays === lagWindow.bestLagDays;
              const r = Number(item.pearsonCorrelation);
              const heightPct = Math.max(10, Math.round((r / 1.0) * 100));

              return (
                <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1.5 group relative">
                  {/* Tooltip on hover */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8 px-1.5 py-0.5 rounded bg-slate-800 text-white text-[10px] pointer-events-none whitespace-nowrap z-10">
                    Lag {item.lagDays}天: r={r.toFixed(3)}
                  </div>
                  <span className={`text-[10px] font-bold ${isPeak ? 'text-teal-600 dark:text-teal-400 font-extrabold' : 'text-slate-400'}`}>
                    {r.toFixed(2)}
                  </span>
                  <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-t-md h-24 flex items-end">
                    <div 
                      className={`w-full rounded-t-md transition-all duration-500 ${
                        isPeak 
                          ? 'bg-teal-500 shadow-md shadow-teal-500/30' 
                          : 'bg-teal-300 dark:bg-teal-700/60 hover:bg-teal-400'
                      }`}
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                  <span className={`text-[10px] font-medium ${isPeak ? 'text-teal-600 dark:text-teal-400 font-bold' : 'text-slate-500'}`}>
                    {item.lagDays}d
                  </span>
                </div>
              );
            })}
          </div>
          <div className="text-center text-[11px] text-slate-400 mt-2">
            滞后天数 (Lag Days): 峰值点处于 Lag {lagWindow.bestLagDays} 天
          </div>
        </div>
      </div>

      {/* 管网拓扑反向溯源结果 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
          <span className="flex items-center gap-1.5 text-teal-600 dark:text-teal-400">
            <GitCommit className="w-4 h-4" /> 上游管网汇水分区与排污节点拓扑溯源
          </span>
          <span className="text-[11px] text-slate-400 font-normal">基于城市排水分区与流向拓扑算法锁定</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {sources.map((src: any, idx: number) => {
            const isHigh = src.upstreamRiskLevel.includes('高危') || src.upstreamRiskLevel.includes('一级');
            return (
              <div 
                key={idx}
                className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-teal-500" />
                    {src.subzoneName}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    isHigh 
                      ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300' 
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                  }`}>
                    {src.upstreamRiskLevel}
                  </span>
                </div>
                <div className="space-y-1 text-slate-600 dark:text-slate-400">
                  <div className="flex justify-between">
                    <span>监测核酸载量:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{src.detectedConcentration}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>流量贡献占比:</span>
                    <span className="font-semibold text-teal-600 dark:text-teal-400">{src.flowContributionRate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>疑似集水设施:</span>
                    <span className="text-slate-700 dark:text-slate-300 font-medium">{src.suspectedFacility}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-slate-800">
                    <span>溯源处置状态:</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> {src.tracingStatus}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 协同处置建议 */}
      <div className="bg-teal-50/60 dark:bg-teal-950/20 p-3 rounded-lg border border-teal-200 dark:border-teal-500/30 flex items-start gap-2.5 text-xs">
        <Sparkles className="w-4 h-4 text-teal-600 dark:text-teal-400 flex-shrink-0 mt-0.5" />
        <div className="text-slate-700 dark:text-slate-300">
          <span className="font-bold text-teal-800 dark:text-teal-300">精准防控建议：</span>
          <span className="ml-1">{suggestedAction}</span>
        </div>
      </div>
    </div>
  );
};
