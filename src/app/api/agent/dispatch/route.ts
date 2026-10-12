import { NextRequest,NextResponse } from 'next/server';
import { dispatch,collectDispatch } from '@/application/dispatch/dispatch-service';
import { normalizeInteraction,toLegacyResult } from '@/application/dispatch/legacy-adapter';
import { createDevelopmentContext } from '@/lib/skills/server-executor';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(req:NextRequest){
  let interaction;try{interaction=normalizeInteraction(await req.json());}catch(error){return NextResponse.json({success:false,error:error instanceof Error?error.message:'Invalid request'},{status:400});}
  try{const ctx=createDevelopmentContext();ctx.signal=req.signal;const result=await collectDispatch(dispatch(interaction,ctx));return NextResponse.json(toLegacyResult(result));}
  catch(error){return NextResponse.json({success:false,status:'FAILED',generativeView:null,error:error instanceof Error?error.message:'Dispatch failed'},{status:503});}
}
