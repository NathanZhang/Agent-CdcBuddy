import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {createLLMClient} from '@/infrastructure/llm/client';

const env={SILICONFLOW_API_KEY:'test',SILICONFLOW_ROUTER_TIMEOUT_MS:'60000'};
const encoder=new TextEncoder();
const frame=(delta:unknown,finish_reason:string|null=null)=>`data: ${JSON.stringify({choices:[{index:0,delta,finish_reason}]})}\n\n`;
beforeEach(()=>vi.useFakeTimers());
afterEach(()=>vi.useRealTimers());

function provider(){
 const streams:ReadableStreamDefaultController<Uint8Array>[]=[];
 const fetcher=vi.fn(async(_url,init)=>new Response(new ReadableStream<Uint8Array>({start(controller){
  streams.push(controller);init!.signal!.addEventListener('abort',()=>controller.error(init!.signal!.reason),{once:true});
 }}),{headers:{'Content-Type':'text/event-stream'}}));
 return {fetcher,send:(text:string)=>streams.at(-1)!.enqueue(encoder.encode(text)),close:()=>streams.at(-1)!.close()};
}

it('keeps continuous reasoning, answer and tool deltas alive beyond multiple original deadlines',async()=>{
 const source=provider();const deltas:string[]=[];
 const pending=createLLMClient({env,fetch:source.fetcher}).complete({messages:[],onDelta:d=>deltas.push(d.type)});
 const outcome=pending.then(value=>({value}),error=>({error}));await vi.advanceTimersByTimeAsync(0);
 for(const delta of [
  {reasoning_content:'第一步'},
  {reasoning_content:'第二步'},
  {content:'正在查询'},
  {tool_calls:[{index:0,id:'call',type:'function',function:{name:'query',arguments:'{"city":'}}]},
  {tool_calls:[{index:0,function:{arguments:'"郑州"}'}}]},
 ]){
  await vi.advanceTimersByTimeAsync(45000);expect(source.fetcher).toHaveBeenCalledTimes(1);source.send(frame(delta));await vi.advanceTimersByTimeAsync(0);
 }
 source.send(frame({},'tool_calls'));source.close();
 expect(await outcome).toMatchObject({value:{content:'正在查询',tool_calls:[{function:{arguments:'{"city":"郑州"}'}}]}});
 expect(source.fetcher).toHaveBeenCalledTimes(1);expect(deltas).toContain('reasoning');expect(vi.getTimerCount()).toBe(0);
});

it('retries only after a full idle window since the last output, and still times out a stalled retry',async()=>{
 const source=provider();const pending=createLLMClient({env,fetch:source.fetcher}).complete({messages:[],onDelta:()=>{}});
 const outcome=pending.catch(error=>error);await vi.advanceTimersByTimeAsync(45000);source.send(frame({reasoning_content:'有进展'}));await vi.advanceTimersByTimeAsync(0);
 await vi.advanceTimersByTimeAsync(59999);expect(source.fetcher).toHaveBeenCalledTimes(1);
 await vi.advanceTimersByTimeAsync(1);expect(source.fetcher).toHaveBeenCalledTimes(2);
 await vi.advanceTimersByTimeAsync(60000);
 expect(await outcome).toMatchObject({code:'LLM_TIMEOUT',message:expect.stringContaining('连续 60000 ms 未收到有效输出')});expect(vi.getTimerCount()).toBe(0);
});

it('heartbeat comments and empty deltas cannot keep a stuck model alive',async()=>{
 const source=provider();const outcome=createLLMClient({env,fetch:source.fetcher}).complete({messages:[],onDelta:()=>{}}).catch(error=>error);
 for(let attempt=0;attempt<2;attempt++){
  await vi.advanceTimersByTimeAsync(45000);source.send(': keep-alive\n\n'+frame({role:'assistant',content:'',reasoning_content:''}));
  await vi.advanceTimersByTimeAsync(15000);
 }
 expect(await outcome).toMatchObject({code:'LLM_TIMEOUT'});expect(source.fetcher).toHaveBeenCalledTimes(2);expect(vi.getTimerCount()).toBe(0);
});

it('user cancellation stops an active stream immediately without a retry or dangling deadline',async()=>{
 const source=provider();const abort=new AbortController();
 const outcome=createLLMClient({env,fetch:source.fetcher}).complete({messages:[],signal:abort.signal,onDelta:()=>{}}).catch(error=>error);
 await vi.advanceTimersByTimeAsync(45000);source.send(frame({reasoning_content:'进行中'}));await vi.advanceTimersByTimeAsync(0);
 abort.abort(new Error('user stopped'));expect(await outcome).toMatchObject({message:'user stopped'});
 await vi.advanceTimersByTimeAsync(120000);expect(source.fetcher).toHaveBeenCalledTimes(1);expect(vi.getTimerCount()).toBe(0);
});
