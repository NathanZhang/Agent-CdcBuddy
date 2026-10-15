import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {beforeAll,afterAll} from 'vitest';
import { it,expect,vi,afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as http } from '@/app/api/agent/dispatch/route';
import { POST as sse } from '@/app/api/agent/stream-dispatch/route';
import { POST as skillPost } from '@/app/api/skills/route';
import { createSseDecoder } from '@/application/dispatch/sse';
import { EventSchemas } from '@ag-ui/core';
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});

function intentResponse(input:string){const evidence={source:'current',quote:input};return Response.json({choices:[{message:{role:'assistant',content:JSON.stringify({task:'data_query',relation:'new',displayRegion:{op:'clear',evidence},dataRegion:{op:'clear',evidence},time:{op:'clear',evidence},filters:{},layerRequests:[],mapOperations:[],mapOptions:{basemap:'vec'}})}}]});}
function llmFixture(){let calls=0;vi.stubEnv('SILICONFLOW_API_KEY','test-only');vi.stubEnv('AGENT_DOMAIN','vector');vi.stubGlobal('fetch',vi.fn(async(_url:RequestInfo|URL,init?:RequestInit)=>{if(JSON.parse(init!.body as string).messages[0].content.includes('你负责识别本轮任务和范围'))return intentResponse(JSON.parse(init!.body as string).messages.at(-1).content);if(JSON.parse(init!.body as string).messages[0].content.includes('你负责提炼会话标题'))return Response.json({choices:[{message:{role:'assistant',content:'{"title":"监测记录查询"}'}}]});calls++;return Response.json({choices:[{message:calls%2?{role:'assistant',content:null,tool_calls:[{id:`call-${calls}`,type:'function',function:{name:'skill_monitoring_data_table',arguments:'{"sql":"SELECT COUNT(*) AS n FROM fact_monitoring"}'}}]}:{role:'assistant',content:'{"mode":"answer","replyText":"已读取病媒实测记录，数量见表。"}'}}]});}));return ()=>calls;}
const traceDirectory=mkdtempSync(join(tmpdir(),'cdc-dispatch-trace-'));
const previousBusinessPath=process.env.APP_BUSINESS_DB_PATH;
beforeAll(()=>{process.env.APP_BUSINESS_DB_PATH=join(traceDirectory,'business.db');});
afterAll(()=>{if(previousBusinessPath===undefined)delete process.env.APP_BUSINESS_DB_PATH;else process.env.APP_BUSINESS_DB_PATH=previousBusinessPath;rmSync(traceDirectory,{recursive:true,force:true});});
const request=(path:string,body:any)=>new NextRequest(`http://localhost:9567${path}`,{method:'POST',body:JSON.stringify(body),headers:{'Content-Type':'application/json'}});
it('HTTP and SSE APIs use server-bound domain and publish real Skill plus AG-UI',async()=>{
 const calls=llmFixture();const body={promptText:'查询总数',domain:'chronic',userRole:'attacker'};
 const first=await (await http(request('/api/agent/dispatch',body))).json();
 const streamed=await sse(request('/api/agent/stream-dispatch',body));const decoder=createSseDecoder();const frames=decoder.push(new Uint8Array(await streamed.arrayBuffer()));frames.push(...decoder.finish());
 const second=frames.find(f=>f.event==='finish')!.data;
 expect(calls()).toBe(4);expect(first.status).toBe('SUCCESS');expect(first.skillRuns[0].result.domain).toBe('vector');
 expect(second.generativeView.data).toEqual(first.generativeView.data);expect(second.agui[0].result.payload.data).toEqual(first.generativeView.data);
 const agui=frames.filter(f=>f.event==='ag_ui');expect(agui.length).toBeGreaterThan(7);for(const frame of agui)expect(()=>EventSchemas.parse(frame.data)).not.toThrow();
});
it('legacy structured skill POST executes its bounded main dispatch without the LLM',async()=>{
 const calls=llmFixture();const result=await (await skillPost(request('/api/skills',{skillId:'skill_monitoring_data_table',args:{sql:'SELECT COUNT(*) AS n FROM fact_monitoring'}}))).json();
 expect(calls()).toBe(0);expect(result.success).toBe(true);expect(result.data.data[0].n).toBeGreaterThan(0);expect(result.agui).toHaveLength(1);
});
it('negotiates SSE on the formerly JSON-only dispatch endpoint',async()=>{
 llmFixture();
 const req=new NextRequest('http://localhost:9567/api/agent/dispatch',{method:'POST',headers:{'Content-Type':'application/json',Accept:'text/event-stream'},body:JSON.stringify({promptText:'查询总数'})});
 const response=await http(req);expect(response.headers.get('content-type')).toContain('text/event-stream');
 const frames=createSseDecoder().push(new Uint8Array(await response.arrayBuffer()));
 expect(frames.find(f=>f.event==='finish')!.data).toMatchObject({success:true,status:'SUCCESS'});
});
it('LLM failure returns failure without a successful old view through either API',async()=>{
 vi.stubEnv('SILICONFLOW_API_KEY','');const body={promptText:'查询数据',context:{currentView:{type:'OLD_SUCCESS'}}};
 const response=await http(request('/api/agent/dispatch',body));const result=await response.json();expect(result.success).toBe(false);expect(result.status).toBe('FAILED');expect(result.skillRuns).toEqual([]);expect(result.generativeView).toBeNull();
 const frames=createSseDecoder().push(new Uint8Array(await (await sse(request('/api/agent/stream-dispatch',body))).arrayBuffer()));
 expect(frames.find(f=>f.event==='finish')!.data.success).toBe(false);expect(frames.some(f=>f.event==='ag_ui'&&f.data.type==='RUN_FINISHED')).toBe(false);
});

it('aborted request closes SSE without dispatching an LLM or a skill',async()=>{
 const calls=llmFixture();const abort=new AbortController();abort.abort();
 const req=new NextRequest('http://localhost:9567/api/agent/stream-dispatch',{method:'POST',body:JSON.stringify({promptText:'查询'}),signal:abort.signal});
 const response=await sse(req);
 const completion=response.text();
 const text=await Promise.race([completion,new Promise<string>(resolve=>setTimeout(()=>resolve('STREAM_NOT_CLOSED'),50))]);
 expect(text).not.toBe('STREAM_NOT_CLOSED');expect(calls()).toBe(0);
});

it.each([false,true])('keeps one real query result when length recovery fails=%s',async(recoveryFails)=>{
 vi.stubEnv('SILICONFLOW_API_KEY','test-only');vi.stubEnv('AGENT_DOMAIN','vector');
 let calls=0;const frame=(delta:unknown,finish_reason:string)=>`data: ${JSON.stringify({choices:[{delta,finish_reason}]})}\n\n`;
 vi.stubGlobal('fetch',async(_url:RequestInfo|URL,init?:RequestInit)=>{
  if(JSON.parse(init!.body as string).messages[0].content.includes('你负责识别本轮任务和范围'))return intentResponse(JSON.parse(init!.body as string).messages.at(-1).content);if(JSON.parse(init!.body as string).messages[0].content.includes('你负责提炼会话标题'))return Response.json({choices:[{message:{role:'assistant',content:'{"title":"监测记录查询"}'}}]});
  calls++;
  const wire=calls===1?frame({tool_calls:[{index:0,id:'query',type:'function',function:{name:'skill_monitoring_data_table',arguments:'{"sql":"SELECT COUNT(*) AS n FROM fact_monitoring"}'}}]},'tool_calls')
   :calls===2||recoveryFails?frame({reasoning_content:'长篇总结未结束'},'length')
   :frame({content:'{"mode":"answer","replyText":"实测记录已查询，完整结果见工作台。"}'},'stop');
  return new Response(wire+'data: [DONE]\n\n',{headers:{'Content-Type':'text/event-stream'}});
 });
 const frames=createSseDecoder().push(new Uint8Array(await (await sse(request('/api/agent/stream-dispatch',{promptText:'查询监测记录'}))).arrayBuffer()));
 const result=frames.find(f=>f.event==='finish')!.data;
 expect(calls).toBe(3);expect(result.skillRuns).toHaveLength(1);
 expect(result.agui).toHaveLength(1);expect(result.generativeView).toMatchObject({type:'DATA_TABLE_VIEW',data:[{n:expect.any(Number)}]});
 expect(frames.filter(f=>f.event==='tool_call_start')).toHaveLength(1);
 expect(result.status).toBe(recoveryFails?'FAILED':'SUCCESS');
 if(recoveryFails)expect(frames.find(f=>f.event==='error')!.data.code).toBe('LLM_OUTPUT_TRUNCATED');
 else expect(result.replyText).toBe('实测记录已查询，完整结果见工作台。');
});
