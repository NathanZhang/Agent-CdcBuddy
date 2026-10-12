import { NextRequest } from 'next/server';
import { dispatch } from '@/application/dispatch/dispatch-service';
import { normalizeInteraction,toLegacyEvents } from '@/application/dispatch/legacy-adapter';
import { toAguiEvents } from '@/application/dispatch/agui-adapter';
import {resolveContext,authStatus} from '@/infrastructure/auth/session';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(req:NextRequest){
  let interaction,ctx;try{interaction=normalizeInteraction(await req.json());ctx=resolveContext(req);}catch(error){return Response.json({success:false,error:error instanceof Error?error.message:'Invalid request'},{status:authStatus(error,400)});}
  const cancellation=new AbortController();const onAbort=()=>cancellation.abort(req.signal.reason);req.signal.addEventListener('abort',onAbort,{once:true});if(req.signal.aborted)onAbort();ctx.signal=cancellation.signal;
  const encoder=new TextEncoder();let readerCancelled=false,errored=false;
  const stream=new ReadableStream<Uint8Array>({async start(controller){try{for await(const event of dispatch(interaction,ctx)){if(cancellation.signal.aborted)break;for(const agui of toAguiEvents(event))controller.enqueue(encoder.encode(`event: ag_ui\ndata: ${JSON.stringify(agui)}\n\n`));controller.enqueue(encoder.encode(`event: run_event\ndata: ${JSON.stringify(event)}\n\n`));for(const legacy of toLegacyEvents(event))controller.enqueue(encoder.encode(`event: ${legacy.event}\ndata: ${JSON.stringify(legacy.data)}\n\n`));}}catch(error){if(!cancellation.signal.aborted){errored=true;controller.error(error);}}finally{req.signal.removeEventListener('abort',onAbort);if(!readerCancelled && !errored)controller.close();}},cancel(){readerCancelled=true;cancellation.abort();req.signal.removeEventListener('abort',onAbort);}});
  return new Response(stream,{headers:{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','X-Accel-Buffering':'no'}});
}
