import { it,expect } from 'vitest';
import { EventSchemas,EventType } from '@ag-ui/core';
import { toAguiEvents } from '@/application/dispatch/agui-adapter';
it('publishes actual run, skill evidence, reply and component state using validated AG-UI events',()=>{
 const result={schemaVersion:'1',runId:'run-1',domain:'vector',status:'SUCCESS',method:'query',datasets:[],payload:{type:'DATA_TABLE_VIEW',data:[{n:17}]},metrics:{},qualityFlags:[]};
 const turn={runId:'run-1',interactionId:'turn-1',status:'SUCCESS',replyText:'实测17条。',agui:[{version:'1',runId:'run-1',component:'DATA_TABLE_VIEW',result}],skillRuns:[]};
 const events=[{version:'1' as const,runId:'run-1',seq:1,type:'started' as const,data:{interactionId:'turn-1'}},{version:'1' as const,runId:'run-1',seq:2,type:'tool_started' as const,data:{callId:'call-1',skillId:'query',args:{sql:'SELECT COUNT(*)'}}},{version:'1' as const,runId:'run-1',seq:3,type:'tool_completed' as const,data:{callId:'call-1',result}},{version:'1' as const,runId:'run-1',seq:4,type:'result' as const,data:{result:turn}}].flatMap(toAguiEvents);
 for(const event of events)expect(()=>EventSchemas.parse(event)).not.toThrow();
 expect(events.find(e=>e.type===EventType.TOOL_CALL_RESULT)).toMatchObject({content:JSON.stringify(result)});
 expect(events.find(e=>e.type===EventType.STATE_SNAPSHOT)).toMatchObject({snapshot:turn});
 expect(events.at(-1)?.type).toBe(EventType.RUN_FINISHED);
 const failed=toAguiEvents({version:'1',runId:'x',seq:1,type:'result',data:{result:{...turn,status:'FAILED',error:{code:'FAIL',message:'失败'}}}});
 expect(failed.at(-1)?.type).toBe(EventType.RUN_ERROR);expect(failed.some(e=>e.type===EventType.RUN_FINISHED)).toBe(false);
});
