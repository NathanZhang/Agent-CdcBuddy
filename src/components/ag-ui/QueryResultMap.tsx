'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { Map as LibreMap, Popup } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Layers, RotateCcw } from 'lucide-react';
import { useTheme } from '@/lib/theme/theme-context';
import { HENAN_PROVINCE_BBOX, HENAN_PROVINCE_CENTER, HENAN_PROVINCE_ZOOM } from '@/lib/geo/henan-geojson';
import { subscribeGeoLocate } from '@/lib/geo/geo-event-bus';
import { pointDescription, resultMapStyle, syncResultMap, type ResultMapPoint } from '@/lib/geo/result-map';

const format=(value:number)=>value.toLocaleString('zh-CN',{maximumFractionDigits:5});

export function QueryResultMap({points,unit}:{points:ResultMapPoint[];unit:string}) {
 const {isDark}=useTheme();
 const [basemap,setBasemap]=useState<'vec'|'img'>('vec');
 const [boundaries,setBoundaries]=useState(true);
 const [error,setError]=useState('');
 const container=useRef<HTMLDivElement>(null);
 const mapRef=useRef<LibreMap|null>(null);
 const popupRef=useRef<Popup|null>(null);
 // Async import and style loading always consume the latest render's data.
 const latest=useRef({points,unit,isDark,basemap,boundaries});
 latest.current={points,unit,isDark,basemap,boundaries};
 // Table pagination and disclosure changes may recreate an identical rows array.
 const pointsKey=JSON.stringify(points);
 const key=process.env.NEXT_PUBLIC_TIANDITU_KEY || '45052613ad935c678a6a702faf0511b1';
 const reset=useCallback(()=>{
  const map=mapRef.current;if(!map)return;
  const current=latest.current.points;
  if(!current.length)map.fitBounds(HENAN_PROVINCE_BBOX,{padding:40,maxZoom:7,duration:500});
  else if(current.length===1)map.flyTo({center:[current[0].lon,current[0].lat],zoom:12,duration:500});
  else map.fitBounds([[Math.min(...current.map(p=>p.lon)),Math.min(...current.map(p=>p.lat))],[Math.max(...current.map(p=>p.lon)),Math.max(...current.map(p=>p.lat))]],{padding:60,maxZoom:12,duration:500});
 },[]);

 useEffect(()=>{
  let disposed=false;let observer:ResizeObserver|undefined;let unsubscribe:(()=>void)|undefined;
  let map:LibreMap|undefined;
  void import('maplibre-gl').then(({default:libre})=>{
   if(disposed||!container.current)return;
   try {
    map=new libre.Map({container:container.current,style:resultMapStyle({...latest.current,key}),center:HENAN_PROVINCE_CENTER,zoom:HENAN_PROVINCE_ZOOM,attributionControl:false,maxZoom:18,maxPitch:0,dragRotate:false,touchPitch:false,renderWorldCopies:false});
    mapRef.current=map;
    map.addControl(new libre.NavigationControl({showCompass:false}),'bottom-right');
    map.addControl(new libre.AttributionControl({compact:true}),'bottom-right');
    map.addControl(new libre.ScaleControl({unit:'metric'}),'bottom-left');
    map.on('error',()=>{if(!disposed)setError('部分地图图层加载失败，请检查网络与天地图密钥；点位明细仍可查看。');});
    // A new style can finish loading after data or visibility has already changed.
    map.on('style.load',()=>{
     if(!map)return;
     syncResultMap(map,latest.current.points,latest.current.boundaries);
    });
    map.once('load',reset);
    map.on('click','result-points',event=>{
     const feature=event.features?.[0];if(!feature||feature.geometry.type!=='Point'||!map)return;
     const props=feature.properties;
     // Rendered geometry is quantized into vector tiles; retain original coordinates.
     const point={label:String(props.label),value:Number(props.value),lat:Number(props.lat),lon:Number(props.lon)};
     const content=document.createElement('div');
     content.className='text-sm text-slate-900';
     content.textContent=pointDescription(point,latest.current.unit);
     popupRef.current?.remove();
     popupRef.current=new libre.Popup({closeButton:true,maxWidth:'280px'}).setLngLat([point.lon,point.lat]).setDOMContent(content).addTo(map);
    });
    map.on('mouseenter','result-points',()=>{if(map)map.getCanvas().style.cursor='pointer';});
    map.on('mouseleave','result-points',()=>{if(map)map.getCanvas().style.cursor='';});
    observer=new ResizeObserver(()=>map?.resize());observer.observe(container.current);
    unsubscribe=subscribeGeoLocate(detail=>{
     if(!map||!Number.isFinite(detail.lat)||!Number.isFinite(detail.lon)||Math.abs(detail.lat)>90||Math.abs(detail.lon)>180)return;
     map.flyTo({center:[detail.lon,detail.lat],zoom:detail.zoom??13.5});
     popupRef.current?.remove();
     popupRef.current=new libre.Popup().setLngLat([detail.lon,detail.lat]).setText(detail.title).addTo(map);
    });
   }catch {setError('地图无法初始化，请确认浏览器支持 WebGL；点位明细仍可查看。');}
  }).catch(()=>{if(!disposed)setError('地图组件加载失败；点位明细仍可查看。');});
  return ()=>{disposed=true;observer?.disconnect();unsubscribe?.();popupRef.current?.remove();popupRef.current=null;map?.remove();mapRef.current=null;};
 },[key,reset]);

 useEffect(()=>{
  const map=mapRef.current;if(!map)return;
  popupRef.current?.remove();setError('');
  // setStyle preserves the camera and avoids rebuilding the WebGL context.
  map.setStyle(resultMapStyle({...latest.current,key}));
 },[isDark,basemap,key]);
 useEffect(()=>{
  const map=mapRef.current;if(!map)return;
  if(syncResultMap(map,latest.current.points,latest.current.boundaries)){
   popupRef.current?.remove();reset();
  }else map.once('style.load',reset);
 },[pointsKey,reset]);
 useEffect(()=>{
  const map=mapRef.current;if(!map)return;
  syncResultMap(map,latest.current.points,boundaries);
 },[boundaries]);

 const button='rounded-lg px-3 py-2 text-xs font-medium border border-slate-200 dark:border-slate-700 hover:bg-sky-50 dark:hover:bg-slate-800';
 return <figure data-visualization="map" data-map-engine="maplibre" className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200">
  <div className="flex flex-wrap items-center justify-between gap-2 p-3">
   <figcaption className="text-sm font-semibold">监测空间分布</figcaption>
   <div className="flex flex-wrap gap-2" role="group" aria-label="地图图层与视野">
    <button className={button} aria-pressed={basemap==='vec'} onClick={()=>setBasemap('vec')}>矢量地图</button>
    <button className={button} aria-pressed={basemap==='img'} onClick={()=>setBasemap('img')}>卫星影像</button>
    <button className={`${button} flex items-center gap-1`} aria-pressed={boundaries} onClick={()=>setBoundaries(v=>!v)}><Layers size={14}/>行政区划</button>
    <button className={`${button} flex items-center gap-1`} onClick={reset}><RotateCcw size={14}/>复位视野</button>
   </div>
  </div>
  <div className="relative">
   <div ref={container} role="region" aria-label={`交互地图（${unit}），可拖动与缩放，点击点位查看数值`} className="h-[420px] sm:h-[500px] w-full"/>
   {error&&<p role="status" className="absolute top-3 left-3 right-3 rounded-lg bg-amber-50/95 text-amber-900 text-xs p-3">{error}</p>}
  </div>
  <p className="p-3 text-xs text-slate-500 dark:text-slate-400">{points.length} 个有效点位 · {points.some(p=>p.value!==undefined)?`圆点大小表示 ${unit}`:'点位未附数值指标'} · 点击点位查看数值；地图与下方明细使用同一批数据。</p>
  <ul className="sr-only" aria-label="地图点位数值">{points.map((p,i)=><li key={i}>{pointDescription(p,unit)}</li>)}</ul>
 </figure>;
}
