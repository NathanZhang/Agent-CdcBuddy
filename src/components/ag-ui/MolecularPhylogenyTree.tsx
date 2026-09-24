'use client';

import React from 'react';
import ReactECharts from 'echarts-for-react';
import { GitBranch, ShieldCheck, Info, CheckCircle2 } from 'lucide-react';

interface MolecularPhylogenyTreeProps {
  data: any;
}

export const MolecularPhylogenyTree: React.FC<MolecularPhylogenyTreeProps> = ({ data }) => {
  const nodes = data?.networkGraph?.nodes || [];
  const links = data?.networkGraph?.links || [];
  const groups = data?.homologousGroups || [];
  const totalAnalyzed = data?.analyzedIsolatesCount || nodes.length;
  const threshold = data?.clusterThreshold || 5;

  const option = {
    title: {
      text: '致病菌全基因组 cgMLST 核心等位基因同源拓扑图 (MST 最小生成树)',
      subtext: `阈值: Δ ≤ ${threshold} 个变异位点视为同一起突发暴发克隆系 · 节点尺寸表示暴发关联株`,
      left: 'center',
      textStyle: { fontSize: 13, fontWeight: 'bold' }
    },
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        if (params.dataType === 'node') {
          const d = params.data?.details || {};
          return `
            <div style="font-size:12px; line-height:1.6;">
              <b>菌株编号:</b> ${params.data.id}<br/>
              <b>所属城市:</b> ${params.data.category}<br/>
              <b>致病菌种:</b> ${d.pathogen || '致病菌'}<br/>
              <b>血清型/ST:</b> ${d.serotype || ''} (${params.data.value})<br/>
              <b>分离来源:</b> ${d.source || '临床标本'}<br/>
              <b>采样日期:</b> ${d.date || '-'}<br/>
              <b>暴发关联:</b> ${params.data.isOutbreak ? '<span style="color:red;font-weight:bold;">聚集暴发分离株</span>' : '散发样本'}
            </div>
          `;
        } else if (params.dataType === 'link') {
          return `
            <div style="font-size:12px;">
              <b>两株基因位点差异:</b> ${params.data.label}<br/>
              <b>同源相似度:</b> ${params.data.similarityRate}%<br/>
              <b>判定结论:</b> ${params.data.isHomologous ? '<span style="color:#10b981;font-weight:bold;">同源暴发克隆系传播</span>' : '散发无显著关联'}
            </div>
          `;
        }
        return '';
      }
    },
    legend: {
      orient: 'vertical',
      left: 'left',
      top: 'bottom'
    },
    series: [
      {
        type: 'graph',
        layout: 'force',
        data: nodes.map((n: any) => ({
          ...n,
          itemStyle: {
            color: n.isOutbreak ? '#ef4444' : '#0ea5e9',
            borderColor: '#ffffff',
            borderWidth: 1.5
          }
        })),
        links: links.map((l: any) => ({
          ...l,
          lineStyle: {
            color: l.isHomologous ? '#10b981' : '#94a3b8',
            width: l.isHomologous ? 2.5 : 1,
            type: l.isHomologous ? 'solid' : 'dashed'
          }
        })),
        roam: true,
        label: {
          show: true,
          position: 'right',
          fontSize: 10
        },
        force: {
          repulsion: 180,
          edgeLength: [50, 120]
        }
      }
    ]
  };

  return (
    <div className="w-full bg-white dark:bg-slate-900 rounded-xl p-5 border border-emerald-200 dark:border-emerald-500/30 shadow-md space-y-4">
      {/* 头部 */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
            <GitBranch className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>致病菌全基因组 cgMLST 分子同源进化树与传播链溯源</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 font-medium">
                WGS 全基因组等位基因聚类
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              比对分离株数量：{totalAnalyzed} 株 · 核心等位基因位点：30 靶标位点 · 聚类判定阈值：Δ ≤ {threshold}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="px-2.5 py-1 rounded-md bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200">
            同源克隆群: {groups.length} 簇
          </span>
        </div>
      </div>

      {/* 同源克隆群识别清单 */}
      {groups.length > 0 && (
        <div className="space-y-2">
          {groups.map((grp: any) => (
            <div 
              key={grp.groupId}
              className="p-3 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-500/30 flex items-start gap-2.5 text-xs text-slate-800 dark:text-slate-200"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold font-mono text-emerald-800 dark:text-emerald-300 px-1.5 py-0.5 bg-emerald-200/60 dark:bg-emerald-800/40 rounded">
                    {grp.groupId}
                  </span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {grp.pathogenName} (序列型: {grp.stType})
                  </span>
                  <span className="text-slate-500">
                    波及地市: {grp.coverageCities.join(', ')} ｜ 分离株数: {grp.isolateCount} 株
                  </span>
                </div>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  {grp.conclusion}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ECharts 网络拓扑图 */}
      <div className="w-full h-[400px] rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
        <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />
      </div>

      {/* 专家研判结论 */}
      {data?.summary && (
        <div className="bg-slate-100 dark:bg-slate-800/60 p-3 rounded-lg text-xs text-slate-700 dark:text-slate-300 leading-relaxed flex items-center gap-2">
          <Info className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span><b>分子流行病学溯源结论：</b>{data.summary}</span>
        </div>
      )}
    </div>
  );
};
