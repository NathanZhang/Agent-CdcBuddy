'use client';
import React,{useState,useRef,useEffect} from 'react';
import {authHeaders} from '@/infrastructure/auth/client';
import {useFunctionalInteraction} from '@/features/workbench/use-workbench-controller';
interface Recognition {recognitionId:string;speciesName:string|null;category:string|null;confidence:number|null;reason:string;}
export const MobileSimulationModal:React.FC<{data?:{inputSchema?:any;defaults?:{city?:string;district?:string}}}>=({data})=>{
 const interactFunctional=useFunctionalInteraction();
 const [record,setRecord]=useState({city:data?.defaults?.city??'',district:data?.defaults?.district??'',category:'蚊',speciesName:'',captureCount:'',weatherTemp:'',weatherHumidity:'',methodName:'',habitatType:''});
 const [recognition,setRecognition]=useState<Recognition|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[preview,setPreview]=useState('');
 const pending=useRef<AbortController|null>(null);
 useEffect(()=>()=>pending.current?.abort(),[]);
 async function recognize(file?:File){
  if(!file)return;
  pending.current?.abort();const controller=new AbortController();pending.current=controller;
  setRecognition(null);setError('');setPreview('');
  setRecord(previous=>({...previous,speciesName:''}));
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>4*1024*1024){setBusy(false);setError('请选择4MiB以内的JPEG、PNG或WebP图片');return;}
  setBusy(true);
  try{
   const dataUrl=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('无法读取图片'));reader.readAsDataURL(file);});
   if(controller.signal.aborted)return;setPreview(dataUrl);
   const response=await fetch('/api/v1/mobile/detect-species',{method:'POST',headers:{...await authHeaders(),'Content-Type':'application/json'},body:JSON.stringify({imageDataUrl:dataUrl}),signal:controller.signal});
   const body=await response.json();if(!response.ok||!body.success)throw new Error(typeof body.error==='string'?body.error:body.error?.message??'图片识别失败');
   if(controller.signal.aborted)return;
   setRecognition(body.data);
   if(body.data.speciesName)setRecord(previous=>({...previous,speciesName:body.data.speciesName,category:body.data.category}));
  }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'图片识别失败');}
  finally{if(pending.current===controller)setBusy(false);}
 }
 const inputRecord=()=>({...Object.fromEntries(Object.entries(record).filter(([,value])=>value!=='')),...(recognition?{recognitionId:recognition.recognitionId}:{}),captureCount:record.captureCount===''?undefined:Number(record.captureCount),weatherTemp:record.weatherTemp===''?undefined:Number(record.weatherTemp),weatherHumidity:record.weatherHumidity===''?undefined:Number(record.weatherHumidity)});
 return <form className="p-5 bg-white dark:bg-slate-900 rounded-xl space-y-4" onSubmit={event=>{event.preventDefault();if(!busy)void interactFunctional({type:'collection.submit',args:{record:inputRecord()}});}}>
  <h3 className="font-semibold">现场图片识别与采集</h3>
  <p className="text-xs text-slate-500">上传照片后调用视觉模型并回填候选物种，请人工核对后提交审核。模型自评置信度不代表已验证准确率。</p>
  <label className="block text-sm">拍照或选择图片（最大4MiB）<input aria-label="上传病媒照片" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={e=>{void recognize(e.target.files?.[0]);e.target.value='';}} className="block mt-2"/></label>
  {preview&&<img src={preview} alt="待识别的现场照片" className="max-h-48 rounded"/>}
  {busy&&<p role="status">正在识别图片…</p>}{error&&<p role="alert" className="text-red-600">{error}</p>}
  {recognition&&<div className="text-sm border rounded p-3"><p>候选：{recognition.speciesName??'无法判断，请人工填写'}；模型自评：{recognition.confidence===null?'未提供':`${Math.round(recognition.confidence*100)}%`}</p><p>{recognition.reason}</p><p className="text-xs">识别编号：{recognition.recognitionId}</p></div>}
  <div className="grid grid-cols-2 gap-3">{Object.entries(record).filter(([key])=>!data?.inputSchema||Object.hasOwn(data.inputSchema.properties,key)).map(([key,value])=><label key={key} className="text-xs">{{city:'城市',district:'区县',category:'病媒类别',speciesName:'物种名称（人工确认）',captureCount:'捕获数量',weatherTemp:'气温（℃）',weatherHumidity:'湿度（%）',methodName:'采样方法',habitatType:'生境'}[key]}<input value={value} onChange={event=>setRecord(previous=>({...previous,[key]:event.target.value}))} required={['city','district','category','speciesName','captureCount'].includes(key)} type={['captureCount','weatherTemp','weatherHumidity'].includes(key)?'number':'text'} step={key==='captureCount'?1:'any'} min={key==='captureCount'||key==='weatherHumidity'?0:undefined} className="block w-full px-2 py-1.5 mt-1 bg-slate-100 dark:bg-slate-800 rounded"/></label>)}</div>
  <div className="flex gap-3"><button disabled={busy} type="button" onClick={()=>void interactFunctional({type:'collection.validate',args:{record:inputRecord()}})} className="px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded text-sm">检查记录</button><button disabled={busy} type="submit" className="px-3 py-2 bg-sky-600 text-white rounded text-sm disabled:opacity-50">确认并提交审核</button></div>
 </form>;
};
