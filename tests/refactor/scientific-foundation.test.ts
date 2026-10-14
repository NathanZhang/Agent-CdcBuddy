import {it,expect,beforeEach,afterEach} from 'vitest';
import {mkdtempSync,rmSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import Database from 'better-sqlite3';
import {observedWorkflowFixture} from './fixtures/observed-workflow-context';
import {createDevelopmentContext} from '@/lib/skills/server-executor';
import {executeSkill} from '@/application/skills/skill-service';
import {readDatasetLocations} from '@/infrastructure/db/dataset-manifest';
import {withBusinessDb} from '@/infrastructure/db/business-store';
import {approveStructuredIntent} from '@/application/agent/structured-intent';
import {readScientificArtifact,saveScientificArtifact} from '@/application/science/artifact-store';
import {stableLocationKey} from '@/application/science/measurements';
import {validateArtifact,type ArtifactRef,type ScientificArtifact} from '@/contracts/scientific-artifact';
import {getDomainRepository} from '@/infrastructure/db/domain-repository';
import {scopeFromArgs} from '@/domains/shared/skill-factory';
import type {ExecutionContext} from '@/contracts/execution-context';
let dir:string,restore:()=>void;const previous=process.env.APP_BUSINESS_DB_PATH;
beforeEach(()=>{dir=mkdtempSync(join(tmpdir(),'cdc-science-'));process.env.APP_BUSINESS_DB_PATH=join(dir,'business.db');restore=observedWorkflowFixture(dir);
 const db=new Database(readDatasetLocations().find(d=>d.domain==='vector')!.path);db.exec("INSERT INTO dim_date VALUES('2024-06-17',2024,6,17,'夏'); INSERT INTO dim_species VALUES('s2','蚊','淡色库蚊','test2'); INSERT INTO dim_method VALUES('m2','粘鼠板法'); INSERT INTO dim_location(location_id,city,district,latitude,longitude) VALUES('l2','郑州市','金水区',34.8,113.7),('foreign','南阳市','宛城区',33,112); INSERT INTO fact_monitoring(monitoring_id,date_id,location_id,species_id,method_id,capture_count,sampling_unit) VALUES('f2','2024-06-15','l','s2','m',15,1),('f3','2024-06-15','l','s','m',10,1),('zero','2024-06-17','l','s','m',0,NULL),('other','2024-06-15','l2','s','m',4,1),('outside','2024-06-15','foreign','s','m',4,1);");db.close();});
afterEach(()=>{restore();if(previous===undefined)delete process.env.APP_BUSINESS_DB_PATH;else process.env.APP_BUSINESS_DB_PATH=previous;rmSync(dir,{recursive:true,force:true});});
const args={city:'郑州市',district:'金水区',from:'2024-06-15',to:'2024-06-17',category:'蚊',methodName:'诱蚊灯法'};
const context=()=>createDevelopmentContext('vector');
async function prepare(ctx=context(),overrides:Record<string,any>={}){const run=await executeSkill('skill_measurement_prepare',{...args,...overrides},ctx);expect(run.error,JSON.stringify(run)).toBeUndefined();const ref=(run.payload as any).data.artifactRef as ArtifactRef;return {run,ref,artifact:readScientificArtifact(ref,ctx,{kind:'Measurements'})};}
async function register(ids=['f','f2'],key='visit-one',unit='trap-hour',effort=2,ctx=context()){return executeSkill('skill_sampling_event_register',{...args,recordIds:ids,sourceEventKey:key,effortUnit:unit,effortValue:effort,evidence:'人工核对原始采样单访次号 '+key},ctx);}
async function select(ref:ArtifactRef,ctx=context(),keys?:string[]){const run=await executeSkill('skill_selection_build',{measurementsRef:ref,...(keys?{locationKeys:keys}:{})},ctx);expect(run.error).toBeUndefined();return (run.payload as any).data.artifactRef as ArtifactRef;}
it('retains unresolved legacy visits and distinguishes co-located source IDs',async()=>{
 const {artifact}=await prepare();expect(artifact.data.records).toHaveLength(5);expect(artifact.data.records.every(r=>r.visitId===null&&r.effortValue===null)).toBe(true);
 expect(new Set(artifact.data.records.map(r=>r.locationKey)).size).toBe(2);expect(stableLocationKey('a:b','c')).not.toBe(stableLocationKey('a','b:c'));
 expect(artifact.qualityFlags).toContain('legacy-effort-semantics-unvalidated');
});
it('deduplicates one visit across species but keeps separate visits on the same date',async()=>{
 expect((await register()).status).toBe('SUCCESS');expect((await register(['f3'],'visit-two','trap-hour',3)).status).toBe('SUCCESS');expect((await register(['zero'],'visit-zero','trap-hour',1)).status).toBe('SUCCESS');
 const ctx=context(),{ref}=await prepare(ctx);const selectionRef=await select(ref,ctx,[stableLocationKey('vector-monitoring','l')]);
 const run=await executeSkill('skill_feature_matrix_build',{measurementsRef:ref,selectionRef,metric:'capture-per-effort',effortUnit:'trap-hour',features:['metric','record-count','visit-count']},ctx);expect(run.status,JSON.stringify(run.error)).toBe('SUCCESS');
 const matrix=readScientificArtifact((run.payload as any).data.artifactRef,ctx,{kind:'FeatureMatrix',unit:'mixed',requireFinite:true});expect(matrix.data.values).toEqual([[5,4,3]]); // 30 captures / (2+3+1); denominator is not 2+2+3+1.
 const duplicate=await register();expect((duplicate.payload as any).data.reused).toBe(true);expect((await register(['f','f2'],'visit-one','trap-hour',9)).status).toBe('FAILED');
});
it('produces continuous calendar points with real zero and missing periods left null',async()=>{
 await register();await register(['f3'],'visit-two','trap-hour',3);await register(['zero'],'visit-zero','trap-hour',1);
 const ctx=context(),{ref}=await prepare(ctx);const selectionRef=await select(ref,ctx,[stableLocationKey('vector-monitoring','l')]);
 const run=await executeSkill('skill_series_build',{measurementsRef:ref,selectionRef,metric:'capture-per-effort',effortUnit:'trap-hour',frequency:'day'},ctx);expect(run.status).toBe('INSUFFICIENT_DATA');
 const artifact=readScientificArtifact((run.payload as any).data.artifactRef,ctx,{kind:'SeriesSet',unit:'capture/trap-hour',frequency:'day'});const series=artifact.data.series.find(s=>s.speciesId==='s')!;
 expect(series.points.map(p=>p.period)).toEqual(['2024-06-15','2024-06-16','2024-06-17']);expect(series.points.map(p=>p.value)).toEqual([3,null,0]);
 expect(()=>readScientificArtifact(artifact.ref,ctx,{kind:'SeriesSet',requireFinite:true})).toThrow('ARTIFACT_MISSING_VALUES');expect(()=>readScientificArtifact(artifact.ref,ctx,{kind:'SeriesSet',frequency:'week'})).toThrow('ARTIFACT_FREQUENCY_MISMATCH');
});
it('rejects mixed units, cross-source selections, invented membership and truncated sources',async()=>{
 await register();await register(['f3'],'visit-two','trap-night',3);
 const ctx=context(),{ref}=await prepare(ctx);const selectionRef=await select(ref,ctx);
 expect((await executeSkill('skill_feature_matrix_build',{measurementsRef:ref,selectionRef,metric:'capture-per-effort',effortUnit:'trap-hour'},ctx)).error?.message).toContain('MEASUREMENT_UNIT_MISMATCH');
 expect((await executeSkill('skill_selection_build',{measurementsRef:ref,locationKeys:['invented']},ctx)).status).toBe('FAILED');
 const truncated=await prepare(context(),{maxRecords:1});expect(truncated.run.status).toBe('INSUFFICIENT_DATA');expect((await executeSkill('skill_selection_build',{measurementsRef:truncated.ref},context())).error?.message).toContain('ARTIFACT_INCOMPLETE');
 const other=await prepare();expect((await executeSkill('skill_series_build',{measurementsRef:other.ref,selectionRef,metric:'capture-count',frequency:'day'},context())).error?.message).toContain('SELECTION_SOURCE_MISMATCH');
});
it('prevents duplicate/foreign/reclassified registration and requires professional role',async()=>{
 expect((await register(['f','outside'])).error?.message).toContain('FORBIDDEN_SAMPLING_RECORDS');
 expect((await register(['f','zero'])).error?.message).toContain('SAMPLING_VISIT_CONFLICT');
 await register();expect((await register(['f'],'different-visit')).status).toBe('FAILED');expect(withBusinessDb(db=>db.prepare('SELECT COUNT(*) n FROM biz_sampling_events').get())).toEqual({n:1});
 const base=context();const collector:ExecutionContext={...base,principal:{...base.principal,role:'DISTRICT_SURVEILLANCE',jurisdiction:{city:'郑州市',district:'金水区'}}};expect((await register(['f3'],'collector','trap-hour',1,collector)).error?.code).toBe('FORBIDDEN_OPERATION');
});
it('checks owner, organization, role, domain, approved scope and forged reference',async()=>{
 const {ref}=await prepare();const base=context();
 for(const ctx of [{...base,principal:{...base.principal,userId:'other'}},{...base,principal:{...base.principal,organizationId:'other'}},{...base,principal:{...base.principal,role:'CITY_EXPERT' as const,jurisdiction:{city:'郑州市'}}}])expect(()=>readScientificArtifact(ref,ctx,{kind:'Measurements'})).toThrow(/FORBIDDEN/);
 expect(()=>readScientificArtifact({...ref,contentHash:'0'.repeat(64)},context(),{kind:'Measurements'})).toThrow('ARTIFACT_INTEGRITY_FAILED');
 expect(()=>readScientificArtifact({...ref,domain:'env'},context(),{kind:'Measurements'})).toThrow('ARTIFACT_TYPE_MISMATCH');
 const narrow=context();narrow.approvedIntent=approveStructuredIntent({...args,to:'2024-06-16'},narrow);expect(()=>readScientificArtifact(ref,narrow,{kind:'Measurements'})).toThrow('ARTIFACT_SCOPE_MISMATCH');
 expect(()=>readScientificArtifact(ref,context(),{kind:'Measurements',unit:'capture/trap-hour'})).toThrow('ARTIFACT_UNIT_MISMATCH');
});
it('refuses stale dataset metadata, expired or tampered artifacts',async()=>{
 const {ref}=await prepare();const manifest=process.env.DATASET_MANIFEST_PATH!;const before=readFileSync(manifest,'utf8');const rows=JSON.parse(before);rows.find((d:any)=>d.domain==='vector').asOf='2026-10-13';writeFileSync(manifest,JSON.stringify(rows));expect(()=>readScientificArtifact(ref,context(),{kind:'Measurements'})).toThrow('ARTIFACT_DATASET_VERSION_CHANGED');writeFileSync(manifest,before);
 withBusinessDb(db=>db.prepare('UPDATE biz_scientific_artifacts SET artifact_json=? WHERE artifact_id=?').run('{}',ref.artifactId));expect(()=>readScientificArtifact(ref,context(),{kind:'Measurements'})).toThrow();
 const other=await prepare();withBusinessDb(db=>db.prepare('UPDATE biz_scientific_artifacts SET expires_at=1 WHERE artifact_id=?').run(other.ref.artifactId));expect(()=>readScientificArtifact(other.ref,context(),{kind:'Measurements'})).toThrow('ARTIFACT_EXPIRED');
});
it('rejects malformed matrix shape, nonfinite data, calendar changes and time widening',async()=>{
 const ctx=context(),{artifact}=await prepare(ctx);const selection=await select(artifact.ref,ctx);const source=readScientificArtifact(selection,ctx,{kind:'SelectionSet'});
 const fake:ScientificArtifact<'FeatureMatrix'>={...source,ref:{...source.ref,kind:'FeatureMatrix'},unit:'mixed',data:{rowKeys:['one'],columns:[{key:'x',unit:'capture'}],values:[[1,2]]}};
 expect(()=>validateArtifact(fake)).toThrow('FEATURE_MATRIX_SHAPE_INVALID');fake.data.values=[[Infinity]];expect(()=>validateArtifact(fake)).toThrow('ARTIFACT_DATA_INVALID');
 expect(()=>saveScientificArtifact({kind:'SelectionSet',data:source.data,unit:'location',frequency:'none',measurementDefinition:source.measurementDefinition,asOf:'2024-06-18',timeWindow:{from:'2024-06-15',to:'2024-06-18'},objectKeys:['locationKey'],qualityFlags:[],dependencies:[artifact.ref],skillId:'invalid'},ctx)).toThrow('ARTIFACT_TIME_WIDENING');
});
it('retains existing SQL scope enforcement while paging only authorized source records',()=>{
 const ctx=context(),scope=scopeFromArgs(args,ctx);const repo=getDomainRepository('vector');const first=repo.readMonitoringRecords({limit:2},scope);const second=repo.readMonitoringRecords({limit:2,afterId:String(first.at(-1)!.recordId)},scope);
 expect(new Set([...first,...second].map(r=>r.recordId)).size).toBe(4);expect([...first,...second].every(r=>r.city==='郑州市'&&r.district==='金水区')).toBe(true);
 expect(()=>repo.query('SELECT capture_count FROM fact_monitoring WHERE monitoring_id=?',['outside'],scope)).toThrow('SQL存在未批准');
 expect(()=>repo.readMonitoringRecords({limit:2},{...scope,approvedIntent:JSON.parse(JSON.stringify(ctx.approvedIntent))})).toThrow('FORBIDDEN_SCIENTIFIC_QUERY');
 expect(repo.readMonitoringRecords({limit:2,recordIds:['outside']},scope)).toEqual([]);
});
it('supports explicit feature columns, units and calendar contracts before a model consumes them',async()=>{
 const ctx=context(),{ref}=await prepare(ctx);const selectionRef=await select(ref,ctx);const run=await executeSkill('skill_feature_matrix_build',{measurementsRef:ref,selectionRef,metric:'capture-count',features:['metric']},ctx);expect(run.status).toBe('SUCCESS');
 const matrix=readScientificArtifact((run.payload as any).data.artifactRef,ctx,{kind:'FeatureMatrix',columns:[{key:'capture-count',unit:'capture'}],requireFinite:true});expect(matrix.data.values).toEqual([[30],[4]]);
 expect(()=>readScientificArtifact(matrix.ref,ctx,{kind:'FeatureMatrix',columns:[{key:'capture-count',unit:'capture/trap-hour'}]})).toThrow('ARTIFACT_FEATURE_UNIT_MISMATCH');
 expect(()=>readScientificArtifact(matrix.ref,ctx,{kind:'FeatureMatrix',measurementDefinition:'different-v1'})).toThrow('ARTIFACT_MEASUREMENT_MISMATCH');
 for(const frequency of ['week','month'] as const){const result=await executeSkill('skill_series_build',{measurementsRef:ref,selectionRef,metric:'capture-count',frequency},ctx);const series=readScientificArtifact((result.payload as any).data.artifactRef,ctx,{kind:'SeriesSet',frequency});expect(series.data.series[0].points[0].period).toBe(frequency==='week'?'2024-06-10':'2024-06-01');const bad=structuredClone(series);bad.data.series[0].points[0].period='2024-06-12';expect(()=>validateArtifact(bad)).toThrow(/SERIES/);}
});
it('reads all pages beyond the 200 row interactive limit without changing the source database',async()=>{
 const db=new Database(readDatasetLocations().find(d=>d.domain==='vector')!.path);db.transaction(()=>{for(let i=0;i<1001;i++)db.prepare("INSERT INTO fact_monitoring(monitoring_id,date_id,location_id,species_id,method_id,capture_count) VALUES(?,'2024-06-15','l','s','m',0)").run('page-'+String(i).padStart(4,'0'));})();db.close();
 const {artifact}=await prepare(context(),{maxRecords:2000});expect(artifact.data.records.length).toBe(1006);expect(artifact.data.complete).toBe(true);expect(artifact.data.records.filter(r=>r.recordId.startsWith('page-')).every(r=>r.captureCount===0&&r.visitId===null)).toBe(true);
});
it('rechecks the current jurisdiction and reports authorization failures at the Skill boundary',async()=>{
 const base=context();const city:ExecutionContext={...base,principal:{...base.principal,role:'CITY_EXPERT',mode:'authenticated',jurisdiction:{city:'郑州市'},permissions:{professionalReview:true}}};const {ref}=await prepare(city);
 const changed:ExecutionContext={...city,approvedIntent:undefined,principal:{...city.principal,jurisdiction:{city:'南阳市'}}};expect(()=>readScientificArtifact(ref,changed,{kind:'Measurements'})).toThrow(/geography exceeds server jurisdiction/);
 const other={...base,principal:{...base.principal,userId:'other'}};const result=await executeSkill('skill_scientific_artifact_read',{artifactRef:ref},other);expect(result.error?.code).toBe('FORBIDDEN_ARTIFACT_OWNER');expect(result.payload).toBeNull();
});
it('detects edited reviewed source records and does not sum incompatible effort units',async()=>{
 await register();await register(['f3'],'visit-two','trap-night',3);await register(['zero'],'visit-three','trap-hour',1);
 const ctx=context(),{ref}=await prepare(ctx),selectionRef=await select(ref,ctx);const result=await executeSkill('skill_series_build',{measurementsRef:ref,selectionRef,metric:'capture-count',frequency:'day'},ctx);const series=readScientificArtifact((result.payload as any).data.artifactRef,ctx,{kind:'SeriesSet'}).data.series.find(s=>s.speciesId==='s')!;expect(series.points[0].effort).toBeNull();expect(series.points[0].effortUnit).toBeNull();expect(series.points[0].visitCount).toBe(2);
 const db=new Database(readDatasetLocations().find(d=>d.domain==='vector')!.path);db.prepare("UPDATE fact_monitoring SET capture_count=999 WHERE monitoring_id='f'").run();db.close();const changed=await executeSkill('skill_measurement_prepare',args,context());expect(changed.error?.message).toBe('MEASUREMENT_SOURCE_CHANGED');
});
