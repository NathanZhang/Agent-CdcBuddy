import type { AgentInteraction,AgentTurnResult } from '@/contracts/agent-interaction';
import type { ExecutionContext } from '@/contracts/execution-context';
import type { RunEvent } from '@/contracts/run-event';
import { runAgentTurn } from '@/application/agent/main-agent';
export function dispatch(request:AgentInteraction,ctx:ExecutionContext,agent=runAgentTurn):AsyncIterable<RunEvent>{return agent(request,ctx);}
export async function collectDispatch(events:AsyncIterable<RunEvent>|Iterable<RunEvent>):Promise<AgentTurnResult>{
  let result:AgentTurnResult|undefined;let completed=false,runId:string|undefined,seq=0;
  for await(const event of events){if(event.version!=='1'||event.seq!==++seq||(runId && event.runId!==runId)||completed)throw new Error('Invalid run event sequence');runId=event.runId;if(event.type==='result')result=event.data.result;if(event.type==='completed')completed=true;}
  if(!completed || !result)throw new Error('Agent stream ended without a complete result');return result;
}
