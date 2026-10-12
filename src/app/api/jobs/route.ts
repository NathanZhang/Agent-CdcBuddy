import {NextRequest} from 'next/server';import {operationResponse} from '@/application/agent/operation-http';
export const runtime='nodejs';
export async function POST(req:NextRequest){return operationResponse(req,{type:'workflow.submit',args:{action:'submit',input:await req.json()},prompt:'提交所附实际分析任务，调用 skill_job_manage，不要在本次运行分析。'},'ANALYTICS_RESULT');}
export async function GET(req:NextRequest){return operationResponse(req,{type:'workflow.list',args:{action:'list'},prompt:'调用 skill_job_manage 查看我持久任务的实际状态。'},'ANALYTICS_RESULT');}
