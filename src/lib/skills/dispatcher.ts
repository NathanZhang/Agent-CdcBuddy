import {authHeaders} from '@/infrastructure/auth/client';
import { createSseDecoder } from '@/application/dispatch/sse';
import type { AgentDomainType } from '@/lib/config/agent-profile';
export interface DispatchResult {
 success:boolean;skillId:string;skillName:string;replyText:string;reasoningText?:string;reasoningDuration?:number;session?:{id:string;title:string};generativeView?:any;error?:string;
 source?:'llm_tool_calling'|'llm_direct_answer';args?:Record<string,any>;runId?:string;interactionId?:string;status?:string;agui?:any[];skillRuns?:any[];
}
export interface DispatchContext {
 domain?:AgentDomainType;chatHistory?:Array<{sender:string;text:string;skillUsed?:string}>;currentView?:any;userRole?:string;signal?:AbortSignal;
 interaction?:{interactionId?:string;sessionRef?:{id:string};kind:string;resourceRef?:{type:string;id:string;action?:string};attachments?:unknown[]};
 onReasoningStart?:()=>void;onReasoningChunk?:(chunk:string,full:string)=>void;onReasoningEnd?:(ms:number)=>void;
 onContentChunk?:(chunk:string,full:string)=>void;onToolCallStart?:(info:{toolId:string;toolName:string;args:any})=>void;
 onToolCallResult?:(info:{toolId:string;success:boolean;summary:string})=>void;onGenerativeView?:(view:any)=>void;
}
function requestBody(promptText:string,context?:DispatchContext){return {promptText,chatHistory:context?.chatHistory ?? [],context:{currentView:context?.currentView},...context?.interaction};}
function failed(message:string):DispatchResult{return {success:false,status:'FAILED',skillId:'',skillName:'',replyText:message,error:message,generativeView:null};}
/** Transport errors are visible. Never repeat a potentially mutating turn on another endpoint. */
export async function dispatchSkillPromptStream(promptText:string,context?:DispatchContext):Promise<DispatchResult>{
 if(!promptText.trim())return failed('请输入有效指令');
 let reader:ReadableStreamDefaultReader<Uint8Array>|undefined;
 try{
  const response=await fetch('/api/agent/stream-dispatch',{method:'POST',headers:{...await authHeaders(),'Content-Type':'application/json',Accept:'text/event-stream'},signal:context?.signal,body:JSON.stringify(requestBody(promptText,context))});
  if(!response.ok||!response.body)throw new Error(`智能体服务响应异常 (${response.status})`);
  reader=response.body.getReader();const decoder=createSseDecoder();let result:DispatchResult|undefined;let content='',reasoning='';
  const consume=(frames:ReturnType<typeof decoder.push>)=>{for(const {event,data} of frames){
   if(event==='reasoning_start')context?.onReasoningStart?.();
   else if(event==='reasoning_chunk'){reasoning=(data.replace?'':reasoning)+data.text;context?.onReasoningChunk?.(data.text,reasoning);}
   else if(event==='reasoning_end')context?.onReasoningEnd?.(data.durationMs ?? 0);
   else if(event==='tool_call_start')context?.onToolCallStart?.(data);
   else if(event==='tool_call_result')context?.onToolCallResult?.(data);
   else if(event==='content_chunk'){content=(data.replace?'':content)+data.text;context?.onContentChunk?.(data.text,content);}
   else if(event==='generative_view')context?.onGenerativeView?.(data.view ?? null);
   else if(event==='finish')result=data;
  }};
  while(true){const part=await reader.read();if(part.done)break;consume(decoder.push(part.value));}consume(decoder.finish());
  if(!result)throw new Error('智能体响应中断，未收到完整结果');return result;
 }catch(error){if(context?.signal?.aborted)throw error;context?.onGenerativeView?.(null);return failed(error instanceof Error?error.message:'智能体连接失败');}
 finally{await reader?.cancel().catch(()=>{});reader?.releaseLock();}
}
export async function dispatchSkillPrompt(promptText:string,context?:DispatchContext):Promise<DispatchResult>{
 try{const response=await fetch('/api/agent/dispatch',{method:'POST',headers:{...await authHeaders(),'Content-Type':'application/json'},signal:context?.signal,body:JSON.stringify(requestBody(promptText,context))});if(!response.ok)throw new Error(`智能体服务响应异常 (${response.status})`);return await response.json();}
 catch(error){if(context?.signal?.aborted)throw error;return failed(error instanceof Error?error.message:'智能体连接失败');}
}
