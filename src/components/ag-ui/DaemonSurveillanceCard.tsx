'use client';

import React, { useState } from 'react';
import { 
  ShieldAlert, 
  Play, 
  Sliders, 
  Radio, 
  Send, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  RefreshCw,
  BellRing
} from 'lucide-react';

interface DaemonSurveillanceCardProps {
  data: any;
}

export const DaemonSurveillanceCard: React.FC<DaemonSurveillanceCardProps> = ({ data }) => {
  const [intervalSec, setIntervalSec] = useState<number>(300);
  const [customPrompt, setCustomPrompt] = useState<string>(data?.prompt_policy || '夏秋季登革热高峰预警，重点关注信阳与南阳');
  const [isSaved, setIsSaved] = useState<boolean>(false);

  const generatedAlerts = data?.generated_alerts || [];
  const queueStatus = data?.queue_push_status || {};

  const handleSaveConfig = () => {
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  return (
    <div className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-md dark:shadow-2xl p-5 space-y-5 transition-colors">
      {/* 顶部标题与状态 */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 via-pink-600 to-amber-500 flex items-center justify-center shadow-lg shadow-rose-500/20 text-white">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-wide">
                后台常驻数据分析智能体 (Surveillance Daemon Agent)
              </h3>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                7×24h 守护中
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              双轮驱动: 周期定时轮询 + CDC 数据变更事件毫秒唤醒
            </p>
          </div>
        </div>

        <div className="text-right text-xs text-slate-500 dark:text-slate-400">
          <div>最近巡检时间: <span className="font-mono text-slate-800 dark:text-slate-200 font-semibold">{data?.cycle_timestamp || '刚刚'}</span></div>
          <div className="text-[11px] text-sky-600 dark:text-sky-400">触发模式: {data?.trigger_source || '定时轮询 (Timer)'}</div>
        </div>
      </div>

      {/* 专家提示词策略与定期间隔动态热配置 */}
      <div className="bg-slate-50 dark:bg-slate-950/70 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            专家巡检策略与定期间隔热配置 (Prompt Policy & Interval)
          </span>
          {isSaved && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-semibold animate-fade-in">
              <CheckCircle2 className="w-3.5 h-3.5" /> 策略已热生效并注入后台守护进程
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-3">
            <label className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1 font-medium">自然语言巡检指令 / 提示词策略 (Prompt):</label>
            <input
              type="text"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              className="w-full bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 focus:outline-none focus:border-indigo-500 shadow-sm"
              placeholder="输入针对病媒物种、地市或阈值的自然语言巡检策略..."
            />
          </div>
          <div>
            <label className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1 font-medium">定期间隔 (秒):</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={intervalSec}
                onChange={(e) => setIntervalSec(Number(e.target.value))}
                min={30}
                max={3600}
                className="w-full bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 focus:outline-none focus:border-indigo-500 shadow-sm"
              />
              <button
                onClick={handleSaveConfig}
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold whitespace-nowrap shadow-md transition-all"
              >
                热更新
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 实时捕捉的异常与自动生成的预警卡片 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <BellRing className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
            本轮巡检自动研判生成的分级预警事件 ({generatedAlerts.length} 起)
          </span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
            消息队列通道: {queueStatus.channel || 'cdc_alert_stream'} (已推入 {queueStatus.pushed_count || generatedAlerts.length} 条)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {generatedAlerts.map((alert: any, idx: number) => (
            <div key={idx} className="bg-white dark:bg-slate-800/80 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between space-y-2.5">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1">
                    {alert.city} {alert.district}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                    alert.level === 'red' 
                      ? 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-500/20 dark:text-rose-400 dark:border-rose-500/30' 
                      : 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/20 dark:text-amber-400'
                  }`}>
                    {alert.level?.toUpperCase()} 预警 (风险分 {alert.risk_score})
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {alert.description}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-700/60 text-[11px]">
                <div className="text-slate-500 dark:text-slate-400 mb-1 font-mono">预警编码: {alert.alert_id}</div>
                <div className="text-emerald-800 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-800/30">
                  <b className="text-emerald-900 dark:text-emerald-200">处置建议:</b> {alert.suggested_action}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 消息队列与推送通道状态条 */}
      <div className="bg-slate-50 dark:bg-slate-950/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between text-xs text-slate-500 dark:text-slate-400 gap-2">
        <div className="flex items-center gap-2">
          <Radio className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400 animate-pulse" />
          <span>实时分发渠道: <b className="text-slate-700 dark:text-slate-300">[Web SSE 脉冲广播, 疾控领导短信, 移动端 APP 推送]</b></span>
        </div>
        <div className="text-emerald-700 dark:text-emerald-400 flex items-center gap-1 font-medium">
          <CheckCircle2 className="w-3.5 h-3.5" /> 已自动写入持久化事实表 <code>biz_early_warning_events</code>
        </div>
      </div>
    </div>
  );
};
