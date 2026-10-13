import {expect,it,vi} from 'vitest';
const result=vi.hoisted(()=>({runId:'r',interactionId:'i',status:'SUCCESS',replyText:'地图',agui:[],skillRuns:[],mapComposition:{type:'MAP_COMPOSITION',mapId:'m',layers:[{id:'points'}]},outcomes:[{requestedOutput:'base-map',status:'SUCCESS'}],intentSummary:{task:'map_with_data'}}));
vi.mock('@/lib/skills/dispatcher',()=>({dispatchSkillPromptStream:async()=>result}));
import {agentClient} from '@/features/workbench/session-client';
it('retains the server composition, outcomes and source intent through the Web and Widget client',async()=>{const turn=await agentClient.interact({interactionId:'i',kind:'conversation',userInput:'地图'});expect(turn.mapComposition).toEqual(result.mapComposition);expect(turn.outcomes).toEqual(result.outcomes);expect(turn.intentSummary).toEqual(result.intentSummary);});
