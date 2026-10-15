import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {NextRequest} from 'next/server';
import {POST} from '@/app/api/agent/stream-dispatch/route';
import * as dispatchService from '@/application/dispatch/dispatch-service';
import {createMainAgent} from '@/application/agent/main-agent';
import {executeSkill,listSkillDefinitions} from '@/application/skills/skill-service';
import {createDevelopmentContext} from '@/lib/skills/server-executor';
import {getAppBusinessProvider} from '@/lib/db/app-business-provider';
import {getRecordedTurn} from '@/infrastructure/db/business-store';
import {createWorkbenchController} from '@/features/workbench/workbench-controller';
import {agentClient} from '@/features/workbench/session-client';
import {restoreSession} from '@/features/workbench/result-adapter';
import {toLegacyEvents,toLegacyResult} from '@/application/dispatch/legacy-adapter';
import {toAguiEvents} from '@/application/dispatch/agui-adapter';
import {setCsrfToken} from '@/infrastructure/auth/client';
import type {LLMRequest} from '@/infrastructure/llm/client';

let dir:string;
const prompt='河南省地图上展示监测点，并展示监测次数柱状图';
const input={interactionId:'deadline-test',kind:'conversation' as const,userInput:prompt};
beforeEach(()=>{
 dir=mkdtempSync(join(tmpdir(),'cdc-deadline-'));
 vi.stubEnv('APP_BUSINESS_DB_PATH',join(dir,'business.db'));
 vi.stubEnv('AGENT_DOMAIN','vector');vi.stubEnv('DEPLOYMENT_TIER','local');
});
afterEach(()=>{
 setCsrfToken(null);getAppBusinessProvider().close();vi.restoreAllMocks();
 vi.unstubAllEnvs();vi.unstubAllGlobals();rmSync(dir,{recursive:true,force:true});
});

function agent(stop?:(request:LLMRequest)=>Promise<never>|never,execute=executeSkill){
 return createMainAgent({listSkills:listSkillDefinitions,executeSkill:execute,enableRegionIntent:true,llm:{complete:async request=>{
  if(request.phase==='intent'){
   const evidence={source:'current',quote:prompt};
   return {role:'assistant',content:JSON.stringify({task:'map_with_data',relation:'new',displayRegion:{op:'set',value:{includeCandidateIds:['410000'],excludeCandidateIds:[]},evidence},dataRegion:{op:'clear',evidence},time:{op:'clear',evidence},filters:{},layerRequests:[],mapOperations:[],mapOptions:{basemap:'vec'}})};
  }
  if(request.messages[0].content?.includes('你负责提炼会话标题'))return {role:'assistant',content:'{"title":"河南省监测地图"}'};
  if(request.toolChoice==='auto')return {role:'assistant',content:null,tool_calls:[
   {id:'points',type:'function',function:{name:'skill_monitoring_data_table',arguments:JSON.stringify({sql:'SELECT latitude AS lat,longitude AS lon,street AS label FROM dim_location LIMIT 3',visualization:{kind:'map',latKey:'lat',lonKey:'lon',labelKey:'label',sourceCRS:'EPSG:4326'}})}},
   {id:'chart',type:'function',function:{name:'skill_monitoring_data_table',arguments:JSON.stringify({sql:'SELECT date_id AS date,COUNT(*) AS n FROM fact_monitoring GROUP BY date_id LIMIT 3',visualization:{kind:'bar',xKey:'date',yKey:'n',unit:'次'}})}}
  ]};
  if(stop)return stop(request);
  return {role:'assistant',content:'{"mode":"answer","replyText":"地图与监测次数图表已展示，明细见工作台。"}'};
 }}});
}

function controlledDeadline(){
 const deadline=new AbortController();
 vi.spyOn(AbortSignal,'timeout').mockReturnValue(deadline.signal);
 return ()=>deadline.abort(new DOMException('Execution deadline reached','TimeoutError'));
}

it.each(['deadline','caller','caller-then-deadline','deadline-then-caller'] as const)('keeps the first abort cause and the correct partial outputs: %s',async cause=>{
 const expire=controlledDeadline(),caller=new AbortController();
 const ctx={...createDevelopmentContext('vector'),deadlineAt:Date.now()+600000};ctx.signal=caller.signal;
 const run=agent(request=>{
  if(cause.startsWith('caller'))caller.abort();else expire();
  if(cause==='caller-then-deadline')expire();
  if(cause==='deadline-then-caller')caller.abort();
  request.signal!.throwIfAborted();throw Error('Expected aborted signal');
 });
 const events=[];for await(const event of run(input,ctx))events.push(event);
 const turn=await dispatchService.collectDispatch(events);
 expect(turn.skillRuns.map(s=>s.result.status)).toEqual(['SUCCESS','SUCCESS','SUCCESS']);
 expect(events.filter(e=>e.type==='tool_completed').some(e=>e.data.mapComposition?.layers.length)).toBe(true);
 const timeout=cause.startsWith('deadline');
 expect(turn).toMatchObject({status:timeout?'FAILED':'CANCELLED',error:{code:timeout?'EXECUTION_TIMEOUT':'CANCELLED'}});
 const legacy=toLegacyResult(turn);expect(legacy.success).toBe(false);
 if(timeout){
  expect(turn.replyText).toContain('执行超时');expect(turn.replyText).toContain('已完成的数据结果保留在工作台');
  expect(turn.agui).toHaveLength(3);expect(turn.mapComposition?.layers).toHaveLength(1);
  expect(legacy.generativeView).toMatchObject({type:'AGUI_RESULT_GROUP',runId:ctx.runId,views:[{type:'MAP_COMPOSITION'},{type:'DATA_TABLE_VIEW'},{type:'DATA_TABLE_VIEW',visualization:{kind:'bar'}}]});
  const finalEvent=events.find(e=>e.type==='result')!;
  expect(toLegacyEvents(finalEvent).find(e=>e.event==='generative_view')?.data.view).toEqual(legacy.generativeView);
  expect(toAguiEvents(finalEvent).find(e=>e.type==='RUN_ERROR')).toMatchObject({code:'EXECUTION_TIMEOUT'});
  expect(getRecordedTurn(ctx.runId,ctx).result.mapComposition).toEqual(turn.mapComposition);
 }else{
  expect(turn.replyText).toBe('操作已取消');expect(turn.agui).toEqual([]);
  expect(turn.mapComposition).toBeUndefined();expect(legacy.generativeView).toBeNull();
 }
});

it('does not reuse an old view when the deadline expires before any skill executes',async()=>{
 const expire=controlledDeadline();expire();
 let calls=0;const ctx={...createDevelopmentContext('vector'),deadlineAt:Date.now()+600000};
 const run=createMainAgent({llm:{complete:async()=>{calls++;throw Error('Must not reach the model');}},listSkills:listSkillDefinitions,executeSkill});
 const turn=await dispatchService.collectDispatch(run({...input,viewContext:{type:'OLD_SUCCESS'}},ctx));
 expect(turn).toMatchObject({status:'FAILED',error:{code:'EXECUTION_TIMEOUT'},skillRuns:[],agui:[]});
 expect(calls).toBe(0);expect(toLegacyResult(turn).generativeView).toBeNull();
 expect(turn.replyText).not.toContain('已完成的数据结果保留');
});

it('keeps the base map when the deadline expires before the business tools start',async()=>{
 const expire=controlledDeadline(),ctx={...createDevelopmentContext('vector'),deadlineAt:Date.now()+600000};
 const run=agent(undefined,async(id,args,context)=>{
  const result=await executeSkill(id,args,context);
  if(id==='skill_map_display')expire();return result;
 });
 const turn=await dispatchService.collectDispatch(run(input,ctx));
 expect(turn).toMatchObject({status:'FAILED',error:{code:'EXECUTION_TIMEOUT'}});
 expect(turn.skillRuns.map(s=>s.skillId)).toEqual(['skill_map_display']);
 expect(turn.agui).toHaveLength(1);expect(toLegacyResult(turn).generativeView.type).toBe('MAP_COMPOSITION');
});

it('keeps completed outputs while excluding the tool interrupted by the deadline',async()=>{
 const expire=controlledDeadline(),ctx={...createDevelopmentContext('vector'),deadlineAt:Date.now()+600000};
 const run=agent(undefined,async(id,args,context)=>{
  if(context.callId==='chart')expire();return executeSkill(id,args,context);
 });
 const turn=await dispatchService.collectDispatch(run(input,ctx));
 expect(turn).toMatchObject({status:'FAILED',error:{code:'EXECUTION_TIMEOUT'}});
 expect(turn.skillRuns.map(s=>s.result.status)).toEqual(['SUCCESS','SUCCESS','CANCELLED']);
 expect(turn.agui).toHaveLength(2);expect(turn.mapComposition?.layers).toHaveLength(1);
 expect(toLegacyResult(turn).generativeView.views).toHaveLength(2);
});

it('does not restore denied data when a later summary hits the deadline',async()=>{
 const expire=controlledDeadline(),ctx={...createDevelopmentContext('vector'),deadlineAt:Date.now()+600000};
 ctx.principal={...ctx.principal,role:'CITY_EXPERT',jurisdiction:{city:'郑州市'}};
 const run=createMainAgent({listSkills:listSkillDefinitions,executeSkill,llm:{complete:async request=>{
  if(request.toolChoice==='auto')return {role:'assistant',content:null,tool_calls:[
   {id:'allowed',type:'function',function:{name:'skill_monitoring_data_table',arguments:'{"sql":"SELECT COUNT(*) AS n FROM fact_monitoring"}'}},
   {id:'denied',type:'function',function:{name:'skill_monitoring_data_table',arguments:'{"sql":"SELECT COUNT(*) AS n FROM fact_monitoring","city":"洛阳市"}'}}
  ]};
  expire();request.signal!.throwIfAborted();throw Error('Expected deadline');
 }}});
 const turn=await dispatchService.collectDispatch(run(input,ctx));
 expect(turn).toMatchObject({status:'FAILED',error:{code:'EXECUTION_TIMEOUT'}});
 expect(turn.skillRuns.map(s=>s.result.status)).toEqual(['SUCCESS','FAILED']);
 expect(turn.skillRuns[1].result.error?.code).toBe('FORBIDDEN_SCOPE');
 expect(turn.agui).toEqual([]);expect(toLegacyResult(turn).generativeView).toBeNull();
});

it('preserves the real map and chart through the SSE route and workbench when a native deadline fires',async()=>{
 let previews=0;
 const run=agent(request=>new Promise((_,reject)=>{
  const abort=()=>reject(request.signal!.reason);
  if(request.signal!.aborted)abort();else request.signal!.addEventListener('abort',abort,{once:true});
 }));
 vi.spyOn(dispatchService,'dispatch').mockImplementation((interaction,ctx)=>run(interaction,{...ctx,deadlineAt:Date.now()+2000}));
 setCsrfToken('test-only');
 vi.stubGlobal('fetch',async(url:string,init:RequestInit)=>{
  expect(url).toBe('/api/agent/stream-dispatch');
  const response=await POST(new NextRequest('http://localhost:9567'+url,{...init,signal:init.signal??undefined,method:'POST'}));
  expect(response.status).toBe(200);return response;
 });
 const controller=createWorkbenchController({domain:'vector',client:agentClient});
 controller.subscribe(()=>{if(controller.getState().busy&&controller.getState().view)previews++;});
 const turn=await controller.send(prompt);
 expect(previews).toBeGreaterThan(0);
 expect(turn).toMatchObject({status:'FAILED',error:{code:'EXECUTION_TIMEOUT'}});
 expect(controller.getState()).toMatchObject({busy:false,status:'FAILED',view:{type:'AGUI_RESULT_GROUP',runId:turn!.runId}});
 expect(controller.getState().view.views.at(-1).visualization.kind).toBe('bar');
 expect(controller.getState().messages.at(-1)?.generativeView).toEqual(controller.getState().view);
});

it('restores retained map and chart snapshots from an existing session after a timeout',async()=>{
 const ctx={...createDevelopmentContext('vector'),deadlineAt:Date.now()+600000};
 const first=await dispatchService.collectDispatch(agent()(input,ctx));
 const expire=controlledDeadline();
 const nextCtx={...ctx,runId:crypto.randomUUID(),deadlineAt:Date.now()+600000};
 const second=await dispatchService.collectDispatch(agent(request=>{expire();request.signal!.throwIfAborted();throw Error('Expected deadline');})({...input,sessionRef:first.session},nextCtx));
 expect(second).toMatchObject({status:'FAILED',session:{id:first.session!.id},error:{code:'EXECUTION_TIMEOUT'}});
 const result=await executeSkill('skill_session_manage',{action:'read',sessionId:first.session!.id},{...nextCtx,signal:undefined});
 const restored=restoreSession((result.payload as any).session);
 expect(restored.view).toMatchObject({type:'AGUI_RESULT_GROUP',runId:nextCtx.runId});
 expect(restored.messages.at(-1)?.generativeView).toEqual(restored.view);
 expect(restored.messages.at(-1)?.text).toContain('执行超时');
});
