'use client';
import React from 'react';
import type { QueryVisualization } from '@/contracts/query-visualization';
import { QueryResultMap } from './QueryResultMap';
import { mapPoints } from '@/lib/geo/result-map';
import { fieldLabel } from '@/features/workbench/result-presentation';

type Row = Record<string, unknown>;
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const number = (v: number) => v.toLocaleString('zh-CN', { maximumFractionDigits: 5 });

// Use calendar intervals for dated series, including periods omitted by SQL GROUP BY.
function calendarPositions(labels: unknown[]): number[] | undefined {
  if (labels.every(v => typeof v === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(v))) {
    return (labels as string[]).map(v => Number(v.slice(0, 4)) * 12 + Number(v.slice(5)) - 1);
  }
  if (labels.every(v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v))) {
    const dates = (labels as string[]).map(v => Date.parse(`${v}T00:00:00Z`));
    if (dates.every((v, i) => Number.isFinite(v) && new Date(v).toISOString().slice(0, 10) === labels[i])) return dates.map(v => v / 86_400_000);
  }
}

/** The chart consumes the executed rows; it never queries or supplies fallback values. */
export function QueryResultVisualization({ rows, spec }: { rows: Row[]; spec?: QueryVisualization }) {
  if (!spec || !rows.length) return null;
  const title = spec.kind === 'map' ? '监测空间分布' : spec.kind === 'line' ? '时间趋势' : spec.kind==='pie'?'构成比例':'分组对比';
  let graphic: React.ReactNode;
  if (spec.kind === 'map') {
    const points = mapPoints(rows, spec);
    if (!points.length) return <p className="text-xs text-slate-500">当前结果没有可绘制的坐标与数值，请查看明细。</p>;
    return <QueryResultMap points={points} unit={spec.unit??'点位'}/>;
  } else if(spec.kind==='pie') {
    const valid=rows.filter(r=>finite(r[spec.yKey])&&(r[spec.yKey] as number)>=0);
    const total=valid.reduce((sum,r)=>sum+(r[spec.yKey] as number),0);
    if(total<=0||!Number.isFinite(total))return <p className="text-xs text-slate-500">当前结果缺少正数总量，无法计算构成比例，请查看明细。</p>;
    let offset=0;const colors=['#0284c7','#16a34a','#f59e0b','#a855f7','#f43f5e','#64748b'];
    graphic=<>{valid.map((r,i)=>{const fraction=(r[spec.yKey] as number)/total;const start=offset;offset+=fraction;return <g key={i}><circle data-series="pie" cx="170" cy="175" r="95" fill="none" stroke={colors[i%colors.length]} strokeWidth="50" pathLength="1" strokeDasharray={`${fraction} ${1-fraction}`} strokeDashoffset={-start} transform="rotate(-90 170 175)" tabIndex={0}><title>{`${r[spec.xKey]}：${number(r[spec.yKey] as number)} ${spec.unit}（${number(fraction*100)}%）`}</title></circle><text x="320" y={28+i*22} fill={colors[i%colors.length]} fontSize="12">{`${r[spec.xKey]}：${number(fraction*100)}%`}</text></g>;})}</>;
  } else {
    const valid = rows.filter(r => finite(r[spec.yKey]));
    if (!valid.length) return <p className="text-xs text-slate-500">当前结果没有可绘制的数值，请查看明细。</p>;
    const min = Math.min(0, ...valid.map(r => r[spec.yKey] as number));
    const max = Math.max(0, ...valid.map(r => r[spec.yKey] as number));
    const range = max - min || 1;
    const calendar = spec.kind === 'line' ? calendarPositions(rows.map(r => r[spec.xKey])) : undefined;
    const start = calendar ? Math.min(...calendar) : 0;
    const span = calendar ? Math.max(...calendar) - start : 0;
    const x = (i: number) => calendar ? (span ? 90 + (calendar[i] - start) / span * 620 : 400) : 72 + (i + 0.5) * 660 / rows.length;
    const y = (v: number) => 300 - (v - min) / range * 260;
    // Break lines at missing values; zero remains a real observation.
    const segments: string[][] = [[]];
    rows.forEach((r, i) => {
      if (calendar && i > 0 && calendar[i] - calendar[i - 1] !== 1) segments.push([]);
      if (finite(r[spec.yKey])) segments[segments.length - 1].push(`${x(i)},${y(r[spec.yKey] as number)}`);
      else segments.push([]);
    });
    graphic = <>
      {[0, 1, 2, 3, 4].map(t => { const v = min + range * t / 4; return <g key={t}><line x1="72" x2="732" y1={y(v)} y2={y(v)} stroke="currentColor" strokeOpacity="0.15"/><text x="64" y={y(v) + 4} textAnchor="end" fill="currentColor" fontSize="11">{number(v)}</text></g>; })}
      {spec.kind === 'line' && segments.filter(s => s.length > 1).map((s, i) => <polyline data-series="line" key={i} points={s.join(' ')} fill="none" stroke="#0ea5e9" strokeWidth="2.5" />)}
      {rows.map((r, i) => <g key={i}>
        {finite(r[spec.yKey]) && (spec.kind === 'bar' ? <rect x={x(i) - Math.min(32, 240 / rows.length)} y={Math.min(y(0), y(r[spec.yKey] as number))} width={Math.min(64, 480 / rows.length)} height={Math.max(1, Math.abs(y(r[spec.yKey] as number) - y(0)))} fill="#0ea5e9" tabIndex={0}><title>{`${r[spec.xKey]}：${number(r[spec.yKey] as number)} ${spec.unit}`}</title></rect> : <circle cx={x(i)} cy={y(r[spec.yKey] as number)} r="3.5" fill="#0ea5e9" tabIndex={0}><title>{`${r[spec.xKey]}：${number(r[spec.yKey] as number)} ${spec.unit}`}</title></circle>)}
        {(i % Math.max(1, Math.ceil(rows.length / 8)) === 0 || i === rows.length - 1) && <text x={x(i)} y="320" fill="currentColor" textAnchor="end" fontSize="10" transform={`rotate(-25 ${x(i)} 320)`}>{String(r[spec.xKey] ?? '')}</text>}
      </g>)}
      <text x="24" y="20" fill="currentColor" fontSize="12">{`${fieldLabel(spec.yKey)}（${spec.unit}）`}</text>
    </>;
  }
  return <figure data-visualization={spec.kind} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-3 text-slate-600 dark:text-slate-300">
    <figcaption className="text-sm font-semibold mb-2">{title}</figcaption>
    <svg role="img" aria-label={`${title}（${spec.unit}）；完整数值见下方表格`} viewBox="0 0 760 380" className="w-full min-h-56">{graphic}</svg>
    <p className="text-xs text-slate-500">图形与下方表格使用同一批返回数据；悬停或聚焦标记查看数值，缺失值不补零。</p>
  </figure>;
}
