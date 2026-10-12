import {createSseDecoder} from '@/application/dispatch/sse';
import {LLMError,validateLLMMessage,type LLMMessage,type LLMRequest,type LLMToolCall} from './client';

/** Assemble native deltas before validating or executing any tool call. */
export async function readLLMStream(response:Response,request:LLMRequest,onActivity?:()=>void):Promise<LLMMessage>{
 if(!response.body)throw new LLMError('INVALID_LLM_RESPONSE','Empty response body');
 const reader=response.body.getReader(),decoder=createSseDecoder();
 let bytes=0,content='',finished=false;const calls=new Map<number,LLMToolCall>();
 const consume=(frames:ReturnType<typeof decoder.push>)=>{for(const {data} of frames){
  if(data.error)throw new LLMError('LLM_REJECTED','大模型流式响应异常');
  const choice=data.choices?.[0];if(!choice)continue;
  if(finished)throw new LLMError('INVALID_LLM_RESPONSE','Unexpected content after completion');
  const delta=choice.delta ?? {};
  let active=Boolean(typeof delta.reasoning_content==='string'&&delta.reasoning_content.length||typeof delta.content==='string'&&delta.content.length);
  if(typeof delta.reasoning_content==='string')request.onDelta?.({type:'reasoning',text:delta.reasoning_content});
  if(typeof delta.content==='string'){content+=delta.content;request.onDelta?.({type:'content',text:delta.content});}
  for(const part of delta.tool_calls ?? []){
   if(!Number.isInteger(part.index)||part.index<0||part.index>=8)throw new LLMError('INVALID_LLM_RESPONSE','Invalid tool call index');
   const call=calls.get(part.index) ?? {id:'',type:'function',function:{name:'',arguments:''}};
   if(part.type!==undefined&&part.type!=='function')throw new LLMError('INVALID_LLM_RESPONSE','Invalid tool call type');
   if(typeof part.id==='string')call.id+=part.id;
   if(typeof part.function?.name==='string')call.function.name+=part.function.name;
   if(typeof part.function?.arguments==='string')call.function.arguments+=part.function.arguments;
   if(call.function.arguments.length>24000)throw new LLMError('INVALID_LLM_RESPONSE','Tool arguments exceed budget');
   if([part.id,part.function?.name,part.function?.arguments].some(value=>typeof value==='string'&&value.length>0))active=true;
   calls.set(part.index,call);
  }
  if(choice.finish_reason){
   if(!['stop','tool_calls'].includes(choice.finish_reason))throw new LLMError('INVALID_LLM_RESPONSE',`模型输出未完整结束 (${choice.finish_reason})`);
   finished=true;
   active=true;
  }
  if(active)onActivity?.();
 }};
 try{
  while(true){
   const part=await reader.read();if(part.done)break;
   bytes+=part.value.byteLength;if(bytes>2*1024*1024)throw new LLMError('INVALID_LLM_RESPONSE','Response exceeds byte budget');
   try{consume(decoder.push(part.value));}catch(error){if(error instanceof LLMError)throw error;throw new LLMError('INVALID_LLM_RESPONSE','Malformed LLM stream');}
  }
  try{consume(decoder.finish());}catch(error){if(error instanceof LLMError)throw error;throw new LLMError('INVALID_LLM_RESPONSE','Truncated LLM stream');}
  if(!finished)throw new LLMError('INVALID_LLM_RESPONSE','大模型响应中断，未收到完整输出');
  return validateLLMMessage({role:'assistant',content:content||null,tool_calls:[...calls.entries()].sort(([a],[b])=>a-b).map(([,call])=>call)});
 }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
