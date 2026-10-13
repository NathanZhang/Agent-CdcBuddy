import {expect,it} from 'vitest';
import {encodeDispatchSseFrame,decodeDispatchSseData} from '@/application/dispatch/dispatch-wire';
import {createSseDecoder} from '@/application/dispatch/sse';
import {MAX_DISPATCH_SSE_FRAME_BYTES} from '@/contracts/transport-budget';

const geometry={type:'FeatureCollection',features:[{type:'Feature',properties:{label:'河南',geometry:{__cdcGeometryRef:0}},geometry:{type:'Point',coordinates:[113.6,34.7]}}]};
const read=(bytes:Uint8Array)=>createSseDecoder({maxFrameBytes:MAX_DISPATCH_SSE_FRAME_BYTES}).push(bytes)[0];

it('pools repeated geometries while restoring exact properties, array positions, and shared objects',()=>{
 const data={first:{geometry},layers:[{output:{geometry}},{output:{geometry}}],ordinary:{geometry:{__cdcGeometryRef:0}}};
 const bytes=encodeDispatchSseFrame('finish',data,true);
 const raw=new TextDecoder().decode(bytes);
 expect(raw.match(/"coordinates":\[113.6,34.7\]/g)).toHaveLength(1);
 const restored=decodeDispatchSseData(read(bytes).data);
 expect(restored).toEqual(data);
 expect(restored.first.geometry).toBe(restored.layers[1].output.geometry);
 expect(data.first.geometry).toBe(geometry);
});

it('leaves unnegotiated and non-map frames as ordinary event JSON',()=>{
 const data={status:'SUCCESS',geometry};
 expect(read(encodeDispatchSseFrame('finish',data)).data).toEqual(data);
 const ordinary={text:'河南',data:{encoding:'geometry-pool-v1'}};
 expect(read(encodeDispatchSseFrame('content_chunk',ordinary,true)).data).toEqual(ordinary);
 expect(decodeDispatchSseData(ordinary)).toEqual(ordinary);
});

it('decodes an allowed large geometry in arbitrary fragments without requiring a previous frame',()=>{
 const data={geometry:{type:'FeatureCollection',features:[{type:'Feature',geometry:null,properties:{label:'界'.repeat(450000)}}]}};
 const bytes=encodeDispatchSseFrame('generative_view',data,true);
 expect(bytes.length).toBeGreaterThan(1024*1024);
 const decoder=createSseDecoder({maxFrameBytes:MAX_DISPATCH_SSE_FRAME_BYTES});const frames=[];
 for(let i=0;i<bytes.length;i+=65536)frames.push(...decoder.push(bytes.subarray(i,i+65536)));
 frames.push(...decoder.finish());expect(decodeDispatchSseData(frames[0].data)).toEqual(data);
});

it('rejects oversized dispatch events at both encoding and decoding boundaries',()=>{
 const data={text:'x'.repeat(MAX_DISPATCH_SSE_FRAME_BYTES)};
 expect(()=>encodeDispatchSseFrame('finish',data)).toThrow('SSE frame exceeds budget');
 const bytes=new TextEncoder().encode(`event: finish\ndata: ${JSON.stringify(data)}\n\n`);
 expect(()=>read(bytes)).toThrow('SSE frame exceeds budget');
});

it.each(['index','path','inherited','geometry'])('rejects malformed compact %s references',problem=>{
 const envelope:any={cdcSseEncoding:'geometry-pool-v1',data:{geometry:null},geometries:[geometry],locations:[{path:['geometry'],index:0}]};
 if(problem==='index')envelope.locations[0].index=99;
 if(problem==='path')envelope.locations[0].path=['missing'];
 if(problem==='inherited')envelope.locations[0].path=['__proto__','polluted'];
 if(problem==='geometry')envelope.geometries[0]={type:'Point',coordinates:[0,0]};
 expect(()=>decodeDispatchSseData(envelope)).toThrow('Invalid compact SSE geometry');
 expect(({} as any).polluted).toBeUndefined();
});

it('still rejects truncated compact frames',()=>{
 const bytes=encodeDispatchSseFrame('finish',{geometry},true);const decoder=createSseDecoder({maxFrameBytes:MAX_DISPATCH_SSE_FRAME_BYTES});
 decoder.push(bytes.subarray(0,bytes.length-3));expect(()=>decoder.finish()).toThrow('Truncated SSE frame');
});
