import { NextRequest } from 'next/server';
import { dispatch } from '@/application/dispatch/dispatch-service';
import { normalizeInteraction,toLegacyEvents } from '@/application/dispatch/legacy-adapter';
import { toAguiEvents } from '@/application/dispatch/agui-adapter';
import {resolveContext,authStatus} from '@/infrastructure/auth/session';
import {encodeDispatchSseFrame,DISPATCH_SSE_ENCODING,DISPATCH_SSE_ENCODING_HEADER} from '@/application/dispatch/dispatch-wire';
import {heartbeatSseResponse} from '@/application/dispatch/heartbeat-stream';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(req:NextRequest){
  let interaction,ctx;try{interaction=normalizeInteraction(await req.json());ctx=resolveContext(req);}catch(error){return Response.json({success:false,error:error instanceof Error?error.message:'Invalid request'},{status:authStatus(error,400)});}
  const compactGeometry=req.headers.get(DISPATCH_SSE_ENCODING_HEADER)===DISPATCH_SSE_ENCODING;
  return heartbeatSseResponse(async(send,signal)=>{
    ctx.signal=signal;
    for await(const event of dispatch(interaction,ctx)){
      if(signal.aborted)continue; // Drain so the Agent can persist its cancelled turn.
      for(const agui of toAguiEvents(event))send(encodeDispatchSseFrame('ag_ui',agui,compactGeometry));
      send(encodeDispatchSseFrame('run_event',event,compactGeometry));
      for(const legacy of toLegacyEvents(event))send(encodeDispatchSseFrame(legacy.event,legacy.data,compactGeometry));
    }
  },req.signal,{drainOnAbort:true});
}
