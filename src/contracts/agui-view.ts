import type { AgentTurnResult } from './agent-interaction';
/** A projection of all executed outputs; never selects a fabricated default card. */
export function projectAguiView(turn:AgentTurnResult):any{
 if(turn.status==='CANCELLED')return null;
 const views=turn.agui.filter(a=>a.result.payload&&!['FAILED','CANCELLED','NO_DATA'].includes(a.result.status)).map(a=>({...a.result.payload as object,runId:turn.runId,callId:turn.skillRuns.find(s=>s.result===a.result)?.callId??turn.skillRuns.find(s=>s.result.method===a.result.method&&JSON.stringify(s.result.payload)===JSON.stringify(a.result.payload))?.callId,status:a.result.status,datasets:a.result.datasets,qualityFlags:a.result.qualityFlags,method:a.result.method}));
 if(turn.mapComposition){const remaining=views.filter(v=>(v as any).type!=='MAP_VIEW');const map={...turn.mapComposition,runId:turn.runId,status:turn.status,datasets:[]};return remaining.length?{type:'AGUI_RESULT_GROUP',runId:turn.runId,status:turn.status,datasets:[],views:[map,...remaining.map(v=>({...v,suppressSpatialMap:true}))]}:map;}
 if(!views.length)return null;if(views.length===1)return views[0];
 const datasets=Array.from(new Map(views.flatMap(v=>v.datasets).map(d=>[d.id,d])).values());
 return {type:'AGUI_RESULT_GROUP',runId:turn.runId,status:turn.status,datasets,views};
}
