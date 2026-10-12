import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { beforeAll,afterAll,describe,it,expect } from 'vitest';
import { executeSkill,listSkillDefinitions,createSkillService } from '@/application/skills/skill-service';
import type { ExecutionContext } from '@/contracts/execution-context';
import type { SkillDefinition } from '@/contracts/skill-definition';
const directory=mkdtempSync(join(tmpdir(),'cdc-skills-'));
const file=join(directory,'business.db');
const previous=process.env.APP_BUSINESS_DB_PATH;
let db: Database.Database;
function context(domain:ExecutionContext['domain']):ExecutionContext {return {runId:'skill-test',domain,deploymentTier:'local',principal:{userId:'owner',role:'PROVINCIAL_ADMIN',organizationId:'test',domainGrants:[domain],jurisdiction:{},mode:'dev'}};}
beforeAll(()=>{process.env.APP_BUSINESS_DB_PATH=file;db=new Database(file);db.exec('CREATE TABLE biz_generated_reports(report_id TEXT PRIMARY KEY,title TEXT,author TEXT,city TEXT,district TEXT,report_type TEXT,summary TEXT,content_markdown TEXT,metadata_json TEXT,created_at TEXT); CREATE TABLE biz_custom_skills(skill_id TEXT PRIMARY KEY,name TEXT,description TEXT,category TEXT,sql_query TEXT,chart_type TEXT,recommended_prompts TEXT,visibility TEXT,created_by TEXT,created_at TEXT,domain TEXT)');});
afterAll(()=>{db.close();if(previous===undefined)delete process.env.APP_BUSINESS_DB_PATH;else process.env.APP_BUSINESS_DB_PATH=previous;rmSync(directory,{recursive:true,force:true});});
describe('one execution service',()=>{
  it('canonical and legacy alias execute identical real species aggregates',async()=>{
    const canonical=await executeSkill('skill_species_composition',{city:'郑州市',category:'蚊'},context('vector'));
    const alias=await executeSkill('species_composition',{city:'郑州市',category:'蚊'},context('vector'));
    expect(canonical.status).toBe('SUCCESS');expect(alias.payload).toEqual(canonical.payload);expect(alias.method).toBe(canonical.method);
    expect(canonical.datasets[0].origin).toBe('observed');
  },20000);
  it('refuses unknown IDs and invalid parameters',async()=>{
    expect((await executeSkill('unregistered',{},context('env'))).error?.code).toBe('UNKNOWN_SKILL');
    const invalid=await executeSkill('skill_species_composition',{category:'not-a-category'},context('vector'));
    expect(invalid.status).toBe('FAILED');expect(invalid.error?.code).toBe('INVALID_INPUT');expect(invalid.payload).toBeNull();
  });
  it('rejects malformed execution output at the real service boundary',async()=>{
    const definition:SkillDefinition={id:'boundary',aliases:[],domain:'env',name:'Boundary',requirementIds:[],availability:'available',inputSchema:{type:'object',additionalProperties:false},outputSchema:{type:'object',required:['value'],properties:{value:{type:'number'}}},method:'boundary-v1',allowedOperations:['read'],execute:async()=>({status:'SUCCESS',payload:{value:'not-a-number'}})};
    const service=createSkillService([definition]);
    const result=await service.executeSkill('boundary',{},context('env'));
    expect(result.status).toBe('FAILED');expect(result.error?.code).toBe('INVALID_OUTPUT');expect(result.payload).toBeNull();
  });
  it('invalid input cannot trigger an execution side effect',async()=>{
    const definition:SkillDefinition={id:'side-effect',aliases:[],domain:'env',name:'Boundary',requirementIds:[],availability:'available',inputSchema:{type:'object',required:['value'],properties:{value:{type:'number'}}},outputSchema:{type:'object'},method:'boundary-v1',allowedOperations:['write'],execute:async()=>{db.exec("INSERT INTO biz_custom_skills(skill_id) VALUES('unwanted')");return {status:'SUCCESS',payload:{}};}};
    const result=await createSkillService([definition]).executeSkill('side-effect',{value:'bad'},context('env'));
    expect(result.status).toBe('FAILED');expect((db.prepare("SELECT COUNT(*) AS n FROM biz_custom_skills WHERE skill_id='unwanted'").get() as {n:number}).n).toBe(0);
  });
  it('rejects duplicate aliases rather than ambiguously choosing a handler',()=>{
    const base:SkillDefinition={id:'one',aliases:['duplicate'],domain:'env',name:'one',requirementIds:[],availability:'planned',inputSchema:{type:'object'},outputSchema:{type:'object'},method:'planned-v1',allowedOperations:[],execute:async()=>({status:'FAILED',payload:null})};
    expect(()=>createSkillService([base,{...base,id:'two'}])).toThrow(/alias|duplicate/i);
  });
  it.each(['env','foodborne','chronic'] as const)('custom skills execute the stored %s domain',async domain=>{
    const tables={env:'fact_water_monitoring',foodborne:'fact_foodborne_case',chronic:'fact_death_registry'};
    const sql=`SELECT COUNT(*) AS n FROM ${tables[domain]}`;
    const builder={env:'skill_env_custom_builder',foodborne:'skill_foodborne_custom_builder',chronic:'skill_chronic_custom_builder'};
    const created=await executeSkill(builder[domain],{skillName:'isolated '+domain,sqlQuery:sql,chartType:'table'},context(domain));
    expect(created.status).toBe('SUCCESS');
    const id=(created.payload as any).skill.id;
    const stored=db.prepare('SELECT domain FROM biz_custom_skills WHERE skill_id=?').get(id) as {domain:string};expect(stored.domain).toBe(domain);
    const run=await executeSkill(id,{},context(domain));expect(run.status).toBe('SUCCESS');expect((run.payload as any).data[0].n).toBeGreaterThan(0);expect(run.datasets.every(d=>d.domain===domain)).toBe(true);
  });
  it('SQL failure never becomes execution-complete data or creates a custom skill',async()=>{
    const before=(db.prepare('SELECT COUNT(*) AS n FROM biz_custom_skills').get() as {n:number}).n;
    const created=await executeSkill('skill_env_custom_builder',{skillName:'invalid',sqlQuery:'SELECT fake_field FROM fact_water_monitoring'},context('env'));
    expect(created.status).toBe('FAILED');expect(created.payload).toBeNull();
    expect((db.prepare('SELECT COUNT(*) AS n FROM biz_custom_skills').get() as {n:number}).n).toBe(before);
    db.prepare('INSERT INTO biz_custom_skills(skill_id,name,sql_query,domain,visibility,created_by) VALUES(?,?,?,?,?,?)').run('custom_skill_broken','broken','SELECT * FROM missing_table','env','private','owner');
    const broken=await executeSkill('custom_skill_broken',{},context('env'));expect(broken.status).toBe('FAILED');expect(broken.payload).toBeNull();
  });
  it('every registered skill has a domain, schema, unique canonical ID and explicit execution state',async()=>{
    for (const domain of ['vector','foodborne','env','chronic'] as const) {
      const definitions=listSkillDefinitions(domain);expect(definitions.length).toBeGreaterThan(0);
      expect(new Set(definitions.map(d=>d.id)).size).toBe(definitions.length);
      for (const d of definitions) {
        expect(d.domain).toBe(domain);expect(d.inputSchema.type).toBe('object');expect(d.outputSchema.type).toBe('object');
        if(d.availability==='planned') {const result=await executeSkill(d.id,{},context(domain));expect(result.status).toBe('FAILED');expect(result.error?.code).toBe('CAPABILITY_UNAVAILABLE');}
        else {
          const tables={vector:'fact_monitoring',env:'fact_water_monitoring',foodborne:'fact_foodborne_case',chronic:'fact_death_registry'};
          const sql=`SELECT COUNT(*) AS n FROM ${tables[domain]}`;
          const args=d.id==='skill_vector_backtest'?{city:'郑州市',methodName:'诱蚊灯法',asOf:'2025-11-11',horizon:1}:d.id==='skill_session_manage'?{action:'create',title:'registered fixture'}:d.id==='skill_catalog_manage'?{action:'list'}:d.id==='skill_collection_manage'?{action:'validate',record:{city:'郑州市',district:'金水区',category:'蚊',speciesName:'白纹伊蚊',captureCount:0}}:d.id==='skill_artifact_export'?{format:'csv',sql}:d.method==='bounded-domain-query-v1'?{sql}:d.method==='validated-custom-skill-create-v1'?{skillName:'fixture '+d.id,sqlQuery:sql}:d.id==='skill_icd10_nlp_inference'?{inputChain:{a:'呼吸衰竭',c:'脑梗死'}}:{city:'郑州市'};
          const result=await executeSkill(d.id,args,context(domain));
          expect(['SUCCESS','REVIEW_REQUIRED',...(d.outputSchema.properties?.type?.const==='ANALYTICS_RESULT'?['INSUFFICIENT_DATA','NO_DATA']:[])],`${d.id}: ${JSON.stringify(result.error)}`).toContain(result.status);if(result.status==='NO_DATA')expect(result.payload).toBeNull();else expect(result.payload).not.toBeNull();
        }
      }
    }
  },30000);
});
