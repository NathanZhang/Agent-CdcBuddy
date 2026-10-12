import { describe,it,expect,vi } from 'vitest';
import { createLLMClient } from '@/infrastructure/llm/client';
const env={SILICONFLOW_API_KEY:'test-only',SILICONFLOW_MODEL:'primary',SILICONFLOW_FALLBACK_MODEL:'secondary',SILICONFLOW_ROUTER_TIMEOUT_MS:'10'};
const request={messages:[{role:'user' as const,content:'查询'}]};
describe('LLM boundary',()=>{
 it('retries another model then returns only a validated LLM message',async()=>{
  const models:string[]=[];const client=createLLMClient({env,fetch:async(_url,init)=>{models.push(JSON.parse(init!.body as string).model);if(models.length===1)return new Response('',{status:503});return Response.json({choices:[{message:{role:'assistant',content:'回答'}}]});}});
  expect((await client.complete(request)).content).toBe('回答');expect(models).toEqual(['primary','secondary']);
 });
 it('exhausted model retries produce failure and never fabricate a response',async()=>{
  const fetcher=vi.fn(async()=>{throw Error('network failure');});await expect(createLLMClient({env,fetch:fetcher}).complete(request)).rejects.toMatchObject({code:'LLM_UNAVAILABLE'});expect(fetcher).toHaveBeenCalledTimes(2);
 });
 it('missing API key never issues an external request',async()=>{const fetcher=vi.fn();await expect(createLLMClient({env:{},fetch:fetcher}).complete(request)).rejects.toMatchObject({code:'LLM_UNAVAILABLE'});expect(fetcher).not.toHaveBeenCalled();});
 it('does not retry malformed or denied responses as successful content',async()=>{
  for(const response of [Response.json({choices:[{message:{role:'assistant',content:null,tool_calls:[{id:'x',type:'function',function:{name:'a',arguments:{}}}]}}]}),new Response('',{status:401})]){
   const fetcher=vi.fn(async()=>response);await expect(createLLMClient({env,fetch:fetcher}).complete(request)).rejects.toBeInstanceOf(Error);expect(fetcher).toHaveBeenCalledTimes(1);
  }
 });
 it('caller cancellation does not trigger retry',async()=>{const fetcher=vi.fn();await expect(createLLMClient({env,fetch:fetcher}).complete({...request,signal:AbortSignal.abort()})).rejects.toBeDefined();expect(fetcher).not.toHaveBeenCalled();});
 it('times out the body read as well as the fetch',async()=>{
  const fetcher=vi.fn(async(_url,init)=>new Response(new ReadableStream({start(controller){init!.signal!.addEventListener('abort',()=>controller.error(new Error('body timeout')));}})));
  await expect(createLLMClient({env,fetch:fetcher}).complete(request)).rejects.toMatchObject({code:'LLM_UNAVAILABLE'});expect(fetcher).toHaveBeenCalledTimes(2);
 });
});
