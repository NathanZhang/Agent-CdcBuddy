'use client';

import React, { useRef, useState } from 'react';
import { FileText, Printer, Copy, Check } from 'lucide-react';

interface AutoReportProps {
  data: {
    title: string;
    date: string;
    author: string;
    summary: string;
    sections: { heading: string; content: string }[];
  };
}

export const AutoReportViewer: React.FC<AutoReportProps> = ({ data }) => {
  const reportRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  const handleCopyMarkdown = () => {
    let md = `# ${data.title}\n\n`;
    md += `> 发布日期: ${data.date} | 编制机构: ${data.author}\n\n`;
    md += `## 摘要\n${data.summary}\n\n`;
    data.sections.forEach(s => {
      md += `## ${s.heading}\n${s.content}\n\n`;
    });

    navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportPdf = () => {
    window.print();
  };

  return (
    <div className="w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-xl p-6 border border-slate-200 dark:border-sky-500/30 shadow-sm dark:shadow-2xl flex flex-col gap-5 transition-colors">
      {/* 操作工具栏 */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-sky-50 text-sky-600 border border-sky-200 dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-500/30">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-sky-600 dark:text-sky-400 font-semibold uppercase tracking-wider">CDC 智能体专题报告</span>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{data.title}</h3>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyMarkdown}
            className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 transition-colors font-medium"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? '已复制 Markdown' : '复制全文 Markdown'}</span>
          </button>
          <button
            onClick={handleExportPdf}
            className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-sky-600/30 transition-all"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>一键打印 / 导出 PDF</span>
          </button>
        </div>
      </div>

      {/* 报告正文 */}
      <div ref={reportRef} className="bg-slate-50 dark:bg-slate-950/80 rounded-xl p-6 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 space-y-6 text-sm leading-relaxed">
        <div className="border-b border-slate-200 dark:border-slate-800/80 pb-4">
          <h1 className="text-xl font-bold text-center text-sky-600 dark:text-sky-400 mb-2">{data.title}</h1>
          <div className="flex justify-center items-center gap-4 text-xs text-slate-500 dark:text-slate-400 font-mono">
            <span>📅 {data.date}</span>
            <span>🏛️ {data.author}</span>
          </div>
        </div>

        <div className="p-4 rounded-lg bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-500/20 text-xs text-sky-900 dark:text-sky-200 leading-relaxed">
          <span className="font-bold text-sky-700 dark:text-sky-400 block mb-1">📌 报告核心摘要:</span>
          {data.summary}
        </div>

        {data.sections.map((sec, idx) => (
          <div key={idx} className="space-y-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 border-l-4 border-sky-500 pl-2.5">
              {sec.heading}
            </h2>
            <p className="text-slate-700 dark:text-slate-300 text-xs leading-relaxed whitespace-pre-line pl-3">
              {sec.content}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};
