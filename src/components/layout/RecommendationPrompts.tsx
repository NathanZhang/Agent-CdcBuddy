'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  TrendingUp, 
  ShieldAlert, 
  Activity, 
  MapPin, 
  Sparkles, 
  ChevronDown,
  ChevronUp,
  X
} from 'lucide-react';

interface RecommendationPromptsProps {
  onSelectPrompt: (prompt: string) => void;
  defaultExpanded?: boolean;
}

export const RecommendationPrompts: React.FC<RecommendationPromptsProps> = ({ 
  onSelectPrompt,
  defaultExpanded = false 
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const containerRef = useRef<HTMLDivElement>(null);

  // 点击外部自动收起浮动面板
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsExpanded(false);
      }
    };
    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isExpanded]);

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

  const handleSelect = (p: string) => {
    onSelectPrompt(p);
    setIsExpanded(false); // 点击后自动收起浮动层
  };

  return (
    <div ref={containerRef} className="relative w-full shrink-0 z-30">
      {/* 紧凑触发横条 */}
      <div 
        className={`w-full bg-white/80 dark:bg-slate-900/70 backdrop-blur-md border border-slate-200/90 dark:border-slate-800/90 shadow-2xs transition-all duration-200 py-1.5 px-3 rounded-xl flex items-center justify-between cursor-pointer select-none ${
          isExpanded ? 'border-sky-400 dark:border-sky-500/40 ring-2 ring-sky-500/10' : 'hover:border-slate-300 dark:hover:border-slate-700'
        }`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200">
          <div className="p-1 rounded-md bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-cyan-400 border border-sky-200/60 dark:border-sky-500/20">
            <Sparkles className="w-3.5 h-3.5" />
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
            {isExpanded ? '点击任意卡片下发指令，或点击外部收起' : '点击展开浮动推荐面板'}
          </span>
          <button
            type="button"
            className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold border transition-colors shadow-2xs ${
              isExpanded 
                ? 'bg-sky-600 text-white border-sky-600' 
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
            }`}
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
          >
            {isExpanded ? (
              <>
                <span>收起浮窗</span>
                <ChevronUp className="w-3 h-3" />
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

      {/* 浮动展开卡片层：绝对定位向下覆盖，不挤压主工作区 */}
      {isExpanded && (
        <div className="absolute top-full left-0 right-0 mt-1.5 p-4 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl rounded-2xl border border-slate-200/90 dark:border-sky-500/30 shadow-2xl shadow-slate-900/20 dark:shadow-sky-950/50 animate-in fade-in slide-in-from-top-1 duration-150 z-40 max-h-[80vh] overflow-y-auto">
          <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800/80 pb-2.5 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100">💡 点击任意业务指令卡片，即时联动 Copilot 与 AG-UI 工作台</span>
            </div>
            <button
              onClick={() => setIsExpanded(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 text-xs flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" />
              <span>收起</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {categories.map((cat, idx) => {
              const IconComp = cat.icon;
              return (
                <div
                  key={idx}
                  className={`p-3.5 rounded-xl ${cat.color} border backdrop-blur-sm flex flex-col justify-between gap-2.5 shadow-sm dark:shadow-md hover:border-sky-400/60 transition-all`}
                >
                  <div className="flex items-center gap-2 border-b border-slate-200/80 dark:border-slate-800/80 pb-2">
                    <IconComp className={`w-4 h-4 ${cat.iconColor}`} />
                    <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">{cat.title}</h3>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    {cat.prompts.map((p, pIdx) => (
                      <button
                        key={pIdx}
                        onClick={() => handleSelect(p)}
                        className="text-left text-xs text-slate-700 dark:text-slate-300 hover:text-sky-700 dark:hover:text-white bg-white/90 dark:bg-slate-950/70 hover:bg-sky-50 dark:hover:bg-sky-950/70 p-2 rounded-lg border border-slate-200/80 dark:border-slate-800 hover:border-sky-400 dark:hover:border-sky-500/50 transition-all leading-snug group flex items-start gap-1.5 shadow-2xs cursor-pointer"
                      >
                        <span className="text-sky-600 dark:text-sky-400 text-[10px] mt-0.5 group-hover:translate-x-0.5 transition-transform shrink-0">▸</span>
                        <span>{p}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

