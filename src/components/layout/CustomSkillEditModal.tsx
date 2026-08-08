'use client';

import React, { useState, useEffect } from 'react';
import { X, Lock, Globe, Save, Sparkles, Database, Layout } from 'lucide-react';

export interface EditableSkillData {
  id: string;
  name: string;
  description: string;
  sqlQuery: string;
  chartType: 'trend' | 'bar' | 'pie' | 'map' | 'table';
  visibility: 'private' | 'public';
  recommendedPrompts: string[];
}

interface CustomSkillEditModalProps {
  isOpen: boolean;
  skill: EditableSkillData | null;
  onClose: () => void;
  onSave: (updatedSkill: EditableSkillData) => Promise<void>;
}

export const CustomSkillEditModal: React.FC<CustomSkillEditModalProps> = ({
  isOpen,
  skill,
  onClose,
  onSave
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'public'>('private');
  const [chartType, setChartType] = useState<'trend' | 'bar' | 'pie' | 'map' | 'table'>('bar');
  const [sqlQuery, setSqlQuery] = useState('');
  const [promptsText, setPromptsText] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (skill) {
      setName(skill.name || '');
      setDescription(skill.description || '');
      setVisibility(skill.visibility || 'private');
      setChartType(skill.chartType || 'bar');
      setSqlQuery(skill.sqlQuery || '');
      setPromptsText(Array.isArray(skill.recommendedPrompts) ? skill.recommendedPrompts.join('\n') : '');
    }
  }, [skill]);

  if (!isOpen || !skill) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSaving(true);
    try {
      const prompts = promptsText
        .split('\n')
        .map(p => p.trim())
        .filter(p => p.length > 0);

      await onSave({
        ...skill,
        name: name.trim(),
        description: description.trim(),
        visibility,
        chartType,
        sqlQuery: sqlQuery.trim(),
        recommendedPrompts: prompts.length > 0 ? prompts : [`执行 ${name.trim()}`]
      });
      onClose();
    } catch (err) {
      console.error('保存技能失败:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div 
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-pink-500/30 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] relative z-[101]">
        {/* 头部 */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-pink-50 text-pink-600 dark:bg-pink-500/10 dark:text-pink-400 border border-pink-200 dark:border-pink-500/30">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">编辑自定义技能</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">修改技能属性、可见性权限与数据分析模板</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 表单主体 */}
        <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* 技能名称 */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700 dark:text-slate-300">
              技能名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：安阳市蜱虫携带恙虫病东方体月度分布监测"
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-pink-500 text-xs"
            />
          </div>

          {/* 可见性选择 (私有 vs 公开) */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700 dark:text-slate-300">
              可见性权限标记 <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              {/* 私有选项 */}
              <div
                onClick={() => setVisibility('private')}
                className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                  visibility === 'private'
                    ? 'bg-purple-50 dark:bg-purple-950/30 border-purple-400 text-purple-900 dark:text-purple-200 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                }`}
              >
                <div className={`p-1.5 rounded-lg shrink-0 ${visibility === 'private' ? 'bg-purple-200/60 dark:bg-purple-800/40 text-purple-700 dark:text-purple-300' : 'bg-slate-200 dark:bg-slate-800'}`}>
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 font-bold">
                    <span>私有 (Private)</span>
                    <span className="text-[10px] px-1 py-0.2 rounded bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300">默认</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">仅当前账号本人可见和调度</p>
                </div>
              </div>

              {/* 公开选项 */}
              <div
                onClick={() => setVisibility('public')}
                className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                  visibility === 'public'
                    ? 'bg-sky-50 dark:bg-sky-950/30 border-sky-400 text-sky-900 dark:text-sky-200 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                }`}
              >
                <div className={`p-1.5 rounded-lg shrink-0 ${visibility === 'public' ? 'bg-sky-200/60 dark:bg-sky-800/40 text-sky-700 dark:text-sky-300' : 'bg-slate-200 dark:bg-slate-800'}`}>
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 font-bold">
                    <span>公开 (Public)</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">全省/市疾控所有业务专家均可查看使用</p>
                </div>
              </div>
            </div>
          </div>

          {/* 技能描述 */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700 dark:text-slate-300">技能功能描述</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="简要说明该技能的业务分析目标与计算口径..."
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-pink-500 text-xs"
            />
          </div>

          {/* 可视化呈现类型 */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Layout className="w-3.5 h-3.5 text-sky-500" />
              <span>默认可视化呈现类型</span>
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: 'map', label: '地图分布' },
                { id: 'bar', label: '柱状对比' },
                { id: 'trend', label: '趋势折线' },
                { id: 'table', label: '数据表格' }
              ].map(item => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => setChartType(item.id as any)}
                  className={`py-1.5 px-2 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                    chartType === item.id
                      ? 'bg-sky-600 text-white border-sky-600 shadow-xs font-semibold'
                      : 'bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* 聚合分析 SQL 语句 */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-sky-500" />
              <span>聚合分析 SQL 逻辑</span>
            </label>
            <textarea
              rows={4}
              value={sqlQuery}
              onChange={(e) => setSqlQuery(e.target.value)}
              placeholder="SELECT ... FROM fact_monitoring ..."
              className="w-full bg-slate-50 dark:bg-slate-950 font-mono text-[11px] border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-cyan-800 dark:text-cyan-300 focus:outline-none focus:border-pink-500"
            />
          </div>

          {/* 推荐调用指令 (每行一条) */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700 dark:text-slate-300">推荐调用自然语言指令 (每行一条)</label>
            <textarea
              rows={2}
              value={promptsText}
              onChange={(e) => setPromptsText(e.target.value)}
              placeholder="例如：执行 安阳市蜱虫携带恙虫病东方体分析"
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-pink-500 text-xs"
            />
          </div>

          {/* 底部按钮栏 */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isSaving || !name.trim()}
              className="px-4 py-2 rounded-lg bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-pink-600/30 transition-all cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? '保存中...' : '保存修改'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
