'use client';

import React from 'react';
import { EarlyWarningAlertItem } from '@/lib/db/data-provider';
import { Bell, Clock, Users } from 'lucide-react';

interface EarlyWarningPanelProps {
  data: {
    totalCount: number;
    alerts: EarlyWarningAlertItem[];
  };
}

export const EarlyWarningPanel: React.FC<EarlyWarningPanelProps> = ({ data }) => {
  return (
    <div className="w-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-xl p-5 border border-slate-200 dark:border-red-500/20 shadow-sm dark:shadow-xl flex flex-col gap-4 transition-colors">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-red-50 text-red-600 border border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/30">
            <Bell className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              疾控病媒生物分级预警依据与下发清单
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30 font-medium">
                共 {data.totalCount} 起活跃预警
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">按照风险等级（一般/较重/严重）自动分类预警，生成通知依据</p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {data.alerts.map((alert, idx) => {
          const isRed = alert.level === 'red';
          const isOrange = alert.level === 'orange';

          return (
            <div 
              key={idx}
              className={`p-4 rounded-xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all ${
                isRed ? 'bg-red-50/80 dark:bg-red-950/30 border-red-200 dark:border-red-500/40 shadow-xs' : (
                  isOrange ? 'bg-orange-50/80 dark:bg-orange-950/30 border-orange-200 dark:border-orange-500/40 shadow-xs' : 'bg-amber-50/80 dark:bg-amber-950/20 border-amber-200 dark:border-amber-500/30 shadow-xs'
                )
              }`}
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                    isRed ? 'bg-red-600 text-white' : (
                      isOrange ? 'bg-orange-500 text-white' : 'bg-amber-400 text-slate-900'
                    )
                  }`}>
                    {alert.levelName}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">{alert.alertId}</span>
                  <span className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {alert.triggerTime}
                  </span>
                </div>

                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">{alert.title}</h4>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed bg-white/90 dark:bg-slate-950/60 p-2 rounded border border-slate-200 dark:border-slate-800">
                  <span className="text-sky-600 dark:text-sky-400 font-semibold">预警依据: </span>
                  {alert.triggerReason}
                </p>
              </div>

              <div className="flex flex-col items-start md:items-end gap-2 shrink-0 text-xs">
                <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                  <Users className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                  <span>影响人口: <span className="font-mono font-bold text-amber-600 dark:text-amber-300">{alert.affectedPopulationEstimate.toLocaleString()}</span> 人</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                    alert.disposalStatus === 'resolved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40' : (
                      alert.disposalStatus === 'in_progress' ? 'bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-500/20 dark:text-sky-300 dark:border-sky-500/40' : 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/40'
                    )
                  }`}>
                    {alert.disposalStatus === 'resolved' ? '✅ 已核销闭环' : (alert.disposalStatus === 'in_progress' ? '⏳ 处置中' : '⚠️ 待派单')}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
