import type {LLMClient,LLMRequest,LLMMessage,LLMStreamDelta} from '@/infrastructure/llm/client';

/** Bridge callback-based provider deltas into the Agent's ordered async event stream. */
export async function* streamCompletion(client:LLMClient,request:LLMRequest):AsyncGenerator<LLMStreamDelta,LLMMessage>{
 const queue:LLMStreamDelta[]=[];let wake:(()=>void)|undefined,done=false,result:LLMMessage|undefined,failure:unknown;
 const completion=client.complete({...request,onDelta:delta=>{queue.push(delta);wake?.();}}).then(value=>{result=value;},error=>{failure=error;}).finally(()=>{done=true;wake?.();});
 while(!done||queue.length){
  if(queue.length){yield queue.shift()!;continue;}
  await new Promise<void>(resolve=>{wake=resolve;});wake=undefined;
 }
 await completion;if(failure)throw failure;return result!;
}

/** Read only top-level string properties; nested data cannot masquerade as the answer. */
export function replyPreview(json:string,allowAnswer=true):string{
 let cursor=0,mode='',reply='';
 const whitespace=()=>{while(/\s/.test(json[cursor] ?? '')&&cursor<json.length)cursor++;};
 const stringToken=()=>{
  const start=cursor++;
  while(cursor<json.length){
   if(json[cursor]==='"'){
    const text=JSON.parse(json.slice(start,++cursor)) as string;return {text,complete:true};
   }
   if(json[cursor]==='\\'){
    const width=json[cursor+1]==='u'?6:2;
    if(cursor+width>json.length)break;
    cursor+=width;
   }else cursor++;
  }
  const text=JSON.parse(json.slice(start,cursor)+'"') as string;
  return {text:/[\uD800-\uDBFF]$/.test(text)?text.slice(0,-1):text,complete:false};
 };
 try{
  whitespace();if(json[cursor++]!=='{')return '';
  while(cursor<json.length){
   whitespace();if(json[cursor]!== '"')break;
   const key=stringToken();if(!key.complete)break;
   whitespace();if(json[cursor++]!==':')break;whitespace();
   if(json[cursor]==='"'){
    const value=stringToken();
    if(key.text==='replyText')reply=value.text;
    if(key.text==='mode'&&value.complete)mode=value.text;
    if(!value.complete)break;
   }else{
    // Skip another property's scalar or nested value, respecting quoted delimiters.
    let depth=0;
    while(cursor<json.length){
     const char=json[cursor];
     if(char==='"'){if(!stringToken().complete)return '';continue;}
     if(depth===0&&(char===','||char==='}'))break;
     if(char==='{'||char==='[')depth++;
     if(char==='}'||char===']')depth--;
     cursor++;
    }
   }
   whitespace();if(json[cursor++]!==',')break;
  }
 }catch{return '';}
 return mode==='clarification'||(mode==='answer'&&allowAnswer)?reply:'';
}
