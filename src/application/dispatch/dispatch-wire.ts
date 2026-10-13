import {MAX_DISPATCH_SSE_FRAME_BYTES} from '@/contracts/transport-budget';

export const DISPATCH_SSE_ENCODING='geometry-pool-v1';
export const DISPATCH_SSE_ENCODING_HEADER='X-Cdc-Sse-Encoding';
interface GeometryLocation {path:string[];index:number;}
const isGeometry=(value:any):boolean=>value?.type==='FeatureCollection'&&Array.isArray(value.features);

/** Each frame is self-contained. Only negotiated clients receive the transport envelope. */
export function encodeDispatchSseFrame(event:string,data:any,compactGeometry=false):Uint8Array{
 let payload=data;
 if(compactGeometry){
  const geometries:any[]=[],locations:GeometryLocation[]=[],indices=new WeakMap<object,number>();
  const visit=(value:any,path:string[]):any=>{
   if(path.at(-1)==='geometry'&&isGeometry(value)){
    let index=indices.get(value);
    if(index===undefined){index=geometries.length;indices.set(value,index);geometries.push(value);}
    locations.push({path,index});return null;
   }
   if(Array.isArray(value))return value.map((item,index)=>visit(item,[...path,String(index)]));
   if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,visit(item,[...path,key])]));
   return value;
  };
  const compact=visit(data,[]);
  if(geometries.length)payload={cdcSseEncoding:DISPATCH_SSE_ENCODING,data:compact,geometries,locations};
 }
 const bytes=new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
 if(bytes.byteLength>MAX_DISPATCH_SSE_FRAME_BYTES)throw new Error('SSE frame exceeds budget');
 return bytes;
}

/** Restore only explicit own-property paths; user properties are never interpreted as references. */
export function decodeDispatchSseData(payload:any):any{
 if(payload?.cdcSseEncoding!==DISPATCH_SSE_ENCODING)return payload;
 const invalid=()=>{throw new Error('Invalid compact SSE geometry');};
 if(!Array.isArray(payload.geometries)||!Array.isArray(payload.locations)||!payload.geometries.every(isGeometry))invalid();
 for(const location of payload.locations){
  if(!location||!Array.isArray(location.path)||!location.path.length||!location.path.every((key:unknown)=>typeof key==='string')||!Number.isSafeInteger(location.index)||location.index<0||location.index>=payload.geometries.length)invalid();
  let parent=payload.data;
  for(const key of location.path.slice(0,-1)){
   if(!parent||typeof parent!=='object'||!Object.hasOwn(parent,key))invalid();
   parent=parent[key];
  }
  const key=location.path.at(-1);
  if(key!=='geometry'||!parent||typeof parent!=='object'||!Object.hasOwn(parent,key)||parent[key]!==null)invalid();
  parent[key]=payload.geometries[location.index];
 }
 return payload.data;
}
