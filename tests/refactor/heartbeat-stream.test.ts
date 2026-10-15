import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {heartbeatSseResponse} from '@/application/dispatch/heartbeat-stream';
import {createSseDecoder,readSseResult} from '@/application/dispatch/sse';
import {encodeDispatchSseFrame} from '@/application/dispatch/dispatch-wire';
beforeEach(()=>vi.useFakeTimers());
afterEach(()=>vi.useRealTimers());

it('emits transport heartbeats every 15s and delivers only the actual terminal result',async()=>{
 let finish!:()=>void;
 const response=heartbeatSseResponse(async send=>{
  await new Promise<void>(resolve=>{finish=resolve;});send(encodeDispatchSseFrame('finish',{success:true}));
 });
 const reader=response.body!.getReader(),decoder=createSseDecoder();
 expect(decoder.push((await reader.read()).value!)).toEqual([]);
 for(let i=0;i<3;i++){
  await vi.advanceTimersByTimeAsync(15000);expect(decoder.push((await reader.read()).value!)).toEqual([]);
 }
 finish();await vi.advanceTimersByTimeAsync(0);
 expect(decoder.push((await reader.read()).value!)).toEqual([{event:'finish',data:{success:true}}]);
 expect((await reader.read()).done).toBe(true);expect(vi.getTimerCount()).toBe(0);reader.releaseLock();
});

it.each(['reader','caller'] as const)('cancels a stalled producer immediately via %s and releases heartbeat timers',async how=>{
 const caller=new AbortController();let signal!:AbortSignal;
 const response=heartbeatSseResponse(async(_send,s)=>{signal=s;await new Promise(()=>{});},caller.signal);
 const reader=response.body!.getReader();await reader.read();
 if(how==='reader')await reader.cancel();else{caller.abort();expect((await reader.read()).done).toBe(true);}
 expect(signal.aborted).toBe(true);expect(vi.getTimerCount()).toBe(0);reader.releaseLock();
});

it('closes an already aborted request without executing the producer',async()=>{
 const produce=vi.fn(),caller=new AbortController();caller.abort();
 expect(await heartbeatSseResponse(produce,caller.signal).text()).toBe('');
 expect(produce).not.toHaveBeenCalled();expect(vi.getTimerCount()).toBe(0);
});

it('waits for interrupted-turn persistence before EOF when drainOnAbort is requested',async()=>{
 const caller=new AbortController();let saved=false;
 const response=heartbeatSseResponse(async(send,signal)=>{
  await new Promise<void>(resolve=>signal.addEventListener('abort',()=>resolve(),{once:true}));
  await new Promise(resolve=>setTimeout(resolve,20));saved=true;
  send(encodeDispatchSseFrame('finish',{mustNotBeSent:true}));
 },caller.signal,{drainOnAbort:true});
 const reader=response.body!.getReader();await reader.read();
 caller.abort();const done=reader.read();expect(saved).toBe(false);
 await vi.advanceTimersByTimeAsync(20);expect(saved).toBe(true);expect((await done).done).toBe(true);
 expect(vi.getTimerCount()).toBe(0);reader.releaseLock();
});

it('propagates producer failures without leaking a heartbeat interval',async()=>{
 const response=heartbeatSseResponse(async()=>{throw Error('producer failed');});
 await expect(response.text()).rejects.toThrow('producer failed');expect(vi.getTimerCount()).toBe(0);
});

it('reads a terminal result without waiting for EOF and rejects incomplete streams',async()=>{
 const cancel=vi.fn();
 const response=new Response(new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode(': heartbeat\n\n'));controller.enqueue(encodeDispatchSseFrame('finish',{success:false,error:{message:'模型超时'}}));},cancel}));
 expect(await readSseResult(response)).toEqual({success:false,error:{message:'模型超时'}});expect(cancel).toHaveBeenCalledOnce();
 await expect(readSseResult(new Response(': heartbeat\n\n'))).rejects.toThrow('未收到完整结果');
});
