'use client';
import React from 'react';
import type { QueryVisualization } from '@/contracts/query-visualization';
import border from '@/lib/geo/henan-province-border.json';
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
  const title = spec.kind === 'map' ? '监测空间分布' : spec.kind === 'line' ? '时间趋势' : '分组对比';
  let graphic: React.ReactNode;
  if (spec.kind === 'map') {
    const points = rows.filter(r => finite(r[spec.latKey]) && finite(r[spec.lonKey]) && Math.abs(r[spec.latKey] as number) <= 90 && Math.abs(r[spec.lonKey] as number) <= 180 && finite(r[spec.valueKey]));
    if (!points.length) return <p className="text-xs text-slate-500">当前结果没有可绘制的坐标与数值，请查看明细。</p>;
    const rings = border.features.flatMap(f => f.geometry.coordinates.flat()) as number[][][];
    const all = [...rings.flat(), ...points.map(r => [r[spec.lonKey] as number, r[spec.latKey] as number])];
    const minLon = Math.min(...all.map(p => p[0])), maxLon = Math.max(...all.map(p => p[0]));
    const minLat = Math.min(...all.map(p => p[1])), maxLat = Math.max(...all.map(p => p[1]));
    const lonScale = Math.cos((minLat + maxLat) / 2 * Math.PI / 180);
    const scale = Math.min(690 / ((maxLon - minLon) * lonScale || 1), 310 / (maxLat - minLat || 1));
    const x = (lon: number) => 380 + (lon - (minLon + maxLon) / 2) * lonScale * scale;
    const y = (lat: number) => 175 - (lat - (minLat + maxLat) / 2) * scale;
    const maxValue = Math.max(1, ...points.map(r => Math.abs(r[spec.valueKey] as number)));
    graphic = <>
      {rings.map((ring, i) => <path key={i} d={ring.map((p, j) => `${j ? 'L' : 'M'}${x(p[0])},${y(p[1])}`).join(' ') + 'Z'} fill="currentColor" fillOpacity="0.07" stroke="currentColor" strokeOpacity="0.35" strokeWidth="0.8" />)}
      {points.map((r, i) => <circle key={i} cx={x(r[spec.lonKey] as number)} cy={y(r[spec.latKey] as number)} r={3 + 7 * Math.sqrt(Math.abs(r[spec.valueKey] as number) / maxValue)} fill="#0ea5e9" fillOpacity="0.65" stroke="#0369a1" tabIndex={0}>
        <title>{`${String(r[spec.labelKey] ?? '')}：${number(r[spec.valueKey] as number)} ${spec.unit}；经度 ${r[spec.lonKey]}，纬度 ${r[spec.latKey]}`}</title>
      </circle>)}
      <text x="24" y="354" fill="currentColor" fontSize="12">{`河南省边界 · ${points.length} 个有效点位 · 圆点大小表示 ${spec.unit}`}</text>
    </>;
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
