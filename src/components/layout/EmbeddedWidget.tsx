'use client';
import React,{useState,useEffect,useRef} from 'react';
import { Bot,X,Send,Square,Maximize2,Minimize2,RotateCcw } from 'lucide-react';
import { MarkdownRenderer } from '@/components/common/MarkdownRenderer';
import { GenerativeComponentRenderer } from '@/components/ag-ui/GenerativeComponentRenderer';
import { getCurrentAgentDomain,getAgentProfile,type AgentDomainType } from '@/lib/config/agent-profile';
import { useWorkbenchController,WorkbenchInteractionProvider } from '@/features/workbench/use-workbench-controller';
import { agentClient } from '@/features/workbench/session-client';
interface EmbeddedWidgetProps {initialPrompt?:string;onSendMessage?:(msg:string)=>void;isVisible?:boolean;onClose?:()=>void;syncWorkspace?:boolean;domain?:AgentDomainType;}
export const EmbeddedWidget:React.FC<EmbeddedWidgetProps>=({initialPrompt,onSendMessage,isVisible=false,onClose,syncWorkspace=false,domain})=>{
 const activeDomain=domain ?? getCurrentAgentDomain();const profile=getAgentProfile(activeDomain);const workbench=useWorkbenchController({domain:activeDomain,client:syncWorkspace?undefined:agentClient});const {state}=workbench;
 const [open,setOpen]=useState(false),[expanded,setExpanded]=useState(false),[input,setInput]=useState(initialPrompt ?? '');const end=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(isVisible)setOpen(true);},[isVisible]);useEffect(()=>{end.current?.scrollIntoView({behavior:'smooth'});},[state.messages,state.busy]);
 const send=async()=>{if(!input.trim())return;const text=input;setInput('');onSendMessage?.(text);await workbench.send(text);};
 if(!isVisible)return null;
 return <WorkbenchInteractionProvider controller={workbench}><div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2">{open&&<section className={`flex flex-col bg-white dark:bg-slate-950 border border-slate-200 dark:border-sky-800 rounded-2xl shadow-2xl overflow-hidden resize ${expanded?'w-[min(760px,calc(100vw-32px))] h-[min(820px,calc(100vh-90px))]':'w-[min(520px,calc(100vw-32px))] h-[min(620px,calc(100vh-90px))]'}`}>
  <header className="p-3 border-b border-slate-200 dark:border-slate-800 flex gap-2 items-center"><Bot size={18}/><h3 className="flex-1 text-sm font-semibold">{profile.floatingWidget.assistantTitle}</h3><button aria-label="新建浮窗会话" onClick={()=>void workbench.startSession()}><RotateCcw size={15}/></button><button aria-label="切换浮窗大小" onClick={()=>setExpanded(v=>!v)}>{expanded?<Minimize2 size={15}/>:<Maximize2 size={15}/>}</button><button aria-label="关闭浮窗" onClick={()=>{setOpen(false);onClose?.();}}><X size={18}/></button></header>
  <div className="flex-1 min-h-0 overflow-auto p-3 space-y-4">{state.messages.map(message=><div key={message.id} className={`p-3 text-sm rounded-xl ${message.sender==='user'?'ml-8 bg-sky-50 dark:bg-sky-950':'mr-2 bg-slate-50 dark:bg-slate-900'}`} data-run-id={message.runId}><MarkdownRenderer content={message.text}/>{message.generativeView&&<GenerativeComponentRenderer view={message.generativeView} isCompact/>}</div>)}{!state.messages.length&&<p className="text-sm text-slate-500">输入监测问题开始对话。</p>}{state.busy&&<p role="status" className="text-xs text-sky-600">{state.progress||'主线 Agent 正在处理…'}</p>}<div ref={end}/></div>
  <form className="p-3 border-t border-slate-200 dark:border-slate-800 flex gap-2" onSubmit={event=>{event.preventDefault();void send();}}><input aria-label="浮窗对话指令" value={input} onChange={event=>setInput(event.target.value)} className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm" placeholder="输入疾控监测问题…"/>{state.busy?<button type="button" aria-label="停止浮窗执行" onClick={workbench.cancel}><Square size={17}/></button>:<button type="submit" aria-label="浮窗发送" disabled={!input.trim()}><Send size={17}/></button>}</form>
 </section>}<button onClick={()=>setOpen(v=>!v)} className="bg-sky-600 text-white p-3 rounded-full shadow-lg" aria-label="打开浮窗助手"><Bot size={22}/></button></div></WorkbenchInteractionProvider>;
};
