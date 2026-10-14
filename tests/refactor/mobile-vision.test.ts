import {beforeAll,afterAll,afterEach,it,expect,vi} from 'vitest';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {NextRequest} from 'next/server';
import {POST} from '@/app/api/v1/mobile/detect-species/route';
import {createDevelopmentContext} from '@/lib/skills/server-executor';
import {executeSkill} from '@/application/skills/skill-service';
import {withBusinessDb} from '@/infrastructure/db/business-store';
import {parseSpeciesRecognition,validateImage,readRecognition} from '@/application/mobile/species-recognition';
import {assertResultSources} from '@/infrastructure/db/dataset-policy';
import {loadDatasetManifest} from '@/infrastructure/db/dataset-manifest';
const directory=mkdtempSync(join(tmpdir(),'cdc-vision-')),bundle=join(directory,'bundle');
// A real PNG pixel is only a transport fixture; the mocked result is not recognition evidence.
const imageDataUrl='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII=';
const candidate={speciesName:'白纹伊蚊',category:'蚊',confidence:0,reason:'模型测试响应，非视觉准确率证据'};
let env:NodeJS.ProcessEnv;
beforeAll(()=>{
 env={...process.env};
 execFileSync('./.venv/bin/python',['scripts/seed-requirement-acceptance.py','--output-dir',bundle],{stdio:'pipe'});
 Object.assign(process.env,{APP_BUSINESS_DB_PATH:join(bundle,'simulation-business.db'),DATASET_MANIFEST_PATH:join(bundle,'manifest.json'),DATASET_REGION_BINDINGS_PATH:join(bundle,'region-bindings.json'),CDC_SIMULATION_CONFIG:join(bundle,'simulation.json'),DEPLOYMENT_TIER:'demo',AGENT_DOMAIN:'vector',SILICONFLOW_API_KEY:'test-only',SILICONFLOW_VISION_MODEL:'test-vision'});
});
afterEach(()=>vi.unstubAllGlobals());
afterAll(()=>{for(const key of Object.keys(process.env))if(!(key in env))delete process.env[key];Object.assign(process.env,env);rmSync(directory,{recursive:true,force:true});});
function request(body:unknown){return new NextRequest('http://localhost/api/v1/mobile/detect-species',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});}
it('sends actual image pixels to the configured vision model, persists provenance, and submits a linked editable record',async()=>{
 let sent:any;vi.stubGlobal('fetch',async(_url:any,init:any)=>{sent=JSON.parse(init.body);return Response.json({choices:[{finish_reason:'stop',message:{role:'assistant',content:JSON.stringify(candidate)}}]});});
 const response=await POST(request({imageDataUrl}));expect(response.status).toBe(200);const body=await response.json();
 expect(sent.model).toBe('test-vision');expect(sent.messages.at(-1).content).toContainEqual({type:'image_url',image_url:{url:imageDataUrl}});
 expect(body.data.confidence).toBe(0);expect(body.data.requiresReview).toBe(true);
 const ctx=createDevelopmentContext('vector');
 const result=await executeSkill('skill_collection_manage',{action:'submit',record:{city:'郑州市',district:'金水区',category:'蚊',speciesName:'人工复核后的物种',captureCount:1,weatherTemp:25,recognitionId:body.data.recognitionId}},ctx);
 expect(result.status,JSON.stringify(result.error)).toBe('SUCCESS');
 const saved=withBusinessDb(db=>db.prepare('SELECT * FROM biz_mobile_submissions WHERE recognition_id=?').get(body.data.recognitionId)) as any;
 expect(saved).toMatchObject({recognized_species:'白纹伊蚊',ai_confidence:0,species_name:'人工复核后的物种',audit_status:'SUBMITTED'});
 expect(result.datasets[0].origin).toBe('mock');
 expect(()=>readRecognition(body.data.recognitionId,{...ctx,principal:{...ctx.principal,userId:'other'}})).toThrow(/INVALID_RECOGNITION/);
 expect(()=>readRecognition(body.data.recognitionId,{...ctx,principal:{...ctx.principal,organizationId:'other'}})).toThrow(/INVALID_RECOGNITION/);
 withBusinessDb(db=>db.prepare('UPDATE biz_species_recognitions SET expires_at=0 WHERE recognition_id=?').run(body.data.recognitionId));
 expect(()=>readRecognition(body.data.recognitionId,ctx)).toThrow(/INVALID_RECOGNITION/);
});
it('does not call the provider or save recognition for malformed images or bad model output',async()=>{
 const fetcher=vi.fn(async()=>Response.json({choices:[{message:{role:'assistant',content:'{"speciesName":"invented","confidence":2}'}}]}));vi.stubGlobal('fetch',fetcher);
 for(const image of ['https://example.com/a.png','data:image/png;base64,ZmFrZQ==',undefined])expect((await POST(request({imageDataUrl:image}))).status).toBe(400);
 expect(fetcher).not.toHaveBeenCalled();
 const before=withBusinessDb(db=>(db.prepare('SELECT COUNT(*) n FROM biz_species_recognitions').get() as any).n);
 expect((await POST(request({imageDataUrl}))).status).toBe(502);
 expect(withBusinessDb(db=>(db.prepare('SELECT COUNT(*) n FROM biz_species_recognitions').get() as any).n)).toBe(before);
 expect(()=>validateImage('data:image/png;base64,'+'A'.repeat(6*1024*1024))).toThrow(/INVALID_IMAGE/);
});
it('accepts an honest unknown and rejects invalid confidence instead of inventing a candidate',()=>{
 expect(parseSpeciesRecognition(JSON.stringify({speciesName:null,category:null,confidence:null,reason:'看不清'})).speciesName).toBeNull();
 for(const confidence of [-1,2,'0.9'])expect(()=>parseSpeciesRecognition(JSON.stringify({...candidate,confidence}))).toThrow();
});
it('enables mock writes only in the explicitly isolated demo, never default local or pilot business',()=>{
 const refs=loadDatasetManifest().filter(d=>d.domain==='vector');expect(()=>assertResultSources(refs,'demo',true)).not.toThrow();
 expect(()=>assertResultSources(refs,'pilot',true)).toThrow();
 const business=process.env.APP_BUSINESS_DB_PATH;process.env.APP_BUSINESS_DB_PATH=join(directory,'unrelated.db');expect(()=>assertResultSources(refs,'demo',true)).toThrow();process.env.APP_BUSINESS_DB_PATH=business;
 const simulation=process.env.CDC_SIMULATION_CONFIG;delete process.env.CDC_SIMULATION_CONFIG;expect(()=>assertResultSources(refs,'demo',true)).toThrow();process.env.CDC_SIMULATION_CONFIG=simulation;
 expect(readFileSync(join(bundle,'simulation.json'),'utf8')).toContain('requirement-acceptance-simulation');
});
it('rejects anonymous pilot callers before reading image input',async()=>{
 const tier=process.env.DEPLOYMENT_TIER;process.env.DEPLOYMENT_TIER='pilot';try{expect((await POST(request({imageDataUrl}))).status).toBe(401);}finally{process.env.DEPLOYMENT_TIER=tier;}
});

it('fails explicitly without a configured vision model and never falls back to a text-only model',async()=>{
 const model=process.env.SILICONFLOW_VISION_MODEL;delete process.env.SILICONFLOW_VISION_MODEL;
 const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
 try{const response=await POST(request({imageDataUrl}));expect(response.status).toBe(503);expect((await response.json()).error.code).toBe('VISION_UNAVAILABLE');expect(fetcher).not.toHaveBeenCalled();}finally{process.env.SILICONFLOW_VISION_MODEL=model;}
});
