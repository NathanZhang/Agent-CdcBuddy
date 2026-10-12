import {it,expect} from 'vitest';
import {createLLMClient} from '@/infrastructure/llm/client';

const env={SILICONFLOW_API_KEY:'test',SILICONFLOW_BASE_URL:'http://model-gateway.local/v1',SILICONFLOW_MODEL:'qwen3.8-27b'};
const request={messages:[{role:'user' as const,content:'查询点位'}],tools:[{type:'function',function:{name:'query',parameters:{type:'object'}}}],toolChoice:'auto' as const,onDelta:()=>{}};
const call={id:'query',type:'function',function:{name:'query',arguments:'{}'}};
const frame=(delta:unknown,finish_reason:string)=>`data: ${JSON.stringify({choices:[{delta,finish_reason}]})}\n\ndata: [DONE]\n\n`;
const stream=(wire:string)=>new Response(wire,{headers:{'Content-Type':'text/event-stream'}});

it.each([
 ['qwen3.8-27b',undefined,'medium'],
 ['qwen3.8-27b','','medium'],
 ['Qwen/Qwen3.8-27B','low','low'],
 ['Qwen/Qwen3.8-27B-FP8','medium','medium'],
 ['qwen3.8-27b','xhigh','xhigh'],
])('uses the selected Qwen3.8 effort in both the API and template (%s, %s)',async(model,configured,expected)=>{
 const client=createLLMClient({env:{...env,SILICONFLOW_MODEL:model,SILICONFLOW_REASONING_EFFORT:configured},fetch:async(_url,init)=>{
  const body=JSON.parse(init!.body as string);
  // Some gateways render from template kwargs without forwarding the API-level effort.
  if(body.reasoning_effort!==expected||body.chat_template_kwargs?.reasoning_effort!==expected)return new Response('',{status:400});
  expect(body.chat_template_kwargs.enable_thinking).toBe(true);
  return stream(frame({tool_calls:[{index:0,...call}]},'tool_calls'));
 }});
 expect((await client.complete(request)).tool_calls).toEqual([call]);
});

it.each(['synthesis','disabled','recovery'])('does not reactivate thinking through effort during %s',async(phase)=>{
 let attempts=0;
 const client=createLLMClient({env:{...env,SILICONFLOW_REASONING_EFFORT:'low',...(phase==='disabled'?{SILICONFLOW_ENABLE_THINKING:'false'}:{})},fetch:async(_url,init)=>{
  const body=JSON.parse(init!.body as string);attempts++;
  if(phase==='recovery'&&attempts===1)return stream(frame({reasoning_content:'未完成'},'length'));
  expect(body.reasoning_effort).toBeUndefined();expect(body.chat_template_kwargs.reasoning_effort).toBeUndefined();
  expect(body.enable_thinking).toBe(false);expect(body.chat_template_kwargs.enable_thinking).toBe(false);
  return stream(frame({content:'{"mode":"clarification","replyText":"请指定年份。"}'},'stop'));
 }});
 expect((await client.complete({...request,...(phase==='synthesis'?{toolChoice:'none' as const,tools:undefined}:{})})).content).toContain('请指定年份');
 expect(attempts).toBe(phase==='recovery'?2:1);
});

it.each([
 {SILICONFLOW_MODEL:'Qwen/Qwen3.6-27B'},
 {SILICONFLOW_BASE_URL:'https://api.siliconflow.cn/v1'},
])('preserves older model and SiliconFlow parameter contracts (%j)',async(overrides)=>{
 const client=createLLMClient({env:{...env,...overrides,SILICONFLOW_REASONING_EFFORT:'medium'},fetch:async(_url,init)=>{
  const body=JSON.parse(init!.body as string);
  expect(body.reasoning_effort).toBeUndefined();expect(body.chat_template_kwargs?.reasoning_effort).toBeUndefined();
  if(overrides.SILICONFLOW_BASE_URL)expect(body.thinking_budget).toBe(1024);
  return stream(frame({tool_calls:[{index:0,...call}]},'tool_calls'));
 }});
 expect((await client.complete(request)).tool_calls).toEqual([call]);
});

it('rejects an unsupported Qwen3.8 effort before calling the gateway',async()=>{
 let calls=0;
 const client=createLLMClient({env:{...env,SILICONFLOW_REASONING_EFFORT:'high'},fetch:async()=>{calls++;return stream(frame({tool_calls:[{index:0,...call}]},'tool_calls'));}});
 await expect(client.complete(request)).rejects.toMatchObject({code:'LLM_UNAVAILABLE',message:expect.stringContaining('SILICONFLOW_REASONING_EFFORT')});
 expect(calls).toBe(0);
});
