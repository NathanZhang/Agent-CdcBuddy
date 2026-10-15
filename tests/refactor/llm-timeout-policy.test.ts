import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {createLLMClient,type LLMRequest} from '@/infrastructure/llm/client';
import {generateSessionTitle} from '@/application/agent/session-title';
import {getLLMTimeouts} from '@/lib/config/llm-timeout';

const env={SILICONFLOW_API_KEY:'test'};
const encoder=new TextEncoder();
const frame=(delta:unknown,finish_reason:string|null=null)=>`data: ${JSON.stringify({choices:[{delta,finish_reason}]})}\n\n`;
beforeEach(()=>vi.useFakeTimers());
afterEach(()=>vi.useRealTimers());

function provider(){
 const wires:ReadableStreamDefaultController<Uint8Array>[]=[];
 const bodies:any[]=[];
 const cancel=vi.fn();
 const fetcher=vi.fn(async(_url,init)=>{
  bodies.push(JSON.parse(init!.body as string));
  return new Response(new ReadableStream<Uint8Array>({start(controller){
   wires.push(controller);
   init!.signal!.addEventListener('abort',()=>controller.error(init!.signal!.reason),{once:true});
  },cancel}),{headers:{'Content-Type':'text/event-stream'}});
 });
 return {fetcher,bodies,cancel,send:(text:string)=>wires.at(-1)!.enqueue(encoder.encode(text))};
}

it('defaults to 300s first output, 180s silence and 300s non-stream compatibility',()=>{
 expect(getLLMTimeouts({})).toEqual({firstOutputMs:300000,idleMs:180000,nonStreamMs:300000});
 expect(getLLMTimeouts({SILICONFLOW_ROUTER_TIMEOUT_MS:'60000'})).toEqual({firstOutputMs:60000,idleMs:60000,nonStreamMs:60000});
 expect(getLLMTimeouts({SILICONFLOW_ROUTER_TIMEOUT_MS:'60000',SILICONFLOW_FIRST_OUTPUT_TIMEOUT_MS:'300000',SILICONFLOW_IDLE_TIMEOUT_MS:'180000'})).toEqual({firstOutputMs:300000,idleMs:180000,nonStreamMs:300000});
});

it('waits 300s for actual first output even if headers, heartbeats and empty deltas arrive',async()=>{
 const source=provider();
 const pending=createLLMClient({env,fetch:source.fetcher}).complete({messages:[]}).catch(error=>error);
 for(let attempt=0;attempt<2;attempt++){
  for(let i=0;i<5;i++){
   await vi.advanceTimersByTimeAsync(59999);
   source.send(': heartbeat\n\n'+frame({role:'assistant',content:'',reasoning_content:'',tool_calls:[{index:0,function:{arguments:''}}]}));
   await vi.advanceTimersByTimeAsync(0);
  }
  expect(source.fetcher).toHaveBeenCalledTimes(attempt+1);
  await vi.advanceTimersByTimeAsync(5);
 }
 expect(await pending).toMatchObject({code:'LLM_TIMEOUT',timeoutDetails:{kind:'first-output',timeoutMs:300000,attempts:2}});
 expect(vi.getTimerCount()).toBe(0);
});

it('switches to a fresh 180s idle window after output and restarts first-output waiting on retry',async()=>{
 const source=provider();
 const pending=createLLMClient({env,fetch:source.fetcher}).complete({messages:[]}).catch(error=>error);
 await vi.advanceTimersByTimeAsync(290000);source.send(frame({reasoning_content:'开始分析'}));await vi.advanceTimersByTimeAsync(0);
 await vi.advanceTimersByTimeAsync(179999);expect(source.fetcher).toHaveBeenCalledTimes(1);
 source.send(': ping\n\n'+frame({content:''}));await vi.advanceTimersByTimeAsync(1);
 expect(source.fetcher).toHaveBeenCalledTimes(2);
 await vi.advanceTimersByTimeAsync(299999);expect(source.fetcher).toHaveBeenCalledTimes(2);
 await vi.advanceTimersByTimeAsync(1);
 expect(await pending).toMatchObject({code:'LLM_TIMEOUT',timeoutDetails:{kind:'first-output',attempts:2}});
 expect(vi.getTimerCount()).toBe(0);
});

it.each(['intent','tool-selection','synthesis','write-intent','vision','text2sql'] as const)('keeps private or visible %s output alive for 40 minutes without an EOF',async phase=>{
 const source=provider();
 const request:LLMRequest={messages:[],phase,...(['intent','synthesis','write-intent','vision'].includes(phase)?{toolChoice:'none' as const}:{})};
 const pending=createLLMClient({env,fetch:source.fetcher}).complete(request);
 for(let i=0;i<20;i++){
  await vi.advanceTimersByTimeAsync(120000);
  source.send(frame(i%2?{content:'片段'}:{reasoning_content:'思考'}));await vi.advanceTimersByTimeAsync(0);
 }
 source.send(frame({},'stop'));
 expect((await pending).content).toBe('片段'.repeat(10));
 expect(source.fetcher).toHaveBeenCalledTimes(1);
 expect(source.bodies[0]).toMatchObject({stream:true,enable_thinking:phase==='intent'||phase==='tool-selection'});
 expect(source.cancel).toHaveBeenCalledOnce();expect(vi.getTimerCount()).toBe(0);
});

it('renews private native tool name and argument output without a UI subscriber',async()=>{
 const source=provider();const pending=createLLMClient({env,fetch:source.fetcher}).complete({messages:[]});
 await vi.advanceTimersByTimeAsync(290000);
 source.send(frame({tool_calls:[{index:0,id:'q',type:'function',function:{name:'query',arguments:'{"sql":'}}]}));await vi.advanceTimersByTimeAsync(0);
 await vi.advanceTimersByTimeAsync(170000);
 source.send(frame({tool_calls:[{index:0,function:{arguments:'"SELECT 1"}'}}]},'tool_calls'));
 expect((await pending).tool_calls?.[0].function).toEqual({name:'query',arguments:'{"sql":"SELECT 1"}'});
 expect(source.fetcher).toHaveBeenCalledOnce();expect(vi.getTimerCount()).toBe(0);
});

it('honors an explicit caller deadline despite continuous output and does not retry',async()=>{
 const source=provider();
 const pending=createLLMClient({env,fetch:source.fetcher}).complete({messages:[],deadlineAt:Date.now()+400000}).catch(error=>error);
 for(let i=0;i<3;i++){
  await vi.advanceTimersByTimeAsync(120000);source.send(frame({content:'持续生成'}));await vi.advanceTimersByTimeAsync(0);
 }
 await vi.advanceTimersByTimeAsync(40000);
 expect(await pending).toMatchObject({code:'LLM_TIMEOUT',timeoutDetails:{kind:'deadline',attempts:1,lastOutputAt:expect.any(Number)}});
 expect(source.fetcher).toHaveBeenCalledOnce();expect(vi.getTimerCount()).toBe(0);
});

it('bounds non-stream JSON body reading from attempt start even if bytes keep arriving',async()=>{
 let wire!:ReadableStreamDefaultController<Uint8Array>;
 const fetcher=vi.fn(async(_url,init)=>{
  await new Promise(resolve=>setTimeout(resolve,200000));
  return new Response(new ReadableStream<Uint8Array>({start(controller){wire=controller;init!.signal!.addEventListener('abort',()=>controller.error(init!.signal!.reason),{once:true});}}),{headers:{'Content-Type':'application/json'}});
 });
 const pending=createLLMClient({env,fetch:fetcher}).complete({messages:[]}).catch(error=>error);
 for(let attempt=0;attempt<2;attempt++){
  await vi.advanceTimersByTimeAsync(200000);
  for(let i=0;i<4;i++){await vi.advanceTimersByTimeAsync(20000);wire.enqueue(encoder.encode(' '));}
  await vi.advanceTimersByTimeAsync(19999);expect(fetcher).toHaveBeenCalledTimes(attempt+1);
  await vi.advanceTimersByTimeAsync(1);
 }
 expect(await pending).toMatchObject({code:'LLM_TIMEOUT',message:expect.stringContaining('非流式响应'),timeoutDetails:{kind:'non-stream',elapsedMs:600000}});
 expect(vi.getTimerCount()).toBe(0);
});

it('keeps the title exception at 8s even when title generation is producing tokens',async()=>{
 const source=provider();
 const pending=generateSessionTitle(createLLMClient({env,fetch:source.fetcher}),{domain:'vector',userInput:'分析',replyText:'结果'});
 await vi.advanceTimersByTimeAsync(7000);source.send(frame({content:'{"title":"尚未生成完成'}));await vi.advanceTimersByTimeAsync(0);
 await vi.advanceTimersByTimeAsync(1000);expect(await pending).toBeUndefined();
 expect(source.fetcher).toHaveBeenCalledOnce();expect(vi.getTimerCount()).toBe(0);
});

it('rejects a complete JSON response whose headers arrive after a shorter non-stream budget',async()=>{
 const fetcher=vi.fn(async()=>{
  await new Promise(resolve=>setTimeout(resolve,200000));
  return Response.json({choices:[{message:{role:'assistant',content:'已超过兼容等待预算'}}]});
 });
 const pending=createLLMClient({env:{...env,SILICONFLOW_NON_STREAM_TIMEOUT_MS:'100000'},fetch:fetcher}).complete({messages:[]}).catch(error=>error);
 await vi.advanceTimersByTimeAsync(400000);
 expect(await pending).toMatchObject({code:'LLM_TIMEOUT',timeoutDetails:{kind:'non-stream',timeoutMs:100000,elapsedMs:400000}});
 expect(fetcher).toHaveBeenCalledTimes(2);expect(vi.getTimerCount()).toBe(0);
});
