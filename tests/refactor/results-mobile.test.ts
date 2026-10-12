import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, it, expect } from 'vitest';
import { POST } from '@/app/api/v1/mobile/record/route';

const directory = mkdtempSync(join(tmpdir(),'cdc-sampling-'));
const file = join(directory,'business.db');
const previous = process.env.APP_BUSINESS_DB_PATH;
let db: Database.Database;
beforeAll(() => {
  process.env.APP_BUSINESS_DB_PATH=file;
  db = new Database(file);
  db.exec(`CREATE TABLE biz_mobile_submissions(submission_id TEXT PRIMARY KEY,user_id TEXT,user_name TEXT,city TEXT,district TEXT,street TEXT,latitude REAL,longitude REAL,image_url_base64 TEXT,recognized_species TEXT,ai_confidence REAL,category TEXT,species_name TEXT,capture_count INTEGER,weather_temp REAL,weather_humidity REAL,habitat_type TEXT,method_name TEXT,audit_status TEXT,submitted_at TEXT)`);
});
afterAll(() => { db.close(); if(previous===undefined) delete process.env.APP_BUSINESS_DB_PATH; else process.env.APP_BUSINESS_DB_PATH=previous; rmSync(directory,{recursive:true,force:true}); });
function request(body: unknown) {return new NextRequest('http://localhost/api/v1/mobile/record',{method:'POST',body:JSON.stringify(body),headers:{'Content-Type':'application/json'}});}
it('persists zero captures, zero weather and zero coordinates without replacing them', async () => {
  const response = await POST(request({userId:'field-one',userName:'采集员',city:'郑州市',district:'金水区',category:'蚊',speciesName:'白纹伊蚊',captureCount:0,weatherTemp:0,weatherHumidity:0,latitude:0,longitude:0,methodName:'诱蚊灯法'}));
  expect(response.status).toBe(200);
  expect(db.prepare('SELECT capture_count,weather_temp,weather_humidity,latitude,longitude,ai_confidence FROM biz_mobile_submissions').get()).toEqual({capture_count:0,weather_temp:0,weather_humidity:0,latitude:0,longitude:0,ai_confidence:null});
  expect((await response.json()).data.syncToSpatialMap).not.toBe(true);
});
it('rejects missing and malformed capture evidence without inserting a record', async () => {
  for (const captureCount of [undefined,-1,'2fake',1.5]) {
    const before=(db.prepare('SELECT COUNT(*) AS n FROM biz_mobile_submissions').get() as {n:number}).n;
    const response=await POST(request({userId:'field-one',userName:'采集员',city:'郑州市',district:'金水区',category:'蚊',speciesName:'白纹伊蚊',captureCount}));
    expect(response.status).toBe(400);
    expect((db.prepare('SELECT COUNT(*) AS n FROM biz_mobile_submissions').get() as {n:number}).n).toBe(before);
  }
});
