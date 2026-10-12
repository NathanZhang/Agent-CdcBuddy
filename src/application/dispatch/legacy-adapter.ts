import { projectAguiView } from '@/contracts/agui-view';
import { randomUUID } from 'node:crypto';
import type { AgentInteraction,AgentTurnResult } from '@/contracts/agent-interaction';
import type { RunEvent } from '@/contracts/run-event';
const kinds=['conversation','skill','resource','workflow','collection','session'];
/** Old HTTP request shape is untrusted transport; identity/domain are never copied. */
export function normalizeInteraction(body:any):AgentInteraction{
  const source=body?.interaction ?? body;
  const userInput=source?.userInput ?? source?.promptText;
  if(typeof userInput!=='string'||!userInput.trim()||userInput.length>12000)throw new Error('请输入有效指令（最多12000字符）');
  const kind=source.kind ?? 'conversation';if(!kinds.includes(kind))throw new Error('Invalid interaction kind');
  const resourceRef=source.resourceRef;
  if(resourceRef && (typeof resourceRef.type!=='string'||typeof resourceRef.id!=='string'||!resourceRef.id||resourceRef.id.length>200||resourceRef.type.length>80||(resourceRef.action!==undefined&&typeof resourceRef.action!=='string')))throw new Error('Invalid resource reference');
  if(source.sessionRef && (typeof source.sessionRef.id!=='string'||!source.sessionRef.id||source.sessionRef.id.length>200))throw new Error('Invalid session reference');
  if(source.attachments!==undefined&&!Array.isArray(source.attachments))throw new Error('Invalid attachments');
  const history=(source.history ?? source.chatHistory ?? []).slice(-6).map((item:any)=>({role:item.role==='user'||item.sender==='user'?'user':'assistant',content:item.content ?? item.text}));
  if(history.some((item:any)=>typeof item.content!=='string'||item.content.length>12000))throw new Error('Invalid chat history');
  const viewContext=source.viewContext ?? source.context?.currentView;
  if(JSON.stringify(viewContext ?? null).length>24000 || JSON.stringify(source.attachments ?? []).length>24000)throw new Error('Context exceeds input budget');
  return {interactionId:typeof source.interactionId==='string'&&source.interactionId.length<=200?source.interactionId:randomUUID(),kind:kind as AgentInteraction['kind'],userInput:userInput.trim(),history,...(source.sessionRef?{sessionRef:{id:source.sessionRef.id}}:{}), ...(resourceRef?{resourceRef:{type:resourceRef.type,id:resourceRef.id,action:resourceRef.action}}:{}),...(viewContext?{viewContext}:{}),...(source.attachments?{attachments:source.attachments}:{})};
}
export function toLegacyResult(turn:AgentTurnResult){
  const last=turn.skillRuns.findLast(run=>run.skillId!=='skill_session_journal');const success=!['FAILED','CANCELLED'].includes(turn.status);
  const view=projectAguiView(turn);
  return {...turn,success,skillId:last?.skillId ?? '',skillName:last?.skillName ?? '',generativeView:view,source:'llm_tool_calling' as const,args:last?.args ?? {},error:turn.error?.message};
}
export interface LegacyEvent {event:string;data:Record<string,any>;}
export function toLegacyEvents(event:RunEvent):LegacyEvent[]{
  const meta={runId:event.runId,seq:event.seq};
  if(event.type==='started')return [{event:'reasoning_start',data:{...meta}}];
  if(event.type==='reasoning')return [{event:'reasoning_chunk',data:{...meta,text:event.data.text,replace:true}}];
  if(event.type==='content')return [{event:'content_chunk',data:{...meta,text:event.data.text,replace:true}}];
  if(event.type==='tool_started')return [{event:'tool_call_start',data:{...meta,toolId:event.data.skillId,toolName:event.data.skillName,args:event.data.args}}];
  if(event.type==='tool_completed'){
    const frames:LegacyEvent[]=[{event:'tool_call_result',data:{...meta,toolId:event.data.skillId,success:!['FAILED','CANCELLED'].includes(event.data.result.status),status:event.data.result.status,summary:event.data.result.method}}];
    if(event.data.agui?.length)frames.push({event:'generative_view',data:{...meta,view:projectAguiView({runId:event.runId,interactionId:'',status:'SUCCESS',replyText:'',skillRuns:[],agui:event.data.agui})}});
    return frames;
  }
  if(event.type==='failed')return [{event:'error',data:{...meta,...event.data}}];
  if(event.type==='result'){
    const result=toLegacyResult(event.data.result);
    return [{event:'reasoning_end',data:{...meta,durationMs:result.reasoningDuration ?? 0}},{event:'generative_view',data:{...meta,view:result.generativeView}},{event:'content_chunk',data:{...meta,text:result.replyText,replace:true}},{event:'finish',data:{...meta,...result}}];
  }
  return [];
}
