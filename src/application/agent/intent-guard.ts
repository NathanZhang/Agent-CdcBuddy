import {createHash} from 'node:crypto';
import type {InteractionIntent,IntentDraft,IntentState,SlotUpdate,FilterSpec} from '@/contracts/interaction-intent';
import type {ApprovedIntent,ApprovedMapPlan} from '@/contracts/approved-intent';
import type {ExecutionContext} from '@/contracts/execution-context';
import type {MapSceneState} from '@/contracts/map-composition';
import {loadRegionCatalog,bindRegionSelection,searchRegionCandidates,regionContains} from '@/infrastructure/geo/region-catalog';
import {loadDatasetRegionBindings} from '@/infrastructure/geo/dataset-region-bindings';
import {loadDatasetManifest} from '@/infrastructure/db/dataset-manifest';
import {assertPrincipal,AuthorizationError} from '@/infrastructure/auth/authorization';
const approvedValues=new WeakSet<object>();
export function isApprovedIntent(value:ApprovedIntent|undefined):value is ApprovedIntent{return !!value&&approvedValues.has(value);}
function deepFreeze<T>(value:T):T{if(value&&typeof value==='object'){Object.values(value).forEach(deepFreeze);Object.freeze(value);}return value;}
function slotValue<T>(s:SlotUpdate<T>,previous:T|null,state:IntentState|null):T|null{if(s.op==='set')return s.value;if(s.op==='clear')return null;if(!state||s.contextRef!==state.contextRef)throw Error('INTENT_CONTEXT_INVALID');return previous;}
export function mergeIntent(previous:IntentState|null,intent:InteractionIntent):IntentDraft{
 if(intent.task==='map_edit'){if(!previous)throw Error('MAP_SCENE_REQUIRED');return {...structuredClone(previous.draft),task:'map_edit',relation:intent.relation,mapOptions:{...previous.draft.mapOptions,...intent.mapOptions,basemap:intent.mapOperations.filter((o):o is Extract<typeof o,{type:'setBasemap'}>=>o.type==='setBasemap').at(-1)?.basemap??previous.draft.mapOptions.basemap},mapOperations:intent.mapOperations,layerRequests:[]};}
 const old=intent.relation==='continue'||intent.relation==='modify'?previous?.draft:null;const catalog=loadRegionCatalog();
 const bind=(s:InteractionIntent['dataRegion'],p:IntentDraft['dataRegion'])=>{const v=slotValue(s,s.op==='inherit'?null:null,previous);if(s.op==='inherit')return p;if(!v)return null;return bindRegionSelection(v,catalog.regions);};
 const filters:Record<string,FilterSpec>={};for(const [field,s] of Object.entries(intent.filters)){const value=slotValue(s,old?.filters[field]??null,previous);if(value){if(value.field!==field)throw Error('INTENT_FILTER_INVALID');filters[field]=value;}}
 const draft:IntentDraft={task:intent.task,relation:intent.relation,displayRegion:bind(intent.displayRegion,old?.displayRegion??null),dataRegion:bind(intent.dataRegion,old?.dataRegion??null),time:slotValue(intent.time,old?.time??null,previous),filters,mapOptions:intent.mapOptions,layerRequests:intent.layerRequests,mapOperations:intent.mapOperations};
 if(intent.task==='map_display'){draft.dataRegion=null;draft.time=null;draft.filters={};}return draft;
}
function defaultRegion(ctx:ExecutionContext){const j=ctx.principal.jurisdiction;const city=j.city?searchRegionCandidates(j.city).candidates:[];const counties=j.district&&city.length===1?searchRegionCandidates(j.district,city[0].code).candidates:[];if(j.city&&city.length!==1||j.district&&counties.length!==1)throw new AuthorizationError('FORBIDDEN_SCOPE','Server jurisdiction not in current region catalog');return counties[0]?.code??city[0]?.code??'410000';}
export function approveIntent(draft:IntentDraft,ctx:ExecutionContext):ApprovedIntent{
 if(draft.time){const valid=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;if(!valid(draft.time.from)||!valid(draft.time.to)||draft.time.from>draft.time.to)throw Error('INTENT_TIME_INVALID');}
 assertPrincipal(ctx);const catalog=loadRegionCatalog(),defaultCode=defaultRegion(ctx);const defaultBound={includeCodes:[defaultCode],excludeCodes:[],catalogVersion:catalog.version};const data=draft.dataRegion??defaultBound;
 if(!['map_display','map_edit','other'].includes(draft.task)&&data.includeCodes.some(code=>!regionContains(defaultCode,code)))throw new AuthorizationError('FORBIDDEN_SCOPE','Requested geography exceeds server jurisdiction');
 for(const bound of [data,draft.displayRegion??defaultBound]){if(bound.catalogVersion!==catalog.version||[...bound.includeCodes,...bound.excludeCodes].some(code=>!catalog.regions.some(r=>r.code===code)))throw Error('REGION_CATALOG_VERSION_MISMATCH');}
 const catalogOnly=['map_display','map_edit','other'].includes(draft.task)||draft.layerRequests.length>0&&draft.layerRequests.every(l=>l.skillId==='skill_map_annotation');const dataset=catalogOnly?{version:`map-catalog:${catalog.version}`}:loadDatasetManifest().find(d=>d.domain===ctx.domain)!;const bindings=catalogOnly?{mappingVersion:'administrative-catalog-only-v1',regions:[]}:loadDatasetRegionBindings(ctx.domain,dataset.version);
 if(!catalogOnly&&data.includeCodes.some(code=>!bindings.regions.some(r=>r.code===code)))throw Error('REGION_DATASET_MAPPING_REQUIRED');
 const allowed=['category','speciesName','methodName','pathogenName','pesticideName','pathogen','pathogenType','diseaseName','basinName','pathogenId','clusterId'];for(const [field,f] of Object.entries(draft.filters)){if(!allowed.includes(field)||f.field!==field||!['eq','in','range','not_in'].includes(f.operator)||!f.values.length||f.operator==='eq'&&f.values.length!==1||f.operator==='range'&&f.values.length!==2)throw Error('INTENT_FILTER_UNSUPPORTED');}
 const effectiveDataScope={region:structuredClone(data),time:draft.time,filters:structuredClone(draft.filters)};
 const fingerprint=createHash('sha256').update(JSON.stringify({domain:ctx.domain,region:effectiveDataScope.region,time:draft.time,filters:Object.fromEntries(Object.entries(draft.filters).sort()),queryBinding:draft.queryBinding??null,mapping:bindings.mappingVersion,dataset:dataset.version})).digest('hex');
 const approved:ApprovedIntent={domain:ctx.domain,owner:{userId:ctx.principal.userId,organizationId:ctx.principal.organizationId},draft:structuredClone(draft),displayScope:{region:draft.displayRegion??data,basemap:draft.mapOptions.basemap},effectiveDataScope,fingerprint,mappingVersion:bindings.mappingVersion,datasetVersion:dataset.version};deepFreeze(approved);approvedValues.add(approved);return approved;
}
export function approveMapPlan(intent:InteractionIntent,previous:MapSceneState|null,ctx:ExecutionContext,state:IntentState|null=null):ApprovedMapPlan{
 const base=approveIntent(mergeIntent(state,intent),ctx);const layerPlans=intent.layerRequests.map(request=>{const annotation=request.skillId==='skill_map_annotation';const override={...intent,task:annotation?'map_with_data' as const:'analysis' as const,dataRegion:request.dataRegion??intent.dataRegion,time:request.time??intent.time,filters:request.filters??intent.filters,layerRequests:annotation?[request]:[],mapOperations:[]};const approved=approveIntent(mergeIntent(state,override),ctx);return {layerRequestId:request.id,request,approved,scopeFingerprint:approved.fingerprint};});return {base,layerPlans};
}
