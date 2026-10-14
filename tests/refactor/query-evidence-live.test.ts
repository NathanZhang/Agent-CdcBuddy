import {expect, it} from 'vitest';
import {loadEnvConfig} from '@next/env';
import {mkdirSync, writeFileSync} from 'node:fs';
import {createMainAgent} from '@/application/agent/main-agent';
import {createLLMClient} from '@/infrastructure/llm/client';
import {executeSkill, listSkillDefinitions} from '@/application/skills/skill-service';
import {createDevelopmentContext} from '@/lib/skills/server-executor';
import {collectDispatch} from '@/application/dispatch/dispatch-service';
import {buildAnswerEvidence, validateAnswerEvidence} from '@/application/agent/answer-evidence';

// Explicit opt-in: uses the configured real model and read-only observed dataset;
// all run/session writes go to Vitest's isolated temporary business database.
it.skipIf(process.env.CDC_EVIDENCE_LIVE_TEST !== '1')('validates the exact fly prompt with the configured real LLM', async () => {
  // Next skips .env.local in test mode; use the same development config as the
  // running workbench, then immediately restore Vitest's mode.
  const testMode = process.env.NODE_ENV;
  try {Object.assign(process.env,{NODE_ENV:'development'});loadEnvConfig(process.cwd(), true, {info:()=>{},error:()=>{}});}
  finally {Object.assign(process.env,{NODE_ENV:testMode});}
  const userInput = '查询河南省2020年7月9日至2025年11月5日家蝇抗药性生测记录，表格展示药剂、地市、日期、LC50、校正死亡率与登记抗性分类，保留缺失值。';
  const context = createDevelopmentContext('vector');
  const client=createLLMClient();const summaries:string[]=[];
  const agent = createMainAgent({llm:{complete:async(request)=>{const reply=await client.complete(request);if(request.toolChoice==='none'&&!request.messages[0].content?.includes('你负责提炼会话标题'))summaries.push(reply.content??'');return reply;}},listSkills:listSkillDefinitions,executeSkill,enableRegionIntent:true});
  const events = [];
  for await (const event of agent({interactionId:'fly-live-evidence',kind:'conversation',userInput},context)) {
    events.push(event);
    if(event.type==='tool_started')console.info('Live verification tool:',event.data.skillId);
  }
  const turn = await collectDispatch(events);
  mkdirSync('docs/verification',{recursive:true});
  writeFileSync('docs/verification/2026-10-14-query-evidence-live.json',JSON.stringify({verifiedAt:new Date().toISOString(),model:process.env.SILICONFLOW_MODEL,prompt:userInput,status:turn.status,error:turn.error,replyText:turn.replyText,modelSummaries:summaries,runId:turn.runId,intentSummary:turn.intentSummary,skills:turn.skillRuns.map(run=>({callId:run.callId,skillId:run.skillId,args:run.args,status:run.result.status,datasets:run.result.datasets,statistics:(run.result.payload as any)?.statistics})),unvalidatedContentPublished:events.some(event=>event.type==='content'&&event.data.text?.includes('{{evidence:'))},null,2)+'\n');
  expect(turn.status,turn.replyText).toBe('SUCCESS');
  const payload = turn.skillRuns.map(run=>run.result.payload as any).find(payload=>payload?.statistics?.tables.some((table:any)=>table.columns.some((column:any)=>['LC50','lc50'].includes(column.field))));
  expect(payload).toBeDefined();
  const table = payload.statistics.tables.find((table:any)=>table.columns.some((column:any)=>['LC50','lc50'].includes(column.field)));
  expect(table.rowCount).toBe(73);
  expect(table.columns.find((column:any)=>['LC50','lc50'].includes(column.field))).toMatchObject({presentCount:33,missingCount:40});
  expect(table.columns.find((column:any)=>['校正死亡率','correctedMortality'].includes(column.field))).toMatchObject({presentCount:0,missingCount:73});
  expect(turn.replyText).toContain('本次返回 73 行');
  expect(turn.replyText).toContain('LC50：有效 33 行，缺失 40 行');
  expect(turn.replyText).not.toContain('{{evidence:');
  const evidence = buildAnswerEvidence(turn.skillRuns);
  expect(evidence.facts.some(fact=>fact.text.includes('本次返回 73 行'))).toBe(true);
  // Recreate references only for server-rendered, verified text; any remaining
  // raw numerical claim would still fail the same publishing gate.
  let template = turn.replyText;
  for(const fact of [...evidence.facts].sort((a,b)=>b.text.length-a.text.length))template=template.split(fact.text).join(`{{evidence:${fact.id}}}`);
  expect(validateAnswerEvidence(template,evidence)).toBe(turn.replyText);
}, 360000);
