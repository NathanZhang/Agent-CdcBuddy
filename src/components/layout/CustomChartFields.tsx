'use client';
import React from 'react';
import type {QueryVisualization} from '@/contracts/query-visualization';
export function CustomChartFields({chartType,value,onChange}:{chartType:string;value?:QueryVisualization;onChange:(value:QueryVisualization)=>void}){
 if(chartType==='table')return null;
 const spec:any=value??(chartType==='map'?{kind:'map',latKey:'',lonKey:'',labelKey:''}:{kind:chartType==='trend'?'line':chartType,xKey:'',yKey:'',unit:''});
 const region=spec.kind==='map'&&'regionCodeKey' in spec;
 const fields=spec.kind==='map'?(region?[['regionCodeKey','行政区代码字段',true],['labelKey','名称字段',true]]:[['latKey','纬度字段',true],['lonKey','经度字段',true],['idKey','点位主键字段',false],['labelKey','名称字段',true]]).concat([['valueKey','指标数值字段',false],['unit','指标单位',!!spec.valueKey]]):[['xKey',chartType==='trend'?'日期字段':'分类字段',true],['yKey','数值字段',true],['unit','数值单位',true]];
 return <fieldset className="space-y-2"><legend className="font-semibold">图表字段绑定</legend><p className="text-slate-500">填写查询结果中的列名；图表与明细使用同一批数据。</p>{spec.kind==='map'&&<label className="block">地图位置方式<select aria-label="地图位置方式" value={region?'region':'point'} onChange={e=>onChange(e.target.value==='region'?{kind:'map',regionCodeKey:'',labelKey:''}:{kind:'map',latKey:'',lonKey:'',labelKey:''})}><option value="point">监测点经纬度</option><option value="region">行政区汇总</option></select></label>}<div className="grid grid-cols-2 gap-2">{fields.map(([key,label,required])=><label key={String(key)} className="block">{String(label)}<input aria-label={String(label)} required={!!required} value={spec[String(key)]??''} onChange={e=>{const next={...spec};if(e.target.value)next[String(key)]=e.target.value;else delete next[String(key)];onChange(next);}} className="block w-full border rounded p-2 bg-transparent"/></label>)}</div></fieldset>;
}
