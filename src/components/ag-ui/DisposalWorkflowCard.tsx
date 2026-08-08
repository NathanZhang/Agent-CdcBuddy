'use client';

import React, { useState } from 'react';
import { CheckCircle2, ClipboardCheck, ShieldAlert } from 'lucide-react';

interface DisposalWorkflowProps {
  data: {
    ticketId: string;
    targetArea: string;
    targetVector: string;
    recommendedProtocol: { step: number; title: string; content: string }[];
    currentStatus: string;
    assignedTeam: string;
    updatedAt: string;
  };
}

export const DisposalWorkflowCard: React.FC<DisposalWorkflowProps> = ({ data }) => {
  const [status, setStatus] = useState<string>(data.currentStatus);

  return (
    <div className="w-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-xl p-5 border border-slate-200 dark:border-emerald-500/20 shadow-sm dark:shadow-xl flex flex-col gap-4 transition-colors">
      {/* 头部 */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30">
            <ClipboardCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              病媒生物消杀处置工单与处置闭环管理
              <span className="text-xs px-2 py-0.5 rounded font-mono bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30 font-medium">
                工单号: {data.ticketId}
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">智能匹配消杀规程指南，全流程追踪处置进度与预警自动核销</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setStatus(status === 'resolved' ? 'in_progress' : 'resolved')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md ${
              status === 'resolved' 
                ? 'bg-emerald-600 text-white hover:bg-emerald-500' 
                : 'bg-sky-600 text-white hover:bg-sky-500'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            {status === 'resolved' ? '已核销闭环 (点击撤销)' : '一键复测并核销预警'}
          </button>
        </div>
      </div>

      {/* 工单基本信息 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs bg-slate-50 dark:bg-slate-950/60 p-3.5 rounded-lg border border-slate-200 dark:border-slate-800">
        <div>
          <span className="text-slate-500 dark:text-slate-400 block">处置目标区域:</span>
          <span className="font-semibold text-slate-900 dark:text-slate-200">{data.targetArea}</span>
        </div>
        <div>
          <span className="text-slate-500 dark:text-slate-400 block">靶标媒介生物:</span>
          <span className="font-semibold text-sky-600 dark:text-sky-400">{data.targetVector}</span>
        </div>
        <div>
          <span className="text-slate-500 dark:text-slate-400 block">执行中队 / 负责人:</span>
          <span className="font-semibold text-amber-600 dark:text-amber-300">{data.assignedTeam}</span>
        </div>
      </div>

      {/* 标准处置流程指南 */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
          <ShieldAlert className="w-4 h-4" />
          <span>国家规范化消杀操作流程与指南:</span>
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {data.recommendedProtocol.map(step => (
            <div key={step.step} className="p-3 bg-slate-50 dark:bg-slate-950/80 rounded-lg border border-slate-200 dark:border-slate-800/90 text-xs flex flex-col gap-1.5">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-bold">
                <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 border border-emerald-300 dark:border-emerald-500/40 flex items-center justify-center text-xs">
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
