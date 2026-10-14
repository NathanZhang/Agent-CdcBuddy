import Ajv from 'ajv';
import {computeResultStatistics,resultStatisticsSource} from './result-statistics';
import type { AgentDomain, DatasetRef } from './dataset';
export const RESULT_STATUSES = ['SUCCESS','NO_DATA','INSUFFICIENT_DATA','FAILED','REVIEW_REQUIRED','CANCELLED'] as const;
export type ResultStatus = typeof RESULT_STATUSES[number];
export interface MetricEvidence {
  value: number | null;
  evaluationKind: 'unvalidated' | 'computed' | 'synthetic' | 'real-backtest';
  datasetIds: string[];
  definition: string;
}
export interface SkillResult<T = unknown> {
  schemaVersion: '1';
  runId: string;
  domain: AgentDomain;
  status: ResultStatus;
  method: string;
  datasets: DatasetRef[];
  payload: T | null;
  metrics: Record<string, MetricEvidence>;
  qualityFlags: string[];
  error?: { code: string; message: string; retryable: boolean } | null;
}
const nonempty = {type:'string',minLength:1};
const schema = {
  type:'object',additionalProperties:false,
  required:['schemaVersion','runId','domain','status','method','datasets','payload','metrics','qualityFlags'],
  properties:{
    schemaVersion:{const:'1'},runId:nonempty,domain:{enum:['vector','foodborne','env','chronic']},status:{enum:RESULT_STATUSES},method:nonempty,payload:{},
    datasets:{type:'array',items:{type:'object',additionalProperties:false,required:['id','domain','origin','version','asOf','schemaVersion'],properties:{id:nonempty,domain:{enum:['vector','foodborne','env','chronic']},origin:{enum:['observed','mock']},version:nonempty,asOf:{type:'string',pattern:'^\\d{4}-\\d{2}-\\d{2}$'},schemaVersion:nonempty}}},
    metrics:{type:'object',additionalProperties:{type:'object',additionalProperties:false,required:['value','evaluationKind','datasetIds','definition'],properties:{value:{type:['number','null']},evaluationKind:{enum:['unvalidated','computed','synthetic','real-backtest']},datasetIds:{type:'array',items:nonempty,uniqueItems:true},definition:nonempty}}},
    qualityFlags:{type:'array',items:nonempty,uniqueItems:true},error:{type:['object','null'],additionalProperties:false,required:['code','message','retryable'],properties:{code:nonempty,message:nonempty,retryable:{type:'boolean'}}}
  }
};
const validate = new Ajv({allErrors:true,strictNumbers:true}).compile(schema);
function assertFinite(value: unknown): void {
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Nonfinite result number');
  if (Array.isArray(value)) value.forEach(assertFinite);
  else if (value && typeof value === 'object') Object.values(value).forEach(assertFinite);
}
export function validateSkillResult<T = unknown>(value: unknown): SkillResult<T> {
  if (!validate(value)) throw new Error(`Invalid SkillResult: ${JSON.stringify(validate.errors)}`);
  const result = value as unknown as SkillResult<T>;
  assertFinite(result);
  const payload = result.payload as {type?: string; data?: unknown; statistics?: unknown} | null;
  const statisticsSource = resultStatisticsSource(payload);
  if (payload?.statistics !== undefined && statisticsSource && JSON.stringify(payload.statistics) !== JSON.stringify(computeResultStatistics(statisticsSource.data, statisticsSource.path))) throw new Error('Result statistics do not match executed data');
  if (['NO_DATA','FAILED','CANCELLED'].includes(result.status) && result.payload !== null) throw new Error(`${result.status} must have null payload`);
  if (result.status === 'SUCCESS' && result.payload === null) throw new Error('SUCCESS requires an executed payload');
  if (result.status === 'FAILED' && !result.error) throw new Error('FAILED requires error evidence');
  const ids = new Set(result.datasets.map(d => d.id));
  if (ids.size !== result.datasets.length) throw new Error('Duplicate result datasets');
  for (const metric of Object.values(result.metrics)) {
    if (metric.evaluationKind === 'unvalidated' && metric.value !== null) throw new Error('Unvalidated metric must be null');
    if (metric.datasetIds.some(id => !ids.has(id))) throw new Error('Unknown metric dataset');
  }
  return result;
}
