import { beforeEach,afterEach,it,expect,vi } from 'vitest';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createMainAgent } from '@/application/agent/main-agent';
import { normalizeInteraction,toLegacyEvents } from '@/application/dispatch/legacy-adapter';
import { collectDispatch } from '@/application/dispatch/dispatch-service';
import * as dispatchService from '@/application/dispatch/dispatch-service';
import { NextRequest } from 'next/server';
import { POST as streamPost } from '@/app/api/agent/stream-dispatch/route';
import { executeSkill,listSkillDefinitions } from '@/application/skills/skill-service';
import { createDevelopmentContext } from '@/lib/skills/server-executor';
import { getAppBusinessProvider } from '@/lib/db/app-business-provider';
import { getRecordedTurn,recordAgentTurn,withBusinessDb } from '@/infrastructure/db/business-store';
import { migrateDatabase } from '@/infrastructure/db/migrations';
import { createWorkbenchController } from '@/features/workbench/workbench-controller';
import { agentClient } from '@/features/workbench/session-client';
import { restoreSession } from '@/features/workbench/result-adapter';
import { adaptFunctionalInteraction } from '@/application/agent/interaction-adapter';
import { LLMError,type LLMClient } from '@/infrastructure/llm/client';
import type { AgentDomain } from '@/contracts/dataset';
import type { ExecutionContext } from '@/contracts/execution-context';

let dir:string;
beforeEach(()=>{dir=mkdtempSync(join(tmpdir(),'cdc-history-'));const file=join(dir,'business.db');migrateDatabase(file);vi.stubEnv('APP_BUSINESS_DB_PATH',file);});
afterEach(()=>{getAppBusinessProvider().close();vi.restoreAllMocks();vi.unstubAllEnvs();vi.unstubAllGlobals();rmSync(dir,{recursive:true,force:true});});
const clarification:LLMClient={complete:async request=>{if(request.messages[0].content?.includes('你负责提炼会话标题'))return {role:'assistant',content:'{"title":"监测数据时间范围确认"}'};request.onDelta?.({type:'reasoning',text:'需要明确时间范围。'});return {role:'assistant',content:'{"mode":"clarification","replyText":"请提供时间范围。"}'};}};
const input={interactionId:'history-test',kind:'conversation' as const,userInput:'分析监测数据'};
const agent=(llm:LLMClient=clarification)=>createMainAgent({llm,listSkills:listSkillDefinitions,executeSkill});
const read=async(id:string,ctx:ExecutionContext)=>((await executeSkill('skill_session_manage',{action:'read',sessionId:id},ctx)).payload as any)?.session;
function browserTransport(ctx:ExecutionContext,llm:LLMClient=clarification){
 const run=agent(llm);
 vi.stubGlobal('fetch',async(url:string,init?:RequestInit)=>{
  if(url==='/api/auth/me')return Response.json({csrfToken:null});
  const interaction=normalizeInteraction(JSON.parse(init!.body as string));let wire='';
  for await(const event of run(interaction,{...ctx,runId:crypto.randomUUID(),signal:init?.signal ?? undefined})){
   for(const frame of toLegacyEvents(event))wire+=`event: ${frame.event}\ndata: ${JSON.stringify(frame.data)}\n\n`;
  }
  return new Response(wire,{headers:{'Content-Type':'text/event-stream'}});
 });
}

it('repeated new-conversation clicks create no database rows before a completed exchange',async()=>{
 const ctx=createDevelopmentContext('vector');browserTransport(ctx);const controller=createWorkbenchController({domain:'vector',client:agentClient});
 for(let i=0;i<5;i++)await controller.startSession();
 expect(withBusinessDb(db=>db.prepare('SELECT COUNT(*) n FROM biz_chat_sessions').get())).toEqual({n:0});
 expect(withBusinessDb(db=>db.prepare('SELECT COUNT(*) n FROM biz_agent_runs').get())).toEqual({n:0});
 await controller.send('开始分析');expect(withBusinessDb(db=>db.prepare('SELECT COUNT(*) n FROM biz_chat_sessions').get())).toEqual({n:1});
 expect((await read(controller.getState().sessionId!,ctx)).messageCount).toBe(2);
});

it.each(['failure','cancel'] as const)('an unfinished first exchange (%s) creates no historical session',async outcome=>{
 const ctx=createDevelopmentContext('vector');const abort=new AbortController();ctx.signal=abort.signal;
 const result=await collectDispatch(agent({complete:async()=>{if(outcome==='cancel')abort.abort();throw new LLMError('LLM_TIMEOUT','模型响应超时');}})(input,ctx));
 expect(result.status).toBe(outcome==='cancel'?'CANCELLED':'FAILED');expect(result.session).toBeUndefined();
 expect(withBusinessDb(db=>db.prepare('SELECT COUNT(*) n FROM biz_chat_sessions').get())).toEqual({n:0});
 expect(getRecordedTurn(ctx.runId,{...ctx,signal:undefined}).result.status).toBe(result.status);
});

it.each(['我的蚊媒分析','新建会话：郑州趋势'])('the LLM derives the first title once and preserves manual rename %s',async manualTitle=>{
 const ctx=createDevelopmentContext('vector');let titles=0;const titleEvidence:any[]=[];
 browserTransport(ctx,{complete:async request=>{
  if(request.messages[0].content?.includes('你负责提炼会话标题')){
   titles++;expect(request.tools).toBeUndefined();expect(request.toolChoice).toBe('none');titleEvidence.push(JSON.parse(request.messages[1].content!));
   return {role:'assistant',content:'{"title":"郑州蚊媒监测趋势分析"}'};
  }
  return {role:'assistant',content:'{"mode":"clarification","replyText":"请提供监测时间范围。"}'};
 }});
 const controller=createWorkbenchController({domain:'vector',client:agentClient});await controller.send('请分析郑州近一个月的蚊媒趋势');
 expect(controller.getState().title).toBe('郑州蚊媒监测趋势分析');expect(titleEvidence).toEqual([{domain:'vector',userInput:'请分析郑州近一个月的蚊媒趋势',replyText:'请提供监测时间范围。'}]);
 const id=controller.getState().sessionId!;await controller.interact(adaptFunctionalInteraction({type:'session.rename',id,args:{title:manualTitle}}));
 await controller.send('继续分析');expect(titles).toBe(1);expect(controller.getState().title).toBe(manualTitle);expect((await read(id,ctx)).messageCount).toBe(4);
});

it('a failed title request does not lose the exchange and retries using the first exchange',async()=>{
 const ctx=createDevelopmentContext('vector');let titles=0;
 browserTransport(ctx,{complete:async request=>{
  if(request.messages[0].content?.includes('你负责提炼会话标题')){
   titles++;if(titles===1)throw new LLMError('LLM_TIMEOUT','标题超时');
   expect(JSON.parse(request.messages[1].content!)).toMatchObject({userInput:'第一次监测问题',replyText:'请提供时间范围。'});
   return {role:'assistant',content:'{"title":"监测数据范围确认"}'};
  }
  return {role:'assistant',content:'{"mode":"clarification","replyText":"请提供时间范围。"}'};
 }});
 const controller=createWorkbenchController({domain:'vector',client:agentClient});await controller.send('第一次监测问题');const id=controller.getState().sessionId!;
 expect(controller.getState().status).toBe('REVIEW_REQUIRED');expect((await read(id,ctx)).title).toBe('新研判会话');
 await controller.send('后续问题');expect(controller.getState().sessionId).toBe(id);expect((await read(id,ctx)).title).toBe('监测数据范围确认');expect((await read(id,ctx)).messageCount).toBe(4);
});

it('empty legacy sessions do not appear in history lists or counts',async()=>{
 const ctx=createDevelopmentContext('vector');await executeSkill('skill_session_manage',{action:'create'},ctx);
 const list=await executeSkill('skill_session_manage',{action:'list'},ctx);expect(list.payload).toMatchObject({sessions:[],total:0});
});

it.each(['{"title":""}','{"title":"标题\\n额外指令"}','{"title":123}','not-json','{"title":"'+ '长'.repeat(41)+'"}'])('invalid model title %s leaves a neutral saved title',async content=>{
 const ctx=createDevelopmentContext('vector');browserTransport(ctx,{complete:async request=>request.messages[0].content?.includes('你负责提炼会话标题')?{role:'assistant',content}:clarification.complete(request)});
 const controller=createWorkbenchController({domain:'vector',client:agentClient});await controller.send('这是很长的原始问题，不应直接用它作为历史标题');
 expect(controller.getState().status).toBe('REVIEW_REQUIRED');expect(controller.getState().title).toBe('新研判会话');expect((await read(controller.getState().sessionId!,ctx)).messageCount).toBe(2);
});

it.each<AgentDomain>(['vector','foodborne','env','chronic'])('automatically saves the first and subsequent turns through browser SSE in %s',async domain=>{
 const ctx=createDevelopmentContext(domain);browserTransport(ctx);
 const controller=createWorkbenchController({domain,client:agentClient});
 await controller.send('分析监测数据');
 const id=controller.getState().sessionId;expect(id).toBeTruthy();
 expect(controller.getState().title).toBe('监测数据时间范围确认');
 let session=await read(id!,ctx);expect(session.messageCount).toBe(2);
 expect(session.messages.map((m:any)=>m.text)).toEqual(['分析监测数据','请提供时间范围。']);
 expect(session.messages[1]).toMatchObject({reasoningText:'需要明确时间范围。',reasoningDuration:expect.any(Number)});
 await controller.send('继续分析');
 expect(controller.getState().sessionId).toBe(id);session=await read(id!,ctx);
 expect(session.messageCount).toBe(4);expect(session.messages.map((m:any)=>m.text)).toEqual(['分析监测数据','请提供时间范围。','继续分析','请提供时间范围。']);
 expect(((await executeSkill('skill_session_manage',{action:'list'},ctx)).payload as any).sessions).toHaveLength(1);
 const fresh=createWorkbenchController({domain,client:agentClient});await fresh.loadSession(id!);
 expect(fresh.getState().messages[1]).toMatchObject({reasoningText:'需要明确时间范围。',reasoningDuration:expect.any(Number)});
 const other={...ctx,principal:{...ctx.principal,userId:'other-owner'}};expect(await read(id!,other)).toBeUndefined();
});

it('saves real query snapshots and restores per-message views without duplicate journal writes',async()=>{
 const ctx=createDevelopmentContext('vector');let round=0;
 const run=agent({complete:async()=>++round===1?{role:'assistant',content:null,tool_calls:[{id:'query',type:'function',function:{name:'skill_monitoring_data_table',arguments:'{"sql":"SELECT COUNT(*) AS n FROM fact_monitoring"}'}}]}:{role:'assistant',content:'{"mode":"answer","replyText":"已读取实测监测记录。"}'}});
 const result=await collectDispatch(run(input,ctx));expect(result.status).toBe('SUCCESS');
 const id=(result as any).session?.id;expect(id).toBeTruthy();
 const session=await read(id,ctx);expect(session.lastGenerativeView).toMatchObject({type:'DATA_TABLE_VIEW',runId:ctx.runId,data:[{n:expect.any(Number)}]});
 expect(restoreSession(session).messages[1]).toMatchObject({runId:ctx.runId,generativeView:session.lastGenerativeView});
 expect((await executeSkill('skill_session_journal',{sessionId:id,sourceRunId:ctx.runId},ctx)).status).toBe('SUCCESS');
 expect((await read(id,ctx)).messageCount).toBe(2);expect(getRecordedTurn(ctx.runId,ctx).result).toMatchObject({session:{id}});
});

it('restores grouped chart/table outputs and can reopen an earlier turn after a no-data reply',async()=>{
 const ctx=createDevelopmentContext('vector');let businessCalls=0;
 browserTransport(ctx,{complete:async request=>{
  if(request.messages[0].content?.includes('你负责提炼会话标题'))return {role:'assistant',content:'{"title":"地市监测记录对比"}'};
  if(++businessCalls===1)return {role:'assistant',content:null,tool_calls:[
   {id:'chart',type:'function',function:{name:'skill_monitoring_data_table',arguments:JSON.stringify({sql:'SELECT l.city AS city, COUNT(*) AS n FROM fact_monitoring f JOIN dim_location l ON f.location_id=l.location_id GROUP BY l.city ORDER BY n DESC LIMIT 3',visualization:{kind:'bar',xKey:'city',yKey:'n',unit:'条记录'}})}},
   {id:'table',type:'function',function:{name:'skill_monitoring_data_table',arguments:'{"sql":"SELECT COUNT(*) AS n FROM fact_monitoring"}'}}
  ]};
  if(businessCalls===2)return {role:'assistant',content:'{"mode":"answer","replyText":"已查询地市记录对比与全省总数。"}'};
  if(businessCalls===3)return {role:'assistant',content:null,tool_calls:[{id:'empty',type:'function',function:{name:'skill_monitoring_data_table',arguments:'{"sql":"SELECT capture_count FROM fact_monitoring WHERE 1=0"}'}}]};
  return {role:'assistant',content:'{"mode":"answer","replyText":"该范围没有监测数据。"}'};
 }});
 const original=createWorkbenchController({domain:'vector',client:agentClient});await original.send('对比地市监测记录并画柱状图');const id=original.getState().sessionId!;
 const firstView=JSON.parse(JSON.stringify(original.getState().view));expect(firstView).toMatchObject({type:'AGUI_RESULT_GROUP',views:[{type:'DATA_TABLE_VIEW',visualization:{kind:'bar',xKey:'city',yKey:'n',unit:'条记录'}},{type:'DATA_TABLE_VIEW'}]});
 await original.send('查询不存在城市');expect(original.getState().status).toBe('NO_DATA');
 getAppBusinessProvider().close();
 const fresh=createWorkbenchController({domain:'vector',client:agentClient});await fresh.loadSession(id);
 expect(businessCalls).toBe(4);expect(fresh.getState().view).toBeNull();
 const previous=fresh.getState().messages[1];expect(previous.generativeView).toEqual(firstView);
 const before=fresh.getState().messages;const selected=fresh.showMessageView(previous.id);
 expect(selected).toBe(true);expect(fresh.getState().view).toEqual(firstView);expect(fresh.getState().messages).toEqual(before);expect(businessCalls).toBe(4);
 const React=await import('react');const {renderToStaticMarkup}=await import('react-dom/server');
 const {GenerativeComponentRenderer}=await import('@/components/ag-ui/GenerativeComponentRenderer');const {ThemeProvider}=await import('@/lib/theme/theme-context');
 const html=renderToStaticMarkup(React.createElement(ThemeProvider,null,React.createElement(GenerativeComponentRenderer,{view:fresh.getState().view})));
 expect(html).toContain('<svg');expect(html).toContain('分组对比');expect(html).toContain('实测数据');
});

it.each(['failure','cancel'] as const)('saves a turn ending in %s before returning its final result',async outcome=>{
 const owner=createDevelopmentContext('vector');const first=await collectDispatch(agent()(input,owner));const ctx={...owner,runId:crypto.randomUUID()};const abort=new AbortController();ctx.signal=abort.signal;
 const result=await collectDispatch(agent({complete:async()=>{if(outcome==='cancel')abort.abort();throw new LLMError('LLM_TIMEOUT','模型响应超时');}})({...input,sessionRef:{id:first.session!.id}},ctx));
 expect(result.status).toBe(outcome==='cancel'?'CANCELLED':'FAILED');
 const id=(result as any).session?.id;expect(id).toBeTruthy();
 const session=await read(id,{...ctx,signal:undefined});expect(session.messageCount).toBe(4);expect(session.messages[3].text).toBe(result.replyText);
});

it.each(['started','reasoning'])('SSE cancellation at the %s event finishes saving the interrupted turn',async boundary=>{
 vi.stubEnv('AGENT_DOMAIN','vector');const ctx=createDevelopmentContext('vector');const first=await collectDispatch(agent()(input,ctx));const abort=new AbortController();
 vi.spyOn(dispatchService,'dispatch').mockImplementation((interaction,ctx)=>(async function*(){
  for await(const event of agent()(interaction,ctx)){
   if(event.type===boundary)abort.abort();
   yield event;
  }
 })());
 const response=await streamPost(new NextRequest('http://localhost:9567/api/agent/stream-dispatch',{method:'POST',body:JSON.stringify({promptText:'中断中的分析',sessionRef:{id:first.session!.id}}),signal:abort.signal}));
 await response.text();
 const list=await executeSkill('skill_session_manage',{action:'list'},ctx);
 const sessions=(list.payload as any).sessions;expect(sessions).toHaveLength(1);
 expect((await read(sessions[0].sessionId,ctx)).messages[3]).toMatchObject({text:'操作已取消',...(boundary==='reasoning'?{reasoningText:'需要明确时间范围。'}:{})});
});

it('concurrent journal replay creates only one session and one message pair',async()=>{
 const ctx=createDevelopmentContext('vector');
 recordAgentTurn(input,{runId:ctx.runId,interactionId:input.interactionId,status:'REVIEW_REQUIRED',replyText:'请提供时间范围。',agui:[],skillRuns:[]},ctx);
 const outcomes=await Promise.all([executeSkill('skill_session_journal',{sourceRunId:ctx.runId},ctx),executeSkill('skill_session_journal',{sourceRunId:ctx.runId},ctx)]);
 expect(outcomes.map(r=>r.status)).toEqual(['SUCCESS','SUCCESS']);
 const id=(outcomes[0].payload as any).sessionId;expect((await read(id,ctx)).messageCount).toBe(2);
 expect(((await executeSkill('skill_session_manage',{action:'list'},ctx)).payload as any).sessions).toHaveLength(1);
});

it('cancelled history keeps the answer preview that was already displayed',async()=>{
 const owner=createDevelopmentContext('vector');const first=await collectDispatch(agent()(input,owner));const ctx={...owner,runId:crypto.randomUUID()};const abort=new AbortController();ctx.signal=abort.signal;
 const run=agent({complete:async request=>{request.onDelta?.({type:'content',text:'{"mode":"clarification","replyText":"请提供时间'});return {role:'assistant',content:'{"mode":"clarification","replyText":"请提供时间范围。"}'};}});
 let result:any;
 for await(const event of run({...input,sessionRef:{id:first.session!.id}},ctx)){if(event.type==='content')abort.abort();if(event.type==='result')result=event.data.result;}
 expect(result.status).toBe('CANCELLED');expect(result.replyText).toBe('请提供时间\n\n操作已取消');
 expect((await read(result.session.id,{...ctx,signal:undefined})).messages[3].text).toBe('请提供时间\n\n操作已取消');
});

it('automatically journals personal chat for public viewers without authorizing business writes',async()=>{
 const ctx=createDevelopmentContext('vector');ctx.principal.role='PUBLIC_VIEWER';
 const result=await collectDispatch(agent()(input,ctx));expect(result.status).toBe('REVIEW_REQUIRED');
 expect((await read((result as any).session?.id,ctx)).messageCount).toBe(2);
 expect((await executeSkill('skill_session_manage',{action:'create'},ctx)).error?.code).toBe('FORBIDDEN_OPERATION');
});

it('reports automatic-save failure visibly while preserving the original answer',async()=>{
 const ctx=createDevelopmentContext('vector');
 const run=createMainAgent({llm:clarification,listSkills:listSkillDefinitions,executeSkill:async(id,args,context)=>id==='skill_session_journal'?{schemaVersion:'1',runId:context.runId,domain:context.domain,status:'FAILED',method:'journal',datasets:[],payload:null,metrics:{},qualityFlags:[],error:{code:'EXECUTION_FAILED',message:'disk full',retryable:false}}:executeSkill(id,args,context)});
 const result=await collectDispatch(run(input,ctx));expect(result.status).toBe('FAILED');expect(result.error?.code).toBe('SESSION_JOURNAL_FAILED');
 expect(result.replyText).toContain('请提供时间范围。');expect(result.replyText).toContain('历史会话自动保存失败');expect((result as any).session).toBeUndefined();
});

it('new sessions and deletion/clearing restart persistence without reusing a deleted ID',async()=>{
 const ctx=createDevelopmentContext('vector');browserTransport(ctx);const controller=createWorkbenchController({domain:'vector',client:agentClient});
 await controller.send('第一轮');const first=controller.getState().sessionId;expect(first).toBeTruthy();
 for(let i=0;i<4;i++)await controller.startSession();expect(controller.getState().sessionId).toBeNull();
 expect(((await executeSkill('skill_session_manage',{action:'list'},ctx)).payload as any).sessions).toHaveLength(1);
 await controller.send('第二轮');const second=controller.getState().sessionId;expect(second).toBeTruthy();expect(second).not.toBe(first);
 expect((await read(first!,ctx)).messageCount).toBe(2);expect((await read(second!,ctx)).messageCount).toBe(2);
 await controller.interact(adaptFunctionalInteraction({type:'session.delete',id:second!}));expect(controller.getState().sessionId).toBeNull();
 await controller.send('删除后继续');expect(controller.getState().sessionId).toBeTruthy();expect(controller.getState().sessionId).not.toBe(second);
 await controller.interact(adaptFunctionalInteraction({type:'session.clear'}));expect(controller.getState().sessionId).toBeNull();
 expect(((await executeSkill('skill_session_manage',{action:'list'},ctx)).payload as any).sessions).toEqual([]);
});

it('rejects a foreign session reference before running the model',async()=>{
 const owner=createDevelopmentContext('vector');const created=await executeSkill('skill_session_manage',{action:'create'},owner);const id=(created.payload as any).session.sessionId;
 const other={...owner,principal:{...owner.principal,userId:'other-owner'},runId:crypto.randomUUID()};let modelCalls=0;
 const result=await collectDispatch(agent({complete:async request=>{modelCalls++;return clarification.complete(request);}})({...input,sessionRef:{id}},other));
 expect(result.status).toBe('FAILED');expect(modelCalls).toBe(0);expect((await read(id,owner)).messageCount).toBe(0);
 expect(withBusinessDb(db=>db.prepare('SELECT COUNT(*) n FROM biz_chat_sessions WHERE user_id=?').get('other-owner'))).toEqual({n:0});
});
