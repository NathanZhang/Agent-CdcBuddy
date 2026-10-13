import type {MapView} from '@/contracts/map-view';
import type {SpatialOutput} from '@/contracts/spatial-output';
import {validateSpatialOutput} from '@/contracts/spatial-output';
import type {MapComposition,MapLayerRequest,MapLayerOutcome} from '@/contracts/map-composition';
export interface MapComposeContext {authorizedRunIds:string[];revision?:number;maxFeatures?:number;maxLayerFeatures?:number;maxLayers?:number;maxBytes?:number;cameraPolicy?:MapComposition['cameraPolicy'];}
export function composeMap(base:MapView,requests:MapLayerRequest[],outputs:SpatialOutput[],ctx:MapComposeContext):MapComposition{
 if(requests.length>(ctx.maxLayers??16)||new Set(requests.map(r=>r.id)).size!==requests.length)throw Error('MAP_DATA_LIMIT');
 const layers:MapComposition['layers']=[],layerOutcomes:MapLayerOutcome[]=[];const allowed=new Set(ctx.authorizedRunIds),seen=new Set<string>();let featureCount=0;
 for(const request of requests){const ref=request.outputRef;const output=outputs.find(o=>o.source.runId===ref.runId&&o.source.callId===ref.callId&&o.outputId===ref.outputId);const reject=(state:MapLayerOutcome['state'],code:string,message:string,status:MapLayerOutcome['status']='INSUFFICIENT_DATA')=>layerOutcomes.push({requestId:request.id,state,status,error:{code,message}});
 if(!allowed.has(ref.runId)){reject('rejected','FORBIDDEN_SOURCE','图层来源未获授权','FAILED');continue;}
 if(!output&&request.sourceOutcome){const outcome=request.sourceOutcome;layerOutcomes.push({requestId:request.id,status:outcome.status==='SUCCESS'?'INSUFFICIENT_DATA':outcome.status,state:outcome.status==='NO_DATA'?'empty':outcome.status==='SUCCESS'?'geometry-required':'failed',error:outcome.error??(outcome.status==='SUCCESS'?{code:'SPATIAL_GEOMETRY_REQUIRED',message:'成功来源缺少所请求的空间几何'}:{code:'LAYER_NOT_EXECUTED',message:'请求图层尚未成功执行'})});continue;}
 if(!output){reject('geometry-required','SPATIAL_GEOMETRY_REQUIRED','技能尚未提供所需空间几何');continue;}validateSpatialOutput(output);
 if(output.source.scopeFingerprint!==request.scopeFingerprint){reject('rejected','SCOPE_MISMATCH','图层来源范围不一致','FAILED');continue;}
 if(!output.renderings.includes(request.rendering)){reject('incompatible','MAP_RENDERING_INCOMPATIBLE','该来源不支持请求的图层');continue;}
 if(request.pointSize!==undefined&&(request.rendering!=='points'||!['fixed','value'].includes(request.pointSize)))throw Error('MAP_STYLE_INVALID');
 if(request.pointSize==='value'&&(!output.channels.value||!output.geometry.features.some(f=>typeof f.properties?.value==='number'&&Number.isFinite(f.properties.value)))){reject('incompatible','SPATIAL_METRIC_VALUES_REQUIRED','圆点大小映射缺少有效数值');continue;}
 if(request.pointSize==='value'&&output.geometry.features.some(f=>typeof f.properties?.value==='number'&&f.properties.value<0)){reject('incompatible','SPATIAL_SIZE_VALUE_INVALID','圆点大小映射仅支持非负数值');continue;}
 if(request.rendering==='heatmap'&&output.channels.value&&!output.geometry.features.some(f=>typeof f.properties?.value==='number'&&Number.isFinite(f.properties.value))){reject('incompatible','SPATIAL_METRIC_VALUES_REQUIRED','数量热力图缺少有效数值');continue;}
 if(!output.geometry.features.length){layerOutcomes.push({requestId:request.id,state:'empty',status:'NO_DATA'});continue;}
 if(output.geometry.features.length>(ctx.maxLayerFeatures??10000))throw Error('MAP_DATA_LIMIT');
 const sourceKey=[ref.runId,ref.callId,ref.outputId].map(encodeURIComponent).join(':');if(!seen.has(sourceKey)){seen.add(sourceKey);featureCount+=output.geometry.features.length;}if(featureCount>(ctx.maxFeatures??20000))throw Error('MAP_DATA_LIMIT');
 const opacity=request.opacity??.8;if(!Number.isFinite(opacity)||opacity<0||opacity>1)throw Error('MAP_STYLE_INVALID');
 const id=`${base.mapId}:${sourceKey}:${encodeURIComponent(request.id)}`;const sourceId=`spatial:${sourceKey}${['circle','grid'].includes(request.rendering)?':'+request.rendering:''}`;
 layers.push({id,sourceId,output,request,visible:request.visible??true,opacity});layerOutcomes.push({requestId:request.id,state:'ready',status:'SUCCESS'});
 }
 // Permission failures cannot reveal otherwise valid cached business features.
 if(layerOutcomes.some(o=>o.state==='rejected'))layers.length=0;
 const order={area:0,grid:0,line:1,circle:2,heatmap:3,points:4,labels:5};layers.sort((a,b)=>order[a.request.rendering]-order[b.request.rendering]);
 const domains=new Map<string,number[]>();const metricKey=(l:MapComposition['layers'][number])=>JSON.stringify([l.output.source.method,l.output.channels.unit,l.output.channels.definition,l.output.semantics,l.output.precision]);for(const l of layers)if(l.output.channels.value){const k=metricKey(l),values=l.output.geometry.features.map(f=>f.properties?.value).filter((v):v is number=>typeof v==='number'&&Number.isFinite(v));domains.set(k,[...(domains.get(k)??[]),...values]);}for(const l of layers){const values=domains.get(metricKey(l));if(values?.length)l.colorDomain=[Math.min(...values),Math.max(...values)];}
 const map:MapComposition={type:'MAP_COMPOSITION',mapId:base.mapId,revision:ctx.revision??1,baseResultRef:{runId:base.mapId.replace(/-map$/,'')},base,layers,layerOutcomes,legendGroups:layers.map(l=>({layerId:l.id,title:l.output.source.skillId,unit:l.output.channels.unit,definition:l.output.channels.definition,semantics:l.output.semantics,precision:l.output.precision,runId:l.output.source.runId,...(l.colorDomain?{domain:l.colorDomain}:{}),...(l.output.channels.category?{categories:[...new Set(l.output.geometry.features.map(f=>String(f.properties?.category??'')))]}:{})})),cameraPolicy:ctx.cameraPolicy??'preserve',lineage:outputs.filter(o=>allowed.has(o.source.runId)).map(o=>({runId:o.source.runId,callId:o.source.callId,outputId:o.outputId}))};
 if(new TextEncoder().encode(JSON.stringify(map)).byteLength>(ctx.maxBytes??8*1024*1024))throw Error('MAP_DATA_LIMIT');return map;
}
