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
  const history=(source.history ?? source.chatHistory ?? []).slice(-6).map((item:any)=>({role:item.role==='user'||item.sender==='user'?'user':'assistant',content:item.content ?? item.text}));
  if(history.some((item:any)=>typeof item.content!=='string'||item.content.length>12000))throw new Error('Invalid chat history');
  const viewContext=source.viewContext ?? source.context?.currentView;
  if(JSON.stringify(viewContext ?? null).length>24000 || JSON.stringify(source.attachments ?? []).length>24000)throw new Error('Context exceeds input budget');
  return {interactionId:typeof source.interactionId==='string'&&source.interactionId.length<=200?source.interactionId:randomUUID(),kind:kind as AgentInteraction['kind'],userInput:userInput.trim(),history, ...(resourceRef?{resourceRef:{type:resourceRef.type,id:resourceRef.id,action:resourceRef.action}}:{}),...(viewContext?{viewContext}:{}),...(source.attachments?{attachments:source.attachments}:{})};
}
export function toLegacyResult(turn:AgentTurnResult){
  const last=turn.skillRuns.at(-1);const success=!['FAILED','CANCELLED'].includes(turn.status);
  const view=success?turn.agui.at(-1)?.result.payload ?? null:null;
  return {...turn,success,skillId:last?.skillId ?? '',skillName:last?.skillName ?? '',generativeView:view,source:'llm_tool_calling' as const,args:last?.args ?? {},error:turn.error?.message};
}
export interface LegacyEvent {event:string;data:Record<string,any>;}
export function toLegacyEvents(event:RunEvent):LegacyEvent[]{
  const meta={runId:event.runId,seq:event.seq};
  if(event.type==='started')return [{event:'reasoning_start',data:{...meta}}];
  if(event.type==='tool_started')return [{event:'tool_call_start',data:{...meta,toolId:event.data.skillId,toolName:event.data.skillName,args:event.data.args}}];
  if(event.type==='tool_completed')return [{event:'tool_call_result',data:{...meta,toolId:event.data.skillId,success:!['FAILED','CANCELLED'].includes(event.data.result.status),status:event.data.result.status,summary:event.data.result.method}}];
  if(event.type==='failed')return [{event:'error',data:{...meta,...event.data}}];
  if(event.type==='result'){
    const result=toLegacyResult(event.data.result);
    return [{event:'reasoning_end',data:{...meta,durationMs:0}},{event:'generative_view',data:{...meta,view:result.generativeView}},{event:'content_chunk',data:{...meta,text:result.replyText}},{event:'finish',data:{...meta,...result}}];
  }
  return [];
}
