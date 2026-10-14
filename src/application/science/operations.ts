import type {ExecutionContext} from '@/contracts/execution-context';
import type {ArtifactRef,ArtifactKind,ScientificArtifact,EffortUnit} from '@/contracts/scientific-artifact';
import {nextPeriod} from '@/contracts/scientific-artifact';
import {aggregateMeasurement,buildFeatureMatrix,buildSeriesSet,metricUnit,measurementDefinition,periodStart,type MeasurementMetric} from './artifact-builders';
import {readScientificArtifact,saveScientificArtifact} from './artifact-store';
import {loadMeasurementRows} from './measurements';
import {runScienceKernel} from './kernels';
export type ScienceOperation='measurements'|'scan'|'scan-select'|'features'|'kmeans'|'cluster-select'|'series';
export const operationInputs:Record<ScienceOperation,Record<string,ArtifactKind>>={measurements:{},scan:{measurements:'Measurements'},'scan-select':{scan:'ScanResult'},features:{measurements:'Measurements',selection:'SelectionSet'},kmeans:{matrix:'FeatureMatrix'},'cluster-select':{clusters:'ClusterSet'},series:{measurements:'Measurements',selection:'SelectionSet'}};
export const operationOutputs:Record<ScienceOperation,ArtifactKind>={measurements:'Measurements',scan:'ScanResult','scan-select':'SelectionSet',features:'FeatureMatrix',kmeans:'ClusterSet','cluster-select':'SelectionSet',series:'SeriesSet'};
/** Shared lineage must reach this exact immutable snapshot, never just the same dataset ID. */
export function containsMeasurement(ref:ArtifactRef,target:ArtifactRef,ctx:ExecutionContext,depth=0):boolean{
 if(depth>16)throw Error('ARTIFACT_LINEAGE_LIMIT');if(ref.artifactId===target.artifactId)return true;
 return readScientificArtifact(ref,ctx,{kind:ref.kind}).dependencies.some(p=>containsMeasurement(p,target,ctx,depth+1));
}
export async function executeScienceOperation(operation:ScienceOperation,inputs:Record<string,ArtifactRef>,params:Record<string,any>,window:{from:string;to:string},ctx:ExecutionContext):Promise<ScientificArtifact>{
 ctx.signal?.throwIfAborted();const kind=operationOutputs[operation],skillId=`science:${operation}`;
 const artifacts=Object.fromEntries(Object.entries(operationInputs[operation]).map(([key,expected])=>[key,readScientificArtifact(inputs[key],ctx,{kind:expected,requireComplete:true,...(operation==='kmeans'?{requireFinite:true}:{})})]));
 const dependencies=Object.values(artifacts).map(a=>a.ref);
 const save=(data:any,unit:string,frequency:ScientificArtifact['frequency'],definition:string,flags:string[]=[])=>{ctx.signal?.throwIfAborted();return saveScientificArtifact({kind,data,unit,frequency,measurementDefinition:definition,timeWindow:window,asOf:window.to,objectKeys:kind==='SeriesSet'?['locationKey','methodId','speciesId']:['locationKey'],qualityFlags:flags,dependencies,skillId},ctx);};
 if(operation==='measurements'){
  const {measurements}=loadMeasurementRows(params,ctx,params.maxRecords??50000);if(!measurements.complete)throw Error('ARTIFACT_INCOMPLETE');
  const records=measurements.records.filter(r=>r.date>=window.from&&r.date<=window.to);if(!records.length)throw Error('SCIENCE_NO_MEASUREMENTS');
  return save({records,matchedRecords:records.length,complete:true},'capture','record','observed-capture-records-v1',records.some(r=>r.visitId===null)?['legacy-visit-unresolved','legacy-effort-semantics-unvalidated']:[]);
 }
 if(operation==='scan'){
  const source=artifacts.measurements as ScientificArtifact<'Measurements'>,rows=source.data.records.filter(r=>r.date>=window.from&&r.date<=window.to);
  if(new Set(rows.map(r=>r.methodId)).size!==1)throw Error('MEASUREMENT_METHOD_REQUIRED');
  const groups=new Map<string,typeof rows>();for(const row of rows){const group=groups.get(row.locationKey)??[];group.push(row);groups.set(row.locationKey,group);}
  const exposure=params.exposure??'record',effortUnit=params.effortUnit as EffortUnit|undefined;
  const sites=[...groups].sort(([a],[b])=>a.localeCompare(b)).map(([locationKey,rs])=>{
   const r=rs[0];if(typeof r.latitude!=='number'||typeof r.longitude!=='number'||rs.some(other=>other.latitude!==r.latitude||other.longitude!==r.longitude))throw Error('SCAN_COORDINATES_REQUIRED');
   const aggregate=aggregateMeasurement(rs,exposure==='effort'?'capture-per-effort':'capture-count',effortUnit);
   if(aggregate.captureCount===null||exposure==='effort'&&aggregate.effort===null)throw Error('SCAN_EXPOSURE_REQUIRED');
   return {locationKey,latitude:r.latitude,longitude:r.longitude,count:aggregate.captureCount,exposure:exposure==='effort'?aggregate.effort:rs.length};
  });
  if(sites.length<3||sites.length>500)throw Error('SCAN_SITE_BUDGET_OR_INSUFFICIENT');
  const data=await runScienceKernel('scan',{sites,exposureUnit:exposure==='effort'?effortUnit:'record'},{maxRadiusKm:params.maxRadiusKm??120,pThreshold:params.pThreshold??.05,simulations:params.simulations??99,seed:params.seed??42},ctx);
  return save(data,'capture','none','conditional-poisson-circular-scan-v1',['approximate-circular-scan-not-full-satscan',...(exposure==='record'?['record-exposure-not-standard-sampling-effort']:[])]);
 }
 if(operation==='scan-select'){
  const source=artifacts.scan as ScientificArtifact<'ScanResult'>;if(params.clusterIds?.some((id:string)=>!source.data.clusters.some(c=>c.id===id)))throw Error('SELECTION_MEMBERSHIP_INVALID');
  const locationKeys=[...new Set(source.data.clusters.filter(c=>!params.clusterIds||params.clusterIds.includes(c.id)).flatMap(c=>c.locationKeys))].sort();return save({locationKeys},'location','none',source.measurementDefinition);
 }
 if(operation==='kmeans'){
  const source=artifacts.matrix as ScientificArtifact<'FeatureMatrix'>;const data=await runScienceKernel('kmeans',source.data,{k:params.k??3,seed:params.seed??42},ctx);return save(data,'cluster','none',source.measurementDefinition,['exploratory-clusters-not-risk-classes']);
 }
 if(operation==='cluster-select'){
  const source=artifacts.clusters as ScientificArtifact<'ClusterSet'>;if(params.labels?.some((label:number)=>!source.data.assignments.some(a=>a.cluster===label)))throw Error('SELECTION_MEMBERSHIP_INVALID');
  const locationKeys=source.data.assignments.filter(a=>!params.labels||params.labels.includes(a.cluster)).map(a=>a.locationKey).sort();return save({locationKeys},'location','none',source.measurementDefinition,['fixed-members-from-cluster-snapshot']);
 }
 const measurements=artifacts.measurements as ScientificArtifact<'Measurements'>,selection=artifacts.selection as ScientificArtifact<'SelectionSet'>;
 if(!containsMeasurement(selection.ref,measurements.ref,ctx))throw Error('SELECTION_SOURCE_MISMATCH');
 const rows=measurements.data.records.filter(r=>r.date>=window.from&&r.date<=window.to);const dataSource={records:rows,complete:true,matchedRecords:rows.length};
 const metric=params.metric as MeasurementMetric,unit=params.effortUnit as EffortUnit|undefined;
 if(operation==='features'){
  const data=buildFeatureMatrix(dataSource,selection.data,metric,unit,params.features);return save(data,'mixed','none',measurementDefinition(metric,unit),data.values.some(r=>r.some(v=>v===null))?['missing-feature-values']:[]);
 }
 const data=buildSeriesSet(dataSource,selection.data,metric,params.frequency,window,unit);const end=new Date(nextPeriod(periodStart(window.to,params.frequency),params.frequency)+'T00:00:00Z');end.setUTCDate(end.getUTCDate()-1);
 const flags=[...(data.series.some(s=>s.points.some(p=>p.value===null))?['missing-periods-or-effort-not-imputed']:[]),...(periodStart(window.from,params.frequency)!==window.from||end.toISOString().slice(0,10)!==window.to?['partial-calendar-periods']:[])];
 return save(data,metricUnit(metric,unit),params.frequency,measurementDefinition(metric,unit),flags);
}
