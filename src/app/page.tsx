'use client';
import React,{useState,useEffect,useRef} from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { RecommendationPrompts } from '@/components/layout/RecommendationPrompts';
import { SkillsDrawer } from '@/components/layout/SkillsDrawer';
import { SessionHistoryDrawer } from '@/components/layout/SessionHistoryDrawer';
import { EmbeddedWidget } from '@/components/layout/EmbeddedWidget';
import { GenerativeComponentRenderer } from '@/components/ag-ui/GenerativeComponentRenderer';
import { MarkdownRenderer } from '@/components/common/MarkdownRenderer';
import { useRbac } from '@/lib/rbac/rbac-context';
import { getCurrentAgentProfile } from '@/lib/config/agent-profile';
import { useWorkbenchController,WorkbenchInteractionProvider } from '@/features/workbench/use-workbench-controller';
import { adaptFunctionalInteraction } from '@/application/agent/interaction-adapter';
import { sourceLabels } from '@/features/workbench/result-adapter';
import { Bot,User,Send,Square,History,Plus,Sparkles } from 'lucide-react';
export default function CdcAgentWorkspace(){
 const profile=getCurrentAgentProfile();const {currentUser}=useRbac();const workbench=useWorkbenchController({domain:profile.domain});const {state}=workbench;
 const [skillsOpen,setSkillsOpen]=useState(false),[historyOpen,setHistoryOpen]=useState(false),[widgetOpen,setWidgetOpen]=useState(false);
 const [input,setInput]=useState(''),[customSkills,setCustomSkills]=useState<any[]>([]);const end=useRef<HTMLDivElement>(null);
 useEffect(()=>{end.current?.scrollIntoView({behavior:'smooth'});},[state.messages,state.busy]);
 const refreshSkills=async()=>{const result=await workbench.interact(adaptFunctionalInteraction({type:'catalog.list'}));const payload=result?.skillRuns.map(r=>r.result.payload).find((p:any)=>p?.type==='SKILL_CATALOG') as any;if(payload)setCustomSkills(payload.customSkills.map((s:any)=>({...s,id:s.skill_id,sqlQuery:s.sql_query,chartType:s.chart_type,createdBy:s.created_by,createdAt:s.created_at,recommendedPrompts:s.recommended_prompts?.split(';') ?? []})));};
 const send=async(text:string)=>{if(!text.trim())return;setInput('');await workbench.send(text);};
 const [datasetLabels,setDatasetLabels]=useState<string[]>([]);
 useEffect(()=>{setDatasetLabels(sourceLabels((window as any).__CDC_RUNTIME_PROFILE__?.datasets ?? []));},[]);
 return <WorkbenchInteractionProvider controller={workbench}><div className="h-screen flex flex-col bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-100">
  <Navbar onOpenSkills={()=>{setSkillsOpen(true);void refreshSkills();}} onSelectPrompt={send} showEmbeddedWidget={widgetOpen} onToggleEmbeddedWidget={()=>setWidgetOpen(v=>!v)}/>
  <div className="px-6 py-2 flex flex-wrap gap-3 text-xs border-b border-slate-200 dark:border-slate-800">{datasetLabels.map(label=><span key={label}>{label}</span>)}{profile.domain==='vector'&&<button className="text-sky-600" onClick={()=>void workbench.interact(adaptFunctionalInteraction({type:'collection.form'}))}>现场采集</button>}<span className="ml-auto">{state.busy?'执行中':state.status==='IDLE'?'等待指令':state.status}</span></div>
  <main className="flex-1 min-h-0 px-4 py-3 flex flex-col gap-3 max-w-[1920px] w-full mx-auto">
   <RecommendationPrompts onSelectPrompt={send}/>
   <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4">
    <section className="lg:col-span-8 min-h-0 flex flex-col"><h2 className="text-sm font-bold flex items-center gap-2 mb-2"><Sparkles size={16}/>AG-UI 分析工作台</h2><div className="flex-1 min-h-0 overflow-auto"><GenerativeComponentRenderer view={state.view}/>{!state.view&&<div className="h-full flex flex-col items-center justify-center gap-3 text-slate-500 rounded-xl border border-dashed border-slate-300 dark:border-slate-700"><Bot size={32}/><p>{state.status==='NO_DATA'?'当前范围没有可用数据。':'输入监测问题或选择技能开始分析。'}</p>{state.replyText&&!state.messages.length&&<p className="max-w-lg text-sm">{state.replyText}</p>}</div>}</div></section>
    <section className="lg:col-span-4 min-h-0 flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
     <header className="p-3 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800"><Bot size={18}/><h2 className="flex-1 truncate text-sm font-semibold">{state.title}</h2><button aria-label="历史会话" onClick={()=>setHistoryOpen(true)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"><History size={16}/></button><button aria-label="新建会话" onClick={()=>void workbench.startSession()} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"><Plus size={16}/></button></header>
     <div className="flex-1 min-h-0 overflow-auto p-3 space-y-4">{state.messages.map(message=><div key={message.id} className={`flex gap-2 ${message.sender==='user'?'flex-row-reverse':''}`}><span className="shrink-0 p-1.5">{message.sender==='user'?<User size={16}/>:<Bot size={16}/>}</span><div className={`rounded-xl p-3 text-sm max-w-[90%] ${message.sender==='user'?'bg-sky-50 dark:bg-sky-950':'bg-slate-50 dark:bg-slate-800'}`} data-run-id={message.runId}><MarkdownRenderer content={message.text}/>{message.skillUsed&&<p className="mt-2 text-xs text-slate-500">{message.skillUsed}</p>}</div></div>)}{state.busy&&<div role="status" className="text-xs text-sky-600 animate-pulse">{state.progress||'主线 Agent 正在处理…'}</div>}<div ref={end}/></div>
     <form className="p-3 border-t border-slate-200 dark:border-slate-800 flex gap-2" onSubmit={event=>{event.preventDefault();void send(input);}}><input aria-label="对话指令" value={input} onChange={event=>setInput(event.target.value)} className="flex-1 min-w-0 bg-slate-100 dark:bg-slate-800 rounded-lg px-3 py-2 text-sm" placeholder="输入疾控监测问题…"/>{state.busy?<button type="button" aria-label="停止执行" onClick={workbench.cancel}><Square size={18}/></button>:<button type="submit" aria-label="发送" disabled={!input.trim()} className="p-2 text-sky-600 disabled:opacity-30"><Send size={18}/></button>}</form>
    </section>
   </div>
  </main>
  <SkillsDrawer isOpen={skillsOpen} onClose={()=>setSkillsOpen(false)} customSkills={customSkills} onRefreshCustomSkills={()=>void refreshSkills()} onDeleteCustomSkill={async id=>{const result=await workbench.interact(adaptFunctionalInteraction({type:'skill.delete',id}));if(result?.status==='SUCCESS')await refreshSkills();}} onRunSkill={(skill,prompt)=>{setSkillsOpen(false);void workbench.interact(adaptFunctionalInteraction({type:'skill.execute',id:skill.id,prompt}));}} onCreateCustomSkill={()=>{setSkillsOpen(false);void send('创建一个自定义监测查询技能，请先向我确认分析需求。');}}/>
  <SessionHistoryDrawer isOpen={historyOpen} onClose={()=>setHistoryOpen(false)} userId={currentUser.id} userName={currentUser.name} domain={profile.domain} currentSessionId={state.sessionId} onSelectSession={id=>{setHistoryOpen(false);void workbench.loadSession(id);}} onNewSession={()=>{setHistoryOpen(false);void workbench.startSession();}}/>
  <EmbeddedWidget isVisible={widgetOpen} onClose={()=>setWidgetOpen(false)} syncWorkspace domain={profile.domain}/>
 </div></WorkbenchInteractionProvider>;
}
