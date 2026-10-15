import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createMainAgent} from '@/application/agent/main-agent';
import {createLLMClient} from '@/infrastructure/llm/client';
import {collectDispatch} from '@/application/dispatch/dispatch-service';
import {executeSkill,listSkillDefinitions} from '@/application/skills/skill-service';
import {createDevelopmentContext} from '@/lib/skills/server-executor';
import {getAppBusinessProvider} from '@/lib/db/app-business-provider';

let directory:string;
beforeEach(()=>{
 directory=mkdtempSync(join(tmpdir(),'cdc-long-turn-'));
 vi.stubEnv('APP_BUSINESS_DB_PATH',join(directory,'business.db'));vi.stubEnv('DEPLOYMENT_TIER','local');
 vi.useFakeTimers();
});
afterEach(()=>{getAppBusinessProvider().close();vi.useRealTimers();vi.unstubAllEnvs();rmSync(directory,{recursive:true,force:true});});

it.each(['vector','foodborne','env','chronic'] as const)('persists a productive 14-minute %s turn with no default whole-turn deadline',async domain=>{
 let wire!:ReadableStreamDefaultController<Uint8Array>;
 const fetcher=vi.fn(async(_url,init)=>{
  const body=JSON.parse(init!.body as string);expect(body.stream).toBe(true);
  if(body.messages[0].content.includes('你负责提炼会话标题'))return Response.json({choices:[{message:{role:'assistant',content:'{"title":"监测分析范围确认"}'}}]});
  return new Response(new ReadableStream<Uint8Array>({start(controller){wire=controller;init!.signal!.addEventListener('abort',()=>controller.error(init!.signal!.reason),{once:true});}}),{headers:{'Content-Type':'text/event-stream'}});
 });
 const run=createMainAgent({llm:createLLMClient({env:{SILICONFLOW_API_KEY:'test'},fetch:fetcher}),listSkills:listSkillDefinitions,executeSkill});
 const pending=collectDispatch(run({interactionId:'long-turn',kind:'conversation',userInput:'请分析监测数据'},createDevelopmentContext(domain)));
 const outcome=pending.then(result=>({result}),error=>({error}));
 await vi.advanceTimersByTimeAsync(0);
 const send=(delta:unknown,finish_reason:string|null=null)=>wire.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({choices:[{delta,finish_reason}]})}\n\n`));
 for(let i=0;i<7;i++){await vi.advanceTimersByTimeAsync(120000);send({reasoning_content:'正在梳理需要确认的范围。'});await vi.advanceTimersByTimeAsync(0);}
 send({content:'{"mode":"clarification","replyText":"请提供具体地域和监测时间范围。"}'},'stop');
 expect(await outcome).toMatchObject({result:{status:'REVIEW_REQUIRED',replyText:'请提供具体地域和监测时间范围。',session:{id:expect.any(String)}}});
 expect(fetcher).toHaveBeenCalledTimes(2);expect(vi.getTimerCount()).toBe(0);
});
