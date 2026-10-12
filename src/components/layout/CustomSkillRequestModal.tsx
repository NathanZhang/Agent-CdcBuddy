'use client';
import React,{useState} from 'react';
export function CustomSkillRequestModal({onClose,onSubmit}:{onClose:()=>void;onSubmit:(request:string)=>void}){
 const [request,setRequest]=useState('');
 return <div className="fixed inset-0 z-[100] bg-black/30 flex items-center justify-center p-4"><form role="dialog" aria-modal="true" aria-labelledby="skill-request-title" className="w-full max-w-lg rounded-xl bg-white dark:bg-slate-900 p-5 space-y-4" onSubmit={event=>{event.preventDefault();if(request.trim())onSubmit(`创建一个自定义监测查询技能：${request.trim()}`);}}><h2 id="skill-request-title" className="font-semibold">创建自定义技能</h2><label className="block text-sm">描述分析需求<textarea autoFocus required value={request} onChange={event=>setRequest(event.target.value)} className="block w-full min-h-32 mt-2 p-3 rounded bg-slate-100 dark:bg-slate-800" placeholder="填写分析对象、范围和希望展示的结果"/></label><div className="flex justify-end gap-3"><button type="button" onClick={onClose}>取消</button><button type="submit" disabled={!request.trim()} className="px-3 py-2 rounded bg-sky-600 text-white disabled:opacity-40">提交创建需求</button></div></form></div>;
}
