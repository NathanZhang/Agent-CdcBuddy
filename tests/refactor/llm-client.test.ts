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
  await expect(createLLMClient({env,fetch:fetcher}).complete(request)).rejects.toMatchObject({code:'LLM_TIMEOUT'});expect(fetcher).toHaveBeenCalledTimes(2);
 });
});
it('treats nullable vendor tool_calls as absent while preserving actual assistant content',async()=>{
 const response={choices:[{message:{role:'assistant',content:'{"mode":"answer","replyText":"实际查询结果。"}',tool_calls:null}}]};
 const message=await createLLMClient({env,fetch:async()=>Response.json(response)}).complete(request);
 expect(message.content).toContain('实际查询结果');expect(message.tool_calls).toBeUndefined();
});

it('uses bounded non-thinking native function calls without exposing model reasoning',async()=>{
 let sent:any;
 await createLLMClient({env,fetch:async(_url,init)=>{sent=JSON.parse(init!.body as string);return Response.json({choices:[{message:{role:'assistant',content:'{"mode":"answer","replyText":"结果"}',reasoning_content:'private reasoning'}}]});}}).complete(request);
 expect(sent.enable_thinking).toBe(false);expect(sent.max_tokens).toBe(4096);expect(sent.temperature).toBe(0.7);
});

it('requests vendor JSON mode only for the no-tools synthesis phase',async()=>{
 const bodies:any[]=[];const client=createLLMClient({env,fetch:async(_url,init)=>{bodies.push(JSON.parse(init!.body as string));return Response.json({choices:[{message:{role:'assistant',content:'{"mode":"answer","replyText":"结果"}'}}]});}});await client.complete({...request,toolChoice:'none'});await client.complete({...request,tools:[{type:'function',function:{name:'query'}}],toolChoice:'auto'});expect(bodies[0].response_format).toEqual({type:'json_object'});expect(bodies[1].response_format).toBeUndefined();
});


it('OpenAI-compatible gateways disable template thinking before expecting a tool response',async()=>{
 const client=createLLMClient({env:{...env,SILICONFLOW_BASE_URL:'http://model-gateway.local/v1'},fetch:async(_url,init)=>{
  const body=JSON.parse(init!.body as string);
  // This gateway ignores SiliconFlow's top-level enable_thinking, exactly as the live probe did.
  return Response.json({choices:[{message:body.chat_template_kwargs?.enable_thinking===false
   ?{role:'assistant',content:null,tool_calls:[{id:'query',type:'function',function:{name:'query',arguments:'{}'}}]}
   :{role:'assistant',content:null,reasoning_content:'Still thinking'}}]});
 }});
 const result=await client.complete({...request,tools:[{type:'function',function:{name:'query'}}]});
 expect(result.tool_calls?.[0].function.name).toBe('query');
});
it('SiliconFlow keeps its own non-thinking API contract',async()=>{
 let body:any;
 await createLLMClient({env,fetch:async(_url,init)=>{body=JSON.parse(init!.body as string);return Response.json({choices:[{message:{role:'assistant',content:'回答'}}]});}}).complete(request);
 expect(body.enable_thinking).toBe(false);expect(body.chat_template_kwargs).toBeUndefined();
});
it('deadline failure reports model, phase, timeout and attempts instead of generic unavailability',async()=>{
 const client=createLLMClient({env,fetch:async(_url,init)=>new Promise((_resolve,reject)=>init!.signal!.addEventListener('abort',()=>reject(init!.signal!.reason),{once:true}))});
 await expect(client.complete({...request,toolChoice:'none'})).rejects.toMatchObject({code:'LLM_TIMEOUT',message:expect.stringContaining('结果汇总')});
});
