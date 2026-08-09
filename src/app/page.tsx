'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useCopilotAction, useCopilotReadable } from '@copilotkit/react-core';
import { Navbar } from '@/components/layout/Navbar';
import { RecommendationPrompts } from '@/components/layout/RecommendationPrompts';
import { SkillsDrawer } from '@/components/layout/SkillsDrawer';
import { EmbeddedWidget } from '@/components/layout/EmbeddedWidget';
import { useRbac } from '@/lib/rbac/rbac-context';
import { VectorSkill } from '@/lib/skills/types';
import { getSkillById, STANDARD_SKILLS } from '@/lib/skills/registry';

// AG-UI 生成式界面组件库与调度引擎
import { GenerativeComponentRenderer } from '@/components/ag-ui/GenerativeComponentRenderer';
import { dispatchSkillPrompt } from '@/lib/skills/dispatcher';
import { ActiveAlertsModal, ACTIVE_ALERTS_LIST } from '@/components/ag-ui/ActiveAlertsModal';
import { MarkdownRenderer } from '@/components/common/MarkdownRenderer';

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
  RefreshCw
} from 'lucide-react';

export default function CdcAgentWorkspace() {
  const { currentUser, activeRole } = useRbac();
  const [isSkillsOpen, setIsSkillsOpen] = useState(false);
  const [isAlertsModalOpen, setIsAlertsModalOpen] = useState(false); // 活跃预警详情弹窗
  const [showFloatingCopilot, setShowFloatingCopilot] = useState(false); // 默认隐藏浮动 Copilot 图标
  const [activeGenerativeView, setActiveGenerativeView] = useState<any>({
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
  });

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

  const [chatHistory, setChatHistory] = useState<{
    id: string;
    sender: 'user' | 'agent';
    text: string;
    skillUsed?: string;
    timestamp: string;
  }[]>([
    {
      id: 'init-1',
      sender: 'agent',
      text: `您好！我是您的 **CdcBuddy 疾控病媒生物监测预警智能体**。\n\n系统已连通河南省 **5.6万+ 条病媒生态、病原PCR检测与抗药性真实监测数据**。您可以点击上方推荐卡片，或直接向我下发分析指令。`,
      timestamp: '11:30'
    }
  ]);

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

  // 智能体意图识别与 Skill 分发调度中枢
  const handleExecutePrompt = async (promptText: string) => {
    if (!promptText.trim()) return;

    const userMsgId = `msg-${Date.now()}`;
    const newChat = [...chatHistory, {
      id: userMsgId,
      sender: 'user' as const,
      text: promptText,
      timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    }];
    setChatHistory(newChat);
    setInputPrompt('');
    setIsThinking(true);

    try {
      const result = await dispatchSkillPrompt(promptText, { 
        chatHistory: newChat, 
        currentView: activeGenerativeView 
      });
      if (result.generativeView) {
        setActiveGenerativeView(result.generativeView);
        // 若创建了新技能，立即刷新自定义技能列表与技能总数
        if (
          result.generativeView.type === 'CUSTOM_SKILL_CREATED' ||
          result.skillId === 'skill_meta_custom_builder'
        ) {
          fetchCustomSkills();
        }
      }

      setTimeout(() => {
        setChatHistory(prev => [
          ...prev,
          {
            id: `agent-${Date.now()}`,
            sender: 'agent',
            text: result.replyText || `已根据您的指令调用 **【${result.skillName}】** 技能。相关分析图表与态势数据已在主工作区生成式渲染完成。`,
            skillUsed: result.skillName,
            timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
          }
        ]);
        setIsThinking(false);
      }, 300);
    } catch (e: any) {
      console.error(e);
      setChatHistory(prev => [
        ...prev,
        {
          id: `agent-err-${Date.now()}`,
          sender: 'agent',
          text: `⚠️ 执行失败：${e.message || '技能执行异常'}，请重试或检查参数。`,
          timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
        }
      ]);
      setIsThinking(false);
    }
  };

  const totalSkillsCount = STANDARD_SKILLS.length + customSkills.length;

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors duration-200">
      {/* 顶部导航与态势指示条 */}
      <Navbar
        skillsCount={totalSkillsCount}
        onOpenSkills={() => setIsSkillsOpen(true)}
        onSelectPrompt={handleExecutePrompt}
        showEmbeddedWidget={showFloatingCopilot}
        onToggleEmbeddedWidget={() => setShowFloatingCopilot(prev => !prev)}
      />

      {/* 统计指标浮动指示条 */}
      <div className="shrink-0 bg-slate-100/90 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800/80 px-6 py-2 flex items-center justify-between overflow-x-auto text-xs text-slate-600 dark:text-slate-300 gap-6 transition-colors">
        <div className="flex items-center gap-6 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>治理监测记录: <strong className="text-sky-600 dark:text-sky-400 font-mono">48,530</strong> 条 (100%温湿度补全)</span>
          </div>
          <div className="flex items-center gap-2">
            <span>PCR 病原检测: <strong className="text-rose-600 dark:text-rose-400 font-mono">7,336</strong> 组批</span>
          </div>
          <div className="flex items-center gap-2">
            <span>抗药性毒力测定: <strong className="text-amber-600 dark:text-amber-400 font-mono">365</strong> 组</span>
          </div>
          <div className="flex items-center gap-2">
            <span>覆盖全省行政区: <strong className="text-slate-900 dark:text-slate-100 font-mono">18 地市 / 126 区县</strong> (2,037 点位)</span>
          </div>
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
            {/* 对话区头部 */}
            <div className="shrink-0 p-3.5 bg-slate-50 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-sky-600 flex items-center justify-center text-white text-xs">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">CdcBuddy 协同研判对话</h3>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">● Copilot Runtime 连接就绪</span>
                </div>
              </div>

              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-400 font-medium">
                {activeRole}
              </span>
            </div>

            {/* 消息滚动区 */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3.5 text-xs">
              {chatHistory.map(m => (
                <div
                  key={m.id}
                  className={`flex gap-2.5 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {m.sender === 'agent' && (
                    <div className="w-6 h-6 rounded-full bg-sky-600 flex items-center justify-center text-white text-[10px] shrink-0 mt-0.5">
                      🤖
                    </div>
                  )}

                  <div className={`max-w-[85%] space-y-1.5 ${m.sender === 'user' ? 'items-end' : 'items-start'}`}>
                    <div
                      className={`p-3.5 rounded-xl leading-relaxed ${
                        m.sender === 'user'
                          ? 'bg-sky-600 text-white rounded-br-none shadow-sm shadow-sky-600/20'
                          : 'bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-bl-none shadow-xs'
                      }`}
                    >
                      <MarkdownRenderer content={m.text} isUser={m.sender === 'user'} />
                    </div>

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

              {isThinking && (
                <div className="flex gap-2.5 items-center text-xs text-sky-600 dark:text-sky-400 p-2 rounded-lg bg-sky-50 dark:bg-slate-950/60 border border-sky-200 dark:border-slate-800 animate-pulse">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>CdcBuddy 正在检索时空数据库并计算模型指标...</span>
                </div>
              )}

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
                  onKeyDown={(e) => e.key === 'Enter' && handleExecutePrompt(inputPrompt)}
                  className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
                />
                <button
                  onClick={() => handleExecutePrompt(inputPrompt)}
                  disabled={!inputPrompt.trim() || isThinking}
                  className="p-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-semibold shadow-md shadow-sky-600/30 transition-all"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
                <span>支持自然语言 Text2SQL 与多模态生成式卡片交互</span>
                <button
                  onClick={() => setIsSkillsOpen(true)}
                  className="text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1 font-medium"
                >
                  <Layers className="w-3 h-3" />
                  <span>查看全部技能</span>
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
