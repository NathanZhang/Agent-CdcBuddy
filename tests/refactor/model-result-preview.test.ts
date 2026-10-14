import {expect,it} from 'vitest';
import {modelResultPreview} from '@/application/agent/model-result-preview';
import {isCorrectedSkillRun} from '@/application/agent/query-recovery';
import {scopedViewConstraints} from '@/infrastructure/query/scoped-view';
it('bounds nested model context without modifying complete workbench evidence',()=>{
 const rows=Array.from({length:300},(_,n)=>({n,history:Array.from({length:82},(_,t)=>({t,value:t}))}));
 const full={type:'ANALYTICS_RESULT',data:{rows,validation:{rmse:.5}}};
 const preview=modelResultPreview(full) as any;
 expect(preview.data.rows.returnedCount).toBe(300);expect(preview.data.rows.preview).toHaveLength(10);
 expect(preview.data.rows.preview[0].history).toMatchObject({previewOnly:true,returnedCount:82});
 expect(preview.data.validation).toEqual({rmse:.5});expect(full.data.rows).toHaveLength(300);expect(rows[0].history).toHaveLength(82);
 expect(JSON.stringify(preview).length).toBeLessThan(JSON.stringify(full).length/20);
});
const query=(sql:string,failed=false):any=>({callId:failed?'failed':'later',skillId:'skill_foodborne_case_table',args:{sql},result:{status:failed?'FAILED':'SUCCESS',method:'bounded-domain-query-v1',payload:failed?null:{data:[{n:5}]},...(failed?{error:{code:'SCOPE_MISMATCH'}}:{})}});
it('resolves a scope-rejected read only after the equivalent approved query succeeds',()=>{
 const failed=query('SELECT city, COUNT(*) AS n FROM fact_foodborne_case WHERE cluster_id IS NOT NULL GROUP BY city HAVING COUNT(*)>2',true);
 expect(isCorrectedSkillRun(failed,query('SELECT city, COUNT(*) AS n FROM fact_foodborne_case GROUP BY city'))).toBe(true);
 expect(isCorrectedSkillRun(failed,query('SELECT city, COUNT(*) AS n FROM fact_foodborne_case GROUP BY city,district'))).toBe(false);
 expect(isCorrectedSkillRun(failed,query('SELECT city, COUNT(*) AS n FROM fact_outbreak_event GROUP BY city'))).toBe(false);
 expect(isCorrectedSkillRun(failed,query('SELECT city, COUNT(*) AS n FROM fact_foodborne_case GROUP BY city',true))).toBe(false);
 const denied=query('SELECT city, COUNT(*) AS n FROM fact_foodborne_case GROUP BY city',true);denied.result.error.code='FORBIDDEN_REGION';
 expect(isCorrectedSkillRun(denied,query(denied.args.sql))).toBe(false);
});
it('maps species names to category without discarding other approved filters',()=>{
 const constraints=scopedViewConstraints('fact_vector_exposure',['city','monitoring_date','species_name'],{domain:'vector',regionPaths:[{city:'郑州市'}],from:'2024-01-01',filters:{category:{field:'category',operator:'eq',values:['蚊']}}} as any,s=>`'${s}'`);
 expect(constraints.join(' AND ')).toContain('species_name IN (SELECT species_name FROM main.dim_species WHERE category=');
 expect(constraints.join(' AND ')).toContain('郑州市');
});

it('keeps task and report results from becoming phantom missing map layers',async()=>{
 const {registerSpatialRun}=await import('@/application/agent/region-turn');
 const turn:any={plan:{base:{draft:{task:'map_with_data'},fingerprint:'scope'},layerPlans:[{request:{skillId:'skill_spatial_early_warning'},layerRequestId:'grid'}]},outputs:[],requests:[]};
 registerSpatialRun(turn,{callId:'job',skillId:'skill_job_manage',args:{action:'list'},result:{runId:'run',status:'SUCCESS',payload:{type:'ANALYTICS_RESULT',data:{jobs:[]}}}} as any);
 expect(turn.requests).toEqual([]);
 registerSpatialRun(turn,{callId:'grid',skillId:'skill_spatial_early_warning',args:{layerRequestId:'grid'},result:{runId:'run',status:'INSUFFICIENT_DATA',payload:null}} as any);
 expect(turn.requests).toHaveLength(1);expect(turn.requests[0].sourceOutcome.status).toBe('INSUFFICIENT_DATA');
});

it('does not request write approval for read-only risk inspection but still gates task creation',async()=>{
 const {verifyWriteIntent}=await import('@/application/agent/write-intent');
 const {listSkillDefinitions}=await import('@/application/skills/skill-service');
 const skill=listSkillDefinitions('vector').find(s=>s.id==='skill_alert_push_dispatch')!;
 let calls=0;const llm:any={complete:async()=>{calls++;return {role:'assistant',content:'{"authorized":false,"reason":"当前仅查询"}'};}};
 const interaction:any={kind:'conversation',userInput:'核对预警阈值与触发依据'};
 await verifyWriteIntent(interaction,skill,{analysis:'signals'},llm);
 expect(calls).toBe(0);
 await expect(verifyWriteIntent(interaction,skill,{createTask:true},llm)).rejects.toThrow('当前仅查询');
 expect(calls).toBe(1);
});

it('recovers an authorized scope-parameter correction while preserving algorithm failures',()=>{
 const failed:any={skillId:'skill_mortality_cluster_rare',args:{analysis:'mortality',city:'郑州市'},result:{method:'chronic-validated-assessment-v1',status:'FAILED',error:{code:'SCOPE_MISMATCH'}}};
 const later:any={...failed,args:{analysis:'mortality'},result:{method:failed.result.method,status:'SUCCESS',payload:{data:{districts:[{}]}}}};
 expect(isCorrectedSkillRun(failed,later)).toBe(true);
 expect(isCorrectedSkillRun(failed,{...later,args:{analysis:'rare'}})).toBe(false);
 expect(isCorrectedSkillRun({...failed,result:{...failed.result,error:{code:'FORBIDDEN_REGION'}}},later)).toBe(false);
});

it('recovers quote-only SQL identifier repairs without accepting changed predicates or projections',()=>{
 const failed=query('SELECT city AS 地市, COUNT(*) AS 数量 FROM fact_foodborne_case GROUP BY city',true);failed.result.error.code='EXECUTION_FAILED';
 expect(isCorrectedSkillRun(failed,query('SELECT city AS "地市", COUNT(*) AS "数量" FROM fact_foodborne_case GROUP BY city'))).toBe(true);
 expect(isCorrectedSkillRun(failed,query('SELECT city AS "地市", SUM(case_id) AS "数量" FROM fact_foodborne_case GROUP BY city'))).toBe(false);
});

it('recovers a rejected scope query when its visualization key is corrected to the same projected column',()=>{
 const failed=query('SELECT city AS "地市",COUNT(*) AS n FROM fact_foodborne_case WHERE city=\'郑州市\' GROUP BY city',true);failed.args.visualization={kind:'map',regionCodeKey:'city',valueKey:'n'};
 const later=query('SELECT city AS "地市",COUNT(*) AS n FROM fact_foodborne_case GROUP BY city');later.args.visualization={kind:'map',regionCodeKey:'地市',valueKey:'n'};
 expect(isCorrectedSkillRun(failed,later)).toBe(true);
 expect(isCorrectedSkillRun(failed,{...later,args:{...later.args,visualization:{...later.args.visualization,regionCodeKey:'district'}}})).toBe(false);
});

it('binds workflow intents with explicit data scope to the real dataset and enforces jurisdiction',async()=>{
 const {approveIntent}=await import('@/application/agent/intent-guard');
 const {loadRegionCatalog}=await import('@/infrastructure/geo/region-catalog');
 const {createDevelopmentContext}=await import('@/lib/skills/server-executor');
 const {mkdtempSync,rmSync}=await import('node:fs');const {tmpdir}=await import('node:os');const {join}=await import('node:path');
 const {observedWorkflowFixture}=await import('./fixtures/observed-workflow-context');
 const directory=mkdtempSync(join(tmpdir(),'cdc-workflow-intent-'));const restore=observedWorkflowFixture(directory);
 try {
 const ctx=createDevelopmentContext('vector');
 const draft:any={task:'other',relation:'new',displayRegion:null,dataRegion:{includeCodes:['410105'],excludeCodes:[],catalogVersion:loadRegionCatalog().version},time:{from:'2024-01-01',to:'2024-12-31'},filters:{},layerRequests:[],mapOperations:[],mapOptions:{basemap:'vec'}};
 const approved=approveIntent(draft,ctx);
 expect(approved.datasetVersion).not.toMatch(/^map-catalog:/);
 expect(approved.effectiveDataScope.region.includeCodes).toEqual(['410105']);
 expect(approveIntent({...draft,dataRegion:null,time:null},ctx).datasetVersion).toMatch(/^map-catalog:/);
 const restricted={...ctx,principal:{...ctx.principal,role:'CITY_EXPERT' as const,jurisdiction:{city:'洛阳市'}}};
 expect(()=>approveIntent(draft,restricted)).toThrow('Requested geography exceeds server jurisdiction');
 }finally{restore();rmSync(directory,{recursive:true,force:true});}
});
