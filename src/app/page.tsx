'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useCopilotAction, useCopilotReadable } from '@copilotkit/react-core';
import { Navbar } from '@/components/layout/Navbar';
import { RecommendationPrompts } from '@/components/layout/RecommendationPrompts';
import { SkillsDrawer } from '@/components/layout/SkillsDrawer';
import { SessionHistoryDrawer } from '@/components/layout/SessionHistoryDrawer';
import { EmbeddedWidget } from '@/components/layout/EmbeddedWidget';
import { useRbac } from '@/lib/rbac/rbac-context';
import { VectorSkill } from '@/lib/skills/types';
import { getSkillById, STANDARD_SKILLS } from '@/lib/skills/registry';

// AG-UI 生成式界面组件库与调度引擎
import { GenerativeComponentRenderer } from '@/components/ag-ui/GenerativeComponentRenderer';
import { dispatchSkillPrompt, dispatchSkillPromptStream } from '@/lib/skills/dispatcher';
import { ActiveAlertsModal, ACTIVE_ALERTS_LIST } from '@/components/ag-ui/ActiveAlertsModal';
import { MarkdownRenderer } from '@/components/common/MarkdownRenderer';
import { ThinkingProcessCard } from '@/components/common/ThinkingProcessCard';

import { 
  Sparkles, 
  Send, 
  Bot, 
  User, 
  Activity, 
  Layers, 
  MapPin, 
  TrendingUp, 
  ShieldAlert, 
  FileText,
  Smartphone,
  PlusCircle,
  Database,
  RefreshCw,
  Trash2,
  Square,
  History,
  Plus,
  RotateCcw
} from 'lucide-react';

const INITIAL_GENERATIVE_VIEW = {
  type: 'SPATIAL_EARLY_WARNING_MAP',
  city: '河南省全域',
  severity: 'all',
  alerts: [
    {
      alertId: 'ALERT-202408-101',
      title: '郑州市金水区 白纹伊蚊密度超标预警',
      level: 'red',
      levelName: '严重预警 (一级)',
      category: '蚊',
      city: '郑州市',
      district: '金水区',
      street: '未来路街道办事处',
      latitude: 34.8003,
      longitude: 113.6627,
      triggerReason: '单次诱蚊灯捕获量达 86 只/台次（基线 30 只），气温 31.5℃，相对湿度 78%，具备暴发滋生条件。',
      currentDensity: 86,
      threshold: 30,
      affectedPopulationEstimate: 32000,
      recommendedAction: '立即启动突发虫媒应急消杀，实施 2.5% 高效氯氟氰菊酯空间超低容量喷雾与积水清除。',
      disposalStatus: 'in_progress',
      triggerTime: '2026-08-08 08:30:00'
    },
    {
      alertId: 'ALERT-202408-102',
      title: '安阳市汤阴县 长角血蜱携病风险预警',
      level: 'orange',
      levelName: '较重预警 (二级)',
      category: '蜱',
      city: '安阳市',
      district: '汤阴县',
      street: '韩庄镇',
      latitude: 35.922,
      longitude: 114.358,
      triggerReason: '羊体寄生蜱指数达 12.4 只/羊，PCR 检测出发热伴血小板减少综合征病毒核酸阳性。',
      currentDensity: 52,
      threshold: 50,
      affectedPopulationEstimate: 14500,
      recommendedAction: '对羊舍与周边灌木实施敌百虫滞留喷洒，下发牧民个人防护指南。',
      disposalStatus: 'pending',
      triggerTime: '2026-08-08 09:15:00'
    },
    {
      alertId: 'ALERT-202408-103',
      title: '信阳市浉河区 恙螨幼虫密度黄警',
      level: 'yellow',
      levelName: '一般预警 (三级)',
      category: '恙螨',
      city: '信阳市',
      district: '浉河区',
      street: '东双河镇',
      latitude: 32.116,
      longitude: 114.065,
      triggerReason: '鼠体恙螨感染率达 28.5%，进入夏秋季流行活跃期。',
      currentDensity: 38,
      threshold: 30,
      affectedPopulationEstimate: 8200,
      recommendedAction: '开展灭鼠防螨综合治理，清理杂草。',
      disposalStatus: 'resolved',
      triggerTime: '2026-08-08 07:45:00'
    }
  ]
};

export interface ChatMessageItem {
  id: string;
  sender: 'user' | 'agent' | 'system';
  text: string;
  reasoningText?: string;
  reasoningDuration?: number;
  isReasoningStreaming?: boolean;
  isContentStreaming?: boolean;
  skillUsed?: string;
  timestamp: string;
}

const getInitialChatHistory = (): ChatMessageItem[] => [
  {
    id: 'init-1',
    sender: 'agent',
    text: `您好！我是您的 **CdcBuddy 疾控病媒生物监测预警智能体**。\n\n系统已连通河南省 **5.6万+ 条病媒生态、病原PCR检测与抗药性真实监测数据**。您可以点击上方推荐卡片，或直接向我下发分析指令。`,
    timestamp: '11:30'
  }
];

export default function CdcAgentWorkspace() {
  const { currentUser, activeRole } = useRbac();
  const [isSkillsOpen, setIsSkillsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isAlertsModalOpen, setIsAlertsModalOpen] = useState(false);
  const [showFloatingCopilot, setShowFloatingCopilot] = useState(false);
  const [activeGenerativeView, setActiveGenerativeView] = useState<any>(INITIAL_GENERATIVE_VIEW);

  // 当前会话状态
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [currentSessionTitle, setCurrentSessionTitle] = useState<string>('新研判会话');
  const [isSessionLoading, setIsSessionLoading] = useState(false);

  const [inputPrompt, setInputPrompt] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [customSkills, setCustomSkills] = useState<any[]>([]);
  const chatMessagesEndRef = useRef<HTMLDivElement>(null);

  // 获取并同步自定义技能列表
  const fetchCustomSkills = async () => {
    try {
      const res = await fetch('/api/skills');
      if (res.ok) {
        const json = await res.json();
        if (json.customSkills && Array.isArray(json.customSkills)) {
          setCustomSkills(json.customSkills);
        }
      }
    } catch (err) {
      console.warn('获取自定义技能失败:', err);
    }
  };

  useEffect(() => {
    fetchCustomSkills();
  }, []);

  const handleDeleteCustomSkill = async (skillId: string) => {
    try {
      const res = await fetch(`/api/skills?skillId=${encodeURIComponent(skillId)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setCustomSkills(prev => prev.filter(s => s.id !== skillId));
      }
    } catch (err) {
      console.error('删除自定义技能失败:', err);
    }
  };

  const [chatHistory, setChatHistory] = useState<ChatMessageItem[]>(getInitialChatHistory());

  const abortControllerRef = useRef<AbortController | null>(null);
  const isCancelledRef = useRef<boolean>(false);

  /**
   * 真实重新加载指定的历史会话
   */
  const handleLoadSession = useCallback(async (sessionId: string) => {
    if (abortControllerRef.current) {
      isCancelledRef.current = true;
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsThinking(false);
    setIsSessionLoading(true);

    try {
      const res = await fetch(`/api/sessions/${sessionId}`);
      if (res.ok) {
        const json = await res.json();
        const data = json.data;
        if (data) {
          setCurrentSessionId(data.sessionId);
          setCurrentSessionTitle(data.title || '历史研判会话');
          if (Array.isArray(data.messages) && data.messages.length > 0) {
            setChatHistory(data.messages);
          } else {
            setChatHistory(getInitialChatHistory());
          }

          // 重新加载并还原当时工作台的 AG-UI 生成式视图快照
          if (data.lastGenerativeView) {
            setActiveGenerativeView(data.lastGenerativeView);
          } else {
            setActiveGenerativeView(INITIAL_GENERATIVE_VIEW);
          }
        }
      }
    } catch (err) {
      console.error('加载历史会话失败:', err);
    } finally {
      setIsSessionLoading(false);
    }
  }, []);

  /**
   * 开启新会话
   */
  const handleNewSession = useCallback(() => {
    if (abortControllerRef.current) {
      isCancelledRef.current = true;
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsThinking(false);
    setInputPrompt('');
    setCurrentSessionId(null);
    setCurrentSessionTitle('新研判会话');
    setChatHistory(getInitialChatHistory());
    setActiveGenerativeView(INITIAL_GENERATIVE_VIEW);
  }, []);

  /**
   * 当切换 RBAC 用户身份时，自动拉取并加载该用户的最近历史会话
   */
  useEffect(() => {
    let isMounted = true;
    const initUserSession = async () => {
      if (!currentUser.id) return;
      try {
        const res = await fetch(`/api/sessions?userId=${encodeURIComponent(currentUser.id)}&limit=1`);
        if (res.ok) {
          const json = await res.json();
          const list = json.data?.sessions;
          if (isMounted) {
            if (list && list.length > 0) {
              handleLoadSession(list[0].sessionId);
            } else {
              handleNewSession();
            }
          }
        }
      } catch (e) {
        if (isMounted) handleNewSession();
      }
    };

    initUserSession();
    return () => {
      isMounted = false;
    };
  }, [currentUser.id, handleLoadSession, handleNewSession]);

  // 清空对话并恢复工作台初始内容（并在新会话模式）
  const handleClearChat = () => {
    handleNewSession();
  };

  // 打断/停止当前研判分析
  const handleStopExecution = () => {
    if (abortControllerRef.current) {
      isCancelledRef.current = true;
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsThinking(false);
    setChatHistory(prev => {
      const updated = prev.map(m => ({
        ...m,
        isReasoningStreaming: false,
        isContentStreaming: false
      }));
      return [
        ...updated,
        {
          id: `agent-stop-${Date.now()}`,
          sender: 'agent' as const,
          text: '⏹️ 已打断并停止当前研判分析任务。',
          timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
        }
      ];
    });
  };

  // 监听新对话消息或智能体思考状态，自动平滑滚动到最新内容
  useEffect(() => {
    chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isThinking]);

  // 同步用户上下文状态至 CopilotKit
  useCopilotReadable({
    description: '当前登录疾控用户的角色、所属辖区与可执行技能列表',
    value: {
      userId: currentUser.id,
      userName: currentUser.name,
      role: currentUser.role,
      jurisdiction: {
        province: currentUser.jurisdictionProvince,
        city: currentUser.jurisdictionCity,
        district: currentUser.jurisdictionDistrict
      }
    }
  });

  // 注册 CopilotKit Actions 以便 AI 自动调用对应业务 Skills
  useCopilotAction({
    name: 'renderVectorGenerativeUI',
    description: '在主工作区渲染病媒生物生成式 UI (地图、ECharts图表、抗药性矩阵、预警工单或报告)',
    parameters: [
      { name: 'skillId', type: 'string', description: '触发的技能ID' },
      { name: 'params', type: 'object', description: '技能执行参数' }
    ],
    handler: async ({ skillId, params }) => {
      const skill = getSkillById(skillId);
      if (skill) {
        const result = await skill.execute(params || {});
        setActiveGenerativeView(result);
        return { success: true, message: `已成功渲染 ${skill.name}` };
      }
      return { success: false, message: '未找到匹配的技能' };
    }
  });

  // 智能体意图识别与 Skill 分发调度中枢 (流式执行并持久化到真实会话数据库)
  const handleExecutePrompt = async (promptText: string) => {
    if (!promptText.trim() || isThinking) return;

    // 若有前序未完成任务，先中断
    if (abortControllerRef.current) {
      isCancelledRef.current = true;
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    isCancelledRef.current = false;

    const userMsgId = `msg-${Date.now()}`;
    const userTimestamp = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    const userMsg: ChatMessageItem = {
      id: userMsgId,
      sender: 'user',
      text: promptText,
      timestamp: userTimestamp
    };

    const agentMsgId = `agent-${Date.now()}`;
    const agentTimestamp = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    const placeholderAgentMsg: ChatMessageItem = {
      id: agentMsgId,
      sender: 'agent',
      text: '',
      reasoningText: '',
      isReasoningStreaming: true,
      isContentStreaming: false,
      timestamp: agentTimestamp
    };

    const newChat = [...chatHistory, userMsg, placeholderAgentMsg];
    setChatHistory(newChat);
    setInputPrompt('');
    setIsThinking(true);

    let latestReasoning = '';
    let latestContent = '';
    let latestSkillName = '';
    let latestView = activeGenerativeView;
    let reasoningDurationMs = 0;

    try {
      const result = await dispatchSkillPromptStream(promptText, { 
        chatHistory: newChat.slice(0, -1), 
        currentView: activeGenerativeView,
        signal: controller.signal,
        onReasoningStart: () => {
          setChatHistory(prev => prev.map(m => m.id === agentMsgId ? {
            ...m,
            isReasoningStreaming: true
          } : m));
        },
        onReasoningChunk: (_chunk, fullReasoning) => {
          latestReasoning = fullReasoning;
          setChatHistory(prev => prev.map(m => m.id === agentMsgId ? {
            ...m,
            reasoningText: fullReasoning,
            isReasoningStreaming: true
          } : m));
        },
        onReasoningEnd: (durMs) => {
          reasoningDurationMs = durMs;
          setChatHistory(prev => prev.map(m => m.id === agentMsgId ? {
            ...m,
            reasoningDuration: durMs,
            isReasoningStreaming: false,
            isContentStreaming: true
          } : m));
        },
        onContentChunk: (_chunk, fullContent) => {
          latestContent = fullContent;
          setChatHistory(prev => prev.map(m => m.id === agentMsgId ? {
            ...m,
            text: fullContent,
            isReasoningStreaming: false,
            isContentStreaming: true
          } : m));
        },
        onToolCallStart: (info) => {
          latestSkillName = info.toolName;
          setChatHistory(prev => prev.map(m => m.id === agentMsgId ? {
            ...m,
            skillUsed: info.toolName
          } : m));
        },
        onGenerativeView: (view) => {
          latestView = view;
          setActiveGenerativeView(view);
          if (
            view.type === 'CUSTOM_SKILL_CREATED' ||
            view.skillId === 'skill_meta_custom_builder'
          ) {
            fetchCustomSkills();
          }
        }
      });

      if (isCancelledRef.current || controller.signal.aborted) {
        return;
      }

      const finalReplyText = result.replyText || latestContent || "处理请求成功。相关分析图表与态势数据已加载完毕。";
      const finalSkillName = result.skillName || latestSkillName;
      const finalReasoning = result.reasoningText || latestReasoning;
      const finalDuration = result.reasoningDuration || reasoningDurationMs;
      const finalGenerativeView = result.generativeView || latestView || activeGenerativeView;

      if (result.generativeView) {
        setActiveGenerativeView(result.generativeView);
        if (
          result.generativeView.type === 'CUSTOM_SKILL_CREATED' ||
          result.skillId === 'skill_meta_custom_builder'
        ) {
          fetchCustomSkills();
        }
      }

      const finalAgentMsg: ChatMessageItem = {
        id: agentMsgId,
        sender: 'agent',
        text: finalReplyText,
        reasoningText: finalReasoning || undefined,
        reasoningDuration: finalDuration > 0 ? finalDuration : undefined,
        isReasoningStreaming: false,
        isContentStreaming: false,
        skillUsed: finalSkillName || undefined,
        timestamp: agentTimestamp
      };

      setChatHistory(prev => prev.map(m => m.id === agentMsgId ? finalAgentMsg : m));

      // ---------------- 真实落库持久化：创建会话或追加消息 ----------------
      try {
        let activeId = currentSessionId;
        const suggestedTitle = promptText.length > 25 ? `${promptText.substring(0, 24)}...` : promptText;

        if (!activeId) {
          // 当前尚未创建会话，执行 POST /api/sessions
          const createRes = await fetch('/api/sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: currentUser.id,
              userName: currentUser.name,
              userRole: currentUser.role,
              title: suggestedTitle,
              lastGenerativeView: finalGenerativeView,
              initialMessages: [userMsg, finalAgentMsg]
            })
          });
          if (createRes.ok) {
            const json = await createRes.json();
            if (json.data?.sessionId) {
              setCurrentSessionId(json.data.sessionId);
              setCurrentSessionTitle(json.data.title || suggestedTitle);
            }
          }
        } else {
          // 当前已有会话，执行 POST /api/sessions/[id]
          await fetch(`/api/sessions/${activeId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: [userMsg, finalAgentMsg],
              lastGenerativeView: finalGenerativeView,
              suggestedTitle: currentSessionTitle === '新研判会话' ? suggestedTitle : undefined
            })
          });
          if (currentSessionTitle === '新研判会话') {
            setCurrentSessionTitle(suggestedTitle);
          }
        }
      } catch (persistErr) {
        console.error('会话持久化落库异常:', persistErr);
      }

    } catch (e: any) {
      if (isCancelledRef.current || controller.signal.aborted || e.name === 'AbortError') {
        console.log('任务已打断取消');
        return;
      }
      console.error(e);
      setChatHistory(prev => {
        const withoutPlaceholder = prev.filter(m => m.id !== agentMsgId);
        return [
          ...withoutPlaceholder,
          {
            id: `agent-err-${Date.now()}`,
            sender: 'agent',
            text: `⚠️ 执行失败：${e.message || '技能执行异常'}，请重试或检查参数。`,
            timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
          }
        ];
      });
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
        setIsThinking(false);
      }
    }
  };

  const totalSkillsCount = STANDARD_SKILLS.length + customSkills.length;

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors duration-200">
      {/* 顶部导航与态势指示条 */}
      <Navbar
        skillsCount={totalSkillsCount}
        onOpenSkills={() => setIsSkillsOpen(true)}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onSelectPrompt={handleExecutePrompt}
        showEmbeddedWidget={showFloatingCopilot}
        onToggleEmbeddedWidget={() => setShowFloatingCopilot(prev => !prev)}
      />

      {/* 统计指标浮动指示条 */}
      <div className="shrink-0 bg-slate-100/90 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800/80 px-6 py-2 flex items-center justify-between overflow-x-auto text-xs text-slate-600 dark:text-slate-300 gap-6 transition-colors">
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => handleExecutePrompt('请汇总展示病媒生物治理监测记录（48,530条）的详细概览，按蚊、蝇、鼠、蟑、蜱、螨六大类群统计监测样本量与捕获总量，并结合气象温湿度补全情况进行多维分析。')}
            title="点击通过 AI 交互查询 48,530 条病媒治理监测记录详情"
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-md hover:bg-slate-200/70 dark:hover:bg-slate-800/70 text-slate-700 dark:text-slate-300 transition-all cursor-pointer group hover:shadow-xs border border-transparent hover:border-slate-300 dark:hover:border-slate-700"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>治理监测记录:</span>
            <strong className="text-sky-600 dark:text-sky-400 font-mono group-hover:underline underline-offset-2">48,530</strong>
            <span className="text-slate-500 dark:text-slate-400 text-[11px]">条</span>
          </button>

          <span className="text-slate-300 dark:text-slate-700">|</span>

          <button
            onClick={() => handleExecutePrompt('请检索并分析全省 7,336 组批 PCR 病原检测数据详情，列出登革病毒、乙脑病毒、布尼亚病毒、立克次体等主要检出靶标分布及阳性率态势。')}
            title="点击通过 AI 交互查询 7,336 组批 PCR 病原检测数据详情"
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-md hover:bg-slate-200/70 dark:hover:bg-slate-800/70 text-slate-700 dark:text-slate-300 transition-all cursor-pointer group hover:shadow-xs border border-transparent hover:border-slate-300 dark:hover:border-slate-700"
          >
            <span>PCR 病原检测:</span>
            <strong className="text-rose-600 dark:text-rose-400 font-mono group-hover:underline underline-offset-2">7,336</strong>
            <span className="text-slate-500 dark:text-slate-400 text-[11px]">组批</span>
          </button>

          <span className="text-slate-300 dark:text-slate-700">|</span>

          <button
            onClick={() => handleExecutePrompt('请调取 365 组杀虫剂抗药性毒力测定实验数据，分析拟除虫菊酯、有机磷等主要药剂在各地市优势蚊蝇种群中的抗性倍数及抗性等级分布。')}
            title="点击通过 AI 交互查询 365 组抗药性毒力测定数据详情"
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-md hover:bg-slate-200/70 dark:hover:bg-slate-800/70 text-slate-700 dark:text-slate-300 transition-all cursor-pointer group hover:shadow-xs border border-transparent hover:border-slate-300 dark:hover:border-slate-700"
          >
            <span>抗药性毒力测定:</span>
            <strong className="text-amber-600 dark:text-amber-400 font-mono group-hover:underline underline-offset-2">365</strong>
            <span className="text-slate-500 dark:text-slate-400 text-[11px]">组</span>
          </button>

          <span className="text-slate-300 dark:text-slate-700">|</span>

          <button
            onClick={() => handleExecutePrompt('请展示全省 18 地市 126 区县共 2,037 个监测点位的地理空间覆盖分布与点位明细，按地市统计点位密度和重点监测生境。')}
            title="点击通过 AI 交互查询全省 18 地市 / 126 区县 (2,037 点位) 空间覆盖详情"
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-md hover:bg-slate-200/70 dark:hover:bg-slate-800/70 text-slate-700 dark:text-slate-300 transition-all cursor-pointer group hover:shadow-xs border border-transparent hover:border-slate-300 dark:hover:border-slate-700"
          >
            <span>覆盖全省行政区:</span>
            <strong className="text-slate-900 dark:text-slate-100 font-mono group-hover:underline underline-offset-2">18 地市 / 126 区县</strong>
            <span className="text-slate-500 dark:text-slate-400 text-[11px]">(2,037 点位)</span>
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setIsAlertsModalOpen(true)}
            title={`点击查看全省 ${ACTIVE_ALERTS_LIST.length} 起活跃预警实时清单与处置态势`}
            className="text-[11px] px-2.5 py-1 rounded-lg bg-red-100 hover:bg-red-200 dark:bg-red-500/20 dark:hover:bg-red-500/30 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-500/40 font-bold flex items-center gap-1.5 shadow-xs transition-all hover:scale-105 active:scale-95 group cursor-pointer"
          >
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
            <span>🚨 活跃预警: {ACTIVE_ALERTS_LIST.length} 起</span>
            <span className="text-[10px] underline text-red-600 dark:text-red-400 group-hover:text-red-800 dark:group-hover:text-white">查看详情 »</span>
          </button>
          <span className="text-slate-500 text-[11px]">最新数据期: 2025-11-11</span>
        </div>
      </div>

      {/* 核心工作台：双栏生成式工作区 (全屏自适应，无整页滚动) */}
      <main className="flex-1 min-h-0 px-6 pt-2 pb-3 flex flex-col gap-2.5 max-w-[1920px] w-full mx-auto overflow-hidden">
        {/* 常用业务研判与推荐对话 Prompt (浮动展开覆盖，不挤压工作区高度) */}
        <RecommendationPrompts onSelectPrompt={handleExecutePrompt} />

        {/* 智能体交互区域：左侧 AG-UI 动态生成式工作台 + 右侧 Copilot 智能交互对话中枢 */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch overflow-hidden">
          {/* 左侧：AG-UI 生成式界面工作台 (占比 8 列，高度自适应) */}
          <div className="lg:col-span-8 h-full min-h-0 flex flex-col gap-2 overflow-hidden">
            <div className="shrink-0 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  AG-UI 动态生成式分析工作台
                </h2>
                {isSessionLoading && (
                  <span className="text-xs text-sky-600 dark:text-sky-400 flex items-center gap-1 animate-pulse">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>恢复会话视图中...</span>
                  </span>
                )}
              </div>
              <span className="text-xs text-slate-500 font-mono">
                Component: {activeGenerativeView?.type || 'READY'}
              </span>
            </div>

            {/* 动态渲染对应的生成式 UI 组件容器 */}
            <div className="flex-1 min-h-0 flex flex-col overflow-y-auto rounded-xl">
              <GenerativeComponentRenderer view={activeGenerativeView} isCompact={false} />
            </div>
          </div>

          {/* 右侧：Copilot 智能体交互对话区 (占比 4 列，高度自适应填满) */}
          <div className="lg:col-span-4 h-full min-h-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-xl border border-slate-200 dark:border-sky-500/20 shadow-sm dark:shadow-2xl flex flex-col overflow-hidden transition-colors">
            {/* 对话区头部：会话标题、新建会话与历史记录快捷入口 */}
            <div className="shrink-0 p-3 bg-slate-50 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="w-7 h-7 rounded-lg bg-sky-600 flex items-center justify-center text-white text-xs shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate" title={currentSessionTitle}>
                      {currentSessionTitle}
                    </h3>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-slate-500">
                    <span className="text-emerald-600 dark:text-emerald-400 font-mono">● {currentUser.name.split(' ')[0]}</span>
                    <span>·</span>
                    <span>{activeRole}</span>
                  </div>
                </div>
              </div>

              {/* 快捷操作组：历史会话抽屉 + 新建会话 */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => setIsHistoryOpen(true)}
                  title="查看与切换历史研判会话"
                  className="p-1.5 rounded-lg text-slate-600 hover:text-sky-600 dark:text-slate-300 dark:hover:text-sky-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors flex items-center gap-1 text-xs cursor-pointer"
                >
                  <History className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  <span className="text-[11px] font-medium hidden sm:inline">历史</span>
                </button>

                <button
                  onClick={handleNewSession}
                  title="开启新研判会话"
                  className="p-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white transition-colors flex items-center gap-1 text-xs shadow-xs active:scale-95 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span className="text-[11px] font-medium hidden sm:inline">新建</span>
                </button>
              </div>
            </div>

            {/* 消息滚动区 */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3.5 text-xs">
              {chatHistory.map((m, idx) => (
                <div
                  key={m.id || `msg-${idx}-${m.timestamp || ''}`}
                  className={`flex gap-2.5 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {m.sender === 'agent' && (
                    <div className="w-6 h-6 rounded-full bg-sky-600 flex items-center justify-center text-white text-[10px] shrink-0 mt-0.5 shadow-xs">
                      🤖
                    </div>
                  )}

                  <div className={`max-w-[85%] space-y-1.5 ${m.sender === 'user' ? 'items-end' : 'items-start'}`}>
                    {/* 若智能体具有深度推理 (Thinking) 过程或正在推演中，优先渲染 Thinking 卡片 */}
                    {m.sender === 'agent' && (m.reasoningText || m.isReasoningStreaming) && (
                      <ThinkingProcessCard
                        reasoningText={m.reasoningText || ''}
                        isStreaming={Boolean(m.isReasoningStreaming)}
                        durationMs={m.reasoningDuration}
                      />
                    )}

                    {/* 正式回复内容 (当存在文本或者不在纯思考占位中时渲染) */}
                    {(m.text || (!m.isReasoningStreaming && m.sender === 'agent')) && (
                      <div
                        className={`p-3.5 rounded-xl leading-relaxed ${
                          m.sender === 'user'
                            ? 'bg-sky-600 text-white rounded-br-none shadow-sm shadow-sky-600/20'
                            : 'bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-bl-none shadow-xs'
                        }`}
                      >
                        {m.text ? (
                          <>
                            <MarkdownRenderer content={m.text} isUser={m.sender === 'user'} />
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

                    <div className="flex items-center gap-2 text-[10px] text-slate-500 px-1">
                      {m.skillUsed && (
                        <span className="px-1.5 py-0.2 rounded bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-500/20 font-medium">
                          ⚡ {m.skillUsed}
                        </span>
                      )}
                      <span>{m.timestamp}</span>
                    </div>
                  </div>

                  {m.sender === 'user' && (
                    <div className="w-6 h-6 rounded-full bg-slate-300 dark:bg-slate-700 flex items-center justify-center text-slate-800 dark:text-white text-[10px] shrink-0 mt-0.5">
                      {currentUser.avatar}
                    </div>
                  )}
                </div>
              ))}

              {/* 自动滚动锚点 */}
              <div ref={chatMessagesEndRef} />
            </div>

            {/* 底部输入框 */}
            <div className="shrink-0 p-3 bg-slate-50 dark:bg-slate-950/90 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="向智能体提问或下发研判指令..."
                  value={inputPrompt}
                  onChange={(e) => setInputPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !isThinking) {
                      handleExecutePrompt(inputPrompt);
                    }
                  }}
                  className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
                />
                {isThinking ? (
                  <button
                    onClick={handleStopExecution}
                    title="打断/停止当前研判分析"
                    className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-semibold text-xs shadow-md shadow-rose-600/30 transition-all cursor-pointer animate-pulse"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span>停止</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleExecutePrompt(inputPrompt)}
                    disabled={!inputPrompt.trim()}
                    title="发送指令"
                    className="p-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold shadow-md shadow-sky-600/30 transition-all cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
                <span className="text-[10px] text-slate-400">
                  {currentSessionId ? `会话ID: ${currentSessionId.substring(0, 14)}...` : '未入库新会话'}
                </span>
                <button
                  onClick={handleClearChat}
                  title="清空并开启新研判会话"
                  className="text-slate-400 hover:text-rose-600 dark:text-slate-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 px-2 py-0.5 rounded-md flex items-center gap-1 font-medium transition-all cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>清空重置</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Skills 技能集市抽屉 */}
      <SkillsDrawer
        isOpen={isSkillsOpen}
        onClose={() => setIsSkillsOpen(false)}
        customSkills={customSkills}
        onDeleteCustomSkill={handleDeleteCustomSkill}
        onRefreshCustomSkills={fetchCustomSkills}
        onRunSkill={(skill, prompt) => handleExecutePrompt(prompt || skill.recommendedPrompts[0])}
        onCreateCustomSkill={() => {
          setIsSkillsOpen(false);
          handleExecutePrompt('帮我创建一个新技能：专门统计近三年安阳市蜱虫携带恙虫病东方体的月度分布并在地图上标出高危村镇。');
        }}
      />

      {/* 历史会话抽屉 */}
      <SessionHistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        userId={currentUser.id}
        userName={currentUser.name}
        currentSessionId={currentSessionId}
        onSelectSession={handleLoadSession}
        onNewSession={handleNewSession}
      />

      {/* 嵌入式浮窗组件 (默认位于左下角，默认隐藏，独立运行模式) */}
      <EmbeddedWidget 
        isVisible={showFloatingCopilot}
        onClose={() => setShowFloatingCopilot(false)}
        syncWorkspace={false}
      />

      {/* 全省活跃预警详情浮窗 */}
      <ActiveAlertsModal
        isOpen={isAlertsModalOpen}
        onClose={() => setIsAlertsModalOpen(false)}
        onLocateOnMap={(city, alert) => {
          setActiveGenerativeView({
            type: 'SPATIAL_EARLY_WARNING_MAP',
            city: city,
            severity: alert.level,
            alerts: [alert]
          });
        }}
        onSelectAlertForAnalysis={(alert) => {
          handleExecutePrompt(`请对 ${alert.city}${alert.district} 的预警 "${alert.title}" (编号: ${alert.alertId}) 进行专项病媒风险深度研判，分析周边种群抗药性并给出详细的应急消杀调度方案。`);
        }}
      />
    </div>
  );
}
