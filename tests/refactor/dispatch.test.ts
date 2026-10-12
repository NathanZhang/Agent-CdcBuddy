import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {beforeAll,afterAll} from 'vitest';
import { describe,it,expect } from 'vitest';
import { dispatch,collectDispatch } from '@/application/dispatch/dispatch-service';
import { createMainAgent } from '@/application/agent/main-agent';
import { executeSkill,listSkillDefinitions } from '@/application/skills/skill-service';
import type { LLMClient,LLMMessage } from '@/infrastructure/llm/client';
import { createDevelopmentContext } from '@/lib/skills/server-executor';
import { normalizeInteraction,toLegacyResult,toLegacyEvents } from '@/application/dispatch/legacy-adapter';
import { createSseDecoder } from '@/application/dispatch/sse';
const traceDirectory=mkdtempSync(join(tmpdir(),'cdc-dispatch-trace-'));
const previousBusinessPath=process.env.APP_BUSINESS_DB_PATH;
beforeAll(()=>{process.env.APP_BUSINESS_DB_PATH=join(traceDirectory,'business.db');});
afterAll(()=>{if(previousBusinessPath===undefined)delete process.env.APP_BUSINESS_DB_PATH;else process.env.APP_BUSINESS_DB_PATH=previousBusinessPath;rmSync(traceDirectory,{recursive:true,force:true});});
const input={interactionId:'turn-fixture',kind:'conversation' as const,userInput:'统计监测记录'};
const tool=(id='call-1')=>({id,type:'function' as const,function:{name:'skill_monitoring_data_table',arguments:'{"sql":"SELECT COUNT(*) AS n FROM fact_monitoring"}'}});
const answer={role:'assistant' as const,content:JSON.stringify({mode:'answer',replyText:'数据库记录数见结果表，来源为病媒实测数据。'})};
function stub(messages:LLMMessage[]):LLMClient{let n=0;return {complete:async()=>messages[n++] ?? answer};}
function titled(llm:LLMClient):LLMClient{return {complete:request=>request.messages[0].content?.includes('你负责提炼会话标题')?Promise.resolve({role:'assistant',content:'{"title":"监测记录查询"}'}):llm.complete(request)};}
function agent(llm:LLMClient,onSkill?:()=>void){return createMainAgent({llm:titled(llm),listSkills:listSkillDefinitions,executeSkill:async(id,args,ctx)=>{if(id!=='skill_session_journal')onSkill?.();return executeSkill(id,args,ctx);}});}
describe('single main Agent dispatch',()=>{
 it('HTTP and stream collect identical actual skill evidence, LLM reply and AG-UI',async()=>{
  let executions=0;const response=[{role:'assistant' as const,content:null,tool_calls:[tool()]},answer];
  const ctx=createDevelopmentContext('vector');ctx.runId='same-run';
  const streamed=[];for await(const event of dispatch(input,ctx,agent(stub(response),()=>executions++)))streamed.push(event);
  const one=await collectDispatch(streamed);const two=await collectDispatch(dispatch(input,ctx,agent(stub(response),()=>executions++)));
  const comparable=(value:unknown)=>JSON.parse(JSON.stringify(value,(key,item)=>key==='executionTimeMs'?undefined:item));expect(comparable(two)).toEqual(comparable(one));expect(executions).toBe(2);expect(one.status).toBe('SUCCESS');expect(one.replyText).toContain('来源');
  expect(one.skillRuns[0].result.payload).toMatchObject({type:'DATA_TABLE_VIEW',data:[{n:expect.any(Number)}]});
  expect(one.agui[0].result).toEqual(one.skillRuns[0].result);expect(one.agui[0].runId).toBe(ctx.runId);
  expect(toLegacyResult(one).generativeView).toMatchObject({type:'DATA_TABLE_VIEW'});
 });
 it('LLM outage fails and runs zero skills without keyword fallback',async()=>{
  let calls=0;const result=await collectDispatch(dispatch(input,createDevelopmentContext('vector'),agent({complete:async()=>{throw Error('timeout');}},()=>calls++)));
  expect(result.status).toBe('FAILED');expect(result.error?.code).toBe('LLM_UNAVAILABLE');expect(calls).toBe(0);expect(result.agui).toEqual([]);
 });
 it('executes two tool calls in order and then asks LLM to ground final answer',async()=>{
  const order:string[]=[];let rounds=0;
  const llm:LLMClient={complete:async(request)=>{rounds++;if(rounds===1)return {role:'assistant',content:null,tool_calls:[tool('first'),{...tool('second'),function:{name:'skill_monitoring_data_table',arguments:'{"sql":"SELECT COUNT(*) AS n2 FROM fact_monitoring"}'}}]};expect(request.messages.filter(m=>m.role==='tool').map(m=>m.tool_call_id)).toEqual(['first','second']);return answer;}};
  const turn=await collectDispatch(dispatch(input,createDevelopmentContext('vector'),createMainAgent({llm:titled(llm),listSkills:listSkillDefinitions,executeSkill:async(id,args,ctx)=>{if(id!=='skill_session_journal')order.push(id);return executeSkill(id,args,ctx);}})));
  expect(order).toHaveLength(2);expect(rounds).toBe(2);expect(turn.skillRuns.map(r=>r.callId)).toEqual(['first','second']);expect(turn.status).toBe('SUCCESS');
 });
 it('halts before executing calls beyond a whole-batch budget',async()=>{
  let calls=0,round=0;const looping:LLMClient={complete:async request=>request.toolChoice==='none'?{role:'assistant',content:'{"mode":"continue","reason":"还需要其他统计"}'}:({role:'assistant',content:null,tool_calls:Array.from({length:3},(_,i)=>({...tool(`${++round}-${i}`),function:{name:'skill_monitoring_data_table',arguments:JSON.stringify({sql:`SELECT COUNT(*) AS n${round} FROM fact_monitoring`})}}))})};
  const turn=await collectDispatch(dispatch(input,createDevelopmentContext('vector'),agent(looping,()=>calls++)));
  expect(turn.status).toBe('FAILED');expect(turn.error?.code).toBe('TOOL_BUDGET_EXCEEDED');expect(calls).toBe(6);
 });
 it('malformed JSON tool arguments never become empty valid input',async()=>{
  let calls=0;const bad=tool();bad.function.arguments='{bad';
  const turn=await collectDispatch(dispatch(input,createDevelopmentContext('vector'),agent(stub([{role:'assistant',content:null,tool_calls:[bad]}]),()=>calls++)));
  expect(turn.status).toBe('FAILED');expect(turn.error?.code).toBe('INVALID_TOOL_ARGUMENTS');expect(calls).toBe(0);
 });
 it('failed or empty skills cannot reuse a successful old view',async()=>{
  const unavailable={...tool(),function:{name:'skill_resistance_evolution',arguments:'{}'}};
  const turn=await collectDispatch(dispatch({...input,viewContext:{type:'OLD_SUCCESS'}},createDevelopmentContext('vector'),agent(stub([{role:'assistant',content:null,tool_calls:[unavailable]},answer]))));
  expect(turn.status).toBe('FAILED');expect(toLegacyResult(turn).success).toBe(false);expect(toLegacyResult(turn).generativeView).toBeNull();
 });
 it('rejects business answers without executed skills but permits explicit clarification',async()=>{
  const failed=await collectDispatch(dispatch(input,createDevelopmentContext('vector'),agent(stub([answer]))));expect(failed.error?.code).toBe('MISSING_SKILL_EVIDENCE');
  const question=await collectDispatch(dispatch(input,createDevelopmentContext('vector'),agent(stub([{role:'assistant',content:'{"mode":"clarification","replyText":"请指定查询时间范围。"}'}]))));
  expect(question.status).toBe('REVIEW_REQUIRED');expect(question.skillRuns).toEqual([]);
 });
 it('binds domain to server context and ignores forged client principal/domain',()=>{
  const interaction=normalizeInteraction({promptText:'查询',domain:'foodborne',userRole:'PROVINCIAL_ADMIN',principal:{userId:'attacker'}});
  expect(interaction).not.toHaveProperty('domain');expect(interaction).not.toHaveProperty('principal');
 });
 it('cancellation does not launch a skill or retain an old view',async()=>{
  const ctx=createDevelopmentContext('vector');ctx.signal=AbortSignal.abort();let calls=0;
  const turn=await collectDispatch(dispatch(input,ctx,agent(stub([answer]),()=>calls++)));expect(turn.status).toBe('CANCELLED');expect(calls).toBe(0);expect(turn.agui).toEqual([]);
 });
 it('retains SSE event names and Unicode across arbitrary byte boundaries',()=>{
  const decoder=createSseDecoder();const raw=new TextEncoder().encode('event: tool_call_start\r\ndata: {"toolId":"技能甲"}\r\n\r\nevent: finish\ndata: {"success":false}\n\n');
  const events=[];for(const byte of raw)events.push(...decoder.push(new Uint8Array([byte])));events.push(...decoder.finish());
  expect(events).toEqual([{event:'tool_call_start',data:{toolId:'技能甲'}},{event:'finish',data:{success:false}}]);
  expect(()=>createSseDecoder().push(new TextEncoder().encode('event: finish\ndata: broken\n\n'))).toThrow();
  expect(toLegacyEvents({version:'1',runId:'r',seq:1,type:'failed',data:{code:'FAIL',message:'真实失败'}})[0].event).toBe('error');
 });
});

it('reserves the last model round for an LLM-generated grounded final response',async()=>{
 let rounds=0;let batches=0;const llm:LLMClient={complete:async(request)=>{rounds++;if(request.toolChoice==='auto')return {role:'assistant',content:null,tool_calls:[{...tool(`batch-${++batches}`),function:{name:'skill_monitoring_data_table',arguments:JSON.stringify({sql:`SELECT COUNT(*) AS n${batches} FROM fact_monitoring`})}}]};if(batches<3)return {role:'assistant',content:'{"mode":"continue","reason":"需要不同汇总"}'};return answer;}};
 const result=await collectDispatch(dispatch(input,createDevelopmentContext('vector'),agent(llm)));expect(rounds).toBe(6);expect(result.status).toBe('SUCCESS');expect(result.skillRuns).toHaveLength(3);expect(result.replyText).toBe(JSON.parse(answer.content).replyText);
});

it('summarizes after tools without reopening native tools unless LLM explicitly requests another step',async()=>{
 let rounds=0;const llm:LLMClient={complete:async request=>{rounds++;if(rounds===1)return {role:'assistant',content:null,tool_calls:[tool()]};expect(request.toolChoice).toBe('none');expect(request.tools).toBeUndefined();return answer;}};
 const result=await collectDispatch(dispatch(input,createDevelopmentContext('vector'),agent(llm)));expect(result.status).toBe('SUCCESS');expect(rounds).toBe(2);expect(result.agui).toHaveLength(1);
});

it('asks the LLM once to correct invalid final JSON without reexecuting Skills',async()=>{
 let rounds=0,executions=0;const llm:LLMClient={complete:async request=>{rounds++;if(rounds===1)return {role:'assistant',content:null,tool_calls:[tool()]};if(rounds===2)return {role:'assistant',content:'```json\n{"mode":"answer","replyText":"格式错误"}\n```'};expect(request.toolChoice).toBe('none');expect(request.tools).toBeUndefined();expect(request.messages.some(m=>m.role==='tool')).toBe(true);return answer;}};
 const result=await collectDispatch(dispatch(input,createDevelopmentContext('vector'),agent(llm,()=>executions++)));expect(result.status).toBe('SUCCESS');expect(rounds).toBe(3);expect(executions).toBe(1);expect(result.agui).toHaveLength(1);
});
it('fails transparently when the bounded LLM format correction also fails',async()=>{
 let rounds=0,executions=0;const llm:LLMClient={complete:async()=>{rounds++;return rounds===1?{role:'assistant',content:null,tool_calls:[tool()]}:{role:'assistant',content:'not JSON'};}};const result=await collectDispatch(dispatch(input,createDevelopmentContext('vector'),agent(llm,()=>executions++)));expect(rounds).toBe(3);expect(executions).toBe(1);expect(result.error?.code).toBe('INVALID_LLM_RESPONSE');expect(result.status).toBe('FAILED');expect(result.agui).toHaveLength(1);expect(toLegacyResult(result).generativeView).toMatchObject({type:'DATA_TABLE_VIEW'});
});

it('publishes reasoning and decoded answer previews before the model completes, then records the exact reasoning',async()=>{
 let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
 const llm:LLMClient={complete:async request=>{
  request.onDelta?.({type:'reasoning',text:'需要先确认时间范围。'});
  request.onDelta?.({type:'content',text:'{"mode":"clarification","replyText":"请指定\\n'});
  await gate;
  request.onDelta?.({type:'content',text:'时间范围。"}'});
  return {role:'assistant',content:'{"mode":"clarification","replyText":"请指定\\n时间范围。"}'};
 }};
 const events=dispatch(input,createDevelopmentContext('vector'),agent(llm))[Symbol.asyncIterator]();
 expect((await events.next()).value.type).toBe('started');
 const reasoning=(await events.next()).value;expect(reasoning).toMatchObject({type:'reasoning',data:{text:'需要先确认时间范围。'}});
 expect(toLegacyEvents(reasoning)[0]).toMatchObject({event:'reasoning_chunk',data:{text:'需要先确认时间范围。',replace:true}});
 expect((await events.next()).value).toMatchObject({type:'content',data:{text:'请指定\n'}});
 release();const remaining=[];while(true){const next=await events.next();if(next.done)break;remaining.push(next.value);}
 const result=remaining.find(e=>e.type==='result')!.data.result;
 expect(result).toMatchObject({replyText:'请指定\n时间范围。',reasoningText:'需要先确认时间范围。',reasoningDuration:expect.any(Number)});
});

it('publishes executed query views before LLM summary and retains them on summary timeout',async()=>{
 let rounds=0;const events=[];const llm:LLMClient={complete:async()=>{if(++rounds===1)return {role:'assistant',content:null,tool_calls:[tool()]};throw Error('summary timeout');}};
 for await(const event of dispatch(input,createDevelopmentContext('vector'),agent(llm)))events.push(event);
 const completed=events.find(e=>e.type==='tool_completed')!;
 expect(toLegacyEvents(completed).find(e=>e.event==='generative_view')?.data.view).toMatchObject({type:'DATA_TABLE_VIEW',data:[{n:expect.any(Number)}]});
 const turn=await collectDispatch(events);expect(turn.status).toBe('FAILED');expect(turn.error?.code).toBe('LLM_UNAVAILABLE');
 expect(toLegacyResult(turn).generativeView).toMatchObject({type:'DATA_TABLE_VIEW',data:[{n:expect.any(Number)}]});
});

it('clears successful partial views when a later tool is denied by jurisdiction',async()=>{
 const ctx=createDevelopmentContext('vector');ctx.principal={...ctx.principal,role:'CITY_EXPERT',jurisdiction:{city:'郑州市'}};
 const denied={...tool('denied'),function:{name:'skill_monitoring_data_table',arguments:JSON.stringify({sql:'SELECT COUNT(*) AS n FROM fact_monitoring',city:'洛阳市'})}};
 const turn=await collectDispatch(dispatch(input,ctx,agent(stub([{role:'assistant',content:null,tool_calls:[tool(),denied]},answer]))));
 expect(turn.skillRuns[0].result.status).toBe('SUCCESS');expect(turn.error?.code).toBe('FORBIDDEN_SCOPE');
 expect(turn.status).toBe('FAILED');expect(turn.agui).toEqual([]);expect(toLegacyResult(turn).generativeView).toBeNull();
});
