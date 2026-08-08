'use client';

import React from 'react';
import { VectorMapComponent } from './VectorMapComponent';
import { DensityTrendChart } from './DensityTrendChart';
import { SpeciesCompositionChart } from './SpeciesCompositionChart';
import { ResistanceMatrixChart } from './ResistanceMatrixChart';
import { PathogenRiskCard } from './PathogenRiskCard';
import { EarlyWarningPanel } from './EarlyWarningPanel';
import { DisposalWorkflowCard } from './DisposalWorkflowCard';
import { TransmissionRiskGauge } from './TransmissionRiskGauge';
import { ResistanceEvolutionChart } from './ResistanceEvolutionChart';
import { AutoReportViewer } from './AutoReportViewer';
import { MobileSimulationModal } from './MobileSimulationModal';
import { CustomSkillBuilderModal } from './CustomSkillBuilderModal';
import { DataTableComponent } from './DataTableComponent';
import { MarkdownRenderer } from '@/components/common/MarkdownRenderer';
import { Bot } from 'lucide-react';

interface GenerativeComponentRendererProps {
  view: any;
  isCompact?: boolean;
}

/**
 * 通用生成式 UI 组件渲染器
 * 既可在主工作台画布上全屏展示，也可在对话浮窗气泡内独立闭环渲染
 */
export const GenerativeComponentRenderer: React.FC<GenerativeComponentRendererProps> = ({
  view,
  isCompact = false
}) => {
  if (!view || !view.type) {
    return null;
  }

  const containerClasses = isCompact 
    ? "w-full my-2 rounded-xl overflow-hidden shadow-md text-left transition-all" 
    : "w-full h-full min-h-0 flex flex-col overflow-y-auto rounded-xl";

  return (
    <div className={containerClasses}>
      {view.type === 'SPATIAL_EARLY_WARNING_MAP' && (
        <div className={isCompact ? "w-full h-[380px] rounded-xl overflow-hidden relative" : "w-full h-full"}>
          <VectorMapComponent
            alerts={view.alerts}
            selectedCity={view.city}
            selectedDistrict={view.district}
            spatialGrid={view.spatialGrid}
            monitoringPoints={view.monitoringPoints}
            category={view.category || '蚊'}
          />
        </div>
      )}

      {view.type === 'POPULATION_DENSITY_TREND' && (
        <DensityTrendChart data={view} />
      )}

      {view.type === 'SPECIES_COMPOSITION' && (
        <SpeciesCompositionChart data={view} />
      )}

      {view.type === 'RESISTANCE_EVALUATION' && (
        <ResistanceMatrixChart data={view} />
      )}

      {view.type === 'PATHOGEN_RISK_ANALYSIS' && (
        <PathogenRiskCard data={view} />
      )}

      {view.type === 'ALERT_PUSH_DISPATCH' && (
        <EarlyWarningPanel data={view} />
      )}

      {view.type === 'DISPOSAL_WORKFLOW_CARD' && (
        <DisposalWorkflowCard data={view} />
      )}

      {view.type === 'DENSITY_GBDT_FORECAST' && (
        <DensityTrendChart data={view.trendData || view} />
      )}

      {view.type === 'TRANSMISSION_RISK_GAUGE' && (
        <TransmissionRiskGauge data={view} />
      )}

      {view.type === 'RESISTANCE_EVOLUTION_CHART' && (
        <ResistanceEvolutionChart data={view} />
      )}

      {view.type === 'AUTO_GENERATED_REPORT' && (
        <AutoReportViewer data={view} />
      )}

      {view.type === 'MOBILE_ASSISTANT_SIMULATOR' && (
        <MobileSimulationModal />
      )}

      {view.type === 'CUSTOM_SKILL_CREATED' && (
        <CustomSkillBuilderModal data={view} />
      )}

      {view.type === 'DATA_TABLE_VIEW' && (
        <DataTableComponent
          title={view.title}
          query={view.query}
          sql={view.sql}
          executionTimeMs={view.executionTimeMs}
          explanation={view.explanation}
          data={view.data}
        />
      )}

      {view.type === 'NLQ_KNOWLEDGE_ANSWER' && (
        <div className="w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-xl p-4 border border-teal-200 dark:border-teal-500/30 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-teal-600 dark:text-teal-400 font-bold text-xs">
            <Bot className="w-4 h-4" />
            <span>CDC 专家知识库检索结果</span>
          </div>
          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">{view.query}</h4>
          <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 leading-relaxed">
            <MarkdownRenderer content={view.answer} />
          </div>
          {view.references && (
            <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-0.5">
              <span className="font-semibold text-slate-700 dark:text-slate-300">引用标准与指南:</span>
              {view.references.map((ref: string, i: number) => (
                <div key={i} className="text-sky-600 dark:text-sky-400">📖 {ref}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
