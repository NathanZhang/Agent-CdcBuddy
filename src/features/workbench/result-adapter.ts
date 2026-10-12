import {domainLabels} from './result-presentation';
import type { DatasetRef } from '@/contracts/dataset';
export function sourceLabels(datasets:DatasetRef[]=[]):string[]{return datasets.map(d=>`${domainLabels[d.domain]}：${d.origin==='observed'?'实测数据':'模拟数据（Mock）'} · ${d.version}`);}
export {projectAguiView as viewFromTurn} from '@/contracts/agui-view';
export function restoreSession(session:any){
 let view=session.lastGenerativeView ?? session.last_generative_view ?? null;
 if(typeof view==='string'){try{view=JSON.parse(view);}catch{view=null;}}
 if(view && !view.runId)view={...view,datasets:[],qualityFlags:[...(view.qualityFlags ?? []),'legacy-unverified']};
 const messages=(session.messages ?? []).map((m:any,i:number)=>({id:m.id ?? m.message_id ?? `legacy-${i}`,sender:m.sender ?? (m.role==='user'?'user':'agent'),text:m.text ?? m.content ?? '',timestamp:m.timestamp ?? '',skillUsed:m.skillUsed ?? m.skill_used,reasoningText:m.reasoningText ?? m.reasoning_text,reasoningDuration:m.reasoningDuration ?? m.reasoning_duration,runId:m.runId ?? m.generativeViewSnapshot?.runId}));
 return {sessionId:session.sessionId ?? session.session_id,title:session.title ?? '历史会话',messages,view};
}

export function queryExportArgs(view:any):Record<string,any>{
 if(typeof view?.sql!=='string'||!view.sql.trim())throw new Error('No executed query available for export');
 const args:Record<string,any>={format:'csv',sql:view.sql,fileName:view.title ?? '监测导出'};
 for(const key of ['city','district','from','to'])if(view.scope?.[key]!==undefined)args[key]=view.scope[key];
 return args;
}
