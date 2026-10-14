'use client';
import {EnvironmentSamplingForm} from './EnvironmentSamplingForm';
import {ReportTemplateEditor} from './ReportTemplateEditor';
import {implementationLabels,validationLabels} from '@/contracts/skill-capability';

import React,{useId} from 'react';
import type {MapFeatureRef} from '@/lib/geo/map-interaction';
import {MapCanvas} from './MapCanvas';
import {AdministrativeMap} from './AdministrativeMap';
import {AnalyticsResultCard} from './AnalyticsResultCard';
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
import { SatScanLSTMPipelineCard } from './SatScanLSTMPipelineCard';
import { SatScanSpatialCard } from './SatScanSpatialCard';
import { LSTMPredictorCard } from './LSTMPredictorCard';
import { ComposableWorkflowCard } from './ComposableWorkflowCard';
import { DaemonSurveillanceCard } from './DaemonSurveillanceCard';
import { FoodborneClusterRadar } from './FoodborneClusterRadar';
import { MolecularPhylogenyTree } from './MolecularPhylogenyTree';
import { FoodRiskRankingChart } from './FoodRiskRankingChart';
import { OutbreakEpidemiologyCard } from './OutbreakEpidemiologyCard';
import { WaterPipelineGisMap } from './WaterPipelineGisMap';
import { SewageLagCorrelationChart } from './SewageLagCorrelationChart';
import { AirClimateHealthRiskCard } from './AirClimateHealthRiskCard';
import { RiverBasinPollutionChainCard } from './RiverBasinPollutionChainCard';
import { EnvScenarioSimulationCard } from './EnvScenarioSimulationCard';
import { EnvOcrEntryCard } from './EnvOcrEntryCard';
import { DeathCertQcCard } from './DeathCertQcCard';
import { Icd10InferenceCard } from './Icd10InferenceCard';
import { RareMortalityClusterCard } from './RareMortalityClusterCard';
import { ChronicRiskForecastCard } from './ChronicRiskForecastCard';
import { InjuryAttributionTreeCard } from './InjuryAttributionTreeCard';
import { LifeTable4q70ReportCard } from './LifeTable4q70ReportCard';
import { MarkdownRenderer } from '@/components/common/MarkdownRenderer';
import {statusLabel} from '@/features/workbench/result-presentation';
import { Bot } from 'lucide-react';
import { sourceLabels } from '@/features/workbench/result-adapter';

interface GenerativeComponentRendererProps {
  view: any;
  isCompact?: boolean;
  surfaceId?:string;
  mapComposition?:import('@/contracts/map-composition').MapComposition;
}

/**
 * 通用生成式 UI 组件渲染器
 * 既可在主工作台画布上全屏展示，也可在对话浮窗气泡内独立闭环渲染
 */
export const GenerativeComponentRenderer: React.FC<GenerativeComponentRendererProps> = ({
  view,
  isCompact = false,
  surfaceId, mapComposition
}) => {
  const ownSurfaceId=useId();const currentSurfaceId=surfaceId??ownSurfaceId;
  if (!view || !view.type) {
    return null;
  }

  if(view.qualityFlags?.includes('legacy-unverified'))return <div className="p-4 overflow-auto"><p className="text-amber-600 text-sm mb-3">历史快照：结果尚未按新执行协议验证，仅展示原始保存内容。</p><pre className="whitespace-pre-wrap text-xs">{JSON.stringify(view,null,2)}</pre></div>;

  const composition=view.type==='MAP_COMPOSITION'?view:view.type==='AGUI_RESULT_GROUP'?view.views.find((v:any)=>v.type==='MAP_COMPOSITION'):mapComposition;
  const featureRefs:Record<string,MapFeatureRef>={};if(composition&&view.spatialOutputs)for(const output of view.spatialOutputs){const layer=composition.layers.find((l:any)=>l.output.source.callId===output.source.callId&&l.output.source.runId===output.source.runId&&l.output.outputId===output.outputId);if(layer)for(const feature of output.geometry.features)featureRefs[String(feature.id)]={mapId:composition.mapId,surfaceId:currentSurfaceId,layerId:layer.id,featureId:String(feature.id)};}
  const containerClasses = isCompact 
    ? "w-full my-2 rounded-xl overflow-hidden shadow-md text-left transition-all" 
    : "w-full min-w-0 flex flex-col gap-3 rounded-xl";

  return (
    <div className={containerClasses} data-run-id={view.runId}>
      <div className="flex flex-wrap gap-2 text-xs px-3 py-2 text-slate-500">{sourceLabels(view.datasets).map(label=><span key={label}>{label}</span>)}{view.qualityFlags?.includes('legacy-unverified')&&<span className="text-amber-600">历史快照：结果尚未按新执行协议验证</span>}{view.status&&view.status!=='SUCCESS'&&<span>{statusLabel(view.status)}</span>}</div>
      {view.type==='AGUI_RESULT_GROUP'&&view.views.map((child:any,index:number)=><GenerativeComponentRenderer key={index} view={child} isCompact={isCompact} surfaceId={currentSurfaceId} mapComposition={composition}/>)}
      {view.type==='MAP_COMPOSITION'&&<MapCanvas key={view.mapId} composition={view} surfaceId={currentSurfaceId}/>}
      {view.type==='MAP_VIEW'&&<AdministrativeMap key={view.mapId} view={view}/>}
      {view.type==='ENVIRONMENT_SAMPLING_FORM'&&<EnvironmentSamplingForm data={view}/>}
      {view.type==='REPORT_TEMPLATE_EDITOR'&&<ReportTemplateEditor data={view}/>}
      {view.type==='ANALYTICS_RESULT'&&<AnalyticsResultCard data={view}/>}
      {view.type==='SPECIES_RECOGNITION_RESULT'&&<div className="p-5"><h3 className="font-semibold">图片识别候选（需人工复核）</h3><p>{view.speciesName??'无法判断'}</p><p>{view.reason}</p><p>模型自评置信度：{view.confidence===null?'未提供':`${Math.round(view.confidence*100)}%`}</p><p>识别编号：{view.recognitionId}</p></div>}
      {view.type==='COLLECTION_FORM'&&<MobileSimulationModal data={view}/>}
      {view.type==='ARTIFACT_DOWNLOAD'&&<div className="p-5"><h3 className="font-semibold">导出文件</h3><a href={view.downloadUrl} className="text-sky-600 underline" download>{view.fileName}</a><p className="text-xs text-slate-500 mt-2">{view.byteLength} 字节</p></div>}
      {view.type==='SESSION_RESULT'&&<div className="p-5"><h3 className="font-semibold">会话管理</h3>{view.sessions?.map((session:any)=><p key={session.sessionId}>{session.title} · {session.messageCount} 条消息</p>)}{view.session&&<p>{view.session.title}</p>}</div>}
      {view.type==='SKILL_CATALOG'&&<div className="p-5"><h3 className="font-semibold">技能列表</h3>{view.standardSkills?.map((skill:any)=><p key={skill.id} className="text-sm mt-2">{skill.name} · {implementationLabels[skill.implementationStatus as keyof typeof implementationLabels]??'尚未实现'} · {validationLabels[skill.validationStatus as keyof typeof validationLabels]??'尚未验证'}</p>)}{view.customSkills?.map((skill:any)=><p key={skill.skill_id}>{skill.name}</p>)}</div>}
      {view.type==='COLLECTION_RESULT'&&<div className="p-5"><h3 className="font-semibold">现场采集结果</h3>{view.record&&<p>记录编号：{view.record.submission_id}；审核状态：{statusLabel(view.record.audit_status)}</p>}{view.record?.recognition_id&&<p>识别编号：{view.record.recognition_id}；模型候选：{view.record.recognized_species??'无法判断'}；人工确认：{view.record.species_name}</p>}{view.evaluation&&<p>经验质控规则：{view.evaluation.passedRulesCount}/{view.evaluation.totalRulesCount} 未触发异常；{view.evaluation.warnings.length} 项需复核。</p>}</div>}
      {view.type === 'SPATIAL_EARLY_WARNING_MAP' && (
        <div className={isCompact ? "w-full h-[380px] rounded-xl overflow-hidden relative" : "w-full h-[560px] shrink-0 relative"}>
          <VectorMapComponent
            alerts={view.alerts}
            selectedCity={view.city}
            selectedDistrict={view.district}
            targetLat={view.targetLat}
            targetLon={view.targetLon}
            spatialGrid={view.spatialGrid}
            monitoringPoints={view.monitoringPoints}
            category={view.category || '蚊'}
            severity={view.severity}
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
          statistics={view.statistics}
          featureRefs={featureRefs}
          sourceRunId={view.runId}
          sourceCallId={view.callId??view.spatialOutputs?.[0]?.source.callId}
          title={view.title}
          query={view.query}
          sql={view.sql}
          executionTimeMs={view.executionTimeMs}
            scope={view.scope}
          explanation={view.explanation}
          data={view.data}
          featureIdKey={view.visualization?.kind==='map'?view.visualization.idKey:undefined}
          visualization={view.suppressSpatialMap&&view.visualization?.kind==='map'?undefined:view.visualization}
        />
      )}

      {view.type === 'SATSCAN_KMEANS_LSTM_PIPELINE' && (
        <SatScanLSTMPipelineCard data={view} />
      )}

      {view.type === 'SATSCAN_SPATIAL_VIEW' && (
        <SatScanSpatialCard data={view} />
      )}

      {view.type === 'LSTM_PREDICTOR_VIEW' && (
        <LSTMPredictorCard data={view} />
      )}

      {view.type === 'COMPOSABLE_WORKFLOW_VIEW' && (
        <ComposableWorkflowCard data={view} />
      )}

      {view.type === 'DAEMON_SURVEILLANCE_VIEW' && (
        <DaemonSurveillanceCard data={view} />
      )}

      {/* 食源性疾病专属生成式组件 */}
      {view.type === 'FOODBORNE_CLUSTER_RADAR' && (
        <FoodborneClusterRadar data={view} />
      )}

      {view.type === 'MOLECULAR_PHYLOGENY_TREE' && (
        <MolecularPhylogenyTree data={view} />
      )}

      {view.type === 'FOOD_RISK_RANKING' && (
        <FoodRiskRankingChart data={view} />
      )}

      {view.type === 'OUTBREAK_DISPOSAL_WORKFLOW' && (
        <OutbreakEpidemiologyCard data={view} />
      )}

      {/* 环境健康风险因素专属生成式组件 */}
      {view.type === 'WATER_PIPELINE_GIS_MAP' && (
        <WaterPipelineGisMap data={view} />
      )}

      {view.type === 'SEWAGE_LAG_CORRELATION' && (
        <SewageLagCorrelationChart data={view} />
      )}

      {view.type === 'AIR_CLIMATE_HEALTH_RISK' && (
        <AirClimateHealthRiskCard data={view} />
      )}

      {view.type === 'RIVER_BASIN_POLLUTION_CHAIN' && (
        <RiverBasinPollutionChainCard data={view} />
      )}

      {view.type === 'ENV_SCENARIO_SIMULATION' && (
        <EnvScenarioSimulationCard data={view} />
      )}

      {view.type === 'ENV_OCR_ENTRY_VIEW' && (
        <EnvOcrEntryCard data={view} />
      )}

      {/* 死因慢病及伤害综合监测专属生成式组件 */}
      {view.type === 'DEATH_CERT_QC_VIEW' && (
        <DeathCertQcCard data={view} />
      )}

      {view.type === 'ICD10_INFERENCE_VIEW' && (
        <Icd10InferenceCard data={view} />
      )}

      {view.type === 'RARE_MORTALITY_CLUSTER_VIEW' && (
        <RareMortalityClusterCard data={view} />
      )}

      {view.type === 'CHRONIC_RISK_FORECAST_VIEW' && (
        <ChronicRiskForecastCard data={view} />
      )}

      {view.type === 'INJURY_ATTRIBUTION_TREE_VIEW' && (
        <InjuryAttributionTreeCard data={view} />
      )}

      {(view.type === 'LIFE_TABLE_GAUGE' || view.type === 'CHRONIC_DEATH_REPORT') && (
        <LifeTable4q70ReportCard data={view} />
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
