import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {NextRequest} from 'next/server';
import {POST} from '@/app/api/agent/stream-dispatch/route';
import * as dispatchService from '@/application/dispatch/dispatch-service';
import {createMainAgent} from '@/application/agent/main-agent';
import {executeSkill,listSkillDefinitions} from '@/application/skills/skill-service';
import {createWorkbenchController} from '@/features/workbench/workbench-controller';
import {agentClient} from '@/features/workbench/session-client';
import {setCsrfToken} from '@/infrastructure/auth/client';
import {getAppBusinessProvider} from '@/lib/db/app-business-provider';
import {createSseDecoder} from '@/application/dispatch/sse';
import type {LLMClient} from '@/infrastructure/llm/client';
import {composeMap} from '@/application/geo/map-composer';
import type {MapView} from '@/contracts/map-view';

let dir:string;
const prompt='叠加显示河南省市县行政区划边界';
const llm:LLMClient={complete:async request=>{
 if(request.phase==='intent'){
  const evidence={source:'current',start:0,end:prompt.length,quote:prompt};
  return {role:'assistant',content:JSON.stringify({task:'map_display',relation:'new',displayRegion:{op:'set',value:{includeCandidateIds:['410000'],excludeCandidateIds:[]},evidence},dataRegion:{op:'clear',evidence},time:{op:'clear',evidence},filters:{},layerRequests:[],mapOperations:[],mapOptions:{basemap:'vec',boundaryLevels:['city','county']}})};
 }
 return {role:'assistant',content:request.messages[0].content?.includes('你负责提炼会话标题')?'{"title":"河南省市县边界"}':'{"mode":"answer","replyText":"已展示河南省市县边界。"}'};
}};
beforeEach(()=>{
 dir=mkdtempSync(join(tmpdir(),'cdc-map-sse-'));
 vi.stubEnv('APP_BUSINESS_DB_PATH',join(dir,'business.db'));vi.stubEnv('AGENT_DOMAIN','vector');vi.stubEnv('DEPLOYMENT_TIER','local');
 const run=createMainAgent({llm,listSkills:listSkillDefinitions,executeSkill,enableRegionIntent:true});
 vi.spyOn(dispatchService,'dispatch').mockImplementation(run);setCsrfToken('test-only');
});
afterEach(()=>{setCsrfToken(null);getAppBusinessProvider().close();vi.restoreAllMocks();vi.unstubAllGlobals();vi.unstubAllEnvs();rmSync(dir,{recursive:true,force:true});});

function fragmentedRoute(){
 const stats={maxFrameBytes:0};
 vi.stubGlobal('fetch',async(url:string,init:RequestInit)=>{
  expect(url).toBe('/api/agent/stream-dispatch');
  const response=await POST(new NextRequest('http://localhost:9567'+url,{...init,signal:init.signal??undefined,method:'POST'}));
  const wire=await response.text();
  stats.maxFrameBytes=Math.max(...wire.split('\n\n').filter(Boolean).map(block=>new TextEncoder().encode(block+'\n\n').length));
  const bytes=new TextEncoder().encode(wire);
  return new Response(new ReadableStream({start(controller){for(let i=0;i<bytes.length;i+=65536)controller.enqueue(bytes.subarray(i,i+65536));controller.close();}}),{headers:response.headers});
 });
 return stats;
}

it('keeps a successful Henan city/county map after the real route is delivered in 64 KiB fragments',async()=>{
 const stats=fragmentedRoute();
 const controller=createWorkbenchController({domain:'vector',client:agentClient});
 const turn=await controller.send(prompt);
 expect(controller.getState().status).toBe('SUCCESS');
 expect(controller.getState().view?.type).toBe('MAP_COMPOSITION');
 expect(turn?.mapComposition?.base.resources.map(r=>r.featureCount)).toEqual([18,157]);
 const mapResult=turn?.skillRuns.find(s=>s.skillId==='skill_map_display')?.result;
 expect((mapResult?.payload as any)?.resources[1].geometry.features).toHaveLength(157);
 expect((turn?.agui[0].result.payload as any)?.resources[0].geometry.features).toHaveLength(18);
 expect(stats.maxFrameBytes).toBeLessThan(1024*1024);
});

it('accepts a legitimate compact map frame larger than the smaller LLM frame budget',async()=>{
 vi.spyOn(dispatchService,'dispatch').mockImplementation((interaction,ctx)=>(async function*(){
  const args={regionCodes:['410000']};const result=await executeSkill('skill_map_display',args,ctx);
  const base=result.payload as MapView;
  base.resources[0].geometry.features[0].properties!.label='界'.repeat(450000);
  const mapComposition=composeMap(base,[],[],{authorizedRunIds:[ctx.runId]});
  const turn={runId:ctx.runId,interactionId:interaction.interactionId,status:'SUCCESS' as const,replyText:'地图已展示。',skillRuns:[{callId:'map',skillId:'skill_map_display',skillName:'行政区划地图显示',args,result}],agui:[{version:'1' as const,runId:ctx.runId,component:'MAP_VIEW',result}],mapComposition};
  yield {version:'1' as const,runId:ctx.runId,seq:1,type:'result' as const,data:{result:turn}};
  yield {version:'1' as const,runId:ctx.runId,seq:2,type:'completed' as const,data:{status:'SUCCESS'}};
 })());
 const stats=fragmentedRoute();const controller=createWorkbenchController({domain:'vector',client:agentClient});
 const turn=await controller.send('显示河南省地图');
 expect(controller.getState().status).toBe('SUCCESS');expect(stats.maxFrameBytes).toBeGreaterThan(1024*1024);
 expect(turn?.mapComposition?.base.resources[0].geometry.features[0].properties?.label).toHaveLength(450000);
});

it('retains ordinary JSON event shapes for clients without compact-encoding negotiation',async()=>{
 const response=await POST(new NextRequest('http://localhost:9567/api/agent/stream-dispatch',{method:'POST',body:JSON.stringify({promptText:prompt})}));
 const decoder=createSseDecoder({maxFrameBytes:32*1024*1024});
 const frames=decoder.push(new Uint8Array(await response.arrayBuffer()));frames.push(...decoder.finish());
 const finish=frames.find(f=>f.event==='finish')?.data;
 expect(finish.status).toBe('SUCCESS');expect(finish.generativeView.base.resources[1].geometry.features).toHaveLength(157);
 expect(frames.find(f=>f.data.type==='STATE_SNAPSHOT')?.data.snapshot.mapComposition.base.resources[0].featureCount).toBe(18);
});
