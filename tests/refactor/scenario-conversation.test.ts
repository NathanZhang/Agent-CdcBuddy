import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createMainAgent} from '@/application/agent/main-agent';
import {collectDispatch} from '@/application/dispatch/dispatch-service';
import {executeSkill,listSkillDefinitions} from '@/application/skills/skill-service';
import {createDevelopmentContext} from '@/lib/skills/server-executor';
import {getAppBusinessProvider} from '@/lib/db/app-business-provider';
import {readFileSync} from 'node:fs';
import {LLMError,type LLMRequest} from '@/infrastructure/llm/client';
import scenarios from '../../config/requirement-scenarios.json';
let dir:string;
beforeEach(()=>{dir=mkdtempSync(join(tmpdir(),'cdc-scenario-chat-'));vi.stubEnv('APP_BUSINESS_DB_PATH',join(dir,'business.db'));vi.stubEnv('DEPLOYMENT_TIER','local');});
afterEach(()=>{getAppBusinessProvider().close();vi.unstubAllEnvs();rmSync(dir,{recursive:true,force:true});});

it.each(scenarios)('requirement $requirementId enters synthesis once and saves prompt + conclusion',async scene=>{
 const ctx=createDevelopmentContext(scene.domain as any);const requests:LLMRequest[]=[];const executions:string[]=[];
 const status=scene.deferred||[60,61].includes(scene.requirementId)?'REVIEW_REQUIRED':'SUCCESS';
 const selectedSkill=scene.skillIds[0];
 const result={schemaVersion:'1' as const,domain:ctx.domain,runId:ctx.runId,status:status as any,method:'contract-fixture',datasets:[],metrics:{},qualityFlags:[],payload:{type:'AGUI_RESULT_GROUP',views:[{type:'ANALYTICS_RESULT',data:{status,limitation:scene.limitation}}]}};
 const agent=createMainAgent({enableRegionIntent:true,listSkills:listSkillDefinitions,executeSkill:async(id,args,context)=>{executions.push(id);return id===selectedSkill?result:executeSkill(id,args,context);},llm:{complete:async request=>{
  requests.push(request);
  if(request.phase==='intent'){
   const evidence={source:'current',quote:scene.prompt},clear={op:'clear',evidence};
   request.onDelta?.({type:'reasoning',text:'识别本轮任务及范围。'});
   return {role:'assistant',content:JSON.stringify({task:'analysis',relation:'new',displayRegion:clear,dataRegion:clear,time:clear,filters:{},layerRequests:[],mapOperations:[],mapOptions:{basemap:'vec'}})};
  }
  if(request.messages[0].content?.includes('操作意图校验'))return {role:'assistant',content:'{"authorized":true,"reason":"合约测试"}'};
  if(request.tools?.length){
   expect(JSON.stringify(request.tools)).not.toContain('skill_requirement_scenario');
   if(scene.deferred)return {role:'assistant',content:'{"mode":"clarification","replyText":"OCR 按要求暂缓，保留人工录入。"}'};
   return {role:'assistant',content:null,tool_calls:[{id:'model-selected',type:'function',function:{name:selectedSkill,arguments:'{}'}}]};
  }
  expect(request.toolChoice).toBe('none');
  if(request.messages[0].content?.includes('你负责提炼会话标题'))return {role:'assistant',content:'{"title":"需求场景研判"}'};
  expect(request.messages.some(m=>m.role==='tool'&&m.content?.includes(scene.limitation))).toBe(true);
  request.onDelta?.({type:'reasoning',text:'核对本轮结果与能力限制。'});
  return {role:'assistant',content:JSON.stringify({mode:'answer',replyText:status==='REVIEW_REQUIRED'?'当前场景仍需复核或暂缓，不能据此宣称完成。':'本轮结果已返回，具体依据与限制见工作台。'})};
 }}});
 const input={interactionId:'scene-'+scene.requirementId,kind:'conversation' as const,userInput:scene.prompt};
 const events=[];for await(const event of agent(input,ctx))events.push(event);
 const turn=await collectDispatch(events);
 expect(turn.status,JSON.stringify(turn.error)).toBe(status);expect(turn.agui).toHaveLength(scene.deferred?0:1);expect(turn.reasoningText).toContain('识别本轮任务及范围。');
 expect(requests.filter(r=>r.phase==='intent')).toHaveLength(2);expect(requests.some(r=>r.tools?.length)).toBe(true);
 expect(executions).not.toContain('skill_requirement_scenario');expect(executions.filter(id=>id===selectedSkill)).toHaveLength(scene.deferred?0:1);expect(turn.session?.id).toBeTruthy();
 const saved=await getAppBusinessProvider().getChatMessages(turn.session!.id);
 expect(saved.map(m=>m.text)).toEqual([scene.prompt,turn.replyText]);
 expect(events.some(e=>e.type==='reasoning')).toBe(true);
});

it('contains no production scenario execution shortcut or prompt-matching dispatch',()=>{
 for(const file of ['src/app/page.tsx','src/application/agent/main-agent.ts','src/application/agent/ui-operation.ts','src/application/skills/skill-service.ts']){
  const source=readFileSync(file,'utf8');expect(source).not.toMatch(/skill_requirement_scenario|requirementScenarios|requirementScenarioSkill/);
 }
 expect(readFileSync('src/components/layout/RecommendationPrompts.tsx','utf8')).toContain('onSelectPrompt(p,skillId)');
 expect(readFileSync('src/app/page.tsx','utf8')).toContain('onSelectPrompt={(prompt,skillId)=>void send(prompt,skillId)}');
 for(const scene of scenarios)expect(scene).not.toHaveProperty('steps');
});
