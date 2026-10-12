import {loadDatasetManifest} from '@/infrastructure/db/dataset-manifest';
import {describe,it,expect} from 'vitest';
import {executeSkill,listSkillDefinitions} from '@/application/skills/skill-service';
import type {ExecutionContext} from '@/contracts/execution-context';
const ctx:ExecutionContext={runId:'vector-method-real',domain:'vector',deploymentTier:'local',principal:{userId:'science-test',role:'PROVINCIAL_ADMIN',organizationId:'test',domainGrants:['vector'],jurisdiction:{},mode:'dev'}};
describe('verified vector subcapabilities via actual Skills and bounded runner',()=>{
 it('forecast uses explicit cutoff and sampling method with observed provenance',async()=>{
  const r=await executeSkill('skill_population_dynamics',{city:'郑州市',methodName:'诱蚊灯法',asOf:'2023-12-31',dataWindow:36,forecastMonths:2},ctx);
  expect(r.status).toBe('SUCCESS');expect(r.datasets[0]).toEqual(loadDatasetManifest().find(d=>d.domain==='vector'));expect((r.payload as any).type).toBe('ANALYTICS_RESULT');expect((r.payload as any).data.groups[0].trainingWindow.end<='2023-12').toBe(true);expect((r.payload as any).data.groups[0].forecasts).toHaveLength(2);expect((r.payload as any).data.groups[0].forecasts.map((p:any)=>p.period)).toEqual(['2024-01','2024-02']);expect((r.payload as any).data.groups[0].unit).toBe('captures/record');
 },20000);
 it('missing geographic scope cannot invent IDW points',async()=>{const r=await executeSkill('skill_spatial_early_warning',{city:'郑州市',district:'不存在区',methodName:'诱蚊灯法'},ctx);expect(r.status).toBe('NO_DATA');expect(r.payload).toBeNull();},20000);
 it('rolling holdouts are reachable through the main Skill contract with real provenance',async()=>{const r=await executeSkill('skill_vector_backtest',{city:'郑州市',methodName:'诱蚊灯法',asOf:'2025-11-11',horizon:1,model:'ar'},ctx);expect(r.status).toBe('SUCCESS');expect(r.metrics.mae.evaluationKind).toBe(r.datasets[0].origin==='observed'?'real-backtest':'synthetic');expect((r.payload as any).data.evaluatedPairs).toBeGreaterThan(0);expect((r.payload as any).data.groups[0].baselineMae).toBeTypeOf('number');},20000);
 it('models with missing training and genotype remain unavailable',async()=>{for(const id of ['skill_lstm_predictor','skill_resistance_evolution']){const d=listSkillDefinitions('vector').find(d=>d.id===id);if(d)expect(d.availability).toBe('planned');}expect((await executeSkill('skill_resistance_evolution',{},ctx)).error?.code).toBe('CAPABILITY_UNAVAILABLE');});
});
