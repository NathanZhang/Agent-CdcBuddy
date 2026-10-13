import { it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
const directory=mkdtempSync(join(tmpdir(),'cdc-report-'));
const file=join(directory,'reports.db');
const previous=process.env.APP_BUSINESS_DB_PATH;
let db: Database.Database;
beforeAll(()=>{process.env.APP_BUSINESS_DB_PATH=file; db=new Database(file); db.exec('CREATE TABLE biz_generated_reports(report_id TEXT PRIMARY KEY,title TEXT,author TEXT,city TEXT,district TEXT,report_type TEXT,summary TEXT,content_markdown TEXT,metadata_json TEXT,created_at TEXT)');});
afterAll(()=>{db.close(); if(previous===undefined) delete process.env.APP_BUSINESS_DB_PATH; else process.env.APP_BUSINESS_DB_PATH=previous; rmSync(directory,{recursive:true,force:true});});
import { executeSkillServer } from '@/lib/skills/server-executor';
it('does not generate or archive a successful report for a nonexistent city', async () => {
  await expect(executeSkillServer('skill_auto_report_gen',{city:'不存在市'})).rejects.toThrow('REGION_UNRESOLVED');
  expect((db.prepare('SELECT COUNT(*) AS n FROM biz_generated_reports').get() as {n:number}).n).toBe(0);
},30000);
