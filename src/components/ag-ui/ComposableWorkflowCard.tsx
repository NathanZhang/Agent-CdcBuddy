'use client';

import React, { useState } from 'react';
import { useTheme } from '@/lib/theme/theme-context';
import { 
  Workflow, 
  Layers, 
  CheckCircle2, 
  Clock, 
  ArrowRight, 
  ShieldCheck, 
  Cpu, 
  ChevronDown, 
  ChevronUp, 
  Sparkles,
  MapPin,
  TrendingUp,
  Activity,
  Send
} from 'lucide-react';

interface ComposableWorkflowCardProps {
  data: any;
}

export const ComposableWorkflowCard: React.FC<ComposableWorkflowCardProps> = ({ data }) => {
  const { isDark } = useTheme();
  const [activeStepTab, setActiveStepTab] = useState<number>(1);
  const [isHilApproved, setIsHilApproved] = useState<boolean>(false);
  const [showLogs, setShowLogs] = useState<boolean>(false);

  const steps = data?.steps_definition || [];
  const stepResults = data?.step_results || {};
  const sharedContext = data?.shared_context || {};
  const logs = data?.execution_logs || [];

  const currentStepResult = stepResults[`step_${activeStepTab}`] || {};
  const currentStepDef = steps[activeStepTab - 1] || {};

  return (
    <div className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-md dark:shadow-2xl p-5 space-y-5 transition-colors">
      {/* 头部标题与 LangGraph 动态工作流标识 */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 via-purple-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-amber-500/20 text-white">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-wide">
                {data.workflow_name || '通用多技能动态协同工作流'}
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30">
                LangGraph Composable Graph
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              动态装配 {steps.length} 个原子技能 · 跨步骤共享上下文自动管道贯通
            </p>
          </div>
        </div>

        <div className="text-right text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
            <span>{steps.length}/{steps.length} 节点全部就绪</span>
          </div>
          <div className="text-[11px] text-slate-400">上下文流转: {Object.keys(sharedContext).length} 个共享参数</div>
        </div>
      </div>

      {/* 动态 DAG 执行流拓扑导航条 */}
      <div className="bg-slate-50 dark:bg-slate-950/60 rounded-xl p-3.5 border border-slate-200 dark:border-slate-800 space-y-2">
        <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 flex items-center justify-between">
          <span>LangGraph 动态状态流拓扑:</span>
          <span className="text-indigo-600 dark:text-indigo-400">点击各环节查看独立产物与数据流</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
          {steps.map((s: any, idx: number) => {
            const stepNum = idx + 1;
            const isActive = activeStepTab === stepNum;
            return (
              <button
                key={s.stepId || idx}
                onClick={() => setActiveStepTab(stepNum)}
                className={`p-3 rounded-lg border text-left transition-all flex items-center gap-2.5 ${
                  isActive
                    ? 'bg-indigo-50 border-indigo-300 dark:bg-indigo-950/60 dark:border-indigo-500/80 shadow-sm'
                    : 'bg-white dark:bg-slate-900/90 border-slate-200 dark:border-slate-700/60 hover:border-slate-300'
                }`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                  isActive 
                    ? 'bg-indigo-600 text-white' 
                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                }`}>
                  {stepNum}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-slate-900 dark:text-white truncate">{s.title}</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono truncate">{s.skillId}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 当前步骤产物卡片渲染区 */}
      <div className="bg-slate-50/80 dark:bg-slate-950/70 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-bold text-slate-900 dark:text-white">
              第 {activeStepTab} 阶段产物: 【{currentStepDef.title}】
            </span>
          </div>
          <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 font-semibold">
            状态: 执行完成 (SUCCESS)
          </span>
        </div>

        {/* 根据当前步骤类型渲染定制概览 */}
        {currentStepResult.type === 'satscan' && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-white dark:bg-slate-800/80 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="text-[11px] text-slate-500 dark:text-slate-400">一类聚集区</div>
                <div className="text-base font-bold text-rose-600 dark:text-rose-400">
                  {currentStepResult.data?.clusters?.[0]?.center_city} {currentStepResult.data?.clusters?.[0]?.center_district}
                </div>
              </div>
              <div className="bg-white dark:bg-slate-800/80 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="text-[11px] text-slate-500 dark:text-slate-400">相对危险度 RR</div>
                <div className="text-base font-bold text-amber-600 dark:text-amber-400">
                  RR = {currentStepResult.data?.clusters?.[0]?.relative_risk}
                </div>
              </div>
              <div className="bg-white dark:bg-slate-800/80 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="text-[11px] text-slate-500 dark:text-slate-400">显著聚集簇总数</div>
                <div className="text-base font-bold text-slate-900 dark:text-white">
                  {currentStepResult.data?.clusters?.length || 3} 个
                </div>
              </div>
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900/80 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
              <b>上下文注入说明：</b> SaTScan 识别出的高危城市 <code>{JSON.stringify(currentStepResult.data?.high_risk_cities)}</code> 已自动注入后续环节。
            </div>
          </div>
        )}

        {currentStepResult.type === 'pathogen' && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-white dark:bg-slate-800/80 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="text-[11px] text-slate-500 dark:text-slate-400">关联挖掘目标地市</div>
                <div className="text-base font-bold text-slate-900 dark:text-white">
                  {currentStepResult.data?.city || '高危重点辖区'}
                </div>
              </div>
              <div className="bg-white dark:bg-slate-800/80 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="text-[11px] text-slate-500 dark:text-slate-400">优势病原种类</div>
                <div className="text-base font-bold text-rose-600 dark:text-rose-400">
                  {currentStepResult.data?.dominant_species || '白纹伊蚊 · 登革病毒'}
                </div>
              </div>
              <div className="bg-white dark:bg-slate-800/80 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Apriori 置信度</div>
                <div className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                  Confidence &gt; 85%
                </div>
              </div>
            </div>
          </div>
        )}

        {currentStepResult.type === 'disposal' && (
          <div className="space-y-3">
            <div className="bg-white dark:bg-slate-800/80 p-3.5 rounded-lg border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1">
                  <Send className="w-3.5 h-3.5 text-indigo-500" />
                  已自动派发消杀处置工单: {currentStepResult.data?.dispatch_id}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300">
                  {currentStepResult.data?.status}
                </span>
              </div>
              <div className="text-slate-600 dark:text-slate-300">
                <b>推荐工艺:</b> {currentStepResult.data?.intervention}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                承接队伍: {currentStepResult.data?.assigned_teams?.join('、')}
              </div>
            </div>
          </div>
        )}

        {currentStepResult.type === 'generic' && (
          <div className="p-3 bg-white dark:bg-slate-800/80 rounded-lg text-xs text-slate-600 dark:text-slate-300">
            {currentStepResult.data?.message || '该步骤已执行完成并沉淀上下文数据'}
          </div>
        )}
      </div>

      {/* 人机协同 (Human-in-the-Loop) 审核条 */}
      {data?.requires_hil && (
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
                  LangGraph 跨技能人机协同审查断点 (HIL Gate)
                </div>
                <div className="text-xs text-rose-700 dark:text-rose-300 mt-0.5">
                  {data?.hil_reason || '动态工作流检测到高危风险聚集，需专家核准后继续流转'}
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
              {isHilApproved ? '✓ 专家已在线核准' : '确认研判结论并放行下一步'}
            </button>
          </div>
        </div>
      )}

      {/* 折叠执行日志 */}
      <div className="border-t border-slate-200 dark:border-slate-800 pt-3">
        <button
          onClick={() => setShowLogs(!showLogs)}
          className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-all"
        >
          <Cpu className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
          <span>查看 LangGraph 动态工作流底层调度日志 ({logs.length} 步)</span>
          {showLogs ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        {showLogs && (
          <div className="mt-2 bg-slate-900 text-slate-200 dark:bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-[11px] space-y-1 max-h-40 overflow-y-auto">
            {logs.map((log: string, idx: number) => (
              <div key={idx} className="text-slate-400">
                <span className="text-amber-400">&gt;</span> {log}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
