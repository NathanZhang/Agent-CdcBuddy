import { NextRequest,NextResponse } from 'next/server';
import { dispatch,collectDispatch } from '@/application/dispatch/dispatch-service';
import { normalizeInteraction,toLegacyResult } from '@/application/dispatch/legacy-adapter';
import {resolveContext,authStatus} from '@/infrastructure/auth/session';
import {POST as streamPost} from '@/app/api/agent/stream-dispatch/route';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(req:NextRequest){
  if(req.headers.get('accept')?.includes('text/event-stream'))return streamPost(req);
  let interaction;try{interaction=normalizeInteraction(await req.json());}catch(error){return NextResponse.json({success:false,error:error instanceof Error?error.message:'Invalid request'},{status:400});}
  try{const ctx=resolveContext(req);ctx.signal=req.signal;const result=await collectDispatch(dispatch(interaction,ctx));return NextResponse.json(toLegacyResult(result),{status:result.error?.code?.startsWith('FORBIDDEN')?403:200});}
  catch(error){return NextResponse.json({success:false,status:'FAILED',generativeView:null,error:error instanceof Error?error.message:'Dispatch failed'},{status:authStatus(error)});}
}
