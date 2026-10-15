import {it,expect} from 'vitest';
import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {ThemeProvider} from '@/lib/theme/theme-context';
import {GenerativeComponentRenderer} from '@/components/ag-ui/GenerativeComponentRenderer';
import {createSkillService,executeSkill} from '@/application/skills/skill-service';
import type {ExecutionContext} from '@/contracts/execution-context';
const ctx:ExecutionContext={runId:'input-failure-test',domain:'vector',deploymentTier:'local',principal:{userId:'science-test',role:'PROVINCIAL_ADMIN',organizationId:'test',domainGrants:['vector'],jurisdiction:{},mode:'dev'}};
it('renders new and restored missing-input results in Chinese in both display modes',()=>{
 for(const compact of [false,true])for(const reason of ['当前范围内没有有效监测数据，请补充记录。',"Execution failed on sql 'SELECT * FROM fact_vector_exposure': no such table: fact_vector_exposure"]){
  const html=renderToStaticMarkup(<ThemeProvider><GenerativeComponentRenderer isCompact={compact} view={{type:'ANALYTICS_RESULT',title:'气象融合密度 GBDT',status:'INSUFFICIENT_DATA',method:'vector-assessment-inputs-v1',data:{reason,qualityFlags:['model-inputs-missing-no-fabricated-estimate']}}}/></ThemeProvider>);
  expect(html).not.toMatch(/SELECT|no such table|Execution failed on sql/);expect(html).toContain('数据不足');expect(html).toContain('补充');expect(html).toContain('未生成或补造估计结果');
 }
});
it('does not expose SQLite failures returned by a TypeScript skill',async()=>{
 const service=createSkillService([{id:'fault',aliases:[],domain:'vector',name:'缺表测试',requirementIds:[],availability:'available',method:'sourced-vector-knowledge-v1',allowedOperations:['read'],inputSchema:{type:'object'},outputSchema:{type:'object'},execute:async()=>{throw new Error('no such table: internal_table');}}]);
 const result=await service.executeSkill('fault',{},ctx);
 expect(result.status).toBe('FAILED');expect(result.error?.message).toContain('缺少');expect(result.error?.message).not.toContain('internal_table');
});
it('local knowledge retrieval does not require a monitoring database',async()=>{
 const old=process.env.DATASET_MANIFEST_PATH;process.env.DATASET_MANIFEST_PATH='/unavailable-input-fixture/manifest.json';
 try{const result=await executeSkill('skill_vector_nlq',{question:'白纹伊蚊的鉴别要点'},ctx);expect(result.status).toBe('SUCCESS');expect(result.datasets).toEqual([]);}
 finally{if(old===undefined)delete process.env.DATASET_MANIFEST_PATH;else process.env.DATASET_MANIFEST_PATH=old;}
});
