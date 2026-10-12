import { beforeEach,afterEach,it,expect,vi } from 'vitest';
import { mkdtempSync,copyFileSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { executeSkill } from '@/application/skills/skill-service';
import { createDevelopmentContext } from '@/lib/skills/server-executor';
import { getArtifact } from '@/infrastructure/db/business-store';
let dir:string;
beforeEach(()=>{dir=mkdtempSync(join(tmpdir(),'interaction-skills-'));copyFileSync(join(process.cwd(),'app_business.db'),join(dir,'business.db'));vi.stubEnv('APP_BUSINESS_DB_PATH',join(dir,'business.db'));});
afterEach(()=>{vi.unstubAllEnvs();rmSync(dir,{recursive:true,force:true});});
it('session create/read/rename/delete actually persist and enforce owner/domain',async()=>{
 const ctx=createDevelopmentContext('vector');ctx.principal.userId='fixture-owner';
 const created=await executeSkill('skill_session_manage',{action:'create',title:'真实会话'},ctx);expect(created.status).toBe('SUCCESS');const sessionId=(created.payload as any).session.sessionId;
 const renamed=await executeSkill('skill_session_manage',{action:'update',sessionId,title:'已修改',isPinned:true},ctx);expect(renamed.status).toBe('SUCCESS');
 const read=await executeSkill('skill_session_manage',{action:'read',sessionId},ctx);expect(read.payload).toMatchObject({session:{title:'已修改',isPinned:true}});
 const wrong=createDevelopmentContext('vector');wrong.principal.userId='other';expect((await executeSkill('skill_session_manage',{action:'read',sessionId},wrong)).status).toBe('FAILED');
 expect((await executeSkill('skill_session_manage',{action:'read',sessionId},createDevelopmentContext('env'))).status).toBe('FAILED');
 expect((await executeSkill('skill_session_manage',{action:'delete',sessionId},ctx)).status).toBe('SUCCESS');expect((await executeSkill('skill_session_manage',{action:'read',sessionId},ctx)).status).toBe('NO_DATA');
});
it('collection quality counts actual rules and persists zero without invented confidence or coordinates',async()=>{
 const ctx=createDevelopmentContext('vector');ctx.principal.userId='collector';
 const record={city:'郑州市',district:'金水区',category:'蚊',speciesName:'白纹伊蚊',captureCount:0,weatherTemp:5,weatherHumidity:0};
 const validated=await executeSkill('skill_collection_manage',{action:'validate',record},ctx);expect(validated.status).toBe('SUCCESS');expect(validated.payload).toMatchObject({evaluation:{totalRulesCount:3,passedRulesCount:3}});
 const submitted=await executeSkill('skill_collection_manage',{action:'submit',record},ctx);expect(submitted.status).toBe('SUCCESS');expect(submitted.payload).toMatchObject({record:{capture_count:0,weather_humidity:0,user_id:'collector',ai_confidence:null,latitude:null},syncToSpatialMap:false});
 const invalid=await executeSkill('skill_collection_manage',{action:'submit',record:{...record,captureCount:-1}},ctx);expect(invalid.status).toBe('FAILED');expect(invalid.error?.code).toBe('INVALID_INPUT');
});
it('CSV export re-queries an authorized source and creates actual retrievable bytes',async()=>{
 const ctx=createDevelopmentContext('vector');ctx.principal.userId='export-owner';
 const result=await executeSkill('skill_artifact_export',{format:'csv',sql:'SELECT COUNT(*) AS n FROM fact_monitoring',fileName:'记录统计'},ctx);
 expect(result.status).toBe('SUCCESS');const payload=result.payload as any;const artifact=getArtifact(payload.artifactId,ctx);
 expect(artifact.content.toString()).toMatch(/^\uFEFF"n"\r?\n"\d+"/);expect(artifact.content.length).toBe(payload.byteLength);
 const wrong=createDevelopmentContext('vector');wrong.principal.userId='other';expect(()=>getArtifact(payload.artifactId,wrong)).toThrow();
});
it('unknown report export cannot fabricate a PDF or successful artifact',async()=>{
 const result=await executeSkill('skill_artifact_export',{format:'markdown',reportId:'does-not-exist'},createDevelopmentContext('vector'));expect(result.status).toBe('NO_DATA');expect(result.payload).toBeNull();
});
it('conversation journal stores only actual run evidence and clears NO_DATA snapshots idempotently',async()=>{
 const { createMainAgent }=await import('@/application/agent/main-agent');
 const { listSkillDefinitions }=await import('@/application/skills/skill-service');
 const ctx=createDevelopmentContext('vector');ctx.principal.userId='journal-owner';
 const created=await executeSkill('skill_session_manage',{action:'create'},ctx);const sessionId=(created.payload as any).session.sessionId;
 for(const city of [undefined,'不存在城市']){
  const runCtx={...ctx,runId:crypto.randomUUID()};let n=0;
  const agent=createMainAgent({listSkills:listSkillDefinitions,executeSkill,llm:{complete:async()=>++n===1?{role:'assistant',content:null,tool_calls:[{id:'query',type:'function',function:{name:'skill_monitoring_data_table',arguments:JSON.stringify({sql:'SELECT capture_count FROM fact_monitoring LIMIT 2',...(city?{city}:{})})}}]}:{role:'assistant',content:JSON.stringify({mode:'answer',replyText:city?'没有数据。':'读取实际监测记录。'})}}});
  const { collectDispatch }=await import('@/application/dispatch/dispatch-service');
  const turn=await collectDispatch(agent({interactionId:'journal',kind:'conversation',userInput:'查询',resourceRef:{type:'session',id:sessionId,action:'conversation'}},runCtx));
  expect(turn.status).toBe(city?'NO_DATA':'SUCCESS');
  const read=await executeSkill('skill_session_manage',{action:'read',sessionId},ctx);const session=(read.payload as any).session;
  expect(session.messages.length).toBe(city?4:2);expect(session.lastGenerativeView===null).toBe(Boolean(city));
  const again=await executeSkill('skill_session_journal',{sessionId,sourceRunId:runCtx.runId},ctx);expect(again.status).toBe('SUCCESS');
  expect(((await executeSkill('skill_session_manage',{action:'read',sessionId},ctx)).payload as any).session.messages.length).toBe(city?4:2);
 }
});
it('LLM cannot alter supplied capture evidence or turn a list request into deletion',async()=>{
 const { createMainAgent }=await import('@/application/agent/main-agent');const {listSkillDefinitions}=await import('@/application/skills/skill-service');const {collectDispatch}=await import('@/application/dispatch/dispatch-service');
 const ctx=createDevelopmentContext('vector');ctx.principal.userId='intent-owner';
 const record={city:'郑州市',district:'金水区',category:'蚊',speciesName:'白纹伊蚊',captureCount:0,weatherTemp:25};
 const run=async(name:string,args:any,interaction:any)=>{let n=0;return collectDispatch(createMainAgent({executeSkill,listSkills:listSkillDefinitions,llm:{complete:async()=>++n===1?{role:'assistant',content:null,tool_calls:[{id:'intent-call',type:'function',function:{name,arguments:JSON.stringify(args)}}]}:{role:'assistant',content:'{"mode":"answer","replyText":"实际结果见界面。"}'}}})(interaction,{...ctx,runId:crypto.randomUUID()}));};
 const collected=await run('skill_collection_manage',{action:'submit',record:{...record,captureCount:45}},{interactionId:'record',kind:'collection',userInput:'提交记录',resourceRef:{type:'collection',id:'collection.submit',action:'submit'},attachments:[{type:'operation-input',args:{record}}]});
 expect(collected.skillRuns[0].result.payload).toMatchObject({record:{capture_count:0}});
 const created=await executeSkill('skill_session_manage',{action:'create'},ctx);const sessionId=(created.payload as any).session.sessionId;
 const listed=await run('skill_session_manage',{action:'delete',sessionId},{interactionId:'list',kind:'session',userInput:'列出会话',resourceRef:{type:'session',id:'session.list',action:'list'},attachments:[{type:'operation-input',args:{}}]});
 expect(listed.status).toBe('SUCCESS');expect(listed.skillRuns[0].args.action).toBe('list');expect((await executeSkill('skill_session_manage',{action:'read',sessionId},ctx)).status).toBe('SUCCESS');
});

it('internal journaling is absent from public tools and a model cannot invoke it',async()=>{
 const {listSkillDefinitions}=await import('@/application/skills/skill-service');
 const {createMainAgent}=await import('@/application/agent/main-agent');
 const {collectDispatch}=await import('@/application/dispatch/dispatch-service');
 const definitions=listSkillDefinitions('vector');
 expect(definitions.find(s=>s.id==='skill_session_manage')?.inputSchema.properties.action.enum).not.toContain('append');
 expect(definitions.map(s=>s.id)).not.toContain('skill_session_journal');
 const execute=vi.fn(executeSkill);
 const result=await collectDispatch(createMainAgent({listSkills:listSkillDefinitions,executeSkill:execute,llm:{complete:async()=>({role:'assistant',content:null,tool_calls:[{id:'internal',type:'function',function:{name:'skill_session_journal',arguments:'{"sessionId":"made-up","sourceRunId":"made-up"}'}}]})}})({interactionId:'query',kind:'conversation',userInput:'查询监测记录'},createDevelopmentContext('vector')));
 expect(result.status).toBe('FAILED');expect(result.error?.code).toBe('UNADVERTISED_TOOL');expect(execute).not.toHaveBeenCalled();
});

it('repeated LLM write calls within a run reuse evidence and create only one session',async()=>{
 const {listSkillDefinitions}=await import('@/application/skills/skill-service');const {createMainAgent}=await import('@/application/agent/main-agent');const {collectDispatch}=await import('@/application/dispatch/dispatch-service');
 const ctx=createDevelopmentContext('vector');ctx.principal.userId='repeat-owner';let round=0;
 const result=await collectDispatch(createMainAgent({executeSkill,listSkills:listSkillDefinitions,llm:{complete:async()=>{round++;if(round===2)return {role:'assistant',content:'{"mode":"continue","reason":"确认上一步"}'};if(round===4){return {role:'assistant',content:'{"mode":"answer","replyText":"会话已创建"}'};}return {role:'assistant',content:null,tool_calls:[{id:`create-${round}`,type:'function',function:{name:'skill_session_manage',arguments:'{"action":"create","title":"同一个会话"}'}}]};}}})({interactionId:'create',kind:'session',userInput:'新建会话',resourceRef:{type:'session',id:'session.create',action:'create'}},ctx));
 const list=await executeSkill('skill_session_manage',{action:'list'},ctx);expect((list.payload as any).sessions).toHaveLength(1);expect(result.status).toBe('SUCCESS');expect(result.agui).toHaveLength(1);
});

it('blocks an unrequested export selected by the model before any artifact write',async()=>{
 const {listSkillDefinitions}=await import('@/application/skills/skill-service');const {createMainAgent}=await import('@/application/agent/main-agent');const {collectDispatch}=await import('@/application/dispatch/dispatch-service');
 const execute=vi.fn(executeSkill);let rounds=0;
 const result=await collectDispatch(createMainAgent({executeSkill:execute,listSkills:listSkillDefinitions,llm:{complete:async()=>++rounds===1?{role:'assistant',content:null,tool_calls:[{id:'export',type:'function',function:{name:'skill_artifact_export',arguments:'{"format":"csv","sql":"SELECT COUNT(*) AS n FROM fact_monitoring"}'}}]}:{role:'assistant',content:'{"authorized":false,"reason":"用户只请求统计，没有要求导出"}'}}})({interactionId:'count',kind:'conversation',userInput:'统计病媒记录总数'},createDevelopmentContext('vector')));
 expect(result.error?.code).toBe('UNREQUESTED_WRITE');expect(execute).not.toHaveBeenCalled();
});

it('exports an actual query view without copying server-only domain scope into skill arguments',async()=>{
 const {queryExportArgs}=await import('@/features/workbench/result-adapter');
 const ctx=createDevelopmentContext('foodborne');const query=await executeSkill('skill_foodborne_case_table',{sql:'SELECT COUNT(*) AS n FROM fact_foodborne_case'},ctx);
 const args=queryExportArgs(query.payload);expect(args).not.toHaveProperty('domain');
 const exported=await executeSkill('skill_artifact_export',args,ctx);expect(exported.status).toBe('SUCCESS');expect(getArtifact((exported.payload as any).artifactId,ctx).content.toString()).toContain(String((query.payload as any).data[0].n));
});


it('drawer, session and form operations execute their exact authorized skill without calling an LLM',async()=>{
 const {createMainAgent}=await import('@/application/agent/main-agent');
 const {listSkillDefinitions}=await import('@/application/skills/skill-service');
 const {collectDispatch}=await import('@/application/dispatch/dispatch-service');
 const {adaptFunctionalInteraction}=await import('@/application/agent/interaction-adapter');
 const ctx=createDevelopmentContext('vector');ctx.principal.userId='ui-owner';
 const agent=createMainAgent({executeSkill,listSkills:listSkillDefinitions,llm:{complete:async()=>{throw new Error('UI operation must not reach the LLM');}}});
 const run=async(action:any)=>collectDispatch(agent(adaptFunctionalInteraction(action),{...ctx,runId:crypto.randomUUID()}));
 const created=await run({type:'session.create'});expect(created.status).toBe('SUCCESS');
 const id=(created.skillRuns[0].result.payload as any).session.sessionId;
 for(const action of [{type:'session.list'},{type:'session.read',id},{type:'session.rename',id,args:{title:'界面重命名'}},{type:'session.update',id,args:{isPinned:true}},{type:'catalog.list'},{type:'collection.form'},{type:'workflow.list'},{type:'session.delete',id},{type:'session.clear'}]){
  const result=await run(action);expect(result.status).toBe('SUCCESS');expect(result.skillRuns).toHaveLength(1);
 }
 const unavailable=await run({type:'collection.ocr-save'});expect(unavailable.error?.code).toBe('CAPABILITY_UNAVAILABLE');
 const invalidApproval=await run({type:'approval.decide',id:'absent',args:{decision:'review-correction'}});expect(invalidApproval.status).toBe('FAILED');expect(invalidApproval.error?.message).not.toContain('LLM');
});
