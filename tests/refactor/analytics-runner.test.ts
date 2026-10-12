import {mkdtempSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {it,expect} from 'vitest';
import path from 'node:path';
import {createAnalyticsRunner,runAnalytics} from '@/infrastructure/analytics/runner';
const scriptPath=path.join(process.cwd(),'tests/refactor/fixtures/analytics-child.py');
const request=(args:Record<string,any>={})=>({task:'species_clustering',domain:'vector' as const,datasetId:'vector-monitoring',runId:crypto.randomUUID(),args});
it('validates task/domain/dataset before spawning and sends explicit dataset identity',async()=>{
 const runner=createAnalyticsRunner({scriptPath});
 for(const input of [{...request(),task:'invalid'},{...request(),domain:'env' as const},{...request(),datasetId:'env-monitoring'}]){expect((await runner.runAnalytics(input)).status).toBe('FAILED');expect(runner.getStats().started).toBe(0);}
 const result=await runner.runAnalytics(request({value:4}));expect(result.status).toBe('SUCCESS');expect(result.payload).toMatchObject({value:8,datasetId:'vector-monitoring'});expect(result.datasets[0].origin).toBe('observed');
});
it('bounds running concurrency to two and queued cancellation never starts a child',async()=>{
 const runner=createAnalyticsRunner({scriptPath,concurrency:2});const cancelled=new AbortController();
 const jobs=[runner.runAnalytics(request({delay:0.1})),runner.runAnalytics(request({delay:0.1})),runner.runAnalytics(request(),{signal:cancelled.signal})];
 expect(runner.getStats()).toMatchObject({active:2,queued:1,peak:2,started:2});cancelled.abort();
 const results=await Promise.all(jobs);expect(results.map(r=>r.status)).toEqual(['SUCCESS','SUCCESS','CANCELLED']);expect(runner.getStats()).toMatchObject({active:0,queued:0,peak:2,started:2});
});
it('timeout and cancellation terminate a running child and release the slot for a real next execution',async()=>{
 for(const cancel of [false,true]){
  const runner=createAnalyticsRunner({scriptPath,concurrency:1,timeoutMs:700});const controller=new AbortController();
  const first=runner.runAnalytics(request({delay:3}),{signal:controller.signal});const next=runner.runAnalytics(request({value:2}));
  if(cancel)controller.abort();const result=await first;expect(result.status).toBe(cancel?'CANCELLED':'FAILED');if(!cancel)expect(result.error?.code).toBe('ANALYTICS_TIMEOUT');
  expect((await next).payload).toMatchObject({value:4});expect(runner.getStats().active).toBe(0);
 }
});
it('does not repair non-finite JSON, splice noisy stdout or accept another run identity',async()=>{
 const runner=createAnalyticsRunner({scriptPath});
 for(const mode of ['invalid','noise','wrong-run']){const result=await runner.runAnalytics(request({mode}));expect(result.status).toBe('FAILED');expect(result.payload).toBeNull();}
});
it('stdout and stderr limits terminate execution without leaking the oversized output',async()=>{
 for(const mode of ['overflow','stderr']){const runner=createAnalyticsRunner({scriptPath,maxStdoutBytes:1024,maxStderrBytes:1024});const result=await runner.runAnalytics(request({mode}));expect(result.status).toBe('FAILED');expect(result.error?.code).toBe('ANALYTICS_OUTPUT_LIMIT');expect(result.error!.message.length).toBeLessThan(500);expect(runner.getStats().active).toBe(0);}
});
it('the production runner computes an actual water snapshot through strict Python SkillResult',async()=>{
 const result=await runAnalytics({task:'water_safety_eval',domain:'env',datasetId:'env-monitoring',runId:crypto.randomUUID(),args:{}});expect(result.status).toBe('SUCCESS');expect(result.datasets[0].origin).toBe('mock');expect(result.payload).toMatchObject({totalSamples:expect.any(Number)});
});

it('timeout terminates a descendant that ignores SIGTERM rather than leaving an orphan writer',async()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'runner-descendants-'));const marker=path.join(dir,'orphan-output');
 try{const runner=createAnalyticsRunner({scriptPath,timeoutMs:500});const result=await runner.runAnalytics(request({fork:true,childOutput:marker,delay:3}));expect(result.error?.code).toBe('ANALYTICS_TIMEOUT');await new Promise(resolve=>setTimeout(resolve,1200));expect(existsSync(marker)).toBe(false);expect(runner.getStats().active).toBe(0);}finally{rmSync(dir,{recursive:true,force:true});}
});
