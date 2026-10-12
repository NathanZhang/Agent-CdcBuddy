import {NextRequest} from 'next/server';import {operationResponse} from '@/application/agent/operation-http';
export async function GET(req:NextRequest,{params}:{params:Promise<{id:string}>}){return operationResponse(req,{type:'workflow.read',args:{action:'read',jobId:(await params).id},prompt:'调用 skill_job_manage 读取所选任务实际状态。'},'ANALYTICS_RESULT');}
