'use client';

import React, { useState } from 'react';
import { 
  X, 
  AlertTriangle, 
  ShieldAlert, 
  MapPin, 
  Clock, 
  Users, 
  Filter, 
  Search, 
  ChevronRight, 
  Send, 
  CheckCircle2, 
  Flame, 
  FileText,
  Activity
} from 'lucide-react';
import { EarlyWarningAlertItem } from '@/lib/db/data-provider';

interface ActiveAlertsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAlertForAnalysis?: (alert: EarlyWarningAlertItem) => void;
  onLocateOnMap?: (city: string, alert: EarlyWarningAlertItem) => void;
}

import { ACTIVE_ALERTS_LIST } from '@/lib/data/active-alerts';
export { ACTIVE_ALERTS_LIST };

export const ActiveAlertsModal: React.FC<ActiveAlertsModalProps> = ({
  isOpen,
  onClose,
  onSelectAlertForAnalysis,
  onLocateOnMap
}) => {
  const [levelFilter, setLevelFilter] = useState<'all' | 'red' | 'orange' | 'yellow'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'in_progress' | 'resolved'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  // 统计指标
  const totalCount = ACTIVE_ALERTS_LIST.length;
  const redCount = ACTIVE_ALERTS_LIST.filter(a => a.level === 'red').length;
  const orangeCount = ACTIVE_ALERTS_LIST.filter(a => a.level === 'orange').length;
  const yellowCount = ACTIVE_ALERTS_LIST.filter(a => a.level === 'yellow').length;
  const pendingCount = ACTIVE_ALERTS_LIST.filter(a => a.disposalStatus === 'pending').length;
  const inProgressCount = ACTIVE_ALERTS_LIST.filter(a => a.disposalStatus === 'in_progress').length;
  const resolvedCount = ACTIVE_ALERTS_LIST.filter(a => a.disposalStatus === 'resolved').length;

  // 过滤列表
  const filteredAlerts = ACTIVE_ALERTS_LIST.filter(a => {
    if (levelFilter !== 'all' && a.level !== levelFilter) return false;
    if (statusFilter !== 'all' && a.disposalStatus !== statusFilter) return false;
    if (categoryFilter !== 'all' && a.category !== categoryFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchCity = a.city.toLowerCase().includes(q);
      const matchDistrict = a.district.toLowerCase().includes(q);
      const matchTitle = a.title.toLowerCase().includes(q);
      const matchId = a.alertId.toLowerCase().includes(q);
      const matchCategory = a.category.toLowerCase().includes(q);
      if (!matchCity && !matchDistrict && !matchTitle && !matchId && !matchCategory) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-sky-500/30 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 弹窗头部 */}
        <div className="p-5 bg-slate-50/90 dark:bg-slate-950/90 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-600 to-red-500 text-white flex items-center justify-center shadow-lg shadow-red-500/20">
              <ShieldAlert className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                  全省病媒生物活跃预警实时清单与处置态势
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-500/40">
                  共 {totalCount} 起监测预警
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                覆盖河南省 18 个地市，依据气象条件、单次捕获密度与病原 PCR 检测指标自动触发
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            title="关闭窗口"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 预警等级与状态统计看板 */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 p-4 bg-slate-100/60 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-800 text-xs">
          <button
            onClick={() => { setLevelFilter('red'); setStatusFilter('all'); }}
            className={`p-2 rounded-lg border flex flex-col items-center justify-center transition-all ${
              levelFilter === 'red' 
                ? 'bg-red-600 text-white border-red-600 shadow-sm' 
                : 'bg-white dark:bg-slate-900 border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 hover:border-red-400'
            }`}
          >
            <span className="font-mono text-base font-bold">{redCount}</span>
            <span className="text-[11px]">一级预警 (严重)</span>
          </button>

          <button
            onClick={() => { setLevelFilter('orange'); setStatusFilter('all'); }}
            className={`p-2 rounded-lg border flex flex-col items-center justify-center transition-all ${
              levelFilter === 'orange' 
                ? 'bg-orange-500 text-white border-orange-500 shadow-sm' 
                : 'bg-white dark:bg-slate-900 border-orange-200 dark:border-orange-500/30 text-orange-600 dark:text-orange-400 hover:border-orange-400'
            }`}
          >
            <span className="font-mono text-base font-bold">{orangeCount}</span>
            <span className="text-[11px]">二级预警 (较重)</span>
          </button>

          <button
            onClick={() => { setLevelFilter('yellow'); setStatusFilter('all'); }}
            className={`p-2 rounded-lg border flex flex-col items-center justify-center transition-all ${
              levelFilter === 'yellow' 
                ? 'bg-amber-500 text-white border-amber-500 shadow-sm' 
                : 'bg-white dark:bg-slate-900 border-amber-200 dark:border-amber-500/30 text-amber-600 dark:text-amber-400 hover:border-amber-400'
            }`}
          >
            <span className="font-mono text-base font-bold">{yellowCount}</span>
            <span className="text-[11px]">三级预警 (一般)</span>
          </button>

          <button
            onClick={() => { setStatusFilter('pending'); setLevelFilter('all'); }}
            className={`p-2 rounded-lg border flex flex-col items-center justify-center transition-all ${
              statusFilter === 'pending' 
                ? 'bg-rose-600 text-white border-rose-600 shadow-sm' 
                : 'bg-white dark:bg-slate-900 border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 hover:border-rose-400'
            }`}
          >
            <span className="font-mono text-base font-bold">{pendingCount}</span>
            <span className="text-[11px]">⚠️ 待派单处置</span>
          </button>

          <button
            onClick={() => { setStatusFilter('in_progress'); setLevelFilter('all'); }}
            className={`p-2 rounded-lg border flex flex-col items-center justify-center transition-all ${
              statusFilter === 'in_progress' 
                ? 'bg-sky-600 text-white border-sky-600 shadow-sm' 
                : 'bg-white dark:bg-slate-900 border-sky-200 dark:border-sky-500/30 text-sky-600 dark:text-sky-400 hover:border-sky-400'
            }`}
          >
            <span className="font-mono text-base font-bold">{inProgressCount}</span>
            <span className="text-[11px]">⏳ 消杀处置中</span>
          </button>

          <button
            onClick={() => { setStatusFilter('resolved'); setLevelFilter('all'); }}
            className={`p-2 rounded-lg border flex flex-col items-center justify-center transition-all ${
              statusFilter === 'resolved' 
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' 
                : 'bg-white dark:bg-slate-900 border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:border-emerald-400'
            }`}
          >
            <span className="font-mono text-base font-bold">{resolvedCount}</span>
            <span className="text-[11px]">✅ 已核销闭环</span>
          </button>
        </div>

        {/* 筛选与搜索工具条 */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            {/* 搜索框 */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="搜索地市、区县、病媒类别或预警标题..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 placeholder-slate-400 w-64 focus:outline-none focus:border-sky-500"
              />
            </div>

            {/* 病媒类别筛选 */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-lg border border-slate-200 dark:border-slate-800">
              <span className="text-slate-400 text-[11px] px-1">类别:</span>
              {['all', '蚊', '蝇', '鼠', '蟑', '蜱', '恙螨'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                    categoryFilter === cat
                      ? 'bg-sky-600 text-white font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {cat === 'all' ? '全部' : cat}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setLevelFilter('all');
                setStatusFilter('all');
                setCategoryFilter('all');
                setSearchQuery('');
              }}
              className="px-2.5 py-1 text-slate-500 hover:text-slate-900 dark:hover:text-white text-xs hover:underline"
            >
              重置筛选 ({filteredAlerts.length}/{totalCount})
            </button>
          </div>
        </div>

        {/* 预警卡片列表区 */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-slate-50/50 dark:bg-slate-950/40">
          {filteredAlerts.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-sm">
              未找到符合条件的活跃预警记录
            </div>
          ) : (
            filteredAlerts.map((alert) => {
              const isRed = alert.level === 'red';
              const isOrange = alert.level === 'orange';

              return (
                <div
                  key={alert.alertId}
                  className={`p-4 rounded-xl border transition-all duration-200 hover:shadow-md ${
                    isRed
                      ? 'bg-red-50/70 dark:bg-red-950/20 border-red-200 dark:border-red-500/30'
                      : isOrange
                      ? 'bg-orange-50/70 dark:bg-orange-950/20 border-orange-200 dark:border-orange-500/30'
                      : 'bg-amber-50/70 dark:bg-amber-950/15 border-amber-200 dark:border-amber-500/25'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-200/80 dark:border-slate-800">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-bold ${
                            isRed
                              ? 'bg-red-600 text-white'
                              : isOrange
                              ? 'bg-orange-500 text-white'
                              : 'bg-amber-400 text-slate-900'
                          }`}
                        >
                          {alert.levelName}
                        </span>

                        <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300">
                          {alert.alertId}
                        </span>

                        <span className="text-xs px-2 py-0.5 rounded bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-500/30 font-medium">
                          病媒: {alert.category}
                        </span>

                        <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-rose-500" />
                          {alert.city} · {alert.district} ({alert.street})
                        </span>

                        <span className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {alert.triggerTime}
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {alert.title}
                      </h4>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`px-2.5 py-1 rounded text-xs font-semibold ${
                          alert.disposalStatus === 'resolved'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 border border-emerald-300'
                            : alert.disposalStatus === 'in_progress'
                            ? 'bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-300 border border-sky-300'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300 border border-rose-300'
                        }`}
                      >
                        {alert.disposalStatus === 'resolved'
                          ? '✅ 已核销闭环'
                          : alert.disposalStatus === 'in_progress'
                          ? '⏳ 消杀处置中'
                          : '⚠️ 待派单处置'}
                      </span>
                    </div>
                  </div>

                  {/* 触发原因与推荐处置建议 */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mt-3 text-xs">
                    <div className="md:col-span-8 space-y-2">
                      <div className="bg-white/90 dark:bg-slate-900/90 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                        <span className="text-rose-600 dark:text-rose-400 font-bold">● 预警触发依据：</span>
                        <span className="text-slate-700 dark:text-slate-300 leading-relaxed ml-1">
                          {alert.triggerReason}
                        </span>
                      </div>

                      <div className="bg-white/90 dark:bg-slate-900/90 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                        <span className="text-sky-600 dark:text-sky-400 font-bold">● 推荐处置方案：</span>
                        <span className="text-slate-700 dark:text-slate-300 leading-relaxed ml-1">
                          {alert.recommendedAction}
                        </span>
                      </div>
                    </div>

                    <div className="md:col-span-4 flex flex-col justify-between bg-white/90 dark:bg-slate-900/90 p-3 rounded-lg border border-slate-200 dark:border-slate-800 gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-slate-500">
                          <span>实测密度 / 阈值:</span>
                          <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                            {alert.currentDensity} / {alert.threshold}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-slate-500">
                          <span>受影响预估人口:</span>
                          <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                            {alert.affectedPopulationEstimate.toLocaleString()} 人
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                        {onLocateOnMap && (
                          <button
                            onClick={() => {
                              onLocateOnMap(alert.city, alert);
                              onClose();
                            }}
                            className="flex-1 py-1.5 px-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded font-medium text-[11px] flex items-center justify-center gap-1 transition-colors"
                          >
                            <MapPin className="w-3 h-3 text-sky-500" />
                            <span>地图定位</span>
                          </button>
                        )}

                        {onSelectAlertForAnalysis && (
                          <button
                            onClick={() => {
                              onSelectAlertForAnalysis(alert);
                              onClose();
                            }}
                            className="flex-1 py-1.5 px-2 bg-sky-600 hover:bg-sky-500 text-white rounded font-medium text-[11px] flex items-center justify-center gap-1 shadow-sm transition-colors"
                          >
                            <Send className="w-3 h-3" />
                            <span>智能体研判</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 弹窗底部操作条 */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span>数据源: 河南省疾病预防控制中心 · 媒介生物监测与预警平台</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl font-semibold transition-colors"
          >
            关闭详情
          </button>
        </div>
      </div>
    </div>
  );
};
