import {afterEach,expect,it} from 'vitest';
import {createServer,type Server,type ServerResponse} from 'node:http';
import {createLLMClient} from '@/infrastructure/llm/client';

let server:Server|undefined;
afterEach(async()=>{
 if(server){server.closeAllConnections();await new Promise<void>(resolve=>server!.close(()=>resolve()));server=undefined;}
});
const frame=(content:string,finish_reason:string|null=null)=>`data: ${JSON.stringify({choices:[{delta:{content},finish_reason}]})}\n\n`;
async function gateway(handle:(response:ServerResponse,attempt:number,body:any)=>void){
 let attempts=0;
 server=createServer(async(request,response)=>{
  const chunks:Buffer[]=[];for await(const chunk of request)chunks.push(chunk);
  handle(response,++attempts,JSON.parse(Buffer.concat(chunks).toString()));
 });
 await new Promise<void>((resolve,reject)=>{server!.once('error',reject);server!.listen(0,'127.0.0.1',resolve);});
 const address=server.address() as {port:number};
 return {env:{SILICONFLOW_API_KEY:'local-test',SILICONFLOW_BASE_URL:`http://127.0.0.1:${address.port}/v1`,SILICONFLOW_FIRST_OUTPUT_TIMEOUT_MS:'500',SILICONFLOW_IDLE_TIMEOUT_MS:'300'},attempts:()=>attempts};
}

it('real fetch keeps private streamed output alive beyond the first-output budget and cancels after finish without EOF',async()=>{
 const source=await gateway((response,_attempt,body)=>{
  expect(body.stream).toBe(true);response.writeHead(200,{'Content-Type':'text/event-stream'});
  response.write(frame('开始'));
  let count=0;const timer=setInterval(()=>{
   response.write(frame('继续'));
   if(++count===7){clearInterval(timer);response.write(frame('完成','stop'));}
  },100);
  response.on('close',()=>clearInterval(timer));
 });
 const result=await createLLMClient({env:source.env}).complete({messages:[],phase:'write-intent'});
 expect(result.content).toBe('开始'+'继续'.repeat(7)+'完成');expect(source.attempts()).toBe(1);
});

it('real fetch aborts stalled body reading despite transport heartbeats and retries only the LLM request',async()=>{
 let closed=false;
 const source=await gateway((response,attempt)=>{
  response.writeHead(200,{'Content-Type':'text/event-stream'});
  if(attempt===2){response.end(frame('重试完成','stop'));return;}
  response.write(frame('部分输出'));
  const timer=setInterval(()=>response.write(': heartbeat\n\n'),50);
  response.on('close',()=>{closed=true;clearInterval(timer);});
 });
 const result=await createLLMClient({env:source.env}).complete({messages:[]});
 expect(result.content).toBe('重试完成');expect(source.attempts()).toBe(2);
 await new Promise(resolve=>setTimeout(resolve,20));expect(closed).toBe(true);
});

it('real fetch honors caller cancellation without retrying the active request',async()=>{
 let upstreamConnected!:()=>void;
 const connected=new Promise<void>(resolve=>{upstreamConnected=resolve;});
 const source=await gateway(response=>{
  response.writeHead(200,{'Content-Type':'text/event-stream'});response.write(frame('正在处理'));upstreamConnected();
 });
 const caller=new AbortController();
 const pending=createLLMClient({env:source.env}).complete({messages:[],signal:caller.signal}).catch(error=>error);
 await connected;caller.abort(new Error('用户取消'));
 expect(await pending).toMatchObject({message:'用户取消'});expect(source.attempts()).toBe(1);
});
