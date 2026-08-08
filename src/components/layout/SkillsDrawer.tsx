'use client';

import React, { useState } from 'react';
import { STANDARD_SKILLS } from '@/lib/skills/registry';
import { VectorSkill } from '@/lib/skills/types';
import { useRbac } from '@/lib/rbac/rbac-context';
import { 
  Layers, 
  X, 
  Play, 
  PlusCircle, 
  CheckCircle2, 
  Lock, 
  TrendingUp, 
  ShieldAlert, 
  Activity, 
  MapPin, 
  BellRing, 
  Gauge, 
  Dna, 
  Bot, 
  FileText, 
  Smartphone,
  PieChart,
  Sparkles
} from 'lucide-react';

const ICON_MAP: Record<string, any> = {
  TrendingUp,
  PieChart,
  ShieldAlert,
  Activity,
  MapPin,
  BellRing,
  CheckCircle2,
  Sparkles: TrendingUp,
  Gauge,
  Dna,
  Bot,
  FileText,
  Smartphone,
  PlusCircle
};

interface SkillsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onRunSkill: (skill: VectorSkill, prompt?: string) => void;
  onCreateCustomSkill: () => void;
  customSkills?: any[];
  onDeleteCustomSkill?: (skillId: string) => void;
}

export const SkillsDrawer: React.FC<SkillsDrawerProps> = ({
  isOpen,
  onClose,
  onRunSkill,
  onCreateCustomSkill,
  customSkills = [],
  onDeleteCustomSkill
}) => {
  const { canAccessSkill } = useRbac();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  if (!isOpen) return null;

  // 格式化自定义技能为标准 VectorSkill 结构并合并
  const formattedCustomSkills: VectorSkill[] = customSkills.map(cs => ({
    id: cs.id,
    name: cs.name,
    category: 'custom',
    categoryName: '自定义技能',
    requirementNo: 'Custom',
    description: cs.description || '由用户在对话中动态生成的分析技能',
    iconName: 'Sparkles',
    badgeColor: 'pink',
    recommendedPrompts: Array.isArray(cs.recommendedPrompts) ? cs.recommendedPrompts : [`执行 ${cs.name}`],
    requiredRoles: ['PROVINCIAL_ADMIN', 'CITY_EXPERT', 'DISTRICT_SURVEILLANCE'],
    parametersSchema: { type: 'object', properties: {} },
    execute: async (args) => {
      const url = typeof window !== 'undefined' ? '/api/skills' : 'http://localhost:3000/api/skills';
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillId: cs.id, args })
      });
      const json = await res.json();
      return json.data;
    }
  }));

  const allSkills: VectorSkill[] = [...STANDARD_SKILLS, ...formattedCustomSkills];

  const categories = [
    { id: 'all', name: '全部技能', count: allSkills.length },
    { id: 'population', name: '种群动态', count: allSkills.filter(s => s.category === 'population').length },
    { id: 'resistance', name: '抗药性评估', count: allSkills.filter(s => s.category === 'resistance').length },
    { id: 'pathogen', name: '病原学筛查', count: allSkills.filter(s => s.category === 'pathogen').length },
    { id: 'warning', name: '预警响应', count: allSkills.filter(s => s.category === 'warning').length },
    { id: 'forecast', name: '风险预测', count: allSkills.filter(s => s.category === 'forecast').length },
    { id: 'report', name: '专题报告', count: allSkills.filter(s => s.category === 'report').length },
    { id: 'custom', name: '自定义技能', count: allSkills.filter(s => s.category === 'custom').length }
  ];

  const filteredSkills = allSkills.filter(s => {
    if (selectedCategory === 'all') return true;
    return s.category === selectedCategory;
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
      <div className="w-full max-w-xl h-full bg-white dark:bg-slate-950 border-l border-slate-200 dark:border-sky-500/30 p-6 flex flex-col gap-5 shadow-2xl overflow-hidden transition-colors">
        {/* 抽屉头部 */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-sky-50 text-sky-600 border border-sky-200 dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-500/30">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Skills 业务技能中心</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                已接入 {allSkills.length} 项疾控病媒专业模型与自定义分析技能 {formattedCustomSkills.length > 0 && `(含 ${formattedCustomSkills.length} 项用户定制)`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onCreateCustomSkill}
              className="px-3 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-pink-600/30 transition-all cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>对话新建技能</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 分类过滤器 */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {categories.map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(c.id)}
              className={`px-3 py-1 rounded-full whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                selectedCategory === c.id 
                  ? 'bg-sky-600 dark:bg-sky-500 text-white font-semibold shadow-xs' 
                  : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <span>{c.name}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                selectedCategory === c.id 
                  ? 'bg-white/20 text-white' 
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
              }`}>
                {c.count}
              </span>
            </button>
          ))}
        </div>

        {/* 技能列表卡片 */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {filteredSkills.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
              <Sparkles className="w-8 h-8 text-pink-500 mb-2 opacity-60 animate-pulse" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">暂无相关技能</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs">
                在对话中输入“帮我创建一个新技能：...”即可由智能体动态解析生成并永久注册到技能集市中。
              </p>
              <button
                onClick={onCreateCustomSkill}
                className="mt-3 px-3 py-1.5 rounded-lg bg-pink-50 text-pink-600 hover:bg-pink-100 border border-pink-200 dark:bg-pink-500/10 dark:text-pink-400 dark:border-pink-500/30 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-all"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>立即尝试对话创建技能</span>
              </button>
            </div>
          ) : (
            filteredSkills.map(skill => {
              const isUserCustomSkill = skill.id.startsWith('custom_skill_');
              const isMetaBuilder = skill.id === 'skill_meta_custom_builder';
              const isCustomCategory = isUserCustomSkill || isMetaBuilder || skill.category === 'custom';
              const hasPermission = isUserCustomSkill ? true : canAccessSkill(skill.id);
              const IconComp = ICON_MAP[skill.iconName] || Layers;

              return (
                <div
                  key={skill.id}
                  className={`p-4 rounded-xl border flex flex-col gap-3 transition-all ${
                    isCustomCategory
                      ? 'bg-pink-50/30 dark:bg-pink-950/20 border-pink-200 dark:border-pink-500/30 hover:border-pink-400 shadow-xs'
                      : hasPermission 
                        ? 'bg-slate-50/80 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 hover:border-sky-400/50 shadow-xs' 
                        : 'bg-slate-100/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-900 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg mt-0.5 border shadow-xs ${
                        isCustomCategory 
                          ? 'bg-pink-50 text-pink-600 border-pink-200 dark:bg-pink-500/10 dark:text-pink-400 dark:border-pink-500/30' 
                          : 'bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 border-slate-200 dark:border-transparent'
                      }`}>
                        <IconComp className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{skill.name}</h3>
                          {isUserCustomSkill ? (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-300 font-semibold border border-pink-200 dark:border-pink-500/40">
                              用户定制
                            </span>
                          ) : isMetaBuilder ? (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-300 font-semibold border border-pink-200 dark:border-pink-500/40">
                              元技能构建器
                            </span>
                          ) : skill.requirementNo ? (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300 font-mono">
                              {skill.requirementNo}
                            </span>
                          ) : null}
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">{skill.description}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {hasPermission ? (
                        <button
                          onClick={() => {
                            onRunSkill(skill, skill.recommendedPrompts[0]);
                            onClose();
                          }}
                          className={`px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-1 transition-all font-medium cursor-pointer ${
                            isCustomCategory
                              ? 'bg-pink-600 hover:bg-pink-500 text-white shadow-xs'
                              : 'bg-sky-50 dark:bg-sky-600/20 hover:bg-sky-600 text-sky-700 dark:text-sky-300 hover:text-white border border-sky-300 dark:border-sky-500/40'
                          }`}
                        >
                          <Play className="w-3.5 h-3.5" />
                          <span>调用</span>
                        </button>
                      ) : (
                        <span className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-800 text-slate-500 text-xs flex items-center gap-1">
                          <Lock className="w-3 h-3" />
                          <span>无权使用</span>
                        </span>
                      )}

                      {isUserCustomSkill && onDeleteCustomSkill && (
                        <button
                          onClick={() => onDeleteCustomSkill(skill.id)}
                          title="删除该自定义技能"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 推荐 Prompts */}
                  {skill.recommendedPrompts && skill.recommendedPrompts.length > 0 && hasPermission && (
                    <div className="bg-white dark:bg-slate-950/60 p-2 rounded-lg border border-slate-200 dark:border-slate-800/80 space-y-1">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block">推荐调用指令:</span>
                      {skill.recommendedPrompts.slice(0, 2).map((rp, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            onRunSkill(skill, rp);
                            onClose();
                          }}
                          className={`text-left text-[11px] block truncate hover:underline cursor-pointer ${
                            isCustomCategory
                              ? 'text-pink-600 dark:text-pink-400 hover:text-pink-700'
                              : 'text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300'
                          }`}
                        >
                          ▸ {rp}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

