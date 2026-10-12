import type { AgentDomain } from '@/contracts/dataset';
import type { AgentInteraction,AgentTurnResult } from '@/contracts/agent-interaction';
import { adaptFunctionalInteraction } from '@/application/agent/interaction-adapter';
import { viewFromTurn,restoreSession } from './result-adapter';
import type { WorkbenchClient } from './session-client';
export interface WorkbenchMessage {id:string;sender:'user'|'agent'|'system';text:string;timestamp:string;runId?:string;skillUsed?:string;generativeView?:any;}
export interface WorkbenchState {domain:AgentDomain;busy:boolean;status:string;messages:WorkbenchMessage[];view:any;sessionId:string|null;title:string;runId?:string;progress:string;replyText:string;}
export function createWorkbenchController(options:{domain:AgentDomain;client:WorkbenchClient}){
 let state:WorkbenchState={domain:options.domain,busy:false,status:'IDLE',messages:[],view:null,sessionId:null,title:'新研判会话',progress:'',replyText:''};
 const listeners=new Set<()=>void>();let generation=0;let abort:AbortController|undefined;
 const update=(changes:Partial<WorkbenchState>)=>{state={...state,...changes};for(const listener of listeners)listener();};
 const cancel=()=>{generation++;abort?.abort();abort=undefined;update({busy:false,progress:'',status:'CANCELLED',view:null});};
 const interact=async(input:AgentInteraction):Promise<AgentTurnResult|undefined>=>{
  abort?.abort();const current=++generation;abort=new AbortController();
  const timestamp=new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'});
  const user:WorkbenchMessage={id:crypto.randomUUID(),sender:'user',text:input.userInput,timestamp};
  const history=state.messages.slice(-6).map(m=>({role:m.sender==='user'?'user' as const:'assistant' as const,content:m.text}));
  update({busy:true,status:'RUNNING',progress:'',messages:[...state.messages,user]});
  try{
   const result=await options.client.interact({...input,history,...(state.sessionId&&input.kind!=='session'?{sessionRef:{id:state.sessionId}}:{})},{signal:abort.signal,onProgress:text=>{if(current===generation)update({progress:text});}});
   if(current!==generation)return;
   const view=viewFromTurn(result);update({replyText:result.replyText});
   const sessionPayload=result.skillRuns.map(r=>r.result.payload).find((p:any)=>p?.type==='SESSION_RESULT' && ['read','create'].includes(p.action)) as any;
   if(sessionPayload?.session && !['FAILED','CANCELLED'].includes(result.status)){
    const restored=restoreSession(sessionPayload.session);update({sessionId:restored.sessionId,title:restored.title,messages:restored.messages,view:restored.view,runId:result.runId,status:result.status});
   }else{
    update({view,runId:result.runId,status:result.status,messages:[...state.messages,{id:crypto.randomUUID(),sender:'agent',text:result.replyText,timestamp,runId:result.runId,skillUsed:result.skillRuns.findLast(r=>r.skillId!=='skill_session_journal')?.skillName,generativeView:view}]});
   }
   return result;
  }catch(error){if(current===generation)update({status:'FAILED',view:null,messages:[...state.messages,{id:crypto.randomUUID(),sender:'agent',text:error instanceof Error?error.message:'智能体执行失败',timestamp}]});}
  finally{if(current===generation){abort=undefined;update({busy:false,progress:''});}}
 };
 return {getState:()=>state,subscribe:(listener:()=>void)=>{listeners.add(listener);return ()=>{listeners.delete(listener);};},interact,cancel,
  send:(text:string)=>interact({interactionId:crypto.randomUUID(),kind:'conversation',userInput:text}),
  loadSession:(id:string)=>{cancel();update({messages:[],view:null,sessionId:null});return interact(adaptFunctionalInteraction({type:'session.read',id}));},
  startSession:()=>{cancel();update({messages:[],view:null,sessionId:null});return interact(adaptFunctionalInteraction({type:'session.create'}));}
 };
}
export type WorkbenchController=ReturnType<typeof createWorkbenchController>;
