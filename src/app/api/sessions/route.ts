import { NextRequest } from 'next/server';
import { operationResponse } from '@/application/agent/operation-http';
export async function GET(req:NextRequest){const search=new URL(req.url).searchParams;return operationResponse(req,{type:'session.list',args:{keyword:search.get('keyword') ?? '',limit:Math.min(100,Math.max(1,Number(search.get('limit'))||50)),offset:Math.max(0,Number(search.get('offset'))||0)}},'SESSION_RESULT',p=>({sessions:p.sessions,total:p.total}));}
export async function POST(req:NextRequest){let body;try{body=await req.json();}catch{return Response.json({success:false,error:'Invalid JSON'},{status:400});}return operationResponse(req,{type:'session.create',args:{title:body.title}},'SESSION_RESULT',p=>p.session);}
export async function DELETE(req:NextRequest){return operationResponse(req,{type:'session.clear'},'SESSION_RESULT');}
