import { NextRequest } from 'next/server';
import { operationResponse } from '@/application/agent/operation-http';
export async function POST(req:NextRequest){let record;try{record=await req.json();}catch{return Response.json({success:false,error:'Invalid JSON'},{status:400});}return operationResponse(req,{type:'collection.validate',args:{record}},'COLLECTION_RESULT',p=>p.evaluation);}
