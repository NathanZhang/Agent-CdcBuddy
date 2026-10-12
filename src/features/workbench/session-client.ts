import type { AgentInteraction,AgentTurnResult } from '@/contracts/agent-interaction';
import { dispatchSkillPromptStream,type DispatchContext } from '@/lib/skills/dispatcher';
export interface WorkbenchClient {interact(input:AgentInteraction,options?:Pick<DispatchContext,'signal'|'onReasoningStart'|'onReasoningChunk'|'onReasoningEnd'|'onContentChunk'>&{onProgress?:(text:string)=>void}):Promise<AgentTurnResult>;}
export const agentClient:WorkbenchClient={interact:async(input,options)=>{
 const result=await dispatchSkillPromptStream(input.userInput,{...options,chatHistory:input.history?.map(m=>({sender:m.role==='user'?'user':'agent',text:m.content})),currentView:input.viewContext,interaction:{interactionId:input.interactionId,sessionRef:input.sessionRef,kind:input.kind,resourceRef:input.resourceRef,attachments:input.attachments},onToolCallStart:info=>options?.onProgress?.(`正在执行：${info.toolName}`)});
 if(!result.runId || !Array.isArray(result.skillRuns)||!Array.isArray(result.agui))throw new Error(result.error ?? result.replyText ?? '缺少有效 Agent 结果');
 return {runId:result.runId,interactionId:result.interactionId ?? input.interactionId,status:result.status as AgentTurnResult['status'],replyText:result.replyText,reasoningText:result.reasoningText,reasoningDuration:result.reasoningDuration,agui:result.agui,skillRuns:result.skillRuns,...(result.error?{error:{code:'AGENT_FAILED',message:result.error}}:{})};
}};
