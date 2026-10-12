import { mkdtempSync,writeFileSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { beforeAll,afterAll,it,expect } from 'vitest';
import { getDomainRepository } from '@/infrastructure/db/domain-repository';
const directory=mkdtempSync(join(tmpdir(),'cdc-domains-'));
const manifest=join(directory,'datasets.json');
const previous=process.env.DATASET_MANIFEST_PATH;
function fixture(name:string,value:number){const file=join(directory,name);const db=new Database(file);db.exec('CREATE TABLE fact_water_monitoring(record_id TEXT,city TEXT,district TEXT,hazard_quotient REAL,monitoring_date TEXT)');db.prepare('INSERT INTO fact_water_monitoring VALUES(?,?,?,?,?)').run('one','郑州市','金水区',value,'2026-08-01');db.prepare('INSERT INTO fact_water_monitoring VALUES(?,?,?,?,?)').run('two','开封市','龙亭区',8,'2026-08-01');db.close();return file;}
function configure(file:string){writeFileSync(manifest,JSON.stringify([{id:'env-test',domain:'env',origin:'mock',version:'1',asOf:'2026-08-31',schemaVersion:'1',path:file}]));}
beforeAll(()=>{process.env.DATASET_MANIFEST_PATH=manifest;configure(fixture('one.db',0.25));});
afterAll(()=>{if(previous===undefined)delete process.env.DATASET_MANIFEST_PATH;else process.env.DATASET_MANIFEST_PATH=previous;rmSync(directory,{recursive:true,force:true});});
it('enforces geographic scope even when SQL tries to widen it',()=>{
  const repo=getDomainRepository('env');
  expect(repo.query("SELECT city,hazard_quotient FROM fact_water_monitoring WHERE city='开封市' OR 1=1",[],{domain:'env',city:'郑州市'})).toEqual([{city:'郑州市',hazard_quotient:0.25}]);
  expect(repo.query('SELECT * FROM fact_water_monitoring',[],{domain:'env',city:'不存在市'})).toEqual([]);
});
it('applies an explicit time cutoff',()=>{
  expect(getDomainRepository('env').query('SELECT * FROM fact_water_monitoring',[],{domain:'env',city:'郑州市',to:'2026-07-31'})).toEqual([]);
});
it('rejects cross-domain scope and tables',()=>{
  expect(()=>getDomainRepository('env').query('SELECT * FROM fact_monitoring',[],{domain:'env'})).toThrow();
  expect(()=>getDomainRepository('env').query('SELECT * FROM fact_water_monitoring',[],{domain:'vector'})).toThrow();
});
it('narrows column access rather than exposing wildcard sensitive fields',()=>{
  const repo=getDomainRepository('env');
  expect(repo.query('SELECT * FROM fact_water_monitoring',[],{domain:'env',city:'郑州市',allowedColumns:{fact_water_monitoring:['record_id','hazard_quotient']}})).toEqual([{record_id:'one',hazard_quotient:0.25}]);
  expect(()=>repo.query('SELECT city FROM fact_water_monitoring',[],{domain:'env',allowedColumns:{fact_water_monitoring:['record_id']}})).toThrow();
});
it('reads the newly configured DB instead of retaining a cached old connection',()=>{
  const repo=getDomainRepository('env');
  configure(fixture('two.db',0.75));
  expect(repo.query('SELECT hazard_quotient FROM fact_water_monitoring',[],{domain:'env',city:'郑州市'})).toEqual([{hazard_quotient:0.75}]);
});
