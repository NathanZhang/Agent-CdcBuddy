'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bot, X, Send, Shield, Maximize2, Minimize2, RefreshCw, Sparkles, Square } from 'lucide-react';
import { MarkdownRenderer } from '@/components/common/MarkdownRenderer';
import { GenerativeComponentRenderer } from '@/components/ag-ui/GenerativeComponentRenderer';
import { ThinkingProcessCard } from '@/components/common/ThinkingProcessCard';
import { dispatchSkillPromptStream } from '@/lib/skills/dispatcher';

interface EmbeddedWidgetProps {
  initialPrompt?: string;
  onSendMessage?: (msg: string) => void;
  isVisible?: boolean;
  onClose?: () => void;
  syncWorkspace?: boolean; // 是否与底层工作台同步，嵌入独立业务系统时为 false
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  reasoningText?: string;
  reasoningDuration?: number;
  isReasoningStreaming?: boolean;
  isContentStreaming?: boolean;
  skillUsed?: string;
  generativeView?: any;
  timestamp: string;
}

export const EmbeddedWidget: React.FC<EmbeddedWidgetProps> = ({
  onSendMessage,
  isVisible = false,
  onClose,
  syncWorkspace = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [inputVal, setInputVal] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 打断控制器
  const abortControllerRef = useRef<AbortController | null>(null);
  const isCancelledRef = useRef<boolean>(false);

  // 浮窗动态尺寸控制（支持鼠标拖动 resize 缩放）
  const [size, setSize] = useState<{ width: number; height: number }>({ width: 520, height: 620 });
  const [isResizing, setIsResizing] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init-1',
      role: 'assistant',
      text: '您好！我是 **CdcBuddy 疾控病媒监测智能助手**。\n\n我已支持在对话流中直接渲染**时空态势地图、Text2SQL 数据明细表、ECharts 消长预测图及应急处置工单**。您可以**拖动浮窗边缘/右上角**自由缩放窗口大小：',
      timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const quickPrompts = [
    '显示郑州市2024年5月全部病媒监测数据表',
    '查看河南省白纹伊蚊空间预警地图',
    '分析郑州市淡色库蚊密度消长趋势',
    '全省五大类卫生杀虫剂抗药性评估'
  ];

  // 当有新消息或展开弹窗时，自动平滑滚动到底部
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isThinking]);

  // 组件卸载时清理未完成的流式请求
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // 鼠标拖动改变浮窗大小 (Resize 核心逻辑)
  const handleResizeMouseDown = (direction: 'top' | 'right' | 'top-right', e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);

    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = size.width;
    const startHeight = size.height;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      let newWidth = startWidth;
      let newHeight = startHeight;

      if (direction === 'right' || direction === 'top-right') {
        const deltaX = moveEvent.clientX - startX;
        newWidth = Math.max(380, Math.min(window.innerWidth - 48, startWidth + deltaX));
      }

      if (direction === 'top' || direction === 'top-right') {
        const deltaY = startY - moveEvent.clientY; // 向上拖动增加高度
        newHeight = Math.max(400, Math.min(window.innerHeight - 48, startHeight + deltaY));
      }

      setSize({ width: newWidth, height: newHeight });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  /**
   * 中途停止/打断流式研判
   */
  const handleStopExecution = useCallback(() => {
    if (abortControllerRef.current) {
      isCancelledRef.current = true;
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsThinking(false);
    setMessages(prev => prev.map(m => {
      if (m.isReasoningStreaming || m.isContentStreaming) {
        return {
          ...m,
          isReasoningStreaming: false,
          isContentStreaming: false,
          text: m.text ? `${m.text}\n\n*(已由用户手动停止研判)*` : '*(已由用户手动停止研判)*'
        };
      }
      return m;
    }));
  }, []);

  // 如果处于隐藏状态，则不渲染在界面上
  if (!isVisible) {
    return null;
  }

  /**
   * SSE 流式发送与交互处理
   */
  const handleSendPrompt = async (promptText: string) => {
    if (!promptText.trim() || isThinking) return;
    const userText = promptText.trim();
    const nowTime = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

    if (abortControllerRef.current) {
      isCancelledRef.current = true;
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    isCancelledRef.current = false;

    // 1. 本地对话流插入用户消息与占位 Assistant 消息
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: userText,
      timestamp: nowTime
    };

    const agentMsgId = `agent-${Date.now()}`;
    const placeholderAgentMsg: ChatMessage = {
      id: agentMsgId,
      role: 'assistant',
      text: '',
      reasoningText: '',
      isReasoningStreaming: true,
      isContentStreaming: false,
      timestamp: nowTime
    };

    setMessages(prev => [...prev, userMsg, placeholderAgentMsg]);
    setInputVal('');
    setIsThinking(true);

    // 2. 如果开启了工作台同步，通知外层工作台
    if (syncWorkspace && onSendMessage) {
      onSendMessage(userText);
    }

    // 3. 构建历史消息上下文
    const chatHistory = messages.map(m => ({
      sender: (m.role === 'user' ? 'user' : 'agent') as 'user' | 'agent',
      text: m.text,
      skillUsed: m.skillUsed
    }));
    chatHistory.push({ sender: 'user', text: userText, skillUsed: undefined });

    let latestReasoning = '';
    let latestContent = '';
    let latestSkillName = '';
    let latestView: any = null;
    let reasoningDurationMs = 0;

    try {
      const result = await dispatchSkillPromptStream(userText, {
        chatHistory,
        signal: controller.signal,
        onReasoningStart: () => {
          setMessages(prev => prev.map(m => m.id === agentMsgId ? {
            ...m,
            isReasoningStreaming: true
          } : m));
        },
        onReasoningChunk: (_chunk, fullReasoning) => {
          latestReasoning = fullReasoning;
          setMessages(prev => prev.map(m => m.id === agentMsgId ? {
            ...m,
            reasoningText: fullReasoning,
            isReasoningStreaming: true
          } : m));
        },
        onReasoningEnd: (durMs) => {
          reasoningDurationMs = durMs;
          setMessages(prev => prev.map(m => m.id === agentMsgId ? {
            ...m,
            reasoningDuration: durMs,
            isReasoningStreaming: false,
            isContentStreaming: true
          } : m));
        },
        onContentChunk: (_chunk, fullContent) => {
          latestContent = fullContent;
          setMessages(prev => prev.map(m => m.id === agentMsgId ? {
            ...m,
            text: fullContent,
            isReasoningStreaming: false,
            isContentStreaming: true
          } : m));
        },
        onToolCallStart: (info) => {
          latestSkillName = info.toolName;
          setMessages(prev => prev.map(m => m.id === agentMsgId ? {
            ...m,
            skillUsed: info.toolName
          } : m));
        },
        onGenerativeView: (view) => {
          latestView = view;
          setMessages(prev => prev.map(m => m.id === agentMsgId ? {
            ...m,
            generativeView: view
          } : m));
        }
      });

      if (isCancelledRef.current || controller.signal.aborted) {
        return;
      }

      const finalReplyText = result.replyText || latestContent || "处理请求成功。相关分析图表与态势数据已加载完毕。";
      const finalSkillName = result.skillName || latestSkillName;
      const finalReasoning = result.reasoningText || latestReasoning;
      const finalDuration = result.reasoningDuration || reasoningDurationMs;
      const finalGenerativeView = result.generativeView || latestView;

      setMessages(prev => prev.map(m => m.id === agentMsgId ? {
        ...m,
        text: finalReplyText,
        skillUsed: finalSkillName,
        reasoningText: finalReasoning || undefined,
        reasoningDuration: finalDuration > 0 ? finalDuration : undefined,
        isReasoningStreaming: false,
        isContentStreaming: false,
        generativeView: finalGenerativeView
      } : m));
    } catch (err: any) {
      if (err.name === 'AbortError' || controller.signal.aborted || isCancelledRef.current) {
        return;
      }
      setMessages(prev => prev.map(m => m.id === agentMsgId ? {
        ...m,
        text: `⚠️ 执行出现异常：${err.message || '系统错误，请重试'}`,
        isReasoningStreaming: false,
        isContentStreaming: false
      } : m));
    } finally {
      if (!controller.signal.aborted && !isCancelledRef.current) {
        setIsThinking(false);
      }
    }
  };

  const currentWidth = isExpanded 
    ? typeof window !== 'undefined' ? Math.min(920, window.innerWidth - 48) : 920
    : size.width;
  const currentHeight = isExpanded 
    ? typeof window !== 'undefined' ? Math.min(820, window.innerHeight - 48) : 820
    : size.height;

  return (
    <div className={`fixed bottom-6 left-6 z-50 flex flex-col items-start font-sans ${isResizing ? 'select-none' : ''}`}>
      {/* 悬浮对话窗口 */}
      {isOpen && (
        <div
          style={{ width: `${currentWidth}px`, height: `${currentHeight}px` }}
          className={`relative bg-white/98 dark:bg-slate-950/98 backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-sky-500/40 shadow-2xl flex flex-col overflow-hidden transition-all duration-150 mb-3 max-w-[calc(100vw-32px)] max-h-[calc(100vh-32px)]`}
        >
          {/* ====== 鼠标拖动缩放 (Resize Handles) ====== */}
          {!isExpanded && (
            <>
              {/* 顶部边缘拖动手柄 (调整高度) */}
              <div
                onMouseDown={(e) => handleResizeMouseDown('top', e)}
                className="absolute top-0 left-0 right-4 h-2 cursor-ns-resize z-50 hover:bg-sky-500/30 transition-colors"
                title="拖动调整窗口高度"
              />

              {/* 右侧边缘拖动手柄 (调整宽度) */}
              <div
                onMouseDown={(e) => handleResizeMouseDown('right', e)}
                className="absolute top-4 right-0 bottom-0 w-2 cursor-ew-resize z-50 hover:bg-sky-500/30 transition-colors"
                title="拖动调整窗口宽度"
              />

              {/* 右上角角落拖动手柄 (同时调整宽高) */}
              <div
                onMouseDown={(e) => handleResizeMouseDown('top-right', e)}
                className="absolute top-0 right-0 w-4 h-4 cursor-nesw-resize z-50 flex items-center justify-center hover:bg-sky-500/40 rounded-tr-2xl transition-colors group"
                title="拖动右上角自由缩放窗口"
              >
                <div className="w-1.5 h-1.5 border-t-2 border-r-2 border-sky-400 opacity-60 group-hover:opacity-100" />
              </div>
            </>
          )}

          {/* 窗口头部 */}
          <div className="p-3 bg-slate-50 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-sky-600 flex items-center justify-center text-white text-xs shadow-sm shadow-sky-600/30">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">CdcBuddy 疾控病媒 AI 助手</h4>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-50 dark:bg-sky-950 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800 font-mono">
                    SSE Stream
                  </span>
                </div>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">● 实时推演与流式交互</span>
              </div>
            </div>

            <div className="flex items-center gap-1 text-slate-400">
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1.5 hover:text-slate-700 dark:hover:text-white rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title={isExpanded ? '还原窗口大小' : '展开大窗口'}
              >
                {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:text-slate-700 dark:hover:text-white rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="收起对话"
              >
                <X className="w-4 h-4" />
              </button>
              {onClose && (
                <button
                  onClick={onClose}
                  className="px-2 py-1 hover:text-rose-500 rounded hover:bg-slate-200 dark:hover:bg-slate-800 ml-1 text-xs cursor-pointer"
                  title="隐藏悬浮助手图标"
                >
                  隐藏
                </button>
              )}
            </div>
          </div>

          {/* 快捷 Prompt 推荐胶囊栏 */}
          <div className="shrink-0 px-3 py-2 bg-slate-100/70 dark:bg-slate-900/60 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center gap-1.5 overflow-x-auto text-[11px] no-scrollbar">
            <span className="text-slate-400 flex items-center gap-1 shrink-0 font-medium">
              <Sparkles className="w-3 h-3 text-amber-500" />
              推荐:
            </span>
            {quickPrompts.map((qp, idx) => (
              <button
                key={idx}
                onClick={() => handleSendPrompt(qp)}
                disabled={isThinking}
                className="shrink-0 px-2.5 py-1 rounded-full bg-white dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-sky-900/40 text-slate-700 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-300 border border-slate-200 dark:border-slate-700 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 text-[10px] cursor-pointer"
              >
                {qp}
              </button>
            ))}
          </div>

          {/* 消息对话滚动区 */}
          <div className="flex-1 p-3.5 overflow-y-auto space-y-4 text-xs">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex gap-2.5 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {m.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-full bg-sky-600 flex items-center justify-center text-white text-[10px] shrink-0 mt-0.5 shadow-sm">
                    🤖
                  </div>
                )}

                <div className={`max-w-[92%] space-y-2 ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                  {/* 思维链过程卡片 (流式推演或已完成推演) */}
                  {m.role === 'assistant' && (m.reasoningText || m.isReasoningStreaming) && (
                    <ThinkingProcessCard
                      reasoningText={m.reasoningText || ''}
                      isStreaming={Boolean(m.isReasoningStreaming)}
                      durationMs={m.reasoningDuration}
                    />
                  )}

                  {/* 文字消息气泡 */}
                  {(m.text || (!m.isReasoningStreaming && m.role === 'assistant')) && (
                    <div
                      className={`p-3 rounded-xl leading-relaxed ${
                        m.role === 'user'
                          ? 'bg-sky-600 text-white rounded-br-none shadow-sm shadow-sky-600/20'
                          : 'bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-bl-none'
                      }`}
                    >
                      {m.text ? (
                        <>
                          <MarkdownRenderer content={m.text} isUser={m.role === 'user'} />
                          {m.isContentStreaming && (
                            <span className="inline-block w-1.5 h-3 ml-1 bg-sky-500 animate-pulse align-middle" />
                          )}
                        </>
                      ) : (
                        <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 py-0.5">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-500" />
                          <span>正在生成研判结论...</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 对话内嵌生成式组件渲染（地图、表格、图表、工单卡片） */}
                  {m.generativeView && (
                    <div className="w-full">
                      <GenerativeComponentRenderer view={m.generativeView} isCompact={true} />
                    </div>
                  )}

                  {/* 消息元信息 */}
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 px-1">
                    {m.skillUsed && (
                      <span className="px-1.5 py-0.2 rounded bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-500/20 font-medium">
                        ⚡ {m.skillUsed}
                      </span>
                    )}
                    <span>{m.timestamp}</span>
                  </div>
                </div>
              </div>
            ))}

            {/* 自动滚动锚点 */}
            <div ref={messagesEndRef} />
          </div>

          {/* 底部输入框 */}
          <div className="p-3 bg-slate-50 dark:bg-slate-900/90 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2 shrink-0">
            <input
              type="text"
              placeholder="输入病媒监测问题或指令 (如：显示郑州监测表)..."
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isThinking) {
                  handleSendPrompt(inputVal);
                }
              }}
              className="flex-1 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
            />
            {isThinking ? (
              <button
                onClick={handleStopExecution}
                title="打断/停止当前研判分析"
                className="flex items-center gap-1 px-3 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-semibold text-xs shadow-md shadow-rose-600/30 transition-all cursor-pointer animate-pulse shrink-0"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>停止</span>
              </button>
            ) : (
              <button
                onClick={() => handleSendPrompt(inputVal)}
                disabled={!inputVal.trim()}
                title="发送指令"
                className="p-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white shadow-md shadow-sky-600/30 transition-all cursor-pointer shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* 悬浮圆形启动按钮 (位于屏幕左下角) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 rounded-full bg-gradient-to-tr from-sky-600 to-cyan-500 text-white flex items-center justify-center shadow-xl shadow-sky-500/30 hover:scale-110 active:scale-95 transition-all border-2 border-white dark:border-sky-400 group cursor-pointer"
        title={isOpen ? '收起浮窗助手' : '展开 Copilot 悬浮助手'}
      >
        {isOpen ? <X className="w-6 h-6" /> : <Bot className="w-6 h-6 group-hover:animate-bounce" />}
      </button>
    </div>
  );
};
