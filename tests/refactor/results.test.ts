import { describe, it, expect } from 'vitest';
import { validateSkillResult } from '@/contracts/skill-result';

const result = { schemaVersion:'1',runId:'run-test',domain:'env',status:'SUCCESS',method:'water-summary-v1',datasets:[{id:'env-fixture',domain:'env',origin:'mock',version:'1',asOf:'2026-08-31',schemaVersion:'1'}],payload:{sampleCount:3,passRate:66.67},metrics:{passRate:{value:66.67,evaluationKind:'computed',datasetIds:['env-fixture'],definition:'passed samples / total * 100'}},qualityFlags:[] };
describe('skill results', () => {
  it('retains real payloads and provenance after validation', () => {
    expect(validateSkillResult(result)).toEqual(result);
  });
  it('forbids invented unvalidated metrics', () => {
    const invalid = {...result, metrics:{accuracy:{value:0.965,evaluationKind:'unvalidated',datasetIds:['env-fixture'],definition:'unmeasured model accuracy'}}};
    expect(() => validateSkillResult(invalid)).toThrow();
    expect(validateSkillResult({...invalid,metrics:{accuracy:{...invalid.metrics.accuracy,value:null}}}).metrics.accuracy.value).toBeNull();
  });
  it.each(['NO_DATA','FAILED','CANCELLED'])('forbids a successful payload with %s', status => {
    expect(() => validateSkillResult({...result,status})).toThrow();
    const empty = {...result,status,payload:null,error:status==='FAILED'?{code:'COMPUTATION_FAILED',message:'failed',retryable:false}:undefined};
    expect(validateSkillResult(empty).payload).toBeNull();
  });
  it('rejects unknown provenance, dangling metric datasets and nonfinite numbers', () => {
    expect(() => validateSkillResult({...result,datasets:[{...result.datasets[0],origin:'demo'}]})).toThrow();
    expect(() => validateSkillResult({...result,metrics:{x:{...result.metrics.passRate,datasetIds:['missing']}}})).toThrow();
    expect(() => validateSkillResult({...result,payload:{value:NaN}})).toThrow();
  });
});
