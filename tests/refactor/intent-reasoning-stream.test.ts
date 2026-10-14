import {afterAll,beforeAll,expect,it} from 'vitest';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createMainAgent} from '@/application/agent/main-agent';
import {createLLMClient,type LLMClient} from '@/infrastructure/llm/client';
import {executeSkill,listSkillDefinitions} from '@/application/skills/skill-service';
import {createDevelopmentContext} from '@/lib/skills/server-executor';
import {getRecordedTurn} from '@/infrastructure/db/business-store';
import {toLegacyEvents} from '@/application/dispatch/legacy-adapter';
import type {RunEvent} from '@/contracts/run-event';
import type {AgentTurnResult} from '@/contracts/agent-interaction';

const dir=mkdtempSync(path.join(tmpdir(),'cdc-intent-reasoning-')),previous=process.env.APP_BUSINESS_DB_PATH;
beforeAll(()=>process.env.APP_BUSINESS_DB_PATH=path.join(dir,'business.db'));
afterAll(()=>{if(previous===undefined)delete process.env.APP_BUSINESS_DB_PATH;else process.env.APP_BUSINESS_DB_PATH=previous;rmSync(dir,{recursive:true,force:true});});
const text='显示河南省地图',evidence={source:'current',start:0,end:text.length,quote:text},clear={op:'clear',evidence};
const intent={task:'map_display',relation:'new',displayRegion:{op:'set',value:{includeCandidateIds:['410000'],excludeCandidateIds:[]},evidence},dataRegion:clear,time:clear,filters:{},layerRequests:[],mapOperations:[],mapOptions:{basemap:'vec'}};
const frame=(delta:unknown,finish_reason:string|null=null)=>`data: ${JSON.stringify({choices:[{delta,finish_reason}]})}\n\n`;

it.each([false,true])('streams intent JSON separately from reasoning and respects disabled thinking (%s)',async(disabled)=>{
 const deltas:any[]=[];
 const client=createLLMClient({env:{SILICONFLOW_API_KEY:'test',...(disabled?{SILICONFLOW_ENABLE_THINKING:'false'}:{})},fetch:async(_url,init)=>{
  expect(JSON.parse(String(init?.body))).toMatchObject({stream:true,enable_thinking:!disabled,tool_choice:'none',response_format:{type:'json_object'}});
  return new Response(frame({reasoning_content:'识别地域。'})+frame({content:JSON.stringify(intent)},'stop'),{headers:{'Content-Type':'text/event-stream'}});
 }});
 expect(JSON.parse((await client.complete({messages:[],phase:'intent',toolChoice:'none',onDelta:delta=>deltas.push(delta)})).content!)).toEqual(intent);
 expect(deltas).toContainEqual({type:'reasoning',text:'识别地域。'});
});

it.each(['SUCCESS','REVIEW_REQUIRED','FAILED','CANCELLED'] as const)('shows intent reasoning before completion and saves it for %s',async(status)=>{
 const controller=new AbortController(),ctx={...createDevelopmentContext('vector'),signal:controller.signal},events:RunEvent[]=[];
 let release!:()=>void,observed!:()=>void,calls=0;
 const gate=new Promise<void>(resolve=>{release=resolve;}),visible=new Promise<void>(resolve=>{observed=resolve;});
 const llm:LLMClient={complete:async request=>{
  if(request.phase==='intent'){
   calls++;
   request.onDelta?.({type:'reset',text:''});
   request.onDelta?.({type:'reasoning',text:'应被替换的失败片段'});
   request.onDelta?.({type:'reset',text:''});
   request.onDelta?.({type:'reasoning',text:calls===1?'识别河南省范围。':'复核任务和地域证据。'});
   if(calls===1)await gate;
   const value=status==='FAILED'?{}:status==='REVIEW_REQUIRED'?{...intent,task:'clarification',displayRegion:clear,questions:['请明确展示内容。']}:intent;
   request.onDelta?.({type:'content',text:JSON.stringify(value)});
   return {role:'assistant',content:JSON.stringify(value)};
  }
  if(request.messages[0].content?.includes('你负责提炼会话标题'))return {role:'assistant',content:'{"title":"河南省地图"}'};
  request.onDelta?.({type:'reset',text:''});
  request.onDelta?.({type:'reasoning',text:'底图已执行，汇总结果。'});
  return {role:'assistant',content:'{"mode":"answer","replyText":"地图已展示。"}'};
 }};
 const run=createMainAgent({llm,listSkills:listSkillDefinitions,executeSkill,enableRegionIntent:true});
 const completion=(async()=>{for await(const event of run({interactionId:'intent-reasoning',kind:'conversation',userInput:text},ctx)){
  events.push(event);
  if(event.type==='reasoning'&&event.data.text.includes('识别河南省范围。'))observed();
 }})();
 await visible;
 try{
  expect(events.some(event=>event.type==='result')).toBe(false);
  const frame=toLegacyEvents(events.at(-1)!)[0];
  expect(frame).toMatchObject({event:'reasoning_chunk',data:{replace:true,text:'【意图识别 · 第 1 轮】\n识别河南省范围。'}});
 }finally{if(status==='CANCELLED')controller.abort();release();}
 await completion;
 const result=events.find(event=>event.type==='result')!.data.result as AgentTurnResult;
 expect(result.status).toBe(status);
 expect(result.reasoningText).toContain('【意图识别 · 第 1 轮】\n识别河南省范围。');
 expect(result.reasoningText).not.toContain('应被替换');
 expect(result.reasoningText).not.toContain('includeCandidateIds');
 expect(result.reasoningDuration).toEqual(expect.any(Number));
 if(status==='SUCCESS'||status==='FAILED')expect(result.reasoningText).toContain('【意图识别 · 第 2 轮】\n复核任务和地域证据。');
 if(status==='SUCCESS')expect(result.reasoningText).toContain('底图已执行，汇总结果。');
 expect(getRecordedTurn(ctx.runId,ctx).result.reasoningText).toBe(result.reasoningText);
});
