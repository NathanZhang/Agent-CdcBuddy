'use client';

import React, { useState } from 'react';
import { 
  TrendingUp, 
  ShieldAlert, 
  Activity, 
  MapPin, 
  Sparkles, 
  ChevronDown,
  ChevronUp,
  MessageSquareQuote
} from 'lucide-react';

interface RecommendationPromptsProps {
  onSelectPrompt: (prompt: string) => void;
  defaultExpanded?: boolean;
}

export const RecommendationPrompts: React.FC<RecommendationPromptsProps> = ({ 
  onSelectPrompt,
  defaultExpanded = true 
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const categories = [
    {
      title: '时空态势与预警排查',
      color: 'bg-red-500/10 dark:bg-gradient-to-b dark:from-red-500/20 dark:to-orange-500/10 border-red-200 dark:border-red-500/30',
      icon: MapPin,
      iconColor: 'text-red-600 dark:text-red-400',
      prompts: [
        '在地图上展示全省当前的病媒生物预警热力分布，标记所有严重（红色）预警区域。',
        '下钻查看郑州市金水区和管城区的蚊媒密度空间热力与超标监测点。',
        '针对全省当前的严重等级预警生成今日消杀调度派单清单与处置依据。'
      ]
    },
    {
      title: '种群消长与趋势预测',
      color: 'bg-sky-500/10 dark:bg-gradient-to-b dark:from-sky-500/20 dark:to-cyan-500/10 border-sky-200 dark:border-sky-500/30',
      icon: TrendingUp,
      iconColor: 'text-sky-600 dark:text-sky-400',
      prompts: [
        '分析近几年全省蚊类密度随气温变化的季节消长规律，并预测未来3个月密度波动。',
        '分析郑州市蚊类优势种群构成比（白纹伊蚊与淡色库蚊比例）及多样性指数。',
        '结合未来高温多雨气象，通过 GBDT 模型预测下月成蚊暴发峰值。'
      ]
    },
    {
      title: '抗药性测定与科学消杀',
      color: 'bg-amber-500/10 dark:bg-gradient-to-b dark:from-amber-500/20 dark:to-yellow-500/10 border-amber-200 dark:border-amber-500/30',
      icon: ShieldAlert,
      iconColor: 'text-amber-600 dark:text-amber-400',
      prompts: [
        '评估全省淡色库蚊对氯氰菊酯和残杀威的抗药性等级及用药调整建议。',
        '查询德国小蠊在郑州市对各类杀虫剂的 LC50 毒力测定结果与轮换方案。',
        '预测未来1年全省淡色库蚊对拟除虫菊酯类的 KDR 耐药基因频率演化。'
      ]
    },
    {
      title: '病原学筛查与专题报告',
      color: 'bg-purple-500/10 dark:bg-gradient-to-b dark:from-purple-500/20 dark:to-pink-500/10 border-purple-200 dark:border-purple-500/30',
      icon: Activity,
      iconColor: 'text-purple-600 dark:text-purple-400',
      prompts: [
        '排查全省蚊媒登革病毒与乙脑病毒的 PCR 阳性检出率及高风险区县。',
        '评估郑州市登革热综合传播风险指数（病媒密度 × 病毒阳性率 × 人口密度）。',
        '生成郑州市2024年夏季蚊媒监测与登革热风险评估专项报告并准备导出。'
      ]
    }
  ];

  const totalPromptsCount = categories.reduce((sum, c) => sum + c.prompts.length, 0);

  return (
    <div className={`w-full bg-white/70 dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80 shadow-xs transition-all duration-200 ${
      isExpanded ? 'p-3.5 rounded-2xl' : 'py-1.5 px-3 rounded-xl'
    }`}>
      {/* 折叠/展开头部操作条 */}
      <div 
        className="flex items-center justify-between cursor-pointer select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200">
          <div className={`rounded-md bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-cyan-400 border border-sky-200/60 dark:border-sky-500/20 ${
            isExpanded ? 'p-1.5' : 'p-1'
          }`}>
            <Sparkles className={isExpanded ? 'w-4 h-4 animate-pulse' : 'w-3.5 h-3.5'} />
          </div>
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold text-slate-900 dark:text-slate-100">
              常用业务研判与推荐对话 Prompt
            </h2>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              4 大类 · 共 {totalPromptsCount} 条
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 text-xs">
          <span className="hidden sm:inline text-slate-400 dark:text-slate-500 text-[11px]">
            {isExpanded ? '点击任意卡片即可直接向智能体下发指令' : '已折叠推荐面板以增加工作区空间'}
          </span>
          <button
            type="button"
            className={`flex items-center gap-1 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold border border-slate-200 dark:border-slate-700 transition-colors shadow-2xs ${
              isExpanded ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-[11px]'
            }`}
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
          >
            {isExpanded ? (
              <>
                <span>折叠面板</span>
                <ChevronUp className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              </>
            ) : (
              <>
                <span>展开推荐</span>
                <ChevronDown className="w-3 h-3 text-slate-500 dark:text-slate-400" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* 可折叠内容区 */}
      {isExpanded && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5 mt-3.5 pt-3 border-t border-slate-200/70 dark:border-slate-800/70 animate-in fade-in slide-in-from-top-2 duration-200">
          {categories.map((cat, idx) => {
            const IconComp = cat.icon;
            return (
              <div
                key={idx}
                className={`p-3.5 rounded-xl ${cat.color} border backdrop-blur-sm flex flex-col justify-between gap-2.5 shadow-sm dark:shadow-md hover:border-sky-400/50 transition-all`}
              >
                <div className="flex items-center gap-2 border-b border-slate-200/80 dark:border-slate-800/80 pb-2">
                  <IconComp className={`w-4 h-4 ${cat.iconColor}`} />
                  <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">{cat.title}</h3>
                </div>

                <div className="flex flex-col gap-1.5">
                  {cat.prompts.map((p, pIdx) => (
                    <button
                      key={pIdx}
                      onClick={() => onSelectPrompt(p)}
                      className="text-left text-xs text-slate-700 dark:text-slate-300 hover:text-sky-700 dark:hover:text-white bg-white/85 dark:bg-slate-950/60 hover:bg-sky-50 dark:hover:bg-sky-950/60 p-2 rounded-lg border border-slate-200/80 dark:border-slate-800 hover:border-sky-400 dark:hover:border-sky-500/40 transition-all leading-snug group flex items-start gap-1.5 shadow-2xs"
                    >
                      <span className="text-sky-600 dark:text-sky-400 text-[10px] mt-0.5 group-hover:translate-x-0.5 transition-transform">▸</span>
                      <span>{p}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
