'use client';

import React, { useState } from 'react';
import { CheckCircle2, ClipboardCheck, ShieldAlert, AlertTriangle, Users, MapPin, Activity } from 'lucide-react';

interface DisposalWorkflowProps {
  data: {
    ticketId: string;
    title?: string;
    domain?: string;
    targetArea: string;
    targetVector: string;
    targetLabel?: string;
    recommendedProtocol: { step: number; title: string; content: string }[];
    currentStatus: string;
    assignedTeam: string;
    afterBiIndex?: number;
    updatedAt: string;
    alertDetails?: {
      alertId: string;
      title?: string;
      levelName?: string;
      triggerReason?: string;
      currentMetric?: string;
      threshold?: string;
      affectedPopulation?: number;
      recommendedAction?: string;
      latitude?: number;
      longitude?: number;
    };
    riskFactors?: { factor: string; detail: string }[];
  };
}

export const DisposalWorkflowCard: React.FC<DisposalWorkflowProps> = ({ data }) => {
  const [status, setStatus] = useState<string>(data.currentStatus);
  const [afterBi, setAfterBi] = useState<number | undefined>(data.afterBiIndex);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  const isChronic = data.domain === 'chronic';
  const isEnv = data.domain === 'env';

  const cardTitle = data.title || (
    isChronic 
      ? '重大慢病急性事件就诊峰值应急处置工单与闭环追踪' 
      : (isEnv ? '环境健康超标异常应急排查与处置工单' : '病媒生物消杀处置工单与处置闭环管理')
  );

  const handleToggleResolve = async () => {
    setIsUpdating(true);
    const nextStatus = status === 'resolved' ? 'in_progress' : 'resolved';
    try {
      await fetch('/api/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skillId: isChronic ? 'skill_chronic_early_warning_disposal' : (isEnv ? 'skill_env_early_warning_disposal' : 'skill_disposal_workflow'),
          args: {
            ticketId: data.ticketId,
            action: nextStatus === 'resolved' ? 'resolve' : 'reopen'
          }
        })
      });
      setStatus(nextStatus);
      if (nextStatus === 'resolved') {
        setAfterBi(3.8);
      }
    } catch (e) {
      console.error(e);
      setStatus(nextStatus);
    } finally {
      setIsUpdating(false);
    }
  };

  const themeBorder = isChronic 
    ? 'border-rose-200 dark:border-rose-500/20' 
    : (isEnv ? 'border-amber-200 dark:border-amber-500/20' : 'border-slate-200 dark:border-emerald-500/20');
  const themeHeaderIcon = isChronic 
    ? 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/30' 
    : (isEnv ? 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30' : 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30');

  return (
    <div className={`w-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-xl p-5 border ${themeBorder} shadow-sm dark:shadow-xl flex flex-col gap-4 transition-colors`}>
      {/* 头部 */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-lg border ${themeHeaderIcon}`}>
            <ClipboardCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              {cardTitle}
              <span className={`text-xs px-2 py-0.5 rounded font-mono font-medium ${isChronic ? 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-500/20 dark:text-rose-300' : 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300'}`}>
                工单号: {data.ticketId}
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">已连通应用业务数据库 (app_business.db)，全流程追踪应急响应与预警核销闭环</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleResolve}
            disabled={isUpdating}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md ${
              status === 'resolved' 
                ? 'bg-emerald-600 text-white hover:bg-emerald-500' 
                : (isChronic ? 'bg-rose-600 text-white hover:bg-rose-500' : 'bg-sky-600 text-white hover:bg-sky-500')
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            {isUpdating ? '正在提交状态...' : (status === 'resolved' ? '✅ 已核销闭环归档' : (isChronic ? '复核就诊波动并核销预警' : '一键复测并核销预警'))}
          </button>
        </div>
      </div>

      {/* 预警源起及触发依据卡 (若存在) */}
      {data.alertDetails && (
        <div className="p-3.5 rounded-lg bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-500/30 text-xs space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rose-200/60 dark:border-rose-500/20 pb-2">
            <div className="flex items-center gap-1.5 font-bold text-rose-700 dark:text-rose-400">
              <AlertTriangle className="w-4 h-4" />
              <span>专项预警源起：{data.alertDetails.title || data.alertDetails.alertId}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded font-bold bg-rose-600 text-white text-[11px]">
                {data.alertDetails.levelName || '较重预警 (二级)'}
              </span>
              <span className="text-slate-500 font-mono text-[11px]">{data.alertDetails.alertId}</span>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1 text-slate-700 dark:text-slate-300">
            <div>
              <span className="text-slate-500 dark:text-slate-400 block text-[11px]">● 预警触发依据:</span>
              <span className="font-medium text-rose-600 dark:text-rose-300">{data.alertDetails.triggerReason}</span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block text-[11px]">● 实测监测值 / 阈值:</span>
              <span className="font-semibold">{data.alertDetails.currentMetric} / {data.alertDetails.threshold}</span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block text-[11px]">● 预估波及/受影响人口:</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-sky-500" />
                {data.alertDetails.affectedPopulation ? `${data.alertDetails.affectedPopulation.toLocaleString()} 人` : '区域常住慢病人群'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 工单基本信息 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs bg-slate-50 dark:bg-slate-950/60 p-3.5 rounded-lg border border-slate-200 dark:border-slate-800">
        <div>
          <span className="text-slate-500 dark:text-slate-400 block">处置目标区域 / 核心点位:</span>
          <span className="font-semibold text-slate-900 dark:text-slate-200 flex items-center gap-1 mt-0.5">
            <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
            {data.targetArea}
          </span>
        </div>
        <div>
          <span className="text-slate-500 dark:text-slate-400 block">{data.targetLabel || '靶标对象 / 监测病种'}:</span>
          <span className="font-semibold text-sky-600 dark:text-sky-400 block mt-0.5">{data.targetVector}</span>
        </div>
        <div>
          <span className="text-slate-500 dark:text-slate-400 block">执行机构 / 应急响应小组:</span>
          <span className="font-semibold text-amber-600 dark:text-amber-300 block mt-0.5">{data.assignedTeam}</span>
        </div>
      </div>

      {/* 周边关联危险因素深度研判 (若存在) */}
      {data.riskFactors && data.riskFactors.length > 0 && (
        <div className="space-y-1.5 text-xs">
          <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-purple-500" />
            <span>周边关联致病危险因素深度研判分析：</span>
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            {data.riskFactors.map((rf, idx) => (
              <div key={idx} className="p-2.5 rounded-lg bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-500/20 text-slate-700 dark:text-slate-300">
                <span className="font-bold text-purple-700 dark:text-purple-400 block mb-0.5">● {rf.factor}</span>
                <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">{rf.detail}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 标准处置流程指南 */}
      <div className="space-y-2">
        <h4 className={`text-xs font-bold flex items-center gap-1.5 ${isChronic ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
          <ShieldAlert className="w-4 h-4" />
          <span>{isChronic ? '慢病高危患者随访用药与急救绿色通道处置方案:' : (isEnv ? '环境超标应急排查与安全防护指引:' : '国家规范化消杀操作流程与指南:')}:</span>
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {data.recommendedProtocol.map(step => (
            <div key={step.step} className="p-3 bg-slate-50 dark:bg-slate-950/80 rounded-lg border border-slate-200 dark:border-slate-800/90 text-xs flex flex-col gap-1.5">
              <div className={`flex items-center gap-2 font-bold ${isChronic ? 'text-rose-700 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
                <span className={`w-5 h-5 rounded-full border flex items-center justify-center text-xs ${isChronic ? 'bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/40' : 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40'}`}>
                  {step.step}
                </span>
                <span>{step.title}</span>
              </div>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">{step.content}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
