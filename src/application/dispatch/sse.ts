export interface SseFrame {event:string;data:any;}
export function createSseDecoder(){
  const decoder=new TextDecoder();let buffer='';
  const parse=():SseFrame[]=>{
    const frames:SseFrame[]=[];let match:RegExpExecArray|null;
    while((match=/\r?\n\r?\n/.exec(buffer))){const block=buffer.slice(0,match.index);buffer=buffer.slice(match.index+match[0].length);let event='message';const data:string[]=[];
      for(const line of block.split(/\r?\n/)){if(line.startsWith('event:'))event=line.slice(6).trimStart();else if(line.startsWith('data:'))data.push(line.slice(5).trimStart());}
      if(data.length){const json=data.join('\n');if(json!=='[DONE]')frames.push({event,data:JSON.parse(json)});}
    }
    if(buffer.length>1024*1024)throw new Error('SSE frame exceeds budget');return frames;
  };
  return {push(bytes:Uint8Array){buffer+=decoder.decode(bytes,{stream:true});return parse();},finish(){buffer+=decoder.decode();const frames=parse();if(buffer.trim())throw new Error('Truncated SSE frame');return frames;}};
}
