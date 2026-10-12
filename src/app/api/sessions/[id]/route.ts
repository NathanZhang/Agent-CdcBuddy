import { NextRequest } from 'next/server';
import { operationResponse } from '@/application/agent/operation-http';
type RouteContext={params:Promise<{id:string}>};
export async function GET(req:NextRequest,context:RouteContext){return operationResponse(req,{type:'session.read',id:(await context.params).id},'SESSION_RESULT',p=>p.session);}
export async function PATCH(req:NextRequest,context:RouteContext){let body;try{body=await req.json();}catch{return Response.json({success:false,error:'Invalid JSON'},{status:400});}return operationResponse(req,{type:'session.update',id:(await context.params).id,args:{title:body.title,isPinned:body.isPinned}},'SESSION_RESULT',p=>p.session);}
export async function DELETE(req:NextRequest,context:RouteContext){return operationResponse(req,{type:'session.delete',id:(await context.params).id},'SESSION_RESULT');}
/** Session messages are journalled internally from immutable Agent runs. */
export async function POST(){return Response.json({success:false,error:'Use the main Agent interaction endpoint'},{status:405});}
