'use client';

import React, { useState } from 'react';
import { Table, Download, Search, Code2, Copy, Check, Sparkles, Clock, Database } from 'lucide-react';

interface DataTableProps {
  title?: string;
  query?: string;
  sql?: string;
  executionTimeMs?: number;
  explanation?: string;
  data: Record<string, any>[];
}

export const DataTableComponent: React.FC<DataTableProps> = ({ 
  title = '监测明细数据表', 
  query,
  sql,
  executionTimeMs,
  explanation,
  data 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showSql, setShowSql] = useState(false);
  const [copied, setCopied] = useState(false);
  const pageSize = 10;

  if (!data || data.length === 0) {
    return (
      <div className="p-6 bg-white/90 dark:bg-slate-900/90 rounded-xl border border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 text-center space-y-2">
        <Database className="w-8 h-8 mx-auto text-slate-400 opacity-60" />
        <p className="font-medium text-slate-700 dark:text-slate-300">未检索到符合条件的病媒监测记录</p>
        <p className="text-[11px] text-slate-400">请尝试调整筛选年份、城市名称或病媒分类后重试</p>
        {sql && (
          <div className="mt-3 text-left p-3 rounded-lg bg-slate-950 text-slate-400 font-mono text-[11px] max-w-xl mx-auto overflow-x-auto">
            <code>{sql}</code>
          </div>
        )}
      </div>
    );
  }

  const columns = Object.keys(data[0]);

  const filteredData = data.filter(row => {
    if (!searchTerm) return true;
    return Object.values(row).some(v => String(v).toLowerCase().includes(searchTerm.toLowerCase()));
  });

  const totalPages = Math.ceil(filteredData.length / pageSize);
  const paginatedData = filteredData.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleExportCsv = () => {
    const header = columns.join(',');
    const rows = filteredData.map(r => columns.map(c => `"${String(r[c] ?? '').replace(/"/g, '""')}"`).join(','));
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [header, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${title}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopySql = () => {
    if (sql) {
      navigator.clipboard.writeText(sql);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="w-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-xl p-5 border border-slate-200 dark:border-slate-700/50 shadow-sm dark:shadow-xl flex flex-col gap-3 text-xs transition-colors">
      {/* 头部信息 */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Table className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">{title}</h4>
          <span className="text-slate-500 text-xs">({filteredData.length} 条记录)</span>
          {executionTimeMs !== undefined && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 font-mono flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>{executionTimeMs}ms</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {sql && (
            <button
              onClick={() => setShowSql(!showSql)}
              className={`px-2.5 py-1 rounded-lg border text-[11px] font-mono flex items-center gap-1 transition-all cursor-pointer ${
                showSql 
                  ? 'bg-sky-50 dark:bg-sky-950 text-sky-600 dark:text-sky-400 border-sky-300 dark:border-sky-700' 
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-sky-400'
              }`}
            >
              <Code2 className="w-3.5 h-3.5 text-sky-500" />
              <span>{showSql ? '收起 SQL' : '查看 Text2SQL'}</span>
            </button>
          )}

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
            <input
              type="text"
              placeholder="搜索表格数据..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg pl-8 pr-3 py-1 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-sky-500 text-xs"
            />
          </div>

          <button
            onClick={handleExportCsv}
            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-sky-700 dark:text-sky-300 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center gap-1 transition-colors font-medium cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>导出 CSV</span>
          </button>
        </div>
      </div>

      {/* Text2SQL 透视展示面板 */}
      {showSql && sql && (
        <div className="p-3 rounded-lg bg-slate-950 text-emerald-400 font-mono text-[11px] border border-slate-800 space-y-1.5 shadow-inner">
          <div className="flex items-center justify-between text-slate-400 text-[10px] border-b border-slate-800 pb-1.5">
            <div className="flex items-center gap-1.5 text-slate-300">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Text2SQL 智能编译语句 ({explanation || '自然语言大模型驱动'})</span>
            </div>
            <button 
              onClick={handleCopySql}
              className="text-sky-400 hover:text-sky-300 flex items-center gap-1 text-[11px] cursor-pointer"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? '已复制' : '复制 SQL'}</span>
            </button>
          </div>
          <pre className="overflow-x-auto whitespace-pre-wrap text-emerald-400 dark:text-emerald-300 leading-relaxed font-mono py-1">
            {sql}
          </pre>
        </div>
      )}

      {/* 表格内容 */}
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800 max-h-[460px] overflow-y-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 font-semibold sticky top-0 z-10 backdrop-blur-sm">
            <tr>
              {columns.map((col, idx) => (
                <th key={idx} className="p-2.5 whitespace-nowrap">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
            {paginatedData.map((row, rIdx) => (
              <tr key={rIdx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                {columns.map((col, cIdx) => (
                  <td key={cIdx} className="p-2.5 whitespace-nowrap font-mono text-xs">
                    {String(row[col] ?? '-')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 分页控制器 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[11px] pt-1">
          <span>页码 {currentPage} / {totalPages} (共 {filteredData.length} 条)</span>
          <div className="flex gap-1.5">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-40 cursor-pointer"
            >
              上一页
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-40 cursor-pointer"
            >
              下一页
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
