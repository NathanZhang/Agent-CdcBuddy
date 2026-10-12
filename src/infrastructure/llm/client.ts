import { getRouterTimeoutMs } from '@/lib/config/llm-timeout';
import {readLLMStream} from './stream';
export interface LLMToolCall {id:string;type:'function';function:{name:string;arguments:string};}
export interface LLMMessage {role:'system'|'user'|'assistant'|'tool';content:string|null;tool_calls?:LLMToolCall[];tool_call_id?:string;}
export interface LLMStreamDelta {type:'reasoning'|'content'|'reset';text:string;}
export interface LLMRequest {messages:LLMMessage[];tools?:unknown[];toolChoice?:'auto'|'none';signal?:AbortSignal;onDelta?:(delta:LLMStreamDelta)=>void;}
export interface LLMClient {complete(request:LLMRequest):Promise<LLMMessage>;}
export class LLMError extends Error {constructor(public code:string,message:string){super(message);}}
export function validateLLMMessage(value:any):LLMMessage{
  if(!value || value.role!=='assistant' || (value.content!==null && typeof value.content!=='string'))throw new LLMError('INVALID_LLM_RESPONSE','LLM response has invalid content');
  if(value.tool_calls!==undefined && value.tool_calls!==null){
    if(!Array.isArray(value.tool_calls)||value.tool_calls.length>8)throw new LLMError('INVALID_LLM_RESPONSE','Invalid tool calls');
    const ids=new Set<string>();
    for(const call of value.tool_calls){if(!call || typeof call.id!=='string' || !call.id || ids.has(call.id) || call.type!=='function' || !call.function || typeof call.function.name!=='string' || !call.function.name || typeof call.function.arguments!=='string' || call.function.arguments.length>24000)throw new LLMError('INVALID_LLM_RESPONSE','Invalid or duplicate tool call');ids.add(call.id);}
  }
  if(!value.content && !value.tool_calls?.length)throw new LLMError('INVALID_LLM_RESPONSE','Empty LLM response');
  return {role:'assistant',content:value.content, ...(value.tool_calls?.length?{tool_calls:value.tool_calls}:{})};
}
async function boundedText(response:Response,maxBytes=2*1024*1024):Promise<string>{
  if(!response.body)throw new LLMError('INVALID_LLM_RESPONSE','Empty response body');
  const reader=response.body.getReader();const decoder=new TextDecoder();let size=0,text='';
  try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>maxBytes)throw new LLMError('INVALID_LLM_RESPONSE','Response exceeds byte budget');text+=decoder.decode(part.value,{stream:true});}return text+decoder.decode();}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
/** Only retries another LLM request. No business or rules fallback. */
export function createLLMClient(options:{env?:Record<string,string|undefined>;fetch?:typeof fetch}={}):LLMClient{
  const env=options.env ?? process.env;const fetcher=options.fetch ?? fetch;
  return {complete:async(request)=>{
    const apiKey=env.SILICONFLOW_API_KEY;if(!apiKey)throw new LLMError('LLM_UNAVAILABLE','未配置可用的大模型服务');
    const base=env.SILICONFLOW_BASE_URL ?? 'https://api.siliconflow.cn/v1';
    const primary=env.SILICONFLOW_MODEL ?? 'Qwen/Qwen3.6-27B';
    const models=[primary,env.SILICONFLOW_FALLBACK_MODEL ?? primary];
    const templateThinking=!new URL(base).hostname.endsWith('.siliconflow.cn');
    const streaming=Boolean(request.onDelta),thinking=streaming&&env.SILICONFLOW_ENABLE_THINKING!=='false';
    const timeoutMs=getRouterTimeoutMs(env);
    const phase=request.toolChoice==='none'?'结果汇总':'技能选择';
    const started=Date.now();
    let last:unknown;
    for(const [attempt,model] of models.entries()){
      request.signal?.throwIfAborted();const controller=new AbortController();
      const abort=()=>controller.abort(request.signal?.reason);request.signal?.addEventListener('abort',abort,{once:true});
      let timedOut=false,isStream=streaming;
      let timer:ReturnType<typeof setTimeout>;
      // Bound the initial wait and each silent interval, not a productive stream's total duration.
      const refreshDeadline=()=>{
        if(controller.signal.aborted)return;
        clearTimeout(timer);
        timer=setTimeout(()=>{timedOut=true;controller.abort(new Error('LLM timeout'));},timeoutMs);
      };
      refreshDeadline();
      try{
        request.onDelta?.({type:'reset',text:''});
        const response=await fetcher(`${base.replace(/\/$/,'')}/chat/completions`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${apiKey}`},signal:controller.signal,body:JSON.stringify({model,messages:request.messages,...(request.tools?.length?{tools:request.tools}:{}),...(request.toolChoice||request.tools?.length?{tool_choice:request.toolChoice ?? 'auto'}:{}),...(request.toolChoice==='none'?{response_format:{type:'json_object'}}:{}),...(streaming?{stream:true}:{}),enable_thinking:thinking,...(thinking&&!templateThinking?{thinking_budget:1024}:{}),...(templateThinking?{chat_template_kwargs:{enable_thinking:thinking}}:{}),max_tokens:thinking&&templateThinking?8192:4096,temperature:0.7,top_p:0.8,top_k:20})});
        if(!response.ok){await response.body?.cancel();if(response.status!==429 && response.status<500)throw new LLMError('LLM_REJECTED',`大模型服务拒绝请求 (${response.status})`);throw new Error(`LLM HTTP ${response.status}`);}
        isStream=Boolean(response.headers.get('content-type')?.includes('text/event-stream'));
        if(isStream)return await readLLMStream(response,request,refreshDeadline);
        const data=JSON.parse(await boundedText(response));const message=validateLLMMessage(data.choices?.[0]?.message);
        if(typeof data.choices?.[0]?.message?.reasoning_content==='string')request.onDelta?.({type:'reasoning',text:data.choices[0].message.reasoning_content});
        if(message.content)request.onDelta?.({type:'content',text:message.content});return message;
      }catch(error){request.signal?.throwIfAborted();if(timedOut){last=new LLMError('LLM_TIMEOUT',`大模型请求超时：${phase}阶段，模型 ${model}，${isStream?`连续 ${timeoutMs} ms 未收到有效输出`:`单次上限 ${timeoutMs} ms`}，已尝试 ${attempt+1} 次，累计等待 ${((Date.now()-started)/1000).toFixed(1)} 秒。请稍后重试。`);}else{if(error instanceof LLMError)throw error;last=error;}}
      finally{clearTimeout(timer!);request.signal?.removeEventListener('abort',abort);}
    }
    if(last instanceof LLMError)throw last;
    throw new LLMError('LLM_UNAVAILABLE',`大模型服务不可用：${last instanceof Error?last.message:'请求失败'}`);
  }};
}
