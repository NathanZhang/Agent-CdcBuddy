import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {beforeAll,afterAll,it,expect} from 'vitest';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {executeSkill} from '@/application/skills/skill-service';
import {createDevelopmentContext} from '@/lib/skills/server-executor';
import {getAppBusinessProvider} from '@/lib/db/app-business-provider';
import {QueryResultVisualization} from '@/components/ag-ui/QueryResultVisualization';
const dir=mkdtempSync(join(tmpdir(),'cdc-custom-chart-')),previous=process.env.APP_BUSINESS_DB_PATH;
beforeAll(()=>process.env.APP_BUSINESS_DB_PATH=join(dir,'business.db'));
afterAll(()=>{getAppBusinessProvider().close();if(previous===undefined)delete process.env.APP_BUSINESS_DB_PATH;else process.env.APP_BUSINESS_DB_PATH=previous;rmSync(dir,{recursive:true,force:true});});
const sql='SELECT l.city AS city,COUNT(*) AS n FROM fact_monitoring f JOIN dim_location l ON f.location_id=l.location_id GROUP BY l.city';
it.each(['bar','pie','trend'] as const)('persists and executes the configured %s against the same rows',async chartType=>{
 const ctx=createDevelopmentContext('vector'),visualization={kind:chartType==='trend'?'line':chartType,xKey:'city',yKey:'n',unit:'记录'};
 const made=await executeSkill('skill_meta_custom_builder',{skillName:chartType,sqlQuery:sql,chartType,visualization},ctx);expect(made.status).toBe('SUCCESS');
 const id=(made.payload as any).skill.id;const stored=await getAppBusinessProvider().getCustomSkillById(id);expect(JSON.parse(stored!.visualization_json!)).toEqual(visualization);
 const run=await executeSkill(id,{},ctx);expect(run.status).toBe('SUCCESS');expect((run.payload as any).visualization).toEqual(visualization);expect((run.payload as any).data).toEqual((made.payload as any).previewData);
 const html=renderToStaticMarkup(<QueryResultVisualization rows={(run.payload as any).data} spec={(run.payload as any).visualization}/>);expect(html).toContain(`data-visualization="${visualization.kind}"`);
});
it('validates edits before persisting, retains unspecified metadata and supports clearing to a table',async()=>{
 const ctx=createDevelopmentContext('vector');const made=await executeSkill('skill_meta_custom_builder',{skillName:'editable',description:'keep me',sqlQuery:sql,chartType:'bar',visualization:{kind:'bar',xKey:'city',yKey:'n',unit:'记录'}},ctx);const id=(made.payload as any).skill.id;
 const invalid=await executeSkill('skill_catalog_manage',{action:'update',skillId:id,visualization:{kind:'bar',xKey:'city',yKey:'missing',unit:'记录'}},ctx);expect(invalid.status).toBe('FAILED');
 expect(JSON.parse((await getAppBusinessProvider().getCustomSkillById(id))!.visualization_json!).yKey).toBe('n');
 const update=await executeSkill('skill_catalog_manage',{action:'update',skillId:id,name:'renamed'},ctx);expect(update.status).toBe('SUCCESS');expect((await getAppBusinessProvider().getCustomSkillById(id))!.description).toBe('keep me');
 const clear=await executeSkill('skill_catalog_manage',{action:'update',skillId:id,chartType:'table',visualization:null},ctx);expect(clear.status).toBe('SUCCESS');expect((await executeSkill(id,{},ctx)).payload).not.toHaveProperty('visualization');
});
it('requires configured columns, numeric values and compatible chart types',async()=>{
 const ctx=createDevelopmentContext('vector');
 for(const args of [{chartType:'bar'},{chartType:'bar',visualization:{kind:'line',xKey:'city',yKey:'n',unit:'记录'}},{chartType:'bar',visualization:{kind:'bar',xKey:'city',yKey:'city',unit:'记录'}}]){
  const made=await executeSkill('skill_meta_custom_builder',{skillName:'invalid',sqlQuery:sql,...args},ctx);expect(made.status).toBe('FAILED');
 }
 expect((await getAppBusinessProvider().getAllCustomSkills('vector')).some(s=>s.name==='invalid')).toBe(false);
});
it('persists maps only with genuine coordinate bindings and publishes the stored map',async()=>{
 const ctx=createDevelopmentContext('vector');const visualization={kind:'map',latKey:'lat',lonKey:'lon',labelKey:'label',idKey:'id'};
 const sqlQuery='SELECT location_id AS id,latitude AS lat,longitude AS lon,street AS label FROM dim_location LIMIT 3';
 const made=await executeSkill('skill_meta_custom_builder',{skillName:'map',sqlQuery,chartType:'map',visualization},ctx);expect(made.status).toBe('SUCCESS');
 const run=await executeSkill((made.payload as any).skill.id,{}, {...ctx,callId:'map-call'});expect(run.status).toBe('SUCCESS');expect((run.payload as any).spatialIssue).toBeUndefined();expect((run.payload as any).spatialOutputs[0].geometry.features.length).toBeGreaterThan(0);
 const invalid=await executeSkill('skill_meta_custom_builder',{skillName:'fake-map',sqlQuery:'SELECT 34 AS lat,113 AS lon,city AS label FROM dim_location LIMIT 1',chartType:'map',visualization:{kind:'map',latKey:'lat',lonKey:'lon',labelKey:'label'}},ctx);expect(invalid.status).toBe('FAILED');expect(invalid.error?.message).toContain('SPATIAL_BINDING_REQUIRED');
});
it('keeps legacy chart records usable as explicit unconfigured tables',async()=>{
 const ctx=createDevelopmentContext('vector');await getAppBusinessProvider().saveCustomSkill({skill_id:'custom_skill_legacy',name:'legacy',description:'',category:'custom',sql_query:sql,chart_type:'bar',recommended_prompts:'',domain:'vector',created_by:ctx.principal.userId,created_at:new Date().toISOString()});
 const run=await executeSkill('custom_skill_legacy',{},ctx);expect(run.status).toBe('SUCCESS');expect(run.payload).not.toHaveProperty('visualization');expect(run.qualityFlags).toContain('legacy-visualization-unconfigured');
});
it('renders zero pie totals as insufficient to compute proportions',()=>{
 const html=renderToStaticMarkup(<QueryResultVisualization rows={[{label:'zero',n:0}]} spec={{kind:'pie',xKey:'label',yKey:'n',unit:'记录'}}/>);expect(html).toContain('缺少正数总量');expect(html).not.toContain('NaN');
});
