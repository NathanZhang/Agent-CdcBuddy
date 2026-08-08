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
  PieChart
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
}

export const SkillsDrawer: React.FC<SkillsDrawerProps> = ({
  isOpen,
  onClose,
  onRunSkill,
  onCreateCustomSkill
}) => {
  const { canAccessSkill } = useRbac();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  if (!isOpen) return null;

  const categories = [
    { id: 'all', name: '全部技能' },
    { id: 'population', name: '种群动态' },
    { id: 'resistance', name: '抗药性评估' },
    { id: 'pathogen', name: '病原学筛查' },
    { id: 'warning', name: '预警响应' },
    { id: 'forecast', name: '风险预测' },
    { id: 'report', name: '专题报告' },
    { id: 'custom', name: '自定义技能' }
  ];

  const filteredSkills = STANDARD_SKILLS.filter(s => {
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
              <p className="text-xs text-slate-500 dark:text-slate-400">已接入 14 项疾控病媒专业模型与自定义分析技能</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onCreateCustomSkill}
              className="px-3 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-pink-600/30 transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              <span>对话新建技能</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
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
              className={`px-3 py-1 rounded-full whitespace-nowrap transition-all ${
                selectedCategory === c.id 
                  ? 'bg-sky-600 dark:bg-sky-500 text-white font-semibold' 
                  : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* 技能列表卡片 */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {filteredSkills.map(skill => {
            const hasPermission = canAccessSkill(skill.id);
            const IconComp = ICON_MAP[skill.iconName] || Layers;

            return (
              <div
                key={skill.id}
                className={`p-4 rounded-xl border flex flex-col gap-3 transition-all ${
                  hasPermission 
                    ? 'bg-slate-50/80 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 hover:border-sky-400/50 shadow-xs' 
                    : 'bg-slate-100/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-900 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 mt-0.5 border border-slate-200 dark:border-transparent shadow-xs">
                      <IconComp className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{skill.name}</h3>
                        {skill.requirementNo && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300 font-mono">
                            {skill.requirementNo}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">{skill.description}</p>
                    </div>
                  </div>

                  {hasPermission ? (
                    <button
                      onClick={() => {
                        onRunSkill(skill, skill.recommendedPrompts[0]);
                        onClose();
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-sky-50 dark:bg-sky-600/20 hover:bg-sky-600 text-sky-700 dark:text-sky-300 hover:text-white border border-sky-300 dark:border-sky-500/40 text-xs flex items-center gap-1 shrink-0 transition-all font-medium"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>调用</span>
                    </button>
                  ) : (
                    <span className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-800 text-slate-500 text-xs flex items-center gap-1 shrink-0">
                      <Lock className="w-3 h-3" />
                      <span>无权使用</span>
                    </span>
                  )}
                </div>

                {/* 推荐 Prompts */}
                {skill.recommendedPrompts.length > 0 && hasPermission && (
                  <div className="bg-white dark:bg-slate-950/60 p-2 rounded-lg border border-slate-200 dark:border-slate-800/80 space-y-1">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block">推荐调用指令:</span>
                    {skill.recommendedPrompts.slice(0, 2).map((rp, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          onRunSkill(skill, rp);
                          onClose();
                        }}
                        className="text-left text-[11px] text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 block truncate hover:underline"
                      >
                        ▸ {rp}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
