import {beforeAll,afterAll,it,expect} from 'vitest';
import {mkdtempSync,rmSync} from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';import {execFileSync} from 'node:child_process';
import {NextRequest} from 'next/server';
import {POST,GET} from '@/app/api/v1/mobile/environment/route';
import {assignEnvironmentTasks} from '@/application/mobile/environment-sampling';
import {createDevelopmentContext} from '@/lib/skills/server-executor';
const root=mkdtempSync(join(tmpdir(),'cdc-env-sampling-'));const bundle=join(root,'bundle');const previous={...process.env};
beforeAll(()=>{execFileSync('./.venv/bin/python',['scripts/seed-requirement-acceptance.py','--output-dir',bundle],{stdio:'pipe'});Object.assign(process.env,{DEPLOYMENT_TIER:'demo',AGENT_DOMAIN:'env',APP_BUSINESS_DB_PATH:join(bundle,'simulation-business.db'),DATASET_MANIFEST_PATH:join(bundle,'manifest.json'),DATASET_REGION_BINDINGS_PATH:join(bundle,'region-bindings.json'),CDC_SIMULATION_CONFIG:join(bundle,'simulation.json')});},30000);
afterAll(()=>{for(const k of Object.keys(process.env))if(!(k in previous))delete process.env[k];Object.assign(process.env,previous);rmSync(root,{recursive:true,force:true});});
const req=(body:unknown)=>new NextRequest('http://localhost/api/v1/mobile/environment',{method:'POST',body:JSON.stringify(body)});
it('validates units and images, persists once on replay, exposes completed task and rejects conflicts',async()=>{
 const task=assignEnvironmentTasks({city:'郑州市'},createDevelopmentContext('env'))[0];
 const record={clientKey:'sample-key-123',taskId:task.task_id,city:task.city,district:task.district,sampleCode:task.sample_code,sampledAt:new Date().toISOString(),indicator:'lead',value:.01,unit:'mg/L'};
 expect((await POST(req({...record,unit:'NTU'}))).status).toBe(400);expect((await POST(req({...record,photoDataUrl:'data:image/png;base64,AAAA'}))).status).toBe(400);
 const a=await (await POST(req(record))).json(),b=await (await POST(req(record))).json();expect(a.success).toBe(true);expect(b.data).toMatchObject({sampleId:a.data.sampleId,replayed:true});
 expect((await POST(req({...record,value:.02}))).status).toBe(409);
 const list=await (await GET(new NextRequest('http://localhost/api/v1/mobile/environment'))).json();expect(list.tasks.find((t:any)=>t.task_id===task.task_id).status).toBe('COMPLETED');
});
it('does not accept environment sampling in another domain',async()=>{process.env.AGENT_DOMAIN='vector';expect((await POST(req({}))).status).toBe(400);process.env.AGENT_DOMAIN='env';});
