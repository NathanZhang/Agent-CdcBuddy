import {it,expect,vi,afterEach} from 'vitest';
import {createLLMClient,type LLMStreamDelta} from '@/infrastructure/llm/client';
import {createWorkbenchController} from '@/features/workbench/workbench-controller';
import {restoreSession} from '@/features/workbench/result-adapter';
import type {WorkbenchClient} from '@/features/workbench/session-client';
import type {AgentTurnResult} from '@/contracts/agent-interaction';
import {agentClient} from '@/features/workbench/session-client';
import {replyPreview} from '@/application/agent/stream-completion';
afterEach(()=>vi.unstubAllGlobals());

const env={SILICONFLOW_API_KEY:'test',SILICONFLOW_ROUTER_TIMEOUT_MS:'5000'};
const result:AgentTurnResult={runId:'r',interactionId:'i',status:'REVIEW_REQUIRED',replyText:'请指定时间。',reasoningText:'需要时间范围。',reasoningDuration:120,agui:[],skillRuns:[]};
const frame=(delta:unknown,finish_reason:string|null=null)=>`data: ${JSON.stringify({choices:[{index:0,delta,finish_reason}]})}\n\n`;
it('delivers reasoning before completion and assembles split Unicode and native tool arguments',async()=>{
 let wire!:ReadableStreamDefaultController<Uint8Array>;let sent:any;
 const deltas:LLMStreamDelta[]=[];const encoder=new TextEncoder();
 const client=createLLMClient({env,fetch:async(_url,init)=>{sent=JSON.parse(init!.body as string);return new Response(new ReadableStream({start(c){wire=c;}}),{headers:{'Content-Type':'text/event-stream'}});}});
 const pending=client.complete({messages:[{role:'user',content:'查询'}],onDelta:delta=>deltas.push(delta)});
 await new Promise(resolve=>setTimeout(resolve,0));
 for(const byte of encoder.encode(frame({reasoning_content:'先查数据。'})))wire.enqueue(new Uint8Array([byte]));
 await new Promise(resolve=>setTimeout(resolve,0));
 expect(deltas.filter(d=>d.type==='reasoning').map(d=>d.text).join('')).toBe('先查数据。');
 expect(sent).toMatchObject({stream:true,enable_thinking:true});
 wire.enqueue(encoder.encode(frame({tool_calls:[{index:0,id:'call',type:'function',function:{name:'query',arguments:'{"city":'}}]})+frame({tool_calls:[{index:0,function:{arguments:'"郑州"}'}}]},'tool_calls')+'data: [DONE]\n\n'));wire.close();
 expect((await pending).tool_calls?.[0]).toEqual({id:'call',type:'function',function:{name:'query',arguments:'{"city":"郑州"}'}});
});
it('rejects an interrupted provider stream even if its partial content looks valid',async()=>{
 const client=createLLMClient({env,fetch:async()=>new Response(frame({content:'{"mode":"clarification","replyText":"范围？"}'}),{headers:{'Content-Type':'text/event-stream'}})});
 await expect(client.complete({messages:[],onDelta:()=>{}})).rejects.toMatchObject({code:'INVALID_LLM_RESPONSE'});
});
it('updates a single pending reply, preserves reasoning, and ignores chunks after cancel',async()=>{
 let callbacks:Parameters<WorkbenchClient['interact']>[1];let finish!:(r:AgentTurnResult)=>void;
 const controller=createWorkbenchController({domain:'vector',client:{interact:async(_input,options)=>{callbacks=options;return new Promise(resolve=>{finish=resolve;});}}});
 const pending=controller.send('分析');
 callbacks?.onReasoningChunk?.('需要','需要');callbacks?.onReasoningChunk?.('时间范围。','需要时间范围。');callbacks?.onContentChunk?.('请指定','请指定');
 expect(controller.getState().messages.at(-1)).toMatchObject({sender:'agent',text:'请指定',reasoningText:'需要时间范围。',streaming:true});
 finish(result);await pending;
 expect(controller.getState().messages).toHaveLength(2);expect(controller.getState().messages.at(-1)).toMatchObject({text:'请指定时间。',reasoningText:'需要时间范围。',reasoningDuration:120,streaming:false});
 const second=controller.send('另一次');callbacks?.onReasoningChunk?.('未完成','未完成');controller.cancel();
 callbacks?.onReasoningChunk?.('过期','过期');finish(result);await second;
 expect(controller.getState().messages.at(-1)).toMatchObject({reasoningText:'未完成',streaming:false});expect(controller.getState().status).toBe('CANCELLED');
});
it('restores saved reasoning and duration from legacy session messages',()=>{
 expect(restoreSession({messages:[{sender:'agent',text:'回答',reasoning_text:'原始推理',reasoning_duration:1234}]}).messages[0]).toMatchObject({reasoningText:'原始推理',reasoningDuration:1234});
});

it('carries reasoning through the real browser transport without duplicating the final answer',async()=>{
 const sse=(event:string,data:unknown)=>`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
 const wire=sse('reasoning_start',{})+sse('reasoning_chunk',{text:'需要时间',replace:true})+sse('reasoning_chunk',{text:'需要时间范围。',replace:true})+sse('content_chunk',{text:'请指定',replace:true})+sse('reasoning_end',{durationMs:120})+sse('content_chunk',{text:'请指定时间。',replace:true})+sse('finish',{...result,success:true});
 vi.stubGlobal('fetch',async()=>new Response(wire,{headers:{'Content-Type':'text/event-stream'}}));
 const controller=createWorkbenchController({domain:'vector',client:agentClient});
 const snapshots:string[]=[];controller.subscribe(()=>snapshots.push(controller.getState().messages.at(-1)?.reasoningText ?? ''));
 await controller.send('分析');expect(snapshots).toContain('需要时间');
 expect(controller.getState().messages).toHaveLength(2);expect(controller.getState().messages.at(-1)).toMatchObject({text:'请指定时间。',reasoningText:'需要时间范围。',streaming:false});
});
it('decodes escaped answer text without showing incomplete escapes or protocol JSON',()=>{
 expect(replyPreview('{"mode":"clarification","replyText":"第一行\\n引号\\"好\\"\\u4e')).toBe('第一行\n引号"好"');
 expect(replyPreview('{"mode":"clarification","replyText":"\\uD83D')).toBe('');
 expect(replyPreview('{"mode":"clarification","replyText":"\\uD83D\\uDE00"}')).toBe('😀');
 expect(replyPreview('{"mode":"continue","reason":"继续查询"}')).toBe('');
});

it('streams top-level replies in any field order while retaining the business evidence gate',()=>{
 expect(replyPreview('{"mode":"clarification","reason":{"replyText":"嵌套内容"},"replyText":"请提供时间')).toBe('请提供时间');
 expect(replyPreview('{"replyText":"请提供时间。","mode":"clarification"}',false)).toBe('请提供时间。');
 expect(replyPreview('{"replyText":"无证据业务答案","mode":"answer"}',false)).toBe('');
 expect(replyPreview('{"mode":"answer","extra":[1,{"text":"a,b}"}],"replyText":"真实结论',true)).toBe('真实结论');
 expect(replyPreview('{"nested":{"mode":"answer","replyText":"嵌套内容"},"mode":"clarification"}')).toBe('');
});

it('resets a failed attempt before streaming the fallback response',async()=>{
 let attempt=0,wire!:ReadableStreamDefaultController<Uint8Array>;let visible='';const encoder=new TextEncoder();
 const client=createLLMClient({env,fetch:async()=>{
  if(++attempt===1)return new Response(new ReadableStream({start(c){wire=c;}}),{headers:{'Content-Type':'text/event-stream'}});
  return new Response(frame({reasoning_content:'第二次推理'})+frame({content:'完整答复'},'stop'),{headers:{'Content-Type':'text/event-stream'}});
 }});
 const pending=client.complete({messages:[],onDelta:delta=>{if(delta.type==='reset')visible='';else if(delta.type==='reasoning')visible+=delta.text;}});
 await new Promise(resolve=>setTimeout(resolve,0));wire.enqueue(encoder.encode(frame({reasoning_content:'失效片段'})));
 await new Promise(resolve=>setTimeout(resolve,0));expect(visible).toBe('失效片段');wire.error(Error('connection lost'));
 expect((await pending).content).toBe('完整答复');expect(visible).toBe('第二次推理');expect(attempt).toBe(2);
});

it('shows completed data while summary streams, retains it on summary failure, and ignores stale views after cancel',async()=>{
 let callbacks:Parameters<WorkbenchClient['interact']>[1];let finish!:(r:AgentTurnResult)=>void;
 const controller=createWorkbenchController({domain:'vector',client:{interact:async(_input,options)=>{callbacks=options;return new Promise(resolve=>{finish=resolve;});}}});
 const payload={type:'DATA_TABLE_VIEW',data:[{n:17}]};
 const partial:AgentTurnResult={...result,status:'FAILED',replyText:'文字总结未完成',error:{code:'INVALID_LLM_RESPONSE',message:'length'},agui:[{version:'1',runId:'r',component:payload.type,result:{schemaVersion:'1',metrics:{},runId:'r',domain:'vector',status:'SUCCESS',method:'query',datasets:[],qualityFlags:[],payload}}]};
 const pending=controller.send('查询');callbacks?.onGenerativeView?.(payload);
 expect(controller.getState().busy).toBe(true);expect(controller.getState().view).toMatchObject(payload);
 finish(partial);await pending;expect(controller.getState().status).toBe('FAILED');expect(controller.getState().view).toMatchObject(payload);
 const next=controller.send('另一次');controller.cancel();callbacks?.onGenerativeView?.(payload);finish(partial);await next;
 expect(controller.getState().view).toBeNull();expect(controller.getState().status).toBe('CANCELLED');
});
