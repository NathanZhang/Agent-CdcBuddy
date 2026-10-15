import { getLLMTimeouts } from '@/lib/config/llm-timeout';
import {readLLMStream} from './stream';
export interface LLMToolCall {id:string;type:'function';function:{name:string;arguments:string};}
export interface LLMMessage {role:'system'|'user'|'assistant'|'tool';content:string|null;tool_calls?:LLMToolCall[];tool_call_id?:string;}
export interface LLMStreamDelta {type:'reasoning'|'content'|'reset';text:string;}
export interface LLMRequest {imageDataUrl?:string;phase?:'intent'|'tool-selection'|'synthesis'|'write-intent'|'vision'|'title'|'text2sql';temperature?:number;attemptBudget?:{remaining:number};deadlineAt?:number;messages:LLMMessage[];tools?:unknown[];toolChoice?:'auto'|'none';signal?:AbortSignal;onDelta?:(delta:LLMStreamDelta)=>void;}
export interface LLMClient {complete(request:LLMRequest):Promise<LLMMessage>;}
export interface LLMTimeoutDetails {kind:'first-output'|'idle'|'non-stream'|'deadline';phase:string;model:string;attempts:number;timeoutMs:number;elapsedMs:number;lastOutputAt?:number;}
export class LLMError extends Error {constructor(public code:string,message:string,public timeoutDetails?:LLMTimeoutDetails){super(message);}}
export function validateLLMFinishReason(reason:unknown):void{
  if(reason===undefined||reason===null||reason==='stop'||reason==='tool_calls')return;
  throw new LLMError(reason==='length'?'LLM_OUTPUT_TRUNCATED':'INVALID_LLM_RESPONSE',`模型输出未完整结束 (${reason})`);
}
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
    // Intent recognition needs visible reasoning even though its output is JSON without tools.
    // Evidence is already available in synthesis; reserve its output budget for the answer.
    // Transport is always streamed, including private JSON validation and vision calls.
    // Enabling streaming must not implicitly enable reasoning for those phases.
    const thinking=(request.phase==='intent'||request.phase==='tool-selection'||!request.phase&&Boolean(request.onDelta)&&request.toolChoice!=='none')&&env.SILICONFLOW_ENABLE_THINKING!=='false';
    const timeouts=getLLMTimeouts(env,request.phase==='text2sql'?'text2sql':'router');
    const phase=request.phase ? ({intent:'意图识别','tool-selection':'技能选择',synthesis:'结果汇总','write-intent':'操作意图校验',vision:'图片识别',title:'会话标题',text2sql:'SQL生成'}[request.phase]) : request.toolChoice==='none'?'结果汇总':'技能选择';
    const started=Date.now();
    let last:unknown,outputRecovery=false,requestAttempts=0;
    for(let attempt=0;attempt<models.length;attempt++){
      const model=models[attempt],attemptThinking=thinking&&!outputRecovery;
      // Regenerate from the original context, never continue an incomplete JSON/tool call.
      const messages=outputRecovery?[...request.messages,{role:'user' as const,content:'上次输出达到长度上限，未完成。请根据已有上下文和真实工具结果重新生成精简完整的响应；只保留核心结论和必要限制，完整明细留在工作台，不逐行复述。需要工具时只生成完整的原生工具调用；最终答复仍严格遵守要求的 JSON 格式。'}]:request.messages;
      request.signal?.throwIfAborted();
      if(request.attemptBudget&&request.attemptBudget.remaining<=0)throw new LLMError('INTENT_REQUEST_BUDGET_EXCEEDED','地域识别请求预算已耗尽');
      if(request.deadlineAt!==undefined&&Date.now()>=request.deadlineAt)throw new LLMError('LLM_TIMEOUT','调用方指定的执行截止时间已到',{kind:'deadline',phase,model,attempts:requestAttempts,timeoutMs:0,elapsedMs:Date.now()-started});
      // Qwen3.8 defaults to xhigh; pass effort to the API and directly to compatible templates.
      const effort=attemptThinking&&templateThinking&&/qwen3\.8(?:[-/]|$)/i.test(model)?env.SILICONFLOW_REASONING_EFFORT?.trim() || 'medium':undefined;
      if(effort&&!['low','medium','xhigh'].includes(effort))throw new LLMError('LLM_UNAVAILABLE','SILICONFLOW_REASONING_EFFORT 仅支持 low、medium 或 xhigh');
      const reasoningOptions=effort?{reasoning_effort:effort}:{};
      const controller=new AbortController();
      const abort=()=>controller.abort(request.signal?.reason);request.signal?.addEventListener('abort',abort,{once:true});
      let timedOut=false,lastOutputAt:number|undefined;
      const timeoutState:{kind:LLMTimeoutDetails['kind'];timeoutMs:number}={kind:'first-output',timeoutMs:timeouts.firstOutputMs};
      const attemptStarted=Date.now();
      let timer:ReturnType<typeof setTimeout>;
      const armDeadline=(nextKind:LLMTimeoutDetails['kind'],waitMs:number,budgetMs=waitMs)=>{
        if(controller.signal.aborted)return;
        clearTimeout(timer);
        timeoutState.kind=nextKind;timeoutState.timeoutMs=budgetMs;
        const remaining=request.deadlineAt===undefined?Infinity:Math.max(1,request.deadlineAt-Date.now());
        if(remaining<=waitMs){timeoutState.kind='deadline';timeoutState.timeoutMs=remaining;}
        timer=setTimeout(()=>{timedOut=true;controller.abort(new Error('LLM timeout'));},Math.min(waitMs,remaining));
      };
      const onActivity=()=>{lastOutputAt=Date.now();armDeadline('idle',timeouts.idleMs);};
      armDeadline('first-output',timeouts.firstOutputMs);
      try{
        request.onDelta?.({type:'reset',text:''});
        requestAttempts++;if(request.attemptBudget)request.attemptBudget.remaining--;
        const response=await fetcher(`${base.replace(/\/$/,'')}/chat/completions`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${apiKey}`},signal:controller.signal,body:JSON.stringify({model,messages:request.imageDataUrl?messages.map((message,index)=>index===messages.map(m=>m.role).lastIndexOf('user')?{...message,content:[{type:'text',text:message.content},{type:'image_url',image_url:{url:request.imageDataUrl}}]}:message):messages,...(request.tools?.length?{tools:request.tools}:{}),...(request.toolChoice||request.tools?.length?{tool_choice:request.toolChoice ?? 'auto'}:{}),...(request.toolChoice==='none'?{response_format:{type:'json_object'}}:{}),stream:true,enable_thinking:attemptThinking,...reasoningOptions,...(attemptThinking&&!templateThinking?{thinking_budget:1024}:{}),...(templateThinking?{chat_template_kwargs:{enable_thinking:attemptThinking,...reasoningOptions}}:{}),max_tokens:outputRecovery||attemptThinking&&templateThinking?8192:4096,temperature:request.temperature??(request.phase==='intent'?.1:.7),top_p:0.8,top_k:20})});
        if(!response.ok){await response.body?.cancel();if(response.status!==429 && response.status<500)throw new LLMError('LLM_REJECTED',`大模型服务拒绝请求 (${response.status})`);throw new Error(`LLM HTTP ${response.status}`);}
        if(response.headers.get('content-type')?.includes('text/event-stream')){
          const message=await readLLMStream(response,request,onActivity);request.signal?.throwIfAborted();return message;
        }
        // A provider ignoring stream:true exposes no token progress. Bound its entire
        // attempt (including headers and body), never renew on arbitrary JSON bytes.
        const nonStreamRemaining=timeouts.nonStreamMs-(Date.now()-attemptStarted);
        armDeadline('non-stream',Math.max(1,nonStreamRemaining),timeouts.nonStreamMs);
        if(nonStreamRemaining<=0){
          timedOut=true;controller.abort(new Error('LLM timeout'));
          await response.body?.cancel().catch(()=>{});throw controller.signal.reason;
        }
        const data=JSON.parse(await boundedText(response));validateLLMFinishReason(data.choices?.[0]?.finish_reason);const message=validateLLMMessage(data.choices?.[0]?.message);
        request.signal?.throwIfAborted();
        if(typeof data.choices?.[0]?.message?.reasoning_content==='string')request.onDelta?.({type:'reasoning',text:data.choices[0].message.reasoning_content});
        if(message.content)request.onDelta?.({type:'content',text:message.content});return message;
      }catch(error){request.signal?.throwIfAborted();
        if(error instanceof LLMError&&error.code==='LLM_OUTPUT_TRUNCATED'&&!outputRecovery){outputRecovery=true;attempt--;continue;}
        if(timedOut){
          const {kind,timeoutMs}=timeoutState;
          const elapsedMs=Date.now()-started;
          const reason=kind==='idle'?`连续 ${timeouts.idleMs} ms 未收到有效输出`:kind==='first-output'?`等待首个有效输出超过 ${timeouts.firstOutputMs} ms`:kind==='non-stream'?`供应商返回非流式响应，单次上限 ${timeouts.nonStreamMs} ms`:'调用方指定的执行截止时间已到';
          const failure=new LLMError('LLM_TIMEOUT',`大模型请求超时：${phase}阶段，模型 ${model}，${reason}，已尝试 ${requestAttempts} 次，累计等待 ${(elapsedMs/1000).toFixed(1)} 秒${lastOutputAt===undefined?'':`，距最后有效输出 ${((Date.now()-lastOutputAt)/1000).toFixed(1)} 秒`}。请稍后重试。`,{kind,phase,model,attempts:requestAttempts,timeoutMs,elapsedMs,...(lastOutputAt===undefined?{}:{lastOutputAt})});
          // Log each failed attempt, including one hidden by a successful retry.
          // Diagnostics contain no prompts, image pixels, tool arguments or credentials.
          last=failure;
          console.warn('LLM_TIMEOUT',JSON.stringify(failure.timeoutDetails));
          if(kind==='deadline')throw last;
        }else{if(error instanceof LLMError)throw error;last=error;}}
      finally{clearTimeout(timer!);request.signal?.removeEventListener('abort',abort);}
    }
    if(last instanceof LLMError)throw last;
    throw new LLMError('LLM_UNAVAILABLE',`大模型服务不可用：${last instanceof Error?last.message:'请求失败'}`);
  }};
}
