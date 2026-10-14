import { describe,it,expect } from 'vitest';
import { createWorkbenchController } from '@/features/workbench/workbench-controller';
import { adaptFunctionalInteraction } from '@/application/agent/interaction-adapter';
import { viewFromTurn,restoreSession,sourceLabels } from '@/features/workbench/result-adapter';
import type { DatasetRef } from '@/contracts/dataset';
import type { AgentTurnResult,AgentInteraction } from '@/contracts/agent-interaction';
const dataset=(domain:DatasetRef['domain']='vector',origin:DatasetRef['origin']='observed'):DatasetRef=>({id:`${domain}-v1`,domain,origin,version:'v1',asOf:'2026-10-12',schemaVersion:'1'});
function turn(runId='run-1',status='SUCCESS',payload:any={type:'DATA_TABLE_VIEW',data:[{n:2}]}):AgentTurnResult{
 const result={schemaVersion:'1',runId,domain:'vector',status,method:'fixture-query',datasets:[dataset()],payload:status==='NO_DATA'?null:payload,metrics:{},qualityFlags:[]};
 return {runId,interactionId:'i',status,replyText:'实际结果。',agui:payload&&status==='SUCCESS'?[{version:'1',runId,component:payload.type,result}]:[],skillRuns:[{callId:'c',skillId:'query',skillName:'查询',args:{},result}]} as AgentTurnResult;
}
describe('shared workbench controller',()=>{
 it('web and widget follow identical state transitions for the same Agent output',async()=>{
  const client={interact:async()=>turn()};const web=createWorkbenchController({domain:'vector',client});const widget=createWorkbenchController({domain:'vector',client});
  await web.send('查询');await widget.send('查询');
  expect(web.getState().messages.map(m=>m.text)).toEqual(widget.getState().messages.map(m=>m.text));expect(web.getState().view).toEqual(widget.getState().view);expect(web.getState().runId).toBe('run-1');
 });
 it('all functional action classes use one Agent interaction client and retain server run IDs',async()=>{
  const requests:AgentInteraction[]=[];const client={interact:async(input:AgentInteraction)=>{requests.push(input);return turn(`actual-${requests.length}`);}};
  const controller=createWorkbenchController({domain:'vector',client});
  for(const action of [
   {type:'skill.execute',id:'skill_species_composition'}, {type:'map.drilldown',id:'郑州市',args:{city:'郑州市'}},
   {type:'collection.submit',args:{captureCount:0,city:'郑州市'}}, {type:'report.generate',args:{city:'郑州市'}},
   {type:'report.export',id:'report-1'}, {type:'session.rename',id:'session-1',args:{title:'新标题'}},
   {type:'approval.decide',id:'approval-1',args:{decision:'approve'}}, {type:'skill.delete',id:'custom_skill_1'}
  ]){const before=controller.getState();const result=await controller.interact(adaptFunctionalInteraction(action));expect(result?.runId).toBe(`actual-${requests.length}`);if(['report.export','session.rename','skill.delete'].includes(action.type))expect(controller.getState()).toEqual(before);else expect(controller.getState().view.runId).toBe(`actual-${requests.length}`);}
  expect(requests).toHaveLength(8);expect(requests.every(r=>r.resourceRef||r.attachments)).toBe(true);
 });
 it('NO_DATA clears an old success view and cannot restore a stale snapshot',async()=>{
  let n=0;const controller=createWorkbenchController({domain:'vector',client:{interact:async()=>++n===1?turn():turn('empty','NO_DATA',null)}});
  await controller.send('查询');expect(controller.getState().view).not.toBeNull();await controller.send('不存在城市');expect(controller.getState().view).toBeNull();expect(controller.getState().status).toBe('NO_DATA');
  expect(viewFromTurn(turn('empty','NO_DATA',null))).toBeNull();
 });
 it('ignores a cancelled completion after another session is loaded',async()=>{
  let resolve!: (value:AgentTurnResult)=>void;let calls=0;
  const controller=createWorkbenchController({domain:'vector',client:{interact:async()=>++calls===1?new Promise<AgentTurnResult>(r=>resolve=r):turn('session-load','SUCCESS',{type:'SESSION_RESULT',action:'read',session:{sessionId:'new-session',title:'新会话',messages:[{id:'loaded',sender:'user',text:'新会话内容'}],lastGenerativeView:null}})}});
  const pending=controller.send('旧查询');await controller.loadSession('new-session');resolve(turn('stale-run'));await pending;
  expect(controller.getState().sessionId).toBe('new-session');expect(controller.getState().messages.map(m=>m.text)).toEqual(['新会话内容']);expect(controller.getState().view).toBeNull();expect(controller.getState().runId).toBe('session-load');
 });
 it('starting a draft resets locally without sending a session-create request',async()=>{
  const requests:AgentInteraction[]=[];const controller=createWorkbenchController({domain:'env',client:{interact:async(input)=>{requests.push(input);return {...turn(),session:{id:'saved',title:'已有会话'}};}}});
  await controller.send('已有对话');requests.length=0;
  for(let i=0;i<3;i++)await controller.startSession();
  await controller.interact(adaptFunctionalInteraction({type:'session.create'}));
  expect(requests).toEqual([]);expect(controller.getState()).toMatchObject({sessionId:null,title:'新研判会话',messages:[],view:null,replyText:'',progress:'',status:'IDLE',busy:false,runId:undefined});
 });
 it('starting a draft ignores streamed chunks and a late completion from the previous conversation',async()=>{
  let finish!:(r:AgentTurnResult)=>void;let onChunk:((chunk:string,full:string)=>void)|undefined;let signal:AbortSignal|undefined;
  const controller=createWorkbenchController({domain:'vector',client:{interact:async(_input,options)=>{onChunk=options?.onContentChunk;signal=options?.signal;return new Promise(resolve=>finish=resolve);}}});
  const pending=controller.send('正在分析');onChunk?.('部分','部分回答');await controller.startSession();
  expect(signal?.aborted).toBe(true);onChunk?.('迟到','迟到回答');finish({...turn(),session:{id:'old',title:'旧会话'}});await pending;
  expect(controller.getState()).toMatchObject({sessionId:null,messages:[],view:null,busy:false,status:'IDLE'});
 });
 it('restores old sessions without presenting unverified legacy snapshots as a new observed result',()=>{
  const restored=restoreSession({sessionId:'old',messages:[{sender:'agent',text:'旧答复'}],lastGenerativeView:JSON.stringify({type:'SPECIES_COMPOSITION',composition:[]})});
  expect(restored.view.type).toBe('SPECIES_COMPOSITION');expect(restored.view.qualityFlags).toContain('legacy-unverified');expect(sourceLabels(restored.view.datasets)).toEqual([]);
 });
 it('normalizes legacy and malformed per-message AG-UI snapshots as well as the last view',()=>{
  const restored=restoreSession({sessionId:'old',messages:[{sender:'agent',text:'历史结果',generative_view_snapshot:JSON.stringify({type:'SPECIES_COMPOSITION',composition:[]})},{sender:'agent',text:'损坏快照',generativeViewSnapshot:'{broken'},{sender:'agent',text:'无效快照',generativeViewSnapshot:42}]});
  expect(restored.messages[0].generativeView).toMatchObject({type:'SPECIES_COMPOSITION',datasets:[],qualityFlags:['legacy-unverified']});
  expect(restored.messages[1].generativeView).toBeNull();expect(restored.messages[2].generativeView).toBeNull();
 });
 it('renders mixed sources by each DatasetRef instead of by current app domain',()=>{
  expect(sourceLabels([dataset('vector','observed'),dataset('env','mock'),dataset('chronic','mock')])).toEqual(['病媒生物：实测数据 · v1','环境健康：模拟数据（Mock） · v1','慢病与死因：模拟数据（Mock） · v1']);
 });
});

it('cancel clears previously displayed success instead of leaving a stale result',async()=>{
 const controller=createWorkbenchController({domain:'vector',client:{interact:async()=>turn()}});
 await controller.send('查询');controller.cancel();expect(controller.getState().view).toBeNull();
});
it('legacy snapshots render their stored values read-only without live fallback metrics or actions',async()=>{
 const {renderToStaticMarkup}=await import('react-dom/server');const React=await import('react');
 const {GenerativeComponentRenderer}=await import('@/components/ag-ui/GenerativeComponentRenderer');
 const {ThemeProvider}=await import('@/lib/theme/theme-context');
 const html=renderToStaticMarkup(React.createElement(ThemeProvider,null,React.createElement(GenerativeComponentRenderer,{view:{type:'SPECIES_COMPOSITION',composition:[],qualityFlags:['legacy-unverified']}})));
 expect(html).toContain('历史快照');expect(html).toContain('SPECIES_COMPOSITION');expect(html).not.toContain('<button');expect(html).not.toContain('1.85');
});

it('retains every actual AG-UI payload when the Agent returns several tools',()=>{
 const result=turn();const other={...result.agui[0],component:'SESSION_RESULT',result:{...result.agui[0].result,datasets:[],payload:{type:'SESSION_RESULT',action:'list',sessions:[]}}};result.agui.push(other);
 const view=viewFromTurn(result);expect(view.type).toBe('AGUI_RESULT_GROUP');expect(view.views.map((v:any)=>v.type)).toEqual(['DATA_TABLE_VIEW','SESSION_RESULT']);expect(view.views.every((v:any)=>v.runId==='run-1')).toBe(true);
});

it('a standalone widget action uses its own injected controller rather than another workbench',async()=>{
 const React=await import('react');const {renderToStaticMarkup}=await import('react-dom/server');
 const {WorkbenchInteractionProvider,useFunctionalInteraction}=await import('@/features/workbench/use-workbench-controller');
 const requests:AgentInteraction[]=[];const own=createWorkbenchController({domain:'foodborne',client:{interact:async input=>{requests.push(input);return turn('own-widget');}}});
 let action:any;function Probe(){action=useFunctionalInteraction();return null;}
 renderToStaticMarkup(React.createElement(WorkbenchInteractionProvider,{controller:own},React.createElement(Probe)));
 const result=await action({type:'report.export',args:{format:'csv',sql:'SELECT COUNT(*) AS n FROM fact_foodborne_case'}});expect(requests).toHaveLength(1);expect(result.runId).toBe('own-widget');expect(own.getState().messages).toEqual([]);
});


it('opening and managing drawers leaves chat and analysis untouched, even during an active answer',async()=>{
 let finish!: (value:AgentTurnResult)=>void;let pendingSignal:AbortSignal|undefined;
 const requests:AgentInteraction[]=[];
 const controller=createWorkbenchController({domain:'vector',client:{interact:async(input,options)=>{
  requests.push(input);
  if(input.kind==='conversation'){pendingSignal=options?.signal;return new Promise<AgentTurnResult>(resolve=>finish=resolve);}
  return turn('ui-operation');
 }}});
 const answering=controller.send('分析监测数据');const before=controller.getState();
 for(const action of [{type:'session.list'},{type:'catalog.list'},{type:'session.rename',id:'old',args:{title:'新标题'}},{type:'session.update',id:'old',args:{isPinned:true}},{type:'session.delete',id:'old'},{type:'session.clear'},{type:'skill.update',id:'custom_skill_1'},{type:'skill.delete',id:'custom_skill_1'},{type:'report.export',id:'report-1'}]){
  await controller.interact(adaptFunctionalInteraction(action));
  expect(controller.getState()).toEqual(before);expect(pendingSignal?.aborted).toBe(false);
  expect(requests.at(-1)).not.toHaveProperty('history');expect(requests.at(-1)).not.toHaveProperty('sessionRef');
 }
 finish(turn('analysis-finished'));await answering;expect(controller.getState().runId).toBe('analysis-finished');
 expect(controller.getState().messages.map(m=>m.text)).toEqual(['分析监测数据','实际结果。']);
});
it('opening collection UI changes the view without adding a chat instruction',async()=>{
 const controller=createWorkbenchController({domain:'vector',client:{interact:async()=>turn('collection','SUCCESS',{type:'MOBILE_ASSISTANT_SIMULATOR'})}});
 await controller.interact(adaptFunctionalInteraction({type:'collection.form'}));
 expect(controller.getState().messages).toEqual([]);expect(controller.getState().view.type).toBe('MOBILE_ASSISTANT_SIMULATOR');
});
it('failed session switching keeps current messages and view without adding a fake answer',async()=>{
 let calls=0;const controller=createWorkbenchController({domain:'vector',client:{interact:async()=>++calls===1?turn():turn('missing','NO_DATA',null)}});
 await controller.send('分析');const before=controller.getState();await controller.loadSession('missing');
 expect(controller.getState().messages).toEqual(before.messages);expect(controller.getState().view).toEqual(before.view);
});

it.each(['clear','delete'])('a delayed answer cannot restore a session removed by %s',async action=>{
 let finish!:(result:AgentTurnResult)=>void;let calls=0;
 const controller=createWorkbenchController({domain:'vector',client:{interact:async input=>{
  if(input.kind!=='conversation')return turn('management');
  if(++calls===1)return {...turn('first'),session:{id:'deleted-session',title:'已删除会话'}};
  return new Promise(resolve=>{finish=resolve;});
 }}});
 await controller.send('第一轮');const pending=controller.send('第二轮');
 await controller.interact(adaptFunctionalInteraction({type:`session.${action}`,id:'deleted-session'}));
 finish({...turn('delayed'),session:{id:'deleted-session',title:'已删除会话'}});await pending;
 expect(controller.getState().sessionId).toBeNull();expect(controller.getState().busy).toBe(false);
 expect(controller.getState().messages.at(-1)?.text).toBe('实际结果。');
});

it('scenario clicks immediately display the exact prompt, stream the answer, and retain session history',async()=>{
 let finish!:(r:AgentTurnResult)=>void;let callbacks:any;let submitted:AgentInteraction|undefined;
 const controller=createWorkbenchController({domain:'vector',client:{interact:async(input,options)=>{submitted=input;callbacks=options;return new Promise(resolve=>finish=resolve);}}});
 const prompt='展示病媒监测空间分布，并给出研判依据。';
 const pending=controller.send(prompt);
 expect(controller.getState().messages.map(m=>m.text)).toEqual([prompt]);
 callbacks.onReasoningChunk('核对结果','核对结果');callbacks.onContentChunk('研判结论','研判结论');
 expect(controller.getState().messages.at(-1)).toMatchObject({text:'研判结论',reasoningText:'核对结果',streaming:true});
 finish({...turn(),session:{id:'scenario-session',title:'监测空间分布'}});await pending;
 expect(controller.getState().messages.map(m=>m.text)).toEqual([prompt,'实际结果。']);
 expect(controller.getState()).toMatchObject({sessionId:'scenario-session',title:'监测空间分布',busy:false});
 const next=controller.send('继续查看预警');
 expect(submitted?.sessionRef?.id).toBe('scenario-session');expect(submitted?.history).toHaveLength(2);
 finish({...turn('next'),session:{id:'scenario-session',title:'监测空间分布'}});await next;
});
