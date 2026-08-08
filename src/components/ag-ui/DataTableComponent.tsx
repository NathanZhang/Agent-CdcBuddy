'use client';

import React, { useState } from 'react';
import { Table, Download, Search } from 'lucide-react';

interface DataTableProps {
  title?: string;
  data: Record<string, any>[];
}

export const DataTableComponent: React.FC<DataTableProps> = ({ title = '监测明细数据表', data }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  if (!data || data.length === 0) {
    return (
      <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 text-center">
        暂无关联表格数据
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

  return (
    <div className="w-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-xl p-5 border border-slate-200 dark:border-slate-700/50 shadow-sm dark:shadow-xl flex flex-col gap-3 text-xs transition-colors">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Table className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">{title}</h4>
          <span className="text-slate-500 text-xs">({filteredData.length} 条记录)</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
            <input
              type="text"
              placeholder="搜索表格数据..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg pl-8 pr-3 py-1 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
          </div>
          <button
            onClick={handleExportCsv}
            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-sky-700 dark:text-sky-300 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center gap-1 transition-colors font-medium"
          >
            <Download className="w-3.5 h-3.5" />
            <span>导出 CSV</span>
          </button>
        </div>
      </div>

      {/* 表格 */}
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="w-full text-left">
          <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 font-semibold">
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
                  <td key={cIdx} className="p-2.5 whitespace-nowrap font-mono">{String(row[col] ?? '-')}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[11px] pt-1">
          <span>页码 {currentPage} / {totalPages}</span>
          <div className="flex gap-1.5">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-40"
            >
              上一页
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-40"
            >
              下一页
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
