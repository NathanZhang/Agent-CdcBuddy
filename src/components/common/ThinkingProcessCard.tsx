'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  ChevronDown, 
  ChevronRight, 
  BrainCircuit, 
  CheckCircle2, 
  Copy, 
  Check, 
  Sparkles,
  Terminal
} from 'lucide-react';

interface ThinkingProcessCardProps {
  reasoningText: string;
  isStreaming?: boolean;
  durationMs?: number;
  defaultExpanded?: boolean;
  className?: string;
}

export const ThinkingProcessCard: React.FC<ThinkingProcessCardProps> = ({
  reasoningText,
  isStreaming = false,
  durationMs,
  defaultExpanded = false,
  className = ''
}) => {
  // 如果流式中，默认展开；若已完成且无强制指定，则默认折叠
  const [isExpanded, setIsExpanded] = useState(isStreaming ? true : defaultExpanded);
  const [hasCopied, setHasCopied] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const userInteractedRef = useRef(false);

  // 流式推演计时器 (实时秒表)
  useEffect(() => {
    if (!isStreaming) return;
    const start = Date.now();
    const timer = setInterval(() => {
      setElapsedSeconds(Number(((Date.now() - start) / 1000).toFixed(1)));
    }, 100);
    return () => clearInterval(timer);
  }, [isStreaming]);

  // 当流式结束时，如果用户没有手动干预展开状态，自动收起以保持对话整洁
  useEffect(() => {
    if (!isStreaming && reasoningText && !userInteractedRef.current) {
      setIsExpanded(false);
    }
  }, [isStreaming, reasoningText]);

  // 流式输出时自动滚动到底部
  useEffect(() => {
    if (isStreaming && isExpanded && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [reasoningText, isStreaming, isExpanded]);

  if (!reasoningText && !isStreaming) return null;

  const durationDisplay = durationMs 
    ? `${(durationMs / 1000).toFixed(1)}s` 
    : `${elapsedSeconds}s`;

  const handleCopyReasoning = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!reasoningText) return;
    navigator.clipboard.writeText(reasoningText);
    setHasCopied(true);
    setTimeout(() => setHasCopied(false), 2000);
  };

  const handleToggleExpand = () => {
    userInteractedRef.current = true;
    setIsExpanded(prev => !prev);
  };

  return (
    <div 
      className={`mb-2.5 rounded-xl border transition-all duration-300 overflow-hidden shadow-xs ${
        isStreaming
          ? 'border-sky-300/90 dark:border-sky-500/40 bg-sky-50/70 dark:bg-sky-950/20 ring-1 ring-sky-400/20'
          : 'border-slate-200/90 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60'
      } ${className}`}
    >
      {/* 头部状态摘要条 */}
      <div
        onClick={handleToggleExpand}
        className="w-full px-3 py-2 flex items-center justify-between text-xs text-slate-700 dark:text-slate-300 hover:bg-sky-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer select-none"
      >
        <div className="flex items-center gap-2 min-w-0">
          {isStreaming ? (
            <div className="relative flex items-center justify-center">
              <BrainCircuit className="w-4 h-4 text-sky-500 animate-pulse" />
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-sky-400 rounded-full animate-ping" />
            </div>
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          )}

          <span className={`font-semibold tracking-wide truncate ${isStreaming ? 'text-sky-700 dark:text-sky-300' : 'text-slate-700 dark:text-slate-300'}`}>
            {isStreaming ? 'CdcBuddy 正在深度推演中...' : '已完成深度推演思考'}
          </span>

          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono shrink-0 border ${
            isStreaming
              ? 'bg-sky-100/90 dark:bg-sky-950/80 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-800'
              : 'bg-slate-100/90 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
          }`}>
            {durationDisplay}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!isStreaming && reasoningText && (
            <button
              onClick={handleCopyReasoning}
              title="复制思维链内容"
              className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {hasCopied ? (
                <span className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                  <Check className="w-3 h-3" /> 已复制
                </span>
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </button>
          )}

          <div className="flex items-center gap-0.5 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            <span>{isExpanded ? '收起' : '展开'}</span>
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </div>
        </div>
      </div>

      {/* 展开的思维链内容区 */}
      {isExpanded && (
        <div 
          ref={scrollContainerRef}
          className="px-3.5 py-3 border-t border-slate-200/80 dark:border-slate-800/80 bg-slate-50/90 dark:bg-slate-950/80 text-slate-700 dark:text-slate-300 font-mono text-[11px] leading-relaxed max-h-72 overflow-y-auto space-y-2 select-text"
        >
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400 pb-1.5 border-b border-slate-200/80 dark:border-slate-800/80 font-sans">
            <Terminal className="w-3 h-3 text-sky-600 dark:text-sky-400 shrink-0" />
            <span className="font-medium">智能体内部认知与时空研判推演链 (CoT / Reasoning Chain)</span>
          </div>

          <div className="border-l-2 border-sky-400/50 dark:border-sky-500/40 pl-2.5 my-1 text-slate-600 dark:text-slate-300 opacity-95 whitespace-pre-wrap break-words">
            {reasoningText}
            {isStreaming && (
              <span className="inline-block w-1.5 h-3.5 ml-1 bg-sky-500 dark:bg-sky-400 animate-pulse align-middle rounded-[1px]" />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
