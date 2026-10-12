import {randomUUID} from 'node:crypto';
import taskDomains from '../../../config/analytics-tasks.json';
import type {AgentDomain} from '@/contracts/dataset';
import type {ExecutionContext} from '@/contracts/execution-context';
import {runAnalytics} from '@/infrastructure/analytics/runner';
export interface AnalyticsEngineTask {task:string;args?:Record<string,any>;}
/** Legacy payload adapter; every process uses the bounded strict runner. */
export async function runAnalyticsEngine<T=any>(task:string,args:Record<string,any>={},ctx?:ExecutionContext):Promise<T>{
 const domain=(taskDomains as Record<string,AgentDomain>)[task];if(!domain)throw new Error('Unknown analytics task');
 if(ctx&&ctx.domain!==domain)throw new Error('Analytics domain mismatch');
 const result=await runAnalytics({task,domain,runId:ctx?.runId ?? randomUUID(),args},{signal:ctx?.signal});
 if(result.status==='FAILED'||result.status==='CANCELLED')throw new Error(result.error?.message ?? 'Analytics execution cancelled');
 return {...result.payload as object,status:result.status,qualityFlags:result.qualityFlags} as T;
}
