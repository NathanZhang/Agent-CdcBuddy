import type { AgentDomain } from '@/contracts/dataset';
import type { AgentInteraction,AgentTurnResult } from '@/contracts/agent-interaction';
import { uiOperation } from '@/application/agent/ui-operation';
import { adaptFunctionalInteraction } from '@/application/agent/interaction-adapter';
import { viewFromTurn,restoreSession } from './result-adapter';
import type { WorkbenchClient } from './session-client';
export interface WorkbenchMessage {id:string;sender:'user'|'agent'|'system';text:string;timestamp:string;runId?:string;skillUsed?:string;generativeView?:any;reasoningText?:string;reasoningDuration?:number;streaming?:boolean;reasoningStreaming?:boolean;interrupted?:boolean;}
export interface WorkbenchState {domain:AgentDomain;busy:boolean;status:string;messages:WorkbenchMessage[];view:any;sessionId:string|null;title:string;runId?:string;progress:string;replyText:string;}
export function createWorkbenchController(options:{domain:AgentDomain;client:WorkbenchClient}){
 let state:WorkbenchState={domain:options.domain,busy:false,status:'IDLE',messages:[],view:null,sessionId:null,title:'新研判会话',progress:'',replyText:''};
 const listeners=new Set<()=>void>();let generation=0;let abort:AbortController|undefined;
 let clearedRevision=0;const deletedSessions=new Set<string>();
 const update=(changes:Partial<WorkbenchState>)=>{state={...state,...changes};for(const listener of listeners)listener();};
 const stopMessages=()=>state.messages.map(m=>m.streaming?{...m,streaming:false,reasoningStreaming:false,interrupted:true,text:m.text||'已停止生成。'}:m);
 const cancel=()=>{generation++;abort?.abort();abort=undefined;update({busy:false,progress:'',status:'CANCELLED',view:null,messages:stopMessages()});};
 const startSession=()=>{
  generation++;abort?.abort();abort=undefined;
  update({busy:false,status:'IDLE',messages:[],view:null,sessionId:null,title:'新研判会话',runId:undefined,progress:'',replyText:''});
 };
 const interact=async(input:AgentInteraction):Promise<AgentTurnResult|undefined>=>{
  const operation=uiOperation(input);
  if(operation?.mode==='session'&&input.resourceRef?.action==='create'){startSession();return;}
  // Drawer reads and management have their own lifecycle; they must not cancel an answer.
  if(operation?.mode==='background'){
   const result=await options.client.interact(input);
   if(result.status==='SUCCESS'&&input.resourceRef?.type==='session'){
    const {action,id}=input.resourceRef;
    if(action==='clear')clearedRevision++;
    if(action==='delete')deletedSessions.add(id);
    if(action==='clear'||(action==='delete'&&id===state.sessionId))update({sessionId:null,title:'新研判会话'});
    if(['rename','update'].includes(action??'')&&id===state.sessionId){
     const payload=result.skillRuns.map(r=>r.result.payload).find((p:any)=>p?.type==='SESSION_RESULT') as any;
     if(payload?.session?.title)update({title:payload.session.title});
    }
   }
   return result;
  }
  const recordChat=!operation;
  abort?.abort();const current=++generation;const sessionRevision=clearedRevision;abort=new AbortController();
  const timestamp=new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'});
  const user:WorkbenchMessage={id:crypto.randomUUID(),sender:'user',text:input.userInput,timestamp};
  const assistantId=crypto.randomUUID();
  const patchReply=(changes:Partial<WorkbenchMessage>)=>{
   if(current!==generation||!recordChat)return;
   const existing=state.messages.some(m=>m.id===assistantId);
   update({messages:existing?state.messages.map(m=>m.id===assistantId?{...m,...changes}:m):[...state.messages,{id:assistantId,sender:'agent',text:'',timestamp,streaming:true,...changes}]});
  };
  const history=state.messages.filter(m=>!m.streaming&&!m.interrupted&&m.text).slice(-6).map(m=>({role:m.sender==='user'?'user' as const:'assistant' as const,content:m.text}));
  update({busy:true,status:'RUNNING',progress:'',messages:[...stopMessages(),...(recordChat?[user]:[])]});
  try{
   const result=await options.client.interact({...input,...(recordChat?{history}:{}),...(recordChat&&state.sessionId&&input.kind!=='session'?{sessionRef:{id:state.sessionId}}:{})},{signal:abort.signal,onGenerativeView:view=>{if(current===generation)update({view});},onProgress:text=>{if(current===generation)update({progress:text});},onReasoningStart:()=>patchReply({reasoningStreaming:true}),onReasoningChunk:(_chunk,full)=>patchReply({reasoningText:full,reasoningStreaming:true}),onReasoningEnd:ms=>patchReply({reasoningDuration:ms,reasoningStreaming:false}),onContentChunk:(_chunk,full)=>patchReply({text:full,...(full?{reasoningStreaming:false}:{})})});
   if(current!==generation)return;
   const sessionStillExists=(id:string)=>sessionRevision===clearedRevision&&!deletedSessions.has(id);
   const view=viewFromTurn(result);update({replyText:result.replyText,...(recordChat&&result.session&&sessionStillExists(result.session.id)?{sessionId:result.session.id,title:result.session.title}:{})});
   const sessionPayload=result.skillRuns.map(r=>r.result.payload).find((p:any)=>p?.type==='SESSION_RESULT' && ['read','create'].includes(p.action)) as any;
   if(sessionPayload?.session && sessionStillExists(sessionPayload.session.sessionId) && !['FAILED','CANCELLED'].includes(result.status)){
    const restored=restoreSession(sessionPayload.session);update({sessionId:restored.sessionId,title:restored.title,messages:restored.messages,view:restored.view,runId:result.runId,status:result.status});
   }else if(operation?.mode==='session'){
    update({status:result.status});
   }else if(!recordChat){
    update({view,runId:result.runId,status:result.status});
   }else{
    patchReply({text:result.replyText,runId:result.runId,skillUsed:result.skillRuns.findLast(r=>r.skillId!=='skill_session_journal')?.skillName,generativeView:view,...(result.reasoningText!==undefined?{reasoningText:result.reasoningText}:{}),...(result.reasoningDuration!==undefined?{reasoningDuration:result.reasoningDuration}:{}),streaming:false,reasoningStreaming:false,interrupted:['FAILED','CANCELLED'].includes(result.status)});
    update({view,runId:result.runId,status:result.status});
   }
   return result;
  }catch(error){if(current===generation){if(recordChat)patchReply({text:error instanceof Error?error.message:'智能体执行失败',streaming:false,reasoningStreaming:false,interrupted:true});update({status:'FAILED',...(recordChat?{view:null}:{replyText:error instanceof Error?error.message:'界面操作失败'})});}}
  finally{if(current===generation){abort=undefined;update({busy:false,progress:''});}}
 };
 return {getState:()=>state,subscribe:(listener:()=>void)=>{listeners.add(listener);return ()=>{listeners.delete(listener);};},interact,cancel,
  send:(text:string)=>interact({interactionId:crypto.randomUUID(),kind:'conversation',userInput:text}),
  loadSession:(id:string)=>interact(adaptFunctionalInteraction({type:'session.read',id})),
  startSession,
  showMessageView:(messageId:string)=>{
   const message=state.messages.find(m=>m.id===messageId);
   if(!message?.generativeView||state.busy)return false;
   update({view:message.generativeView});return true;
  }
 };
}
export type WorkbenchController=ReturnType<typeof createWorkbenchController>;
