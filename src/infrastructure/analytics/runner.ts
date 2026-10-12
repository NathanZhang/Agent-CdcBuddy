import {spawn,type ChildProcess} from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import taskDomains from '../../../config/analytics-tasks.json';
import type {AgentDomain,DatasetRef} from '@/contracts/dataset';
import {validateSkillResult,type SkillResult} from '@/contracts/skill-result';
import {resolveDatasetLocation} from '@/infrastructure/db/dataset-manifest';
export interface AnalyticsRequest {task:string;domain:AgentDomain;datasetId?:string;runId:string;args?:Record<string,any>;}
interface RunnerOptions {concurrency?:number;timeoutMs?:number;maxStdoutBytes?:number;maxStderrBytes?:number;scriptPath?:string;pythonBin?:string;}
interface Job {request:AnalyticsRequest;dataset:DatasetRef;dbPath:string;argsJson:string;signal?:AbortSignal;resolve:(result:SkillResult)=>void;queuedAbort?:()=>void;}
function budget(value:number|undefined,fallback:number,max:number){const n=value ?? fallback;if(!Number.isSafeInteger(n)||n<=0||n>max)throw new Error('Invalid analytics budget');return n;}
export function createAnalyticsRunner(options:RunnerOptions={}){
 const concurrency=budget(options.concurrency,2,32),timeoutMs=budget(options.timeoutMs,120000,3600000),maxStdout=budget(options.maxStdoutBytes,8*1024*1024,64*1024*1024),maxStderr=budget(options.maxStderrBytes,1024*1024,8*1024*1024);
 const queue:Job[]=[];let active=0,peak=0,started=0;
 const failure=(request:AnalyticsRequest,code:string,message:string,datasets:DatasetRef[]=[],cancelled=false):SkillResult=>validateSkillResult({schemaVersion:'1',runId:request.runId,domain:request.domain,status:cancelled?'CANCELLED':'FAILED',method:`analytics:${request.task}`,datasets,payload:null,metrics:{},qualityFlags:[],...(cancelled?{}:{error:{code,message,retryable:false}})});
 const drain=()=>{while(active<concurrency&&queue.length){const job=queue.shift()!;if(job.queuedAbort)job.signal?.removeEventListener('abort',job.queuedAbort);if(job.signal?.aborted){job.resolve(failure(job.request,'CANCELLED','算法执行已取消',[job.dataset],true));continue;}start(job);}};
 const start=(job:Job)=>{
  active++;started++;peak=Math.max(peak,active);let stopped:SkillResult|undefined,done=false,child:ChildProcess|undefined,killTimer:ReturnType<typeof setTimeout>|undefined;let stdoutBytes=0,stderrBytes=0;const chunks:Buffer[]=[];
  const finish=(result:SkillResult)=>{if(done)return;done=true;clearTimeout(timer);if(killTimer)clearTimeout(killTimer);job.signal?.removeEventListener('abort',abort);active--;job.resolve(result);drain();};
  const kill=(signal:NodeJS.Signals)=>{if(!child?.pid)return;try{if(process.platform==='win32')child.kill(signal);else process.kill(-child.pid,signal);}catch{/* process may have already exited */}};
  const stop=(result:SkillResult)=>{if(stopped||done)return;stopped=result;kill('SIGTERM');killTimer=setTimeout(()=>kill('SIGKILL'),100);};
  const abort=()=>stop(failure(job.request,'CANCELLED','算法执行已取消',[job.dataset],true));
  const timer=setTimeout(()=>stop(failure(job.request,'ANALYTICS_TIMEOUT','算法执行超过时间预算',[job.dataset])),timeoutMs);
  job.signal?.addEventListener('abort',abort,{once:true});
  try{
   const script=path.resolve(options.scriptPath ?? process.env.ANALYTICS_ENGINE_SCRIPT ?? path.join(process.cwd(),'analytics_engine/engine.py'));
   const venv=path.resolve(process.cwd(),'.venv/bin/python');const python=options.pythonBin ?? process.env.PYTHON_BIN ?? (fs.existsSync(venv)?venv:'python3');
   child=spawn(python,['-u',script,'--task',job.request.task,'--args',job.argsJson,'--domain',job.request.domain,'--db',job.dbPath,'--dataset-id',job.dataset.id,'--dataset-ref',JSON.stringify(job.dataset),'--run-id',job.request.runId,'--protocol','skill-result-v1'],{cwd:path.dirname(script),detached:process.platform!=='win32',env:{...process.env,PYTHONPATH:[process.cwd(),path.dirname(script),process.env.PYTHONPATH].filter(Boolean).join(path.delimiter),PYTHONIOENCODING:'utf-8',OMP_NUM_THREADS:'1',OPENBLAS_NUM_THREADS:'1',MKL_NUM_THREADS:'1'}});
   child.stdout!.on('data',(chunk:Buffer)=>{stdoutBytes+=chunk.byteLength;if(stdoutBytes>maxStdout){stop(failure(job.request,'ANALYTICS_OUTPUT_LIMIT','算法标准输出超过字节预算',[job.dataset]));return;}chunks.push(chunk);});
   child.stderr!.on('data',(chunk:Buffer)=>{stderrBytes+=chunk.byteLength;if(stderrBytes>maxStderr)stop(failure(job.request,'ANALYTICS_OUTPUT_LIMIT','算法诊断输出超过字节预算',[job.dataset]));});
   child.on('error',()=>finish(stopped ?? failure(job.request,'ANALYTICS_PROCESS_ERROR','无法启动算法进程',[job.dataset])));
   child.on('close',code=>{
    if(stopped){kill('SIGKILL');finish(stopped);return;}if(code!==0){finish(failure(job.request,'ANALYTICS_PROCESS_ERROR',`算法进程异常退出（${code}）`,[job.dataset]));return;}
    try{const result=validateSkillResult(JSON.parse(Buffer.concat(chunks).toString('utf8')));if(result.runId!==job.request.runId||result.domain!==job.request.domain||result.datasets.length!==1||JSON.stringify(result.datasets[0])!==JSON.stringify(job.dataset))throw new Error('Result identity mismatch');finish(result);}catch{finish(failure(job.request,'INVALID_ANALYTICS_RESULT','算法输出不符合严格 JSON/SkillResult 协议',[job.dataset]));}
   });
   if(job.signal?.aborted)abort();
  }catch{finish(failure(job.request,'ANALYTICS_PROCESS_ERROR','无法启动算法进程',[job.dataset]));}
 };
 const runAnalytics=async(request:AnalyticsRequest,execution:{signal?:AbortSignal}={}):Promise<SkillResult>=>{
  let dataset:DatasetRef|undefined;
  try{
   if((taskDomains as Record<string,AgentDomain>)[request.task]!==request.domain)throw new Error('Unknown task or task/domain mismatch');
   const {path:dbPath,...ref}=resolveDatasetLocation(request.domain,request.datasetId);dataset=ref;
   if(!request.runId||typeof request.runId!=='string'||!request.args&&request.args!==undefined)throw new Error('Invalid request');
   const args=request.args ?? {};if(typeof args!=='object'||Array.isArray(args))throw new Error('Arguments must be an object');
   for(const key of ['db','db_path','dbPath','datasetPath','businessDbPath'])if(Object.hasOwn(args,key))throw new Error('Dataset paths are server-owned');
   const argsJson=JSON.stringify(args,(_key,value)=>{if(typeof value==='number'&&!Number.isFinite(value))throw new Error('Nonfinite input');return value;});if(Buffer.byteLength(argsJson)>32768)throw new Error('Input exceeds byte budget');
   if(execution.signal?.aborted)return failure(request,'CANCELLED','算法执行已取消',[dataset],true);
   return await new Promise(resolve=>{const job:Job={request,dataset:ref,dbPath,argsJson,signal:execution.signal,resolve};job.queuedAbort=()=>{const index=queue.indexOf(job);if(index<0)return;queue.splice(index,1);job.signal?.removeEventListener('abort',job.queuedAbort!);resolve(failure(request,'CANCELLED','算法执行已取消',[ref],true));};queue.push(job);job.signal?.addEventListener('abort',job.queuedAbort,{once:true});drain();});
  }catch(error){return failure(request,'INVALID_ANALYTICS_REQUEST',error instanceof Error?error.message:'Invalid analytics request',dataset?[dataset]:[]);}
 };
 return {runAnalytics,getStats:()=>({active,queued:queue.length,peak,started})};
}
let defaultRunner:ReturnType<typeof createAnalyticsRunner>|undefined;
export function runAnalytics(request:AnalyticsRequest,options:{signal?:AbortSignal}={}){
 defaultRunner ??= createAnalyticsRunner({concurrency:process.env.ANALYTICS_CONCURRENCY?Number(process.env.ANALYTICS_CONCURRENCY):undefined,timeoutMs:process.env.ANALYTICS_TIMEOUT_MS?Number(process.env.ANALYTICS_TIMEOUT_MS):undefined,maxStdoutBytes:process.env.ANALYTICS_STDOUT_BYTES?Number(process.env.ANALYTICS_STDOUT_BYTES):undefined,maxStderrBytes:process.env.ANALYTICS_STDERR_BYTES?Number(process.env.ANALYTICS_STDERR_BYTES):undefined});return defaultRunner.runAnalytics(request,options);
}
