import {readFileSync} from 'node:fs';
import path from 'node:path';
import type {Feature,FeatureCollection,Geometry} from 'geojson';
import type {SpatialOutput,SpatialSource,MapRendering} from '@/contracts/spatial-output';
import {validateSpatialOutput} from '@/contracts/spatial-output';
import {loadRegionCatalog,searchRegionCandidates} from '@/infrastructure/geo/region-catalog';
export interface SpatialPublishContext extends SpatialSource {sourceCRS?:'EPSG:4326'|'EPSG:4490';}
export interface QuerySpatialSpec {latKey?:string;lonKey?:string;labelKey?:string;valueKey?:string;unit?:string;categoryKey?:string;idKey?:string;regionCodeKey?:string;sourceCRS?:'EPSG:4326'|'EPSG:4490';precision?:SpatialOutput['precision'];definition?:string;}
const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
function output(features:Feature[],id:string,context:SpatialPublishContext,options:Partial<SpatialOutput>={}):SpatialOutput{
 if(!context.sourceCRS)throw Error('COORDINATE_REFERENCE_REQUIRED');const {sourceCRS,...source}=context;
 return validateSpatialOutput({schemaVersion:1,outputId:id,source,geometry:{type:'FeatureCollection',features},coordinates:{sourceCRS,targetCRS:sourceCRS,conversionVersion:'native-geographic-v1'},semantics:'observed',precision:'sampling-site',channels:{label:'label'},renderings:['points','labels'],quality:{missingGeometry:0,flags:[],returnedCount:features.length},dependencies:[],...options});
}
export function adaptQuerySpatialOutput(rows:Record<string,unknown>[],spec:QuerySpatialSpec,context:SpatialPublishContext):SpatialOutput{
 if(spec.regionCodeKey)return adaptRegionRows(rows.map(r=>({...r,regionCode:r[spec.regionCodeKey!]})),spec,context);
 const features:Feature[]=rows.flatMap((r,i)=>{const lat=r[spec.latKey??'lat'],lon=r[spec.lonKey??'lon'];if(!finite(lat)||!finite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)return [];
 const value=spec.valueKey?r[spec.valueKey]:undefined;return [{type:'Feature',id:spec.idKey?String(r[spec.idKey]??i):String(i),geometry:{type:'Point',coordinates:[lon,lat]},properties:{label:String(r[spec.labelKey??'label']??r.street??r.district??r.city??r.id??'未命名点位'),...(finite(value)?{value}:{}),...(spec.categoryKey?{category:String(r[spec.categoryKey]??'')}:{}),...(finite(r.radiusKm)?{radiusKm:r.radiusKm}:{})}}];});
 const numeric=!!spec.valueKey;if(numeric&&!spec.unit)throw Error('SPATIAL_METRIC_REQUIRED');
 return output(features,'points',{...context,sourceCRS:spec.sourceCRS??context.sourceCRS},{precision:spec.precision??'sampling-site',channels:{label:'label',...(numeric?{value:'value',unit:spec.unit,definition:spec.definition??spec.valueKey}:{}),...(spec.categoryKey?{category:'category'}:{})},renderings:['points','labels',...(spec.precision!=='administrative-centroid'&&features.length&&features.every(f=>f.properties?.value===undefined||f.properties.value>=0)?['heatmap' as const]:[])],quality:{missingGeometry:rows.length-features.length,flags:rows.length>=200?['returned-rows-may-be-limited']:[],returnedCount:features.length,truncated:rows.length>=200}});
}
export function adaptRegionRows(rows:Record<string,unknown>[],spec:QuerySpatialSpec,context:SpatialPublishContext):SpatialOutput{
 const catalog=loadRegionCatalog();const files=new Map<string,FeatureCollection>();let missing=0;
 const features:Feature[]=rows.flatMap((row,i)=>{let region=catalog.regions.find(r=>r.code===row.regionCode);if(!region){const cities=searchRegionCandidates(String(row.city??row.cityName??''));const city=cities.candidates.length===1?cities.candidates[0]:undefined;const district=row.district??row.districtName;if(district&&city){const choices=searchRegionCandidates(String(district),city.code).candidates;region=choices.length===1?choices[0]:undefined;}else region=city;}
 if(!region){missing++;return [];}let file=files.get(region.assetId);if(!file){const asset=catalog.resources.find(r=>r.assetId===region!.assetId)!;file=JSON.parse(readFileSync(path.join(process.cwd(),'public/geo',asset.filename),'utf8')) as FeatureCollection;files.set(region.assetId,file);}const source=file.features.find(f=>String(f.properties?.gb)===region!.sourceId);if(!source){missing++;return [];}
 const value=spec.valueKey?row[spec.valueKey]:undefined;return [{type:'Feature',id:`${region.code}-${i}`,geometry:source.geometry,properties:{regionCode:region.code,label:String(row[spec.labelKey??'label']??region.name),...(finite(value)?{value}:{})}}];});
 const numeric=!!spec.valueKey;return output(features,'regions',{...context,sourceCRS:'EPSG:4490'},{semantics:'region-summary',precision:'region-boundary',channels:{label:'label',...(numeric?{value:'value',unit:spec.unit,definition:spec.definition??spec.valueKey}:{})},renderings:['area','labels'],quality:{missingGeometry:missing,flags:['regional-summary-not-precise-site'],returnedCount:features.length}});
}
export function adaptAnalyticsSpatialOutputs(data:Record<string,any>,ctx:SpatialPublishContext):SpatialOutput[]{
 const outputs:SpatialOutput[]=[];const points=(rows:Record<string,unknown>[],key:string,unit:string,options:Partial<SpatialOutput>={})=>{const o=adaptQuerySpatialOutput(rows,{latKey:'lat',lonKey:'lon',valueKey:key,unit},ctx);outputs.push(validateSpatialOutput({...o,...options}));};
 if(ctx.method==='observed-capture-idw-v1'){
 if(data.monitoringPoints?.length)points(data.monitoringPoints,'value','捕获量 / 记录');
 if(data.grid?.length){const o=adaptQuerySpatialOutput(data.grid,{latKey:'lat',lonKey:'lon',valueKey:'value',unit:'捕获量 / 记录'},ctx);const metadata=data.gridMetadata;outputs.push(validateSpatialOutput({...o,outputId:'idw-grid',semantics:'derived',renderings:metadata&&metadata.spacingLat>0&&metadata.spacingLon>0?['grid']:['points'],quality:{...o.quality,flags:[...(data.qualityFlags??[]),'interpolation-not-disease-risk'],...(metadata?{gridMetadata:metadata}:{})},dependencies:['points']}));}
 }else if(ctx.method==='conditional-poisson-circular-scan-v1'){
 const circles=(data.clusters??[]).map((c:any)=>({lat:c.center_coord?.[1],lon:c.center_coord?.[0],radiusKm:c.radius_km,label:c.cluster_id}));if(circles.length){const o=adaptQuerySpatialOutput(circles,{latKey:'lat',lonKey:'lon',labelKey:'label'},ctx);outputs.push(validateSpatialOutput({...o,outputId:'scan-regions',semantics:'derived',renderings:['circle','labels']}));}
 const members=(data.clusters??[]).flatMap((c:any)=>c.member_locations??[]);if(members.length)points(members,'observed_count','捕获量',{renderings:['points','labels']});
 }else if(ctx.method==='observed-water-summary-v1'&&data.observedPoints?.length)points(data.observedPoints,'hazardIndex','危害商 HQ（无量纲）');
 else if(ctx.method==='district-centroid-dbscan-v1'&&data.dbscanSpatialClusters?.length)points(data.dbscanSpatialClusters,'observedDeaths','死亡登记记录',{precision:'administrative-centroid',renderings:['points','labels']});
 else if(ctx.method==='method-separated-kmeans-capture-v1'){
 const members=(data.clusters??[]).flatMap((c:any)=>(c.members??[]).map((m:any)=>({...m,label:`${m.city} ${m.district} ${m.speciesName}`,clusterId:c.clusterId,memberId:[m.locationId,m.speciesId,m.methodId].map(encodeURIComponent).join(':')})));if(members.length){const o=adaptQuerySpatialOutput(members,{latKey:'lat',lonKey:'lon',labelKey:'label',categoryKey:'clusterId',idKey:'memberId'},ctx);outputs.push({...o,semantics:'derived',renderings:['points','labels']});}
 }else{
 if(ctx.method==='food-exposure-window-candidates-v1'&&!(data.dynamicClusters??[]).length)outputs.push(adaptRegionRows([],{valueKey:'caseCount',unit:'候选窗口内病例记录'},ctx));
 const choices=[data.regionalSummaries,data.dynamicClusters,data.clusterIncidentsDetected,data.isolates,data.items,data.groups,data.rareMortalityClustersDetected];const rows=choices.find(a=>Array.isArray(a)&&a.some(r=>r.city||r.cityName));if(rows?.length){const valueKey=['positivityRate','mortality','caseCount','testedCount'].find(k=>rows.some((r:Record<string,unknown>)=>finite(r[k])));outputs.push(adaptRegionRows(rows,{...(valueKey?{valueKey,unit:valueKey==='positivityRate'||valueKey==='mortality'?'%':'条'}:{})},ctx));}
 }
 if(ctx.method==='calendar-aligned-pearson-v1')for(const output of outputs)output.renderings=['labels'];
 for(const o of outputs)o.quality.flags=[...new Set([...o.quality.flags,...(data.qualityFlags??[])])];
 return outputs.map(validateSpatialOutput);
}
