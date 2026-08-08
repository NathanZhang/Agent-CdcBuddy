'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Bot, X, Send, Shield, Maximize2, Minimize2 } from 'lucide-react';

import { MarkdownRenderer } from '@/components/common/MarkdownRenderer';

interface EmbeddedWidgetProps {
  initialPrompt?: string;
  onSendMessage?: (msg: string) => void;
  isVisible?: boolean;
  onClose?: () => void;
}

export const EmbeddedWidget: React.FC<EmbeddedWidgetProps> = ({
  onSendMessage,
  isVisible = false,
  onClose
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [inputVal, setInputVal] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; text: string }[]>([
    {
      role: 'assistant',
      text: '您好！我是 **CdcBuddy 疾控病媒监测智能助手**。您可以向我咨询最新的全省病媒密度趋势、抗药性评估、病原阳性率预警或生成专项报告。'
    }
  ]);

  // 当有新消息或展开弹窗时，自动平滑滚动到底部
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // 如果处于隐藏状态，则不渲染在界面上
  if (!isVisible) {
    return null;
  }

  const handleSend = () => {
    if (!inputVal.trim()) return;
    const userText = inputVal.trim();
    setMessages(prev => [...prev, { role: 'user', text: userText }]);
    setInputVal('');

    if (onSendMessage) onSendMessage(userText);

    setTimeout(() => {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          text: `**【CdcBuddy 智能体】**已为您检索分析 "${userText}"。主工作区已同步更新对应的 AG-UI 态势地图与专业分析图表。`
        }
      ]);
    }, 600);
  };

  return (
    <div className="fixed bottom-6 left-6 z-50 flex flex-col items-start">
      {/* 悬浮对话窗口 */}
      {isOpen && (
        <div
          className={`bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-sky-500/40 shadow-2xl flex flex-col overflow-hidden transition-all duration-300 mb-3 ${
            isExpanded ? 'w-[680px] h-[640px]' : 'w-96 h-[500px]'
          }`}
        >
          {/* 窗口头部 */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-sky-600 flex items-center justify-center text-white text-xs">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">CdcBuddy 悬浮 AI 助手</h4>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">● 疾控知识库与模型在线</span>
              </div>
            </div>

            <div className="flex items-center gap-1 text-slate-400">
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1 hover:text-slate-700 dark:hover:text-white rounded hover:bg-slate-200 dark:hover:bg-slate-800"
                title={isExpanded ? '还原大小' : '窗口最大化'}
              >
                {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:text-slate-700 dark:hover:text-white rounded hover:bg-slate-200 dark:hover:bg-slate-800"
                title="关闭对话"
              >
                <X className="w-4 h-4" />
              </button>
              {onClose && (
                <button
                  onClick={onClose}
                  className="p-1 hover:text-rose-500 rounded hover:bg-slate-200 dark:hover:bg-slate-800 ml-1 text-xs"
                  title="隐藏悬浮助手"
                >
                  隐藏
                </button>
              )}
            </div>
          </div>

          {/* 消息列表 */}
          <div className="flex-1 p-3.5 overflow-y-auto space-y-3 text-xs">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {m.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-full bg-sky-600 flex items-center justify-center text-white text-[10px] shrink-0 mt-0.5">
                    🤖
                  </div>
                )}
                <div
                  className={`p-3 rounded-xl max-w-[82%] leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-sky-600 text-white rounded-br-none shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-bl-none'
                  }`}
                >
                  <MarkdownRenderer content={m.text} isUser={m.role === 'user'} />
                </div>
              </div>
            ))}
            {/* 自动滚动锚点 */}
            <div ref={messagesEndRef} />
          </div>

          {/* 底部输入框 */}
          <div className="p-3 bg-slate-50 dark:bg-slate-900/90 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2">
            <input
              type="text"
              placeholder="输入病媒监测问题或指令..."
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              className="flex-1 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
            <button
              onClick={handleSend}
              className="p-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 悬浮圆形启动按钮 (位于屏幕左下角) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 rounded-full bg-gradient-to-tr from-sky-600 to-cyan-500 text-white flex items-center justify-center shadow-xl shadow-sky-500/30 hover:scale-110 active:scale-95 transition-all border-2 border-white dark:border-sky-400 group"
        title={isOpen ? '收起浮窗助手' : '展开 Copilot 悬浮助手'}
      >
        {isOpen ? <X className="w-6 h-6" /> : <Bot className="w-6 h-6 group-hover:animate-bounce" />}
      </button>
    </div>
  );
};

