'use client';

import React, { useState } from 'react';
import { 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  Sparkles, 
  UploadCloud, 
  Database,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';

interface EnvOcrEntryCardProps {
  data?: any;
}

export const EnvOcrEntryCard: React.FC<EnvOcrEntryCardProps> = ({ data = {} }) => {
  const [isSaved, setIsSaved] = useState(false);

  const docTitle = data?.docTitle || '河南省生活饮用水水质检验报告单 (出厂水质多参数全分析)';
  const sampleId = data?.sampleId || 'RPT-WATER-2026-08194';
  const confidence = data?.overallConfidence || 0.985;
  const fields = data?.extractedFields || [
    { name: '采样地点', value: '新乡市凤泉区第一水厂出厂水取样口', status: 'valid', confidence: 0.99 },
    { name: '采样日期', value: '2026-08-20 08:30', status: 'valid', confidence: 0.99 },
    { name: '浑浊度 (NTU)', value: '0.42 (标准限值 ≤1.0)', status: 'valid', confidence: 0.98 },
    { name: '游离余氯 (mg/L)', value: '0.65 (标准限值 0.3~2.0)', status: 'valid', confidence: 0.98 },
    { name: '高锰酸盐指数 (mg/L)', value: '1.85 (标准限值 ≤3.0)', status: 'valid', confidence: 0.97 },
    { name: '菌落总数 (CFU/mL)', value: '12 (标准限值 ≤100)', status: 'valid', confidence: 0.99 },
    { name: '总大肠菌群 (CFU/100mL)', value: '未检出 (标准限值 不得检出)', status: 'valid', confidence: 0.99 },
    { name: '重金属铅 (mg/L)', value: '0.002 (标准限值 ≤0.01)', status: 'valid', confidence: 0.96 },
    { name: '重金属镉 (mg/L)', value: '0.0004 (标准限值 ≤0.005)', status: 'valid', confidence: 0.95 }
  ];

  return (
    <div className="w-full bg-white dark:bg-slate-900 rounded-xl p-5 border border-cyan-200 dark:border-cyan-500/30 shadow-md space-y-5">
      {/* 头部态势栏 */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-cyan-100 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 flex items-center justify-center font-bold">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>环境健康检验单据与台账 OCR 智能录入引擎</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300 font-medium">
                多模态 OCR · 数据清洗标化
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              单据单号：{sampleId} · 文档类型：生活饮用水理化及微生物化验报告
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="px-2.5 py-1 rounded-md bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-500/30">
            识别置信度: {(confidence * 100).toFixed(1)}%
          </span>
          <span className="px-2.5 py-1 rounded-md bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 font-bold border border-cyan-200 dark:border-cyan-500/30">
            逻辑质控: 全部通过
          </span>
        </div>
      </div>

      {/* 提取内容网格 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-800 dark:text-slate-200">
          <span className="flex items-center gap-1.5 text-cyan-600 dark:text-cyan-400">
            <ShieldCheck className="w-4 h-4" /> 结构化字段自动解析与 GB 5749-2022 逻辑一致性校验
          </span>
          <span className="text-[11px] text-slate-400">9 项关键指标全部标化匹配成功</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
          {fields.map((field: any, idx: number) => (
            <div 
              key={idx}
              className="bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs space-y-1"
            >
              <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
                <span>{field.name}</span>
                <span className="text-[10px] text-emerald-600 font-medium">{(field.confidence * 100).toFixed(0)}%</span>
              </div>
              <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center justify-between">
                <span>{field.value}</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 ml-1" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 底部入库与确认操作栏 */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <Database className="w-4 h-4 text-cyan-600" />
          <span>目标归档表：<code className="text-cyan-700 dark:text-cyan-300 font-mono">fact_water_monitoring</code></span>
        </div>

        <button
          onClick={() => setIsSaved(true)}
          disabled={isSaved}
          className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
            isSaved
              ? 'bg-emerald-600 text-white cursor-default shadow-sm'
              : 'bg-cyan-600 hover:bg-cyan-700 text-white shadow hover:shadow-md'
          }`}
        >
          {isSaved ? (
            <>
              <CheckCircle2 className="w-4 h-4" />
              <span>已成功标化入库 (fact_water_monitoring)</span>
            </>
          ) : (
            <>
              <UploadCloud className="w-4 h-4" />
              <span>一键清洗标化并同步至环境健康监测库</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
