import {MAX_LLM_SSE_FRAME_BYTES} from '@/contracts/transport-budget';
export interface SseFrame {event:string;data:any;}
export function createSseDecoder(options:{maxFrameBytes?:number}={}){
  const maxFrameBytes=options.maxFrameBytes??MAX_LLM_SSE_FRAME_BYTES;
  if(!Number.isSafeInteger(maxFrameBytes)||maxFrameBytes<1)throw new Error('Invalid SSE frame budget');
  const decoder=new TextDecoder(),encoder=new TextEncoder();let buffer='',bufferBytes=0;
  const append=(text:string)=>{buffer+=text;bufferBytes+=encoder.encode(text).byteLength;};
  const parse=():SseFrame[]=>{
    const frames:SseFrame[]=[];let match:RegExpExecArray|null;
    while((match=/\r?\n\r?\n/.exec(buffer))){
      const end=match.index+match[0].length,frameBytes=encoder.encode(buffer.slice(0,end)).byteLength;
      if(frameBytes>maxFrameBytes)throw new Error('SSE frame exceeds budget');
      const block=buffer.slice(0,match.index);buffer=buffer.slice(end);bufferBytes-=frameBytes;let event='message';const data:string[]=[];
      for(const line of block.split(/\r?\n/)){if(line.startsWith('event:'))event=line.slice(6).trimStart();else if(line.startsWith('data:'))data.push(line.slice(5).trimStart());}
      if(data.length){const json=data.join('\n');if(json!=='[DONE]')frames.push({event,data:JSON.parse(json)});}
    }
    if(bufferBytes>maxFrameBytes)throw new Error('SSE frame exceeds budget');return frames;
  };
  return {push(bytes:Uint8Array){append(decoder.decode(bytes,{stream:true}));return parse();},finish(){append(decoder.decode());const frames=parse();if(buffer.trim())throw new Error('Truncated SSE frame');return frames;}};
}

/** Read a single terminal JSON result while ignoring transport heartbeat comments. */
export async function readSseResult<T>(response:Response):Promise<T>{
  if(!response.body)throw new Error('服务响应缺少数据流');
  const reader=response.body.getReader(),decoder=createSseDecoder();
  try{
    while(true){
      const part=await reader.read();
      const frames=part.done?decoder.finish():decoder.push(part.value);
      const result=frames.find(frame=>frame.event==='finish');
      if(result)return result.data as T;
      if(part.done)throw new Error('服务响应中断，未收到完整结果');
    }
  }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
