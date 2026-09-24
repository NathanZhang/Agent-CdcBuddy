'use client';

import React from 'react';
import { 
  Activity, 
  GitPullRequest, 
  MapPin, 
  AlertTriangle, 
  ShieldAlert, 
  CheckCircle2, 
  Clock, 
  Sparkles,
  Layers
} from 'lucide-react';

interface InjuryAttributionTreeCardProps {
  data?: any;
}

export const InjuryAttributionTreeCard: React.FC<InjuryAttributionTreeCardProps> = ({ data = {} }) => {
  const total = data?.totalInjuriesMonitored || 5000;
  const clusters = data?.clusterIncidentsDetected || [
    {
      incidentId: 'INJ-CLUS-郏县-2026',
      city: '平顶山市',
      district: '郏县',
      incidentPlace: '乡镇农机联合收割合作社',
      injuryType: '机械切割/冲压伤害',
      affectedCases: 5,
      severityLevel: '重度 (机械绞碾上肢撕脱伤)',
      timeSpan: '2026-08-18 09:30:00 ~ 2026-08-18 21:30:00',
      attributionSummary: '农机秋收作业期间连续发生玉米收割机摘穗辊机械绞碾伤害，主因异物卡死未停机带电人工排堵。',
      emergencyIntervention: '会同农业农村及农机监理部门联合下发秋收农机安全紧急通报，关停隐患合作社作业机械。'
    }
  ];

  const compositions = data?.injuryTypeComposition || [
    { injuryType: '老年人跌倒/跌落', caseCount: 1270, percentage: '25.4%' },
    { injuryType: '道路交通伤害', caseCount: 1264, percentage: '25.3%' },
    { injuryType: '机械切割/冲压伤害', caseCount: 1237, percentage: '24.7%' },
    { injuryType: '非职业性一氧化碳中毒', caseCount: 1229, percentage: '24.6%' }
  ];

  const decisionTree = data?.decisionTreeAttribution || [
    {
      injuryCategory: '农村机械伤害 (农用收割/五金冲压)',
      primarySplittingFactor: '未规范佩戴防护手套与阻燃工作服',
      attributionRatio: '75.4%',
      secondarySplittingFactor: '防护罩/紧急制动联锁装置缺失 (占 62.1%)',
      highRiskWindow: '9~10月秋收农忙期及阴雨湿滑作业时段'
    },
    {
      injuryCategory: '老年人居家跌倒/跌落 (≥65岁)',
      primarySplittingFactor: '卫生间浴室地面湿滑未铺防滑垫',
      attributionRatio: '68.2%',
      secondarySplittingFactor: '起夜光线昏暗与未安装马桶安全扶手 (占 54.8%)',
      highRiskWindow: '冬季夜间 22:00~06:00 起夜时段'
    },
    {
      injuryCategory: '中小学生道路交通伤害',
      primarySplittingFactor: '骑乘电动自行车未佩戴安全头盔',
      attributionRatio: '71.6%',
      secondarySplittingFactor: '大货车盲区抢行与逆向穿插路口 (占 48.3%)',
      highRiskWindow: '工作日早晨 07:10~07:50 与傍晚 17:30~18:30 放学高峰'
    }
  ];

  const topPlaces = data?.top5HighRiskPlaces || [
    { rank: 1, place: '非机动车道交叉口', cases: 449 },
    { rank: 2, place: '农贸集市湿滑阶梯', cases: 429 },
    { rank: 3, place: '小区步道绿化带', cases: 428 },
    { rank: 4, place: '城乡结合部公路干道', cases: 423 },
    { rank: 5, place: '建筑工地木工作业间', cases: 422 }
  ];

  const guidance = data?.interventionGuidance || '优先针对农机作业安全锁具普及、适老化浴室防滑改造和学生骑乘一盔一带开展靶向干预。';

  return (
    <div className="w-full bg-white dark:bg-slate-900 rounded-xl p-5 border border-orange-200 dark:border-orange-500/30 shadow-md space-y-5">
      {/* 头部态势栏 */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center font-bold">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>伤害时空特征聚类、决策树归因与聚集性事件识别</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300 font-medium">
                决策树归因 · 聚集识别 (≥5例)
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              哨点医院门诊伤害记录：{total.toLocaleString()} 例 · 老年跌倒/道路交通/农机冲压/CO中毒多维归因
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="px-2.5 py-1 rounded-md bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 font-bold border border-rose-200 dark:border-rose-500/30">
            识别聚集事件: {clusters.length} 起
          </span>
          <span className="px-2.5 py-1 rounded-md bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300 font-bold border border-orange-200 dark:border-orange-500/30">
            聚集阈值: 同场所≥5例
          </span>
        </div>
      </div>

      {/* 聚集性伤害突发事件卡片 */}
      {clusters.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-rose-700 dark:text-rose-400">
            <span className="flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-rose-600" /> 短期场所聚集性伤害事件 (Cluster Incidents)
            </span>
            <span className="text-[11px] text-slate-400 font-normal">多部门应急联动协同中</span>
          </div>

          <div className="space-y-2">
            {clusters.map((c: any, i: number) => (
              <div 
                key={i}
                className="bg-rose-50/60 dark:bg-rose-950/20 p-4 rounded-xl border border-rose-300 dark:border-rose-500/40 space-y-2 text-xs"
              >
                <div className="flex flex-wrap justify-between items-center gap-2 border-b border-rose-200 dark:border-rose-500/30 pb-2">
                  <span className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-rose-600" />
                    {c.city} · {c.district} ({c.incidentPlace})
                  </span>
                  <span className="text-rose-600 font-bold">
                    波及 {c.affectedCases} 例 · {c.severityLevel}
                  </span>
                </div>
                <div className="space-y-1 text-slate-600 dark:text-slate-300">
                  <p><span className="font-semibold text-slate-800 dark:text-slate-100">伤害类型与诱因：</span>{c.attributionSummary}</p>
                  <p><span className="font-semibold text-slate-800 dark:text-slate-100">应急处置措施：</span>{c.emergencyIntervention}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 伤害构成与决策树归因分析 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
          <span className="flex items-center gap-1.5 text-orange-600 dark:text-orange-400">
            <GitPullRequest className="w-4 h-4" /> 决策树模型：关键伤害类型第一诱因归因比 (Decision Tree Attribution)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {decisionTree.map((dt: any, idx: number) => (
            <div 
              key={idx}
              className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 text-xs"
            >
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-900 dark:text-slate-100">{dt.injuryCategory}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 font-bold">
                  归因比 {dt.attributionRatio}
                </span>
              </div>
              <div className="space-y-1 text-slate-600 dark:text-slate-400">
                <div>
                  <span className="text-slate-500">首要分裂因素:</span>
                  <p className="font-bold text-rose-600 dark:text-rose-400 mt-0.5">{dt.primarySplittingFactor}</p>
                </div>
                <div className="text-[11px] pt-1 border-t border-slate-200 dark:border-slate-800">
                  次要诱因: {dt.secondarySplittingFactor}
                </div>
                <div className="text-[11px] text-slate-400">
                  高发时段: {dt.highRiskWindow}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 高发场所 TOP5 */}
      <div className="space-y-2">
        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">门诊伤害高发场所 TOP5 (High-Risk Scenes)</span>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
          {topPlaces.map((tp: any, i: number) => (
            <div key={i} className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 space-y-0.5">
              <span className="text-[10px] text-slate-400 font-bold">TOP {tp.rank}</span>
              <p className="font-bold text-slate-800 dark:text-slate-200 truncate">{tp.place}</p>
              <span className="text-orange-600 dark:text-orange-400 text-[11px]">{tp.cases} 例</span>
            </div>
          ))}
        </div>
      </div>

      {/* 协同干预建议 */}
      <div className="bg-orange-50/60 dark:bg-orange-950/20 p-3.5 rounded-lg border border-orange-200 dark:border-orange-500/30 flex items-start gap-2.5 text-xs">
        <Sparkles className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
        <div className="text-slate-700 dark:text-slate-300">
          <span className="font-bold text-orange-800 dark:text-orange-300">精准干预与治理举措：</span>
          <span className="ml-1">{guidance}</span>
        </div>
      </div>
    </div>
  );
};
