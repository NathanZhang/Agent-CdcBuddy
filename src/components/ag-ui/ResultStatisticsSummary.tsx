import React from 'react';
import type {ResultStatistics} from '@/contracts/result-statistics';
import {tableStatisticsText} from '@/contracts/result-statistics';
import {fieldLabel} from '@/features/workbench/result-presentation';

export function ResultStatisticsSummary({statistics}: {statistics?: ResultStatistics}) {
  if (!statistics?.tables.length) return null;
  return <aside className="space-y-1 rounded-lg bg-slate-50 dark:bg-slate-900 p-3 text-xs text-slate-600 dark:text-slate-300" aria-label="返回数据统计">
    {statistics.tables.map(table => <p key={JSON.stringify(table.path)}>
      {table.path.length > 1 && <span>{table.path.slice(1).map(fieldLabel).join(' / ')}： </span>}
      {tableStatisticsText(table, fieldLabel)}
    </p>)}
    <p className="text-slate-500">统计针对本次返回数据，保留缺失值和重复记录；返回行数不代表全部匹配记录或独立采样访次。</p>
  </aside>;
}
