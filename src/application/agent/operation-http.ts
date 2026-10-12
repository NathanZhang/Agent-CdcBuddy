import { NextRequest,NextResponse } from 'next/server';
import { adaptFunctionalInteraction,type FunctionalAction } from './interaction-adapter';
import { dispatch,collectDispatch } from '@/application/dispatch/dispatch-service';
import { createDevelopmentContext } from '@/lib/skills/server-executor';
import { toLegacyResult } from '@/application/dispatch/legacy-adapter';
export async function operationResponse(req:NextRequest,action:FunctionalAction,type:string,adapt:(payload:any)=>any=(p=>p)){
 try{
  const ctx=createDevelopmentContext();ctx.signal=req.signal;
  const turn=await collectDispatch(dispatch(adaptFunctionalInteraction(action),ctx));
  const payload=turn.skillRuns.map(s=>s.result.payload).find((p:any)=>p?.type===type);
  const success=Boolean(payload)&&!['FAILED','CANCELLED'].includes(turn.status);
  return NextResponse.json({...toLegacyResult(turn),success,code:success?0:turn.status==='NO_DATA'?404:503,message:turn.replyText,data:success?adapt(payload):null},{status:turn.error?.code==='INVALID_INPUT'?400:200});
 }catch(error){return NextResponse.json({success:false,code:503,status:'FAILED',data:null,error:error instanceof Error?error.message:'操作失败'},{status:503});}
}
