import {it,expect} from 'vitest';
import {createLLMClient,type LLMStreamDelta} from '@/infrastructure/llm/client';

const env={SILICONFLOW_API_KEY:'test',SILICONFLOW_BASE_URL:'http://model-gateway.local/v1',SILICONFLOW_MODEL:'primary',SILICONFLOW_FALLBACK_MODEL:'secondary'};
const messages=[{role:'user' as const,content:'展示点位地图并总结，完整明细见工作台'}];
const answer='{"mode":"answer","replyText":"已展示 **143** 个点位，明细见工作台。"}';
const frame=(delta:unknown,finish_reason:string|null=null)=>`data: ${JSON.stringify({choices:[{index:0,delta,finish_reason}]})}\n\n`;
const stream=(wire:string)=>new Response(wire+'data: [DONE]\n\n',{headers:{'Content-Type':'text/event-stream'}});

it('finishes evidence synthesis without spending its answer budget on gateway thinking',async()=>{
 let attempts=0;
 const client=createLLMClient({env,fetch:async(_url,init)=>{
  attempts++;
  const body=JSON.parse(init!.body as string);
  return body.chat_template_kwargs?.enable_thinking===false
   ?stream(frame({content:answer},'stop'))
   :stream(frame({reasoning_content:'继续在推理中组织长篇总结'},'length'));
 }});
 expect((await client.complete({messages,toolChoice:'none',onDelta:()=>{}})).content).toBe(answer);
 expect(attempts).toBe(1);
});

it('regenerates a length-limited stream once with the same evidence and clears discarded previews',async()=>{
 const bodies:any[]=[];let visible='';const deltas:LLMStreamDelta[]=[];
 const client=createLLMClient({env,fetch:async(_url,init)=>{
  const body=JSON.parse(init!.body as string);bodies.push(body);
  if(bodies.length===1)return stream(frame({reasoning_content:'过长推理'})+frame({content:'{"mode":"answer","replyText":"截断'},'length'));
  expect(body.model).toBe('primary');expect(body.messages.slice(0,-1)).toEqual(messages);
  expect(body.messages.at(-1).content).not.toContain('截断');
  expect(body.enable_thinking).toBe(false);expect(body.chat_template_kwargs.enable_thinking).toBe(false);
  expect(body.max_tokens).toBeGreaterThanOrEqual(8192);
  return stream(frame({content:answer},'stop'));
 }});
 const result=await client.complete({messages,onDelta:delta=>{deltas.push(delta);if(delta.type==='reset')visible='';else visible+=delta.text;}});
 expect(result.content).toBe(answer);expect(visible).toBe(answer);expect(bodies).toHaveLength(2);
 expect(deltas.filter(delta=>delta.type==='reset')).toHaveLength(2);
});

it('rejects length-limited JSON responses even when their content parses as a complete answer',async()=>{
 let attempts=0;
 const client=createLLMClient({env,fetch:async()=>{attempts++;return Response.json({choices:[{finish_reason:'length',message:{role:'assistant',content:answer}}]});}});
 await expect(client.complete({messages})).rejects.toMatchObject({code:'LLM_OUTPUT_TRUNCATED'});
 expect(attempts).toBe(2);
});

it('never returns truncated tool calls or retries indefinitely when recovery also reaches length',async()=>{
 let attempts=0;
 const client=createLLMClient({env,fetch:async()=>{attempts++;return stream(frame({tool_calls:[{index:0,id:'partial',type:'function',function:{name:'query',arguments:'{"sql":'}}]},'length'));}});
 await expect(client.complete({messages,tools:[{type:'function',function:{name:'query'}}],onDelta:()=>{}})).rejects.toMatchObject({code:'LLM_OUTPUT_TRUNCATED'});
 expect(attempts).toBe(2);
});

it('does not recover content-filtered responses as a token limit',async()=>{
 let attempts=0;
 const client=createLLMClient({env,fetch:async()=>{attempts++;return stream(frame({content:answer},'content_filter'));}});
 await expect(client.complete({messages,onDelta:()=>{}})).rejects.toMatchObject({code:'INVALID_LLM_RESPONSE'});
 expect(attempts).toBe(1);
});

it('honors cancellation before any length recovery request',async()=>{
 let attempts=0;const abort=new AbortController();
 const client=createLLMClient({env,fetch:async()=>{attempts++;return stream(frame({reasoning_content:'过长推理'},'length'));}});
 await expect(client.complete({messages,signal:abort.signal,onDelta:delta=>{if(delta.type==='reasoning')abort.abort();}})).rejects.toBeDefined();
 expect(attempts).toBe(1);
});
