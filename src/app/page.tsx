'use client';

import React, { useState, useEffect } from 'react';
import { useCopilotAction, useCopilotReadable } from '@copilotkit/react-core';
import { Navbar } from '@/components/layout/Navbar';
import { RecommendationPrompts } from '@/components/layout/RecommendationPrompts';
import { SkillsDrawer } from '@/components/layout/SkillsDrawer';
import { EmbeddedWidget } from '@/components/layout/EmbeddedWidget';
import { useRbac } from '@/lib/rbac/rbac-context';
import { VectorSkill } from '@/lib/skills/types';
import { getSkillById, STANDARD_SKILLS } from '@/lib/skills/registry';

// AG-UI 生成式界面组件库
import { VectorMapComponent } from '@/components/ag-ui/VectorMapComponent';
import { DensityTrendChart } from '@/components/ag-ui/DensityTrendChart';
import { SpeciesCompositionChart } from '@/components/ag-ui/SpeciesCompositionChart';
import { ResistanceMatrixChart } from '@/components/ag-ui/ResistanceMatrixChart';
import { PathogenRiskCard } from '@/components/ag-ui/PathogenRiskCard';
import { EarlyWarningPanel } from '@/components/ag-ui/EarlyWarningPanel';
import { DisposalWorkflowCard } from '@/components/ag-ui/DisposalWorkflowCard';
import { TransmissionRiskGauge } from '@/components/ag-ui/TransmissionRiskGauge';
import { ResistanceEvolutionChart } from '@/components/ag-ui/ResistanceEvolutionChart';
import { AutoReportViewer } from '@/components/ag-ui/AutoReportViewer';
import { MobileSimulationModal } from '@/components/ag-ui/MobileSimulationModal';
import { CustomSkillBuilderModal } from '@/components/ag-ui/CustomSkillBuilderModal';
import { DataTableComponent } from '@/components/ag-ui/DataTableComponent';

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
      text: `您好，**${currentUser.name}**！我是您的 **CdcBuddy 疾控病媒生物监测预警智能体**。\n\n系统已连通河南省 **5.6万+ 条病媒生态、病原PCR检测与抗药性真实监测数据**。您可以点击上方推荐卡片，或直接向我下发分析指令。`,
      timestamp: '11:30'
    }
  ]);

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

    const q = promptText.toLowerCase();

    try {
      let matchedSkillId = 'skill_spatial_early_warning';
      let skillArgs: any = {};

      if (q.includes('地图') || q.includes('热力') || q.includes('预警') || q.includes('超标') || q.includes('点位')) {
        matchedSkillId = 'skill_spatial_early_warning';
        if (q.includes('郑州')) skillArgs.city = '郑州市';
        if (q.includes('安阳')) skillArgs.city = '安阳市';
        if (q.includes('信阳')) skillArgs.city = '信阳市';
      } else if (q.includes('动态') || q.includes('消长') || q.includes('arima') || q.includes('预测未来3个月') || q.includes('曲线')) {
        matchedSkillId = 'skill_population_dynamics';
        skillArgs.category = q.includes('蝇') ? '蝇' : (q.includes('蟑螂') ? '蟑螂' : (q.includes('鼠') ? '鼠' : '蚊'));
        if (q.includes('淡色库蚊')) skillArgs.speciesName = '淡色库蚊';
        if (q.includes('白纹伊蚊')) skillArgs.speciesName = '白纹伊蚊';
        if (q.includes('郑州')) skillArgs.city = '郑州市';
      } else if (q.includes('优势种') || q.includes('构成比') || q.includes('聚类') || q.includes('比例')) {
        matchedSkillId = 'skill_species_composition';
        skillArgs.category = q.includes('鼠') ? '鼠' : (q.includes('蜱') ? '蜱' : '蚊');
        if (q.includes('郑州')) skillArgs.city = '郑州市';
      } else if (q.includes('抗药性') || q.includes('药剂') || q.includes('菊酯') || q.includes('lc50') || q.includes('轮换')) {
        matchedSkillId = 'skill_resistance_evaluation';
        if (q.includes('淡色库蚊')) skillArgs.speciesName = '淡色库蚊';
        if (q.includes('德国小蠊')) skillArgs.speciesName = '德国小蠊';
        if (q.includes('氯氰菊酯')) skillArgs.pesticideName = '氯氰菊酯';
      } else if (q.includes('病原') || q.includes('pcr') || q.includes('阳性') || q.includes('登革') || q.includes('乙脑') || q.includes('恙虫病') || q.includes('出血热')) {
        matchedSkillId = 'skill_pathogen_risk';
        if (q.includes('登革')) skillArgs.pathogenName = '登革病毒';
        if (q.includes('乙脑')) skillArgs.pathogenName = '乙型脑炎病毒';
        if (q.includes('恙虫病')) skillArgs.pathogenName = '恙虫病东方体';
      } else if (q.includes('工单') || q.includes('处置') || q.includes('消杀') || q.includes('核销') || q.includes('闭环')) {
        matchedSkillId = 'skill_disposal_workflow';
      } else if (q.includes('报告') || q.includes('专项') || q.includes('导出') || q.includes('公报')) {
        matchedSkillId = 'skill_auto_report_gen';
        if (q.includes('郑州')) skillArgs.city = '郑州市';
        if (q.includes('信阳')) skillArgs.city = '信阳市';
      } else if (q.includes('传播风险') || q.includes('暴发风险') || q.includes('指数') || q.includes('仪表盘')) {
        matchedSkillId = 'skill_transmission_risk';
        if (q.includes('登革热')) skillArgs.diseaseName = '登革热 (Dengue Fever)';
      } else if (q.includes('演化') || q.includes('基因') || q.includes('kdr') || q.includes('突变')) {
        matchedSkillId = 'skill_resistance_evolution';
      } else if (q.includes('移动端') || q.includes('拍照') || q.includes('录入') || q.includes('仿真') || q.includes('质控')) {
        matchedSkillId = 'skill_mobile_assistant_api';
      } else if (q.includes('创建新技能') || q.includes('新建技能') || q.includes('自定义技能') || q.includes('定制技能')) {
        matchedSkillId = 'skill_meta_custom_builder';
        skillArgs.skillName = '豫北蜱虫携带恙虫病东方体时空分布分析';
        skillArgs.description = '用户对话动态创建：统计安阳与新乡蜱虫病原携带率及高危村镇热力点';
      } else {
        matchedSkillId = 'skill_vector_nlq';
        skillArgs.query = promptText;
      }

      const skill = getSkillById(matchedSkillId);
      if (skill) {
        const result = await skill.execute(skillArgs);
        setActiveGenerativeView(result);

        setTimeout(() => {
          setChatHistory(prev => [
            ...prev,
            {
              id: `agent-${Date.now()}`,
              sender: 'agent',
              text: `已根据您的指令调用 **【${skill.name}】** 技能。相关分析图表与态势数据已在主工作区生成式渲染完成。`,
              skillUsed: skill.name,
              timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
            }
          ]);
          setIsThinking(false);
        }, 500);
      }
    } catch (e: any) {
      console.error(e);
      setIsThinking(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors duration-200">
      {/* 顶部导航与态势指示条 */}
      <Navbar
        onOpenSkills={() => setIsSkillsOpen(true)}
        onSelectPrompt={handleExecutePrompt}
      />

      {/* 统计指标浮动指示条 */}
      <div className="bg-slate-100/90 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800/80 px-6 py-2 flex items-center justify-between overflow-x-auto text-xs text-slate-600 dark:text-slate-300 gap-6 transition-colors">
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
          <span className="text-[11px] px-2 py-0.5 rounded bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/40 font-semibold animate-pulse">
            🚨 活跃预警: 14 起
          </span>
          <span className="text-slate-500 text-[11px]">最新数据期: 2025-11-11</span>
        </div>
      </div>

      {/* 核心工作台：双栏生成式工作区 */}
      <main className="flex-1 p-6 flex flex-col gap-6 max-w-[1780px] w-full mx-auto">
        {/* 常用业务研判与推荐对话 Prompt 瀑布流 */}
        <RecommendationPrompts onSelectPrompt={handleExecutePrompt} />

        {/* 下半部分：左侧 AG-UI 动态生成式工作台 + 右侧 Copilot 智能交互对话中枢 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* 左侧：AG-UI 生成式界面工作台 (占比 8 列) */}
          <div className="lg:col-span-8 flex flex-col gap-4">
            <div className="flex items-center justify-between">
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

            {/* 动态渲染对应的生成式 UI 组件 */}
            {activeGenerativeView?.type === 'SPATIAL_EARLY_WARNING_MAP' && (
              <VectorMapComponent
                alerts={activeGenerativeView.alerts}
                selectedCity={activeGenerativeView.city}
              />
            )}

            {activeGenerativeView?.type === 'POPULATION_DENSITY_TREND' && (
              <DensityTrendChart data={activeGenerativeView} />
            )}

            {activeGenerativeView?.type === 'SPECIES_COMPOSITION' && (
              <SpeciesCompositionChart data={activeGenerativeView} />
            )}

            {activeGenerativeView?.type === 'RESISTANCE_EVALUATION' && (
              <ResistanceMatrixChart data={activeGenerativeView} />
            )}

            {activeGenerativeView?.type === 'PATHOGEN_RISK_ANALYSIS' && (
              <PathogenRiskCard data={activeGenerativeView} />
            )}

            {activeGenerativeView?.type === 'ALERT_PUSH_DISPATCH' && (
              <EarlyWarningPanel data={activeGenerativeView} />
            )}

            {activeGenerativeView?.type === 'DISPOSAL_WORKFLOW_CARD' && (
              <DisposalWorkflowCard data={activeGenerativeView} />
            )}

            {activeGenerativeView?.type === 'DENSITY_GBDT_FORECAST' && (
              <DensityTrendChart data={activeGenerativeView.trendData} />
            )}

            {activeGenerativeView?.type === 'TRANSMISSION_RISK_GAUGE' && (
              <TransmissionRiskGauge data={activeGenerativeView} />
            )}

            {activeGenerativeView?.type === 'RESISTANCE_EVOLUTION_CHART' && (
              <ResistanceEvolutionChart data={activeGenerativeView} />
            )}

            {activeGenerativeView?.type === 'AUTO_GENERATED_REPORT' && (
              <AutoReportViewer data={activeGenerativeView} />
            )}

            {activeGenerativeView?.type === 'MOBILE_ASSISTANT_SIMULATOR' && (
              <MobileSimulationModal />
            )}

            {activeGenerativeView?.type === 'CUSTOM_SKILL_CREATED' && (
              <CustomSkillBuilderModal data={activeGenerativeView} />
            )}

            {activeGenerativeView?.type === 'NLQ_KNOWLEDGE_ANSWER' && (
              <div className="w-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-xl p-6 border border-teal-200 dark:border-teal-500/30 shadow-sm dark:shadow-xl space-y-4 transition-colors">
                <div className="flex items-center gap-2 text-teal-600 dark:text-teal-400 font-bold text-sm">
                  <Bot className="w-5 h-5" />
                  <span>CDC 专家知识库检索结果</span>
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{activeGenerativeView.query}</h3>
                <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-lg border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-line">
                  {activeGenerativeView.answer}
                </div>
                {activeGenerativeView.references && (
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">引用标准与指南:</span>
                    {activeGenerativeView.references.map((ref: string, i: number) => (
                      <div key={i} className="text-sky-600 dark:text-sky-400">📖 {ref}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 右侧：Copilot 智能体交互对话区 (占比 4 列) */}
          <div className="lg:col-span-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-xl border border-slate-200 dark:border-sky-500/20 shadow-sm dark:shadow-2xl flex flex-col h-[720px] overflow-hidden transition-colors">
            {/* 对话区头部 */}
            <div className="p-4 bg-slate-50 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
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
                      className={`p-3.5 rounded-xl leading-relaxed whitespace-pre-line ${
                        m.sender === 'user'
                          ? 'bg-sky-600 text-white rounded-br-none shadow-sm shadow-sky-600/20'
                          : 'bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-bl-none shadow-xs'
                      }`}
                    >
                      {m.text}
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
            </div>

            {/* 底部输入框 */}
            <div className="p-3 bg-slate-50 dark:bg-slate-950/90 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-2">
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
        onRunSkill={(skill, prompt) => handleExecutePrompt(prompt || skill.recommendedPrompts[0])}
        onCreateCustomSkill={() => {
          setIsSkillsOpen(false);
          handleExecutePrompt('帮我创建一个新技能：专门统计近三年安阳市蜱虫携带恙虫病东方体的月度分布并在地图上标出高危村镇。');
        }}
      />

      {/* 嵌入式浮窗组件 */}
      <EmbeddedWidget onSendMessage={handleExecutePrompt} />
    </div>
  );
}
