import Ajv from 'ajv';
import {Parser} from 'node-sql-parser';
import {queryVisualizationSchema,type QueryVisualization} from '@/contracts/query-visualization';
import type {ExecutionContext} from '@/contracts/execution-context';
import {publishSpatialOutputs} from '@/application/geo/spatial-output-service';
import {loadDatasetManifest} from '@/infrastructure/db/dataset-manifest';
import {loadDatasetRegionBindings} from '@/infrastructure/geo/dataset-region-bindings';
const validate=new Ajv({strict:false,allErrors:true}).compile(queryVisualizationSchema);
export function customVisualization(value:unknown,chartType:string,rows:Record<string,any>[],sql:string,ctx?:ExecutionContext):QueryVisualization|undefined {
 if(value===undefined||value===null)return undefined; // Legacy records remain tables until explicitly configured.
 if(chartType==='table')throw Error('VISUALIZATION_TYPE_MISMATCH: 表格类型应清除图表配置');
 if(!validate(value))throw Error('VISUALIZATION_CONFIG_INVALID');
 const spec=value as QueryVisualization;
 if(spec.kind!==(chartType==='trend'?'line':chartType))throw Error('VISUALIZATION_TYPE_MISMATCH');
 if(spec.kind==='map'&&spec.valueKey&&!spec.unit)throw Error('SPATIAL_METRIC_REQUIRED');
 const ast=new Parser().astify(sql,{database:'SQLite'}) as any;
 const fields=(Array.isArray(ast)?ast[0]:ast).columns;
 const names=rows.length?Object.keys(rows[0]):fields.map((f:any)=>f.as??f.expr?.column);
 const keys=spec.kind==='map'?['regionCodeKey' in spec?spec.regionCodeKey:spec.latKey,...('regionCodeKey' in spec?[]:[spec.lonKey]),spec.labelKey,...(spec.valueKey?[spec.valueKey]:[]),...('idKey' in spec&&spec.idKey?[spec.idKey]:[])]:[spec.xKey,spec.yKey];
 if(keys.some(k=>!names.includes(k)))throw Error('VISUALIZATION_FIELD_MISSING: 图表字段必须与SELECT结果列名一致');
 const numeric=spec.kind==='map'?spec.valueKey:spec.yKey;
 if(numeric&&rows.some(r=>r[numeric]!=null&&(typeof r[numeric]!=='number'||!Number.isFinite(r[numeric]))))throw Error('VISUALIZATION_VALUE_INVALID');
 if(spec.kind==='pie'&&rows.some(r=>typeof r[spec.yKey]==='number'&&r[spec.yKey]<0))throw Error('VISUALIZATION_VALUE_INVALID: 饼图不能使用负值');
 if(spec.kind==='map'){
  if(!ctx)throw Error('SPATIAL_BINDING_REQUIRED');
  const datasets=loadDatasetManifest().filter(d=>d.domain===ctx.domain);const callId=ctx.callId??'visualization-validation';
  const source={runId:ctx.runId,callId,skillId:'custom-query-validation',method:'bounded-domain-query-v1',datasetRefs:datasets,scopeFingerprint:ctx.approvedIntent?.fingerprint??'validation',sourceCRS:loadDatasetRegionBindings(ctx.domain,datasets[0].version).sourceCRS};
  publishSpatialOutputs({callId,skillId:source.skillId,skillName:'实际查询图表校验',args:{},result:{schemaVersion:'1',runId:ctx.runId,domain:ctx.domain,status:'SUCCESS',method:source.method,datasets,payload:{type:'DATA_TABLE_VIEW',sql,data:rows,visualization:spec},metrics:{},qualityFlags:[]}},source);
 }
 return spec;
}
