import { NextRequest } from 'next/server';
import { dispatch } from '@/application/dispatch/dispatch-service';
import { normalizeInteraction,toLegacyEvents } from '@/application/dispatch/legacy-adapter';
import { toAguiEvents } from '@/application/dispatch/agui-adapter';
import {resolveContext,authStatus} from '@/infrastructure/auth/session';
import {encodeDispatchSseFrame,DISPATCH_SSE_ENCODING,DISPATCH_SSE_ENCODING_HEADER} from '@/application/dispatch/dispatch-wire';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(req:NextRequest){
  let interaction,ctx;try{interaction=normalizeInteraction(await req.json());ctx=resolveContext(req);}catch(error){return Response.json({success:false,error:error instanceof Error?error.message:'Invalid request'},{status:authStatus(error,400)});}
  const cancellation=new AbortController();const onAbort=()=>cancellation.abort(req.signal.reason);req.signal.addEventListener('abort',onAbort,{once:true});if(req.signal.aborted)onAbort();ctx.signal=cancellation.signal;
  const compactGeometry=req.headers.get(DISPATCH_SSE_ENCODING_HEADER)===DISPATCH_SSE_ENCODING;let readerCancelled=false,errored=false;
  const stream=new ReadableStream<Uint8Array>({async start(controller){try{for await(const event of dispatch(interaction,ctx)){if(cancellation.signal.aborted)continue;for(const agui of toAguiEvents(event))controller.enqueue(encodeDispatchSseFrame('ag_ui',agui,compactGeometry));controller.enqueue(encodeDispatchSseFrame('run_event',event,compactGeometry));for(const legacy of toLegacyEvents(event))controller.enqueue(encodeDispatchSseFrame(legacy.event,legacy.data,compactGeometry));}}catch(error){if(!cancellation.signal.aborted){errored=true;controller.error(error);}}finally{req.signal.removeEventListener('abort',onAbort);if(!readerCancelled && !errored)controller.close();}},cancel(){readerCancelled=true;cancellation.abort();req.signal.removeEventListener('abort',onAbort);}});
  return new Response(stream,{headers:{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','X-Accel-Buffering':'no'}});
}
