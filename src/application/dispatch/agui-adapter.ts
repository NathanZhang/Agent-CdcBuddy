import { EventType,EventSchemas,type AGUIEvent } from '@ag-ui/core';
import type { RunEvent } from '@/contracts/run-event';
/** AG-UI is a projection of the same recorded run, never a second execution. */
export function toAguiEvents(event:RunEvent):AGUIEvent[]{
 const runId=event.runId;const messageId=`${runId}-reply`;let events:any[]=[];
 if(event.type==='started')events=[{type:EventType.RUN_STARTED,threadId:runId,runId}];
 else if(event.type==='tool_started')events=[{type:EventType.TOOL_CALL_START,toolCallId:event.data.callId,toolCallName:event.data.skillId,parentMessageId:messageId},{type:EventType.TOOL_CALL_ARGS,toolCallId:event.data.callId,delta:JSON.stringify(event.data.args)},{type:EventType.TOOL_CALL_END,toolCallId:event.data.callId}];
 else if(event.type==='tool_completed')events=[{type:EventType.TOOL_CALL_RESULT,toolCallId:event.data.callId,messageId:`${runId}-${event.data.callId}-result`,content:JSON.stringify(event.data.result),role:'tool'}];
 else if(event.type==='result'){
  const result=event.data.result;
  events=[{type:EventType.TEXT_MESSAGE_START,messageId,role:'assistant'},{type:EventType.TEXT_MESSAGE_CONTENT,messageId,delta:result.replyText},{type:EventType.TEXT_MESSAGE_END,messageId},{type:EventType.STATE_SNAPSHOT,snapshot:result},...(['FAILED','CANCELLED'].includes(result.status)?[{type:EventType.RUN_ERROR,code:result.error?.code ?? result.status,message:result.error?.message ?? result.replyText}]:[{type:EventType.RUN_FINISHED,threadId:runId,runId}])];
 }
 return events.map(value=>EventSchemas.parse(value) as AGUIEvent);
}
