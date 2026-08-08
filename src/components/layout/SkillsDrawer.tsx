'use client';

import React, { useState } from 'react';
import { STANDARD_SKILLS } from '@/lib/skills/registry';
import { VectorSkill } from '@/lib/skills/types';
import { useRbac } from '@/lib/rbac/rbac-context';
import { CustomSkillEditModal, EditableSkillData } from './CustomSkillEditModal';
import { 
  Layers, 
  X, 
  Play, 
  PlusCircle, 
  CheckCircle2, 
  Lock, 
  Globe,
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
  Sparkles,
  Edit3,
  Trash2,
  AlertTriangle
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
  onDeleteCustomSkill?: (skillId: string) => Promise<void> | void;
  onRefreshCustomSkills?: () => void;
}

export const SkillsDrawer: React.FC<SkillsDrawerProps> = ({
  isOpen,
  onClose,
  onRunSkill,
  onCreateCustomSkill,
  customSkills = [],
  onDeleteCustomSkill,
  onRefreshCustomSkills
}) => {
  const { canAccessSkill } = useRbac();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // 编辑弹窗状态
  const [editingSkill, setEditingSkill] = useState<EditableSkillData | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // 删除二次确认弹窗状态
  const [deletingSkill, setDeletingSkill] = useState<VectorSkill | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
    visibility: (cs.visibility as 'private' | 'public') || 'private',
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

  // 处理保存技能编辑
  const handleSaveSkillEdit = async (updated: EditableSkillData) => {
    try {
      const res = await fetch('/api/skills', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skillId: updated.id,
          name: updated.name,
          description: updated.description,
          sqlQuery: updated.sqlQuery,
          chartType: updated.chartType,
          visibility: updated.visibility,
          recommendedPrompts: updated.recommendedPrompts
        })
      });
      if (res.ok) {
        onRefreshCustomSkills?.();
      }
    } catch (e) {
      console.error('更新技能失败:', e);
    }
  };

  // 处理确认删除技能
  const handleConfirmDelete = async () => {
    if (!deletingSkill) return;
    setIsDeleting(true);
    try {
      if (onDeleteCustomSkill) {
        await onDeleteCustomSkill(deletingSkill.id);
      }
      setDeletingSkill(null);
    } catch (e) {
      console.error('删除技能失败:', e);
    } finally {
      setIsDeleting(false);
    }
  };

  // 打开编辑弹窗
  const handleOpenEdit = (skill: VectorSkill) => {
    const raw = customSkills.find(cs => cs.id === skill.id) || {};
    setEditingSkill({
      id: skill.id,
      name: skill.name,
      description: skill.description,
      sqlQuery: raw.sqlQuery || raw.sql_query || '',
      chartType: raw.chartType || raw.chart_type || 'bar',
      visibility: skill.visibility || 'private',
      recommendedPrompts: skill.recommendedPrompts || []
    });
    setIsEditModalOpen(true);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
        <div className="w-full max-w-xl h-full bg-white dark:bg-slate-950 border-l border-slate-200 dark:border-sky-500/30 p-6 flex flex-col gap-5 shadow-2xl overflow-hidden transition-colors">
          {/* 抽屉头部 */}
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="p-2 rounded-lg bg-sky-50 text-sky-600 border border-sky-200 dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-500/30 shrink-0">
                <Layers className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 truncate">Skills 业务技能中心</h2>
                <p 
                  className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5"
                  title={`已接入 ${allSkills.length} 项专业模型与自定义技能${formattedCustomSkills.length > 0 ? ` (含 ${formattedCustomSkills.length} 项用户定制)` : ''}`}
                >
                  已接入 {allSkills.length} 项专业模型与自定义技能{formattedCustomSkills.length > 0 && ` (含 ${formattedCustomSkills.length} 项定制)`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={onCreateCustomSkill}
                className="px-3 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-pink-600/30 transition-all cursor-pointer whitespace-nowrap shrink-0"
              >
                <PlusCircle className="w-4 h-4 shrink-0" />
                <span>对话新建技能</span>
              </button>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
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
                const isPrivate = (skill.visibility ?? 'private') === 'private';

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
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{skill.name}</h3>
                            
                            {/* 自定义技能专属标签与可见性 */}
                            {isUserCustomSkill && (
                              <>
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-300 font-semibold border border-pink-200 dark:border-pink-500/40">
                                  用户定制
                                </span>
                                {isPrivate ? (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 font-medium border border-purple-200 dark:border-purple-800 flex items-center gap-0.5">
                                    <Lock className="w-2.5 h-2.5" />
                                    <span>私有</span>
                                  </span>
                                ) : (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300 font-medium border border-sky-200 dark:border-sky-800 flex items-center gap-0.5">
                                    <Globe className="w-2.5 h-2.5" />
                                    <span>公开</span>
                                  </span>
                                )}
                              </>
                            )}

                            {isMetaBuilder && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-300 font-semibold border border-pink-200 dark:border-pink-500/40">
                                元技能构建器
                              </span>
                            )}

                            {!isUserCustomSkill && !isMetaBuilder && skill.requirementNo && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300 font-mono">
                                {skill.requirementNo}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">{skill.description}</p>
                        </div>
                      </div>

                      {/* 动作操作按钮组 */}
                      <div className="flex items-center gap-1 shrink-0">
                        {hasPermission ? (
                          <button
                            onClick={() => {
                              onRunSkill(skill, skill.recommendedPrompts[0]);
                              onClose();
                            }}
                            title="调用此技能"
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

                        {/* 自定义技能支持编辑 */}
                        {isUserCustomSkill && (
                          <button
                            onClick={() => handleOpenEdit(skill)}
                            title="编辑技能属性与可见性"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/40 border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* 自定义技能支持删除 (点击打开二次确认弹窗) */}
                        {isUserCustomSkill && onDeleteCustomSkill && (
                          <button
                            onClick={() => setDeletingSkill(skill)}
                            title="删除该自定义技能"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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

      {/* 自定义技能编辑弹窗 */}
      <CustomSkillEditModal
        isOpen={isEditModalOpen}
        skill={editingSkill}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingSkill(null);
        }}
        onSave={handleSaveSkillEdit}
      />

      {/* 删除二次确认弹窗 */}
      {deletingSkill && (
        <div 
          onClick={(e) => {
            if (e.target === e.currentTarget && !isDeleting) setDeletingSkill(null);
          }}
          className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4 relative z-[111]">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">确认删除该自定义技能？</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  即将永久删除技能 <strong className="text-slate-800 dark:text-slate-200">“{deletingSkill.name}”</strong>
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 p-3 rounded-lg leading-relaxed">
              ⚠️ 注意：删除后该技能绑定的聚合分析 SQL、图表模板及调用指令将被彻底清除，且此操作不可逆。
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingSkill(null)}
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-red-600/30 transition-all cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? '删除中...' : '确认删除'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

