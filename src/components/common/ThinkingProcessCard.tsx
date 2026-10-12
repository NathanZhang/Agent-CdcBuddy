'use client';

import React,{useState,useEffect,useRef} from 'react';
import {ChevronDown,ChevronRight,BrainCircuit,Copy,Check} from 'lucide-react';

interface ThinkingProcessCardProps {
 reasoningText:string;
 isStreaming?:boolean;
 durationMs?:number;
 defaultExpanded?:boolean;
 interrupted?:boolean;
 className?:string;
}

export const ThinkingProcessCard:React.FC<ThinkingProcessCardProps>=({reasoningText,isStreaming=false,durationMs,defaultExpanded=false,interrupted=false,className=''})=>{
 const [isExpanded,setIsExpanded]=useState(isStreaming||defaultExpanded);
 const [hasCopied,setHasCopied]=useState(false);
 const scrollContainerRef=useRef<HTMLDivElement>(null);
 const userInteractedRef=useRef(false);
 const copyTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 useEffect(()=>()=>clearTimeout(copyTimer.current),[]);
 useEffect(()=>{if(isStreaming&&!userInteractedRef.current)setIsExpanded(true);},[isStreaming]);
 // Follow every update, including the final chunk and reopening a collapsed card.
 useEffect(()=>{
  const container=scrollContainerRef.current;
  if(isExpanded&&container)container.scrollTop=container.scrollHeight;
 },[reasoningText,isExpanded]);
 if(!reasoningText&&!isStreaming)return null;
 const copy=async()=>{
  try{await navigator.clipboard.writeText(reasoningText);setHasCopied(true);clearTimeout(copyTimer.current);copyTimer.current=setTimeout(()=>setHasCopied(false),2000);}catch{setHasCopied(false);}
 };
 return <div className={`mb-3 min-w-0 overflow-hidden rounded-xl border ${isStreaming?'border-sky-200 bg-sky-50/70 dark:border-sky-800 dark:bg-sky-950/20':'border-slate-200 bg-white/70 dark:border-slate-700 dark:bg-slate-900/50'} ${className}`}>
  <div className="flex items-center gap-1 px-2 py-1">
   <button type="button" aria-expanded={isExpanded} onClick={()=>{userInteractedRef.current=true;setIsExpanded(value=>!value);}} className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-2 text-left text-xs text-slate-600 dark:text-slate-300">
    <BrainCircuit size={15} className={`shrink-0 text-sky-600 ${isStreaming?'animate-pulse':''}`}/>
    <span className="font-semibold">推理过程</span>
    <span className="text-[10px] text-slate-500">{interrupted?'已中断':isStreaming?'生成中':durationMs!==undefined?`${(durationMs/1000).toFixed(1)} 秒`:''}</span>
    <span className="ml-auto flex shrink-0 items-center gap-1">{isExpanded?'收起':'展开'}{isExpanded?<ChevronDown size={13}/>:<ChevronRight size={13}/>}</span>
   </button>
   {reasoningText&&<button type="button" onClick={()=>void copy()} aria-label="复制推理内容" className="rounded p-1.5 text-slate-400 hover:text-sky-600">{hasCopied?<Check size={13}/>:<Copy size={13}/>}</button>}
  </div>
  {isExpanded&&<div ref={scrollContainerRef} role="region" aria-label="模型推理内容" tabIndex={0} className="max-h-64 overflow-y-auto overscroll-contain border-t border-slate-200/70 px-3 py-3 text-xs leading-6 text-slate-600 dark:border-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
   {reasoningText||<span className="text-slate-400">等待模型返回推理内容…</span>}
   {isStreaming&&<span aria-hidden="true" className="ml-1 inline-block h-3 w-1 animate-pulse rounded bg-sky-500 align-middle"/>}
  </div>}
 </div>;
};
