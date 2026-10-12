import {NextRequest} from 'next/server';import {operationResponse} from '@/application/agent/operation-http';
export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}){const body=await req.json();return operationResponse(req,{type:'approval.decide',id:(await params).id,args:{decision:body.decision},prompt:'提交所选任务专业审批决定。'},'ANALYTICS_RESULT');}
