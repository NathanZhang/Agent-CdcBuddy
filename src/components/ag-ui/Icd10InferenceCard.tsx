'use client';

import React from 'react';
import { 
  GitBranch, 
  ArrowRight, 
  CheckCircle2, 
  Sparkles, 
  FileText, 
  Database,
  Layers,
  Award
} from 'lucide-react';

interface Icd10InferenceCardProps {
  data?: any;
}

export const Icd10InferenceCard: React.FC<Icd10InferenceCardProps> = ({ data = {} }) => {
  const chain = data?.inputDeathChain || {
    part1_a: '心源性休克',
    part1_b: '心室颤动',
    part1_c: '急性下壁心肌梗死',
    part1_d: '冠状动脉粥样硬化性心脏病'
  };

  const underlying = data?.inferredUnderlyingCause || {
    diseaseName: '急性下壁心肌梗死',
    standardIcd10: 'I21.1',
    icd10ExpandedCode: 'I21.101',
    chapter: '第九章 循环系统疾病',
    block: '缺血性心脏病 (I20-I25)',
    confidenceScore: 0.982
  };

  const workflow = data?.reasoningWorkflow || [
    {
      step: 1,
      title: '直接死因逻辑过滤 (消除终末状态)',
      content: `识别并剥离终末症状【${chain.part1_a}】，根据国家规范，呼吸心跳骤停/衰竭不得作为根本死因。`
    },
    {
      step: 2,
      title: '死因链因果顺应性溯源',
      content: `由中间状态【${chain.part1_b}】回溯至最早引发一系列病理级联反应的原发疾病【${chain.part1_c}】。`
    },
    {
      step: 3,
      title: 'ICD-10 知识图谱编码锁定',
      content: `匹配至国家标准 ICD-10 字典，映射为【${underlying.standardIcd10} ${underlying.diseaseName}】(${underlying.block})。`
    }
  ];

  const accuracyCompliance = data?.accuracyCompliance || '达标 (96.5% >= 95.0% 国家标准)';
  const benefit = data?.replacementBenefit || '已完全替代人工初审初编，单份证明书解析平均耗时由 8 分钟降至 0.04 秒。';

  return (
    <div className="w-full bg-white dark:bg-slate-900 rounded-xl p-5 border border-purple-200 dark:border-purple-500/30 shadow-md space-y-5">
      {/* 头部态势栏 */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
            <GitBranch className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>死因链医学知识图谱根本死因推断与 ICD-10 智能编码</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300 font-medium">
                NLP 因果推理 · 准确率≥95%
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              基于 WHO 根本死因选择总原则与修正规则，自动解析非结构化死亡因果链
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="px-2.5 py-1 rounded-md bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-500/30">
            编码准确率: {accuracyCompliance}
          </span>
          <span className="px-2.5 py-1 rounded-md bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 font-bold border border-purple-200 dark:border-purple-500/30">
            置信度: {(underlying.confidenceScore * 100).toFixed(1)}%
          </span>
        </div>
      </div>

      {/* 原始死因链级联流转展示 */}
      <div className="space-y-2">
        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <Layers className="w-4 h-4 text-purple-500" /> 原始上报死因链 (Part I 因果序列)
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
          <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1">
            <span className="text-[10px] text-slate-400 font-bold">(a) 直接死因</span>
            <p className="font-semibold text-slate-900 dark:text-slate-100">{chain.part1_a}</p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1">
            <span className="text-[10px] text-slate-400 font-bold">(b) 引起(a)的疾病</span>
            <p className="font-semibold text-slate-900 dark:text-slate-100">{chain.part1_b}</p>
          </div>
          <div className="bg-purple-50/60 dark:bg-purple-950/20 p-3 rounded-lg border border-purple-200 dark:border-purple-500/30 space-y-1">
            <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold">(c) 引起(b)的疾病</span>
            <p className="font-bold text-purple-700 dark:text-purple-300">{chain.part1_c}</p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1">
            <span className="text-[10px] text-slate-400 font-bold">(d) 引起(c)的疾病</span>
            <p className="font-semibold text-slate-900 dark:text-slate-100">{chain.part1_d || '无'}</p>
          </div>
        </div>
      </div>

      {/* 推断根本死因与 ICD-10 国家标准编码 */}
      <div className="bg-gradient-to-r from-purple-50 via-pink-50 to-rose-50 dark:from-purple-950/30 dark:via-pink-950/20 dark:to-rose-950/30 p-4 rounded-xl border border-purple-200 dark:border-purple-500/40 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-purple-800 dark:text-purple-300">
            <Award className="w-4 h-4 text-purple-600" />
            <span>智能推断判定根本死因与 ICD-10 国家标准编码：</span>
          </div>
          <span className="text-xs px-2 py-0.5 rounded bg-purple-600 text-white font-mono font-bold">
            {underlying.standardIcd10}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="bg-white/80 dark:bg-slate-900/80 p-3 rounded-lg border border-purple-100 dark:border-purple-900/50">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">根本死因疾病名称</span>
            <p className="text-base font-black text-purple-700 dark:text-purple-300 mt-0.5">{underlying.diseaseName}</p>
          </div>
          <div className="bg-white/80 dark:bg-slate-900/80 p-3 rounded-lg border border-purple-100 dark:border-purple-900/50">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">ICD-10 扩展编码 / 章节</span>
            <p className="text-base font-bold text-slate-800 dark:text-slate-200 mt-0.5 font-mono">{underlying.icd10ExpandedCode}</p>
            <span className="text-[10px] text-slate-400">{underlying.chapter}</span>
          </div>
          <div className="bg-white/80 dark:bg-slate-900/80 p-3 rounded-lg border border-purple-100 dark:border-purple-900/50">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">所属疾病亚目 (Block)</span>
            <p className="text-sm font-bold text-rose-600 dark:text-rose-400 mt-0.5">{underlying.block}</p>
            <span className="text-[10px] text-emerald-600">知识图谱置信度 98.2%</span>
          </div>
        </div>
      </div>

      {/* 推理路径演进 */}
      <div className="space-y-2.5">
        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">医学知识图谱推理步骤明细 (Reasoning Workflow)</span>
        <div className="space-y-2">
          {workflow.map((step: any, i: number) => (
            <div key={i} className="flex items-start gap-3 bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs">
              <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 flex items-center justify-center font-bold flex-shrink-0 text-[11px]">
                {step.step}
              </span>
              <div className="space-y-0.5">
                <span className="font-bold text-slate-900 dark:text-slate-100">{step.title}</span>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{step.content}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 效能收益 */}
      <div className="bg-purple-50/60 dark:bg-purple-950/20 p-3 rounded-lg border border-purple-200 dark:border-purple-500/30 flex items-center gap-2 text-xs">
        <Sparkles className="w-4 h-4 text-purple-600 flex-shrink-0" />
        <span className="text-slate-700 dark:text-slate-300 font-medium">{benefit}</span>
      </div>
    </div>
  );
};
