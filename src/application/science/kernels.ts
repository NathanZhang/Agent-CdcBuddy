import {spawn} from 'node:child_process';
import path from 'node:path';
import type {ExecutionContext} from '@/contracts/execution-context';
/** No client paths, SQL or full payloads enter the tool interface. */
export function runScienceKernel(operation:'scan'|'kmeans',data:unknown,params:unknown,ctx:ExecutionContext):Promise<any>{
 ctx.signal?.throwIfAborted();const input=JSON.stringify({operation,data,params});if(Buffer.byteLength(input)>16*1024*1024)throw Error('KERNEL_INPUT_BUDGET');
 return new Promise((resolve,reject)=>{
  const child=spawn(process.env.ANALYTICS_PYTHON_PATH??path.join(process.cwd(),'.venv/bin/python'),['-m','analytics_engine.artifact_kernels'],{cwd:process.cwd(),stdio:['pipe','pipe','pipe'],env:{...process.env,OMP_NUM_THREADS:'1',OPENBLAS_NUM_THREADS:'1',MKL_NUM_THREADS:'1'}});
  let output='',errors='',settled=false;const finish=(error?:Error,result?:unknown)=>{if(settled)return;settled=true;clearTimeout(timer);ctx.signal?.removeEventListener('abort',abort);if(error)reject(error);else resolve(result);};
  const abort=()=>{child.kill('SIGKILL');finish(Error('SCIENCE_CANCELLED'));};
  const timer=setTimeout(()=>{child.kill('SIGKILL');finish(Error('KERNEL_TIMEOUT'));},Math.max(1,Math.min(120000,(ctx.deadlineAt??Date.now()+120000)-Date.now())));
  ctx.signal?.addEventListener('abort',abort,{once:true});
  child.stdout.on('data',chunk=>{output+=chunk.toString();if(Buffer.byteLength(output)>8*1024*1024){child.kill('SIGKILL');finish(Error('KERNEL_OUTPUT_BUDGET'));}});
  child.stderr.on('data',chunk=>{errors=(errors+chunk.toString()).slice(-4000);});child.on('error',e=>finish(e));child.stdin.on('error',e=>finish(e));
  child.on('close',code=>{if(code!==0)finish(Error(errors.match(/(?:ValueError|KeyError): ([A-Z_]+)/)?.[1]??'KERNEL_PROCESS_FAILED'));else try{finish(undefined,JSON.parse(output));}catch{finish(Error('KERNEL_OUTPUT_INVALID'));}});
  child.stdin.end(input);
 });
}
