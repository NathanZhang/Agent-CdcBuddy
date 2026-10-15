import {loadDatasetManifest} from '@/infrastructure/db/dataset-manifest';
import {describe,it,expect} from 'vitest';
import {executeSkill,listSkillDefinitions} from '@/application/skills/skill-service';
import type {ExecutionContext} from '@/contracts/execution-context';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {observedWorkflowFixture} from './fixtures/observed-workflow-context';
async function withIncompleteSource(check:()=>Promise<void>){
 const directory=mkdtempSync(join(tmpdir(),'cdc-incomplete-vector-'));
 let restore:(()=>void)|undefined;
 try{restore=observedWorkflowFixture(directory);await check();}
 finally{restore?.();rmSync(directory,{recursive:true,force:true});}
}
const ctx:ExecutionContext={runId:'vector-method-real',domain:'vector',deploymentTier:'local',principal:{userId:'science-test',role:'PROVINCIAL_ADMIN',organizationId:'test',domainGrants:['vector'],jurisdiction:{},mode:'dev'}};
describe('verified vector subcapabilities via actual Skills and bounded runner',()=>{
 it('forecast refuses an uncovered cutoff with isolated observed-policy provenance',async()=>withIncompleteSource(async()=>{
  const r=await executeSkill('skill_population_dynamics',{city:'郑州市',methodName:'诱蚊灯法',asOf:'2024-12-31',dataWindow:36,forecastMonths:2},ctx);
  expect(r.status).toBe('INSUFFICIENT_DATA');expect(r.datasets[0]).toEqual(loadDatasetManifest().find(d=>d.domain==='vector'));expect((r.payload as any).data.reason).toMatch(/缺测时段|截止期/);
  // Actual ARIMA/LSTM predictions and cutoff isolation are exercised in requirement-full-flow and scientific tests.

 }),20000);
 it('missing geographic scope cannot invent IDW points',async()=>{const r=await executeSkill('skill_spatial_early_warning',{city:'郑州市',district:'不存在区',methodName:'诱蚊灯法'},ctx);expect(r.status).toBe('FAILED');expect(r.payload).toBeNull();expect(r.error?.message).toContain('REGION_UNRESOLVED');},20000);
 it('rolling holdouts are reachable through the main Skill contract with real provenance',async()=>{const r=await executeSkill('skill_vector_backtest',{city:'郑州市',methodName:'诱蚊灯法',asOf:'2025-11-11',horizon:1,model:'ar'},ctx);expect(r.status).toBe('SUCCESS');expect(r.metrics.mae.evaluationKind).toBe(r.datasets[0].origin==='observed'?'real-backtest':'synthetic');expect((r.payload as any).data.evaluatedPairs).toBeGreaterThan(0);expect((r.payload as any).data.groups[0].baselineMae).toBeTypeOf('number');},20000);
 it('implemented models disclose missing genotype inputs instead of fabricating evolution',async()=>withIncompleteSource(async()=>{expect(listSkillDefinitions('vector').find(d=>d.id==='skill_resistance_evolution')?.availability).toBe('available');const r=await executeSkill('skill_resistance_evolution',{},ctx);expect(r.status).toBe('INSUFFICIENT_DATA');expect((r.payload as any).data.reason).toContain('抗性基因');expect((r.payload as any).data.reason).not.toContain('SELECT');}));
});
