import { it,expect,vi,afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as http } from '@/app/api/agent/dispatch/route';
import { POST as sse } from '@/app/api/agent/stream-dispatch/route';
import { POST as skillPost } from '@/app/api/skills/route';
import { createSseDecoder } from '@/application/dispatch/sse';
import { EventSchemas } from '@ag-ui/core';
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
function llmFixture(){let calls=0;vi.stubEnv('SILICONFLOW_API_KEY','test-only');vi.stubEnv('AGENT_DOMAIN','vector');vi.stubGlobal('fetch',vi.fn(async()=>{calls++;return Response.json({choices:[{message:calls%2?{role:'assistant',content:null,tool_calls:[{id:`call-${calls}`,type:'function',function:{name:'skill_monitoring_data_table',arguments:'{"sql":"SELECT COUNT(*) AS n FROM fact_monitoring"}'}}]}:{role:'assistant',content:'{"mode":"answer","replyText":"已读取病媒实测记录，数量见表。"}'}}]});}));return ()=>calls;}
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
it('legacy skill POST calls the main LLM rather than directly executing a skill',async()=>{
 const calls=llmFixture();const result=await (await skillPost(request('/api/skills',{skillId:'skill_monitoring_data_table',args:{sql:'SELECT COUNT(*) AS n FROM fact_monitoring'}}))).json();
 expect(calls()).toBe(2);expect(result.success).toBe(true);expect(result.data.data[0].n).toBeGreaterThan(0);expect(result.replyText).toContain('实测');expect(result.agui).toHaveLength(1);
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
