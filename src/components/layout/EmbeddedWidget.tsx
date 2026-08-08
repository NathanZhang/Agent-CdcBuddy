'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Bot, X, Send, Shield, Maximize2, Minimize2, RefreshCw, Sparkles } from 'lucide-react';
import { MarkdownRenderer } from '@/components/common/MarkdownRenderer';
import { GenerativeComponentRenderer } from '@/components/ag-ui/GenerativeComponentRenderer';
import { dispatchSkillPrompt } from '@/lib/skills/dispatcher';

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

  // 如果处于隐藏状态，则不渲染在界面上
  if (!isVisible) {
    return null;
  }

  const handleSendPrompt = async (promptText: string) => {
    if (!promptText.trim() || isThinking) return;
    const userText = promptText.trim();
    const nowTime = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

    // 1. 本地对话流先插入用户消息
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: userText,
      timestamp: nowTime
    };
    setMessages(prev => [...prev, userMsg]);
    setInputVal('');
    setIsThinking(true);

    // 2. 如果开启了工作台同步，通知外层工作台
    if (syncWorkspace && onSendMessage) {
      onSendMessage(userText);
    }

    // 3. 独立执行技能调度引擎（支持作为独立 API 嵌入第三方系统运行）
    try {
      const chatHistory = messages.map(m => ({
        sender: m.role === 'user' ? 'user' : 'agent',
        text: m.text,
        skillUsed: m.skillUsed
      }));
      chatHistory.push({ sender: 'user', text: userText, skillUsed: undefined });

      const result = await dispatchSkillPrompt(userText, { chatHistory });
      
      const assistantMsg: ChatMessage = {
        id: `agent-${Date.now()}`,
        role: 'assistant',
        text: result.replyText,
        skillUsed: result.skillName,
        generativeView: result.generativeView,
        timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          id: `agent-err-${Date.now()}`,
          role: 'assistant',
          text: `⚠️ 执行出现异常：${err.message || '系统错误，请重试'}`,
          timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsThinking(false);
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
                    API Embedded
                  </span>
                </div>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">● 支持拖动边框自由缩放尺寸</span>
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
                  {/* 文字消息气泡 */}
                  <div
                    className={`p-3 rounded-xl leading-relaxed ${
                      m.role === 'user'
                        ? 'bg-sky-600 text-white rounded-br-none shadow-sm shadow-sky-600/20'
                        : 'bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-bl-none'
                    }`}
                  >
                    <MarkdownRenderer content={m.text} isUser={m.role === 'user'} />
                  </div>

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

            {isThinking && (
              <div className="flex gap-2 items-center text-xs text-sky-600 dark:text-sky-400 p-2.5 rounded-xl bg-sky-50 dark:bg-slate-900 border border-sky-200 dark:border-slate-800 animate-pulse">
                <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
                <span>CdcBuddy 正在检索时空数据库并生成图表组件...</span>
              </div>
            )}

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
              onKeyDown={(e) => e.key === 'Enter' && handleSendPrompt(inputVal)}
              disabled={isThinking}
              className="flex-1 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
            />
            <button
              onClick={() => handleSendPrompt(inputVal)}
              disabled={!inputVal.trim() || isThinking}
              className="p-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white shadow-md shadow-sky-600/30 transition-all cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
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
