'use client';
import React,{useState,useEffect,useMemo,useRef,useSyncExternalStore} from 'react';
import {X,Search,Pin,Trash2,Edit3,Plus,History,MessageSquare,Clock3,CalendarDays,Folder,Loader2,ArrowRight} from 'lucide-react';
import {useFunctionalInteraction} from '@/features/workbench/use-workbench-controller';
import {createSessionHistoryList,groupHistorySessions,formatHistoryTime,historyResultLabel,type ChatSessionItem} from '@/features/workbench/session-history';
export type {ChatSessionItem} from '@/features/workbench/session-history';
interface Props {isOpen:boolean;onClose:()=>void;userId:string;userName:string;domain?:string;currentSessionId:string|null;refreshKey?:string;onSelectSession:(id:string)=>void;onNewSession:()=>void;}
interface ContentProps {
 userName:string;sessions:ChatSessionItem[];total:number;keyword:string;loading:boolean;error:string;currentSessionId:string|null;hasMore:boolean;
 managing?:boolean;onKeywordChange:(value:string)=>void;onSearch:()=>void;onRetry:()=>void;onLoadMore:()=>void;onClose:()=>void;onNewSession:()=>void;onSelectSession:(id:string)=>void;
 onManage:(action:'rename'|'update'|'delete',session:ChatSessionItem)=>void;onClear:()=>void;
}
const focusRing='focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950';
const primaryButton=`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-sky-600 px-3.5 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:opacity-50 ${focusRing}`;
export function SessionHistoryContent(props:ContentProps){
 const {userName,sessions,total,keyword,loading,error,currentSessionId,hasMore,managing=false}=props;
 const groups=groupHistorySessions(sessions);
 return <aside role="dialog" aria-modal="true" aria-labelledby="history-heading" aria-describedby="history-owner" className="flex h-[100dvh] w-full max-w-[520px] flex-col border-l border-slate-200 bg-slate-50 text-slate-800 shadow-2xl dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
  <header className="flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 py-5 sm:px-5 dark:border-slate-800 dark:bg-slate-950">
   <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-600 min-[380px]:flex dark:bg-sky-950 dark:text-sky-400"><History size={23}/></span>
   <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h2 id="history-heading" className="truncate text-base font-bold sm:text-lg">历史研判会话</h2><span aria-label={`${total} 个会话`} className="rounded-full bg-slate-100 px-2.5 py-1 font-mono text-xs font-semibold tabular-nums text-slate-500 dark:bg-slate-800 dark:text-slate-400">{total}</span></div><p id="history-owner" className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400" title={userName}>所属人员：<span className="text-slate-600 dark:text-slate-300">{userName}</span></p></div>
   <button aria-label="关闭会话抽屉" onClick={props.onClose} className={`rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 ${focusRing}`}><X size={23}/></button>
  </header>
  <form role="search" className="shrink-0 border-b border-slate-200 bg-white/50 p-4 dark:border-slate-800 dark:bg-slate-950/40" onSubmit={event=>{event.preventDefault();props.onSearch();}}>
   <div className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-500/15 dark:border-slate-700 dark:bg-slate-900">
    <button aria-label="查询历史会话" className={`rounded p-1 text-slate-400 hover:text-sky-500 ${focusRing}`}><Search size={20}/></button>
    <input aria-label="搜索历史会话" type="search" maxLength={200} value={keyword} onChange={event=>props.onKeywordChange(event.target.value)} className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500" placeholder="搜索历史会话标题或研判内容…"/>
    {keyword&&<button type="button" aria-label="清除搜索" onClick={()=>props.onKeywordChange('')} className={`rounded p-1 text-slate-400 hover:text-slate-600 ${focusRing}`}><X size={15}/></button>}
   </div>
  </form>
  <div aria-busy={loading} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-4">
   {error&&<div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"><p>{error}</p><button onClick={props.onRetry} className={`mt-2 rounded text-xs font-semibold underline underline-offset-4 ${focusRing}`}>重新加载</button></div>}
   {!error&&!loading&&!sessions.length&&<div className="flex min-h-64 flex-col items-center justify-center px-6 text-center"><span className="mb-4 rounded-2xl bg-slate-100 p-4 text-slate-400 dark:bg-slate-800"><History size={28}/></span><h3 className="text-sm font-semibold">{keyword.trim()?'没有匹配的会话':'还没有历史会话'}</h3><p className="mt-2 text-xs leading-6 text-slate-500">{keyword.trim()?'试试其他关键词，或清除搜索查看全部会话。':'完成第一轮对话后，会话会自动保存在这里。'}</p>{keyword.trim()&&<button className={`mt-3 rounded text-sm text-sky-600 dark:text-sky-400 ${focusRing}`} onClick={()=>props.onKeywordChange('')}>查看全部会话</button>}</div>}
   {groups.map(group=><section key={group.label} className="mb-5 last:mb-0" aria-label={group.label}><h3 className="mb-2.5 flex items-center gap-2 px-1 text-xs font-semibold tracking-wide text-slate-500">{group.label==='已置顶'?<Pin size={15}/>:group.label==='近 7 天'?<CalendarDays size={16}/>:<Folder size={16}/>} {group.label}</h3><div className="space-y-2">{group.sessions.map(session=>{
    const selected=session.sessionId===currentSessionId;
    return <article key={session.sessionId} className={`group relative rounded-2xl border transition ${selected?'border-sky-500 bg-sky-50 dark:border-sky-700 dark:bg-sky-950/40':'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/70 dark:hover:border-slate-600'}`}>
     <button onClick={()=>props.onSelectSession(session.sessionId)} aria-current={selected?'true':undefined} title={session.title} className={`block w-full rounded-2xl p-4 text-left ${focusRing}`}>
      <p className={`truncate pr-24 text-sm font-semibold leading-6 sm:pr-0 sm:group-hover:pr-24 sm:group-focus-within:pr-24 ${selected?'text-sky-700 dark:text-sky-300':'text-slate-700 dark:text-slate-200'}`}>{session.title}</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-2 text-xs text-slate-500 dark:text-slate-400"><span className="inline-flex shrink-0 items-center gap-1.5"><MessageSquare size={14}/>{session.messageCount} 条对话</span><span className="max-w-32 truncate rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">{historyResultLabel(session.lastGenerativeViewType)}</span><span className="ml-auto inline-flex shrink-0 items-center gap-1.5 tabular-nums"><Clock3 size={14}/><time dateTime={session.updatedAt}>{formatHistoryTime(session.updatedAt)}</time></span></div>
     </button>
     <div className="absolute right-3 top-3 flex items-center gap-0.5 rounded-lg bg-white/95 p-0.5 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 dark:bg-slate-900/95">
      <button disabled={managing} aria-label={`${session.isPinned?'取消置顶':'置顶'} ${session.title}`} aria-pressed={session.isPinned} onClick={()=>props.onManage('update',session)} className={`rounded-md p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 ${session.isPinned?'text-sky-500':'text-slate-400'} ${focusRing}`}><Pin size={14}/></button>
      <button disabled={managing} aria-label={`重命名 ${session.title}`} onClick={()=>props.onManage('rename',session)} className={`rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-sky-500 dark:hover:bg-slate-800 ${focusRing}`}><Edit3 size={14}/></button>
      <button disabled={managing} aria-label={`删除 ${session.title}`} onClick={()=>props.onManage('delete',session)} className={`rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-950 ${focusRing}`}><Trash2 size={14}/></button>
     </div>
    </article>;
   })}</div></section>)}
   {loading&&<p role="status" className="flex items-center justify-center gap-2 py-5 text-xs text-slate-500"><Loader2 size={16} className="animate-spin"/>正在读取会话…</p>}
   {hasMore&&!loading&&<button onClick={props.onLoadMore} disabled={managing} className={`mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 py-3 text-xs text-slate-500 hover:border-sky-500 hover:text-sky-600 dark:border-slate-700 ${focusRing}`}>加载更多（已显示 {sessions.length} / {total}）<ArrowRight size={14}/></button>}
  </div>
  <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] dark:border-slate-800 dark:bg-slate-950">
   <button disabled={managing||(total===0&&!keyword.trim())} onClick={props.onClear} className={`inline-flex items-center gap-2 rounded-lg p-1 text-xs text-slate-500 transition hover:text-rose-500 disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`}><Trash2 size={16}/><span>清空该用户历史</span></button>
   <button onClick={props.onNewSession} className={primaryButton}><Plus size={18}/>开启新会话</button>
  </footer>
 </aside>;
}
export const SessionHistoryDrawer:React.FC<Props>=({isOpen,onClose,userId,userName,domain,currentSessionId,refreshKey,onSelectSession,onNewSession})=>{
 const interact=useFunctionalInteraction(),interactRef=useRef(interact);interactRef.current=interact;
 const closeRef=useRef(onClose);closeRef.current=onClose;
 const container=useRef<HTMLDivElement>(null),searchTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 const [keyword,setKeyword]=useState(''),[actionError,setActionError]=useState(''),[managing,setManaging]=useState(false);
 const keywordRef=useRef(keyword),openRef=useRef(isOpen),actionRevision=useRef(0);keywordRef.current=keyword;openRef.current=isOpen;
 const list=useMemo(()=>createSessionHistoryList(async(search,offset)=>{
  const result=await interactRef.current({type:'session.list',args:{keyword:search,limit:50,offset}});
  if(result?.status!=='SUCCESS')throw new Error(result?.replyText||'读取会话失败');
  const payload=result.skillRuns.map(run=>run.result.payload).find((p:any)=>p?.type==='SESSION_RESULT'&&p.action==='list') as any;
  if(!payload||!Array.isArray(payload.sessions)||typeof payload.total!=='number')throw new Error('历史会话响应不完整');
  return {sessions:payload.sessions,total:payload.total};
 }),[userId,domain]);
 const activeList=useRef(list);activeList.current=list;
 const state=useSyncExternalStore(list.subscribe,list.getState,list.getState);
 useEffect(()=>{keywordRef.current='';setKeyword('');setActionError('');},[list]);
 useEffect(()=>{actionRevision.current++;setManaging(false);},[list,isOpen]);
 useEffect(()=>{if(isOpen){setActionError('');void list.load(keywordRef.current);}else list.invalidate();return()=>list.invalidate();},[isOpen,list,refreshKey]);
 const search=()=>{clearTimeout(searchTimer.current);setActionError('');void list.load(keyword);};
 const changeKeyword=(value:string)=>{
  keywordRef.current=value;setKeyword(value);setActionError('');clearTimeout(searchTimer.current);
  searchTimer.current=setTimeout(()=>void list.load(value),250);
 };
 useEffect(()=>()=>clearTimeout(searchTimer.current),[list,isOpen]);
 useEffect(()=>{
  if(!isOpen)return;
  const previous=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;document.body.style.overflow='hidden';
  container.current?.querySelector<HTMLInputElement>('input')?.focus();
  const keydown=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){event.preventDefault();closeRef.current();return;}
   if(event.key!=='Tab')return;
   const nodes=container.current?.querySelectorAll<HTMLElement>('aside button:not(:disabled),aside input:not(:disabled)');
   if(!nodes?.length)return;const first=nodes[0],last=nodes[nodes.length-1];
   if(!container.current?.querySelector('aside')?.contains(document.activeElement)){event.preventDefault();(event.shiftKey?last:first).focus();return;}
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  };
  document.addEventListener('keydown',keydown);
  return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',keydown);previous?.focus();};
 },[isOpen]);
 const manage=async(action:'rename'|'update'|'delete',session:ChatSessionItem)=>{
  let args:Record<string,unknown>|undefined;
  if(action==='rename'){const title=window.prompt('新会话标题',session.title)?.trim();if(!title||title===session.title)return;args={title};}
  if(action==='update')args={isPinned:!session.isPinned};
  if(action==='delete'&&!window.confirm(`删除会话“${session.title}”？`))return;
  const revision=++actionRevision.current;const active=()=>revision===actionRevision.current&&openRef.current&&activeList.current===list;
  setManaging(true);setActionError('');
  try{const result=await interactRef.current({type:`session.${action}`,id:session.sessionId,args});if(!active())return;if(result?.status!=='SUCCESS')throw new Error(result?.replyText||'会话操作失败');clearTimeout(searchTimer.current);await list.load(keywordRef.current);}
  catch(error){if(active())setActionError(error instanceof Error?error.message:'会话操作失败');}finally{if(active())setManaging(false);}
 };
 const clear=async()=>{
  if(!window.confirm('清空当前领域的个人历史会话？此操作无法撤销。'))return;
  const revision=++actionRevision.current;const active=()=>revision===actionRevision.current&&openRef.current&&activeList.current===list;
  setManaging(true);setActionError('');
  try{const result=await interactRef.current({type:'session.clear'});if(!active())return;if(result?.status!=='SUCCESS')throw new Error(result?.replyText||'清空会话失败');clearTimeout(searchTimer.current);keywordRef.current='';setKeyword('');list.reset();}
  catch(error){if(active())setActionError(error instanceof Error?error.message:'清空会话失败');}finally{if(active())setManaging(false);}
 };
 if(!isOpen)return null;
 return <div ref={container} className="fixed inset-0 z-[70] flex justify-end bg-slate-950/45 backdrop-blur-sm"><button tabIndex={-1} aria-label="关闭历史会话" className="min-w-0 flex-1 cursor-default" onClick={onClose}/><SessionHistoryContent userName={userName} {...state} keyword={keyword} error={actionError||state.error} currentSessionId={currentSessionId} managing={managing} hasMore={state.hasMore&&keyword.trim()===state.keyword} onKeywordChange={changeKeyword} onSearch={search} onRetry={search} onLoadMore={()=>void list.load(keyword,true)} onClose={onClose} onNewSession={onNewSession} onSelectSession={onSelectSession} onManage={(action,session)=>void manage(action,session)} onClear={()=>void clear()}/></div>;
};
