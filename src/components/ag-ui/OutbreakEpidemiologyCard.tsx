'use client';

import React from 'react';
import { 
  ClipboardCheck, 
  MapPin, 
  Users, 
  CheckCircle2, 
  Clock, 
  History, 
  Send,
  FileCheck2
} from 'lucide-react';

interface OutbreakEpidemiologyCardProps {
  data: any;
}

export const OutbreakEpidemiologyCard: React.FC<OutbreakEpidemiologyCardProps> = ({ data }) => {
  const steps = data?.standardProcedures || [];
  const historyCases = data?.similarHistoricalCases || [];

  return (
    <div className="w-full bg-white dark:bg-slate-900 rounded-xl p-5 border border-sky-200 dark:border-sky-500/30 shadow-md space-y-4">
      {/* 头部事件状态 */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-sky-100 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold">
            <ClipboardCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>食源性突发事件标准化流调处置工单与处置指引</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300 font-medium">
                {data?.disposalLevel || '二级突发响应'}
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              事件编号：{data?.clusterId || 'OUTBREAK-202608-01'} · 关联涉案场所：{data?.venueName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="px-2.5 py-1 rounded-md bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200">
            罹患率: {data?.attackRate || 14.8}%
          </span>
          <span className="px-2.5 py-1 rounded-md bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 font-bold border border-rose-200">
            确诊人数: {data?.caseCount || 38} 人
          </span>
        </div>
      </div>

      {/* 涉案核心流调要素 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800">
          <span className="text-slate-400">检出致病因子</span>
          <p className="font-bold text-slate-800 dark:text-slate-200 mt-1">{data?.pathogen}</p>
        </div>
        <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800">
          <span className="text-slate-400">锁定嫌疑食品</span>
          <p className="font-bold text-slate-800 dark:text-slate-200 mt-1">{data?.suspectedFood}</p>
        </div>
        <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800">
          <span className="text-slate-400">医疗救治状态</span>
          <p className="font-bold text-emerald-600 dark:text-emerald-400 mt-1">住院 {data?.hospitalizedCount || 4} 例，重症 0 例</p>
        </div>
      </div>

      {/* 标准处置流程指引 */}
      <div className="space-y-2.5">
        <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4 text-sky-600" />
          <span>国家食源性暴发事件流调标准处置流程 (SOP 指引)</span>
        </h4>

        <div className="space-y-2">
          {steps.map((s: any) => (
            <div 
              key={s.step}
              className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex items-start justify-between gap-3 text-xs"
            >
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-sky-600 text-white font-bold flex items-center justify-center shrink-0 mt-0.5 text-[11px]">
                  {s.step}
                </span>
                <div>
                  <p className="font-bold text-slate-900 dark:text-slate-100">{s.title}</p>
                  <p className="text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">{s.desc}</p>
                </div>
              </div>
              <span className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-bold ${
                s.status === 'completed' 
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' 
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
              }`}>
                {s.status === 'completed' ? '已完成' : '处置跟进中'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 历史相似暴发案例推荐 */}
      {historyCases.length > 0 && (
        <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs space-y-1.5">
          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 font-bold">
            <History className="w-3.5 h-3.5 text-sky-600" />
            <span>知识库历史相似处置案例推荐</span>
          </div>
          {historyCases.map((h: any) => (
            <p key={h.id} className="text-slate-700 dark:text-slate-300 leading-relaxed">
              • <b>{h.name}</b> (综合匹配度: {h.matchRate}%) ➔ 最终成效: {h.outcome}
            </p>
          ))}
        </div>
      )}
    </div>
  );
};
