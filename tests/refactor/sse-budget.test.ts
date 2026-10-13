import {expect,it} from 'vitest';
import {createSseDecoder} from '@/application/dispatch/sse';

const wire=(text:string)=>new TextEncoder().encode(`event: message\ndata: ${JSON.stringify({text})}\n\n`);

it.each(['complete','fragmented'])('rejects an oversized %s frame',delivery=>{
 const bytes=wire('x'.repeat(1024*1024+1));
 const decoder=createSseDecoder();
 const chunkSize=delivery==='complete'?bytes.length:65536;
 expect(()=>{for(let i=0;i<bytes.length;i+=chunkSize)decoder.push(bytes.subarray(i,i+chunkSize));}).toThrow('SSE frame exceeds budget');
});

it('counts UTF-8 bytes rather than JavaScript characters',()=>{
 const bytes=wire('界'.repeat(400000));
 expect(()=>createSseDecoder().push(bytes)).toThrow('SSE frame exceeds budget');
});

it('accepts several valid frames even when one read exceeds the frame budget',()=>{
 const bytes=wire('x'.repeat(600000));const combined=new Uint8Array(bytes.length*2);combined.set(bytes);combined.set(bytes,bytes.length);
 expect(createSseDecoder().push(combined)).toHaveLength(2);
});

it('allows a larger bounded application frame without increasing the LLM default',()=>{
 const bytes=wire('x'.repeat(1200000));const decoder=createSseDecoder({maxFrameBytes:2*1024*1024});
 const frames=[];for(let i=0;i<bytes.length;i+=65536)frames.push(...decoder.push(bytes.subarray(i,i+65536)));
 frames.push(...decoder.finish());expect(frames[0].data.text).toHaveLength(1200000);
 expect(()=>createSseDecoder().push(bytes)).toThrow('SSE frame exceeds budget');
});

it('enforces exact byte boundaries while preserving split UTF-8 and CRLF',()=>{
 const bytes=new TextEncoder().encode('event: message\r\ndata: {"text":"河南"}\r\n\r\n');
 const decoder=createSseDecoder({maxFrameBytes:bytes.length});const frames=[];
 for(const byte of bytes)frames.push(...decoder.push(Uint8Array.of(byte)));
 expect(frames).toEqual([{event:'message',data:{text:'河南'}}]);
 expect(()=>createSseDecoder({maxFrameBytes:bytes.length-1}).push(bytes)).toThrow('SSE frame exceeds budget');
});
