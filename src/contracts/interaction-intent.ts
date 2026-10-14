import type {RegionSelection,BoundRegionSet} from './region';
import type {MapSceneOperation,SpatialOutputRef} from './map-composition';
import type {MapRendering} from './spatial-output';
export type QuoteEvidence={source:'current';quote:string}|{source:'context';contextRef:string;cue:{quote:string}};
// Character offsets exist only in server-anchored evidence, never in model output.
export type Evidence={source:'current';start:number;end:number;quote:string}|{source:'context';contextRef:string;cue:{start:number;end:number;quote:string}};
export type SlotUpdate<T,E=Evidence>={op:'set';value:T;evidence:E}|{op:'inherit';contextRef:string;evidence:E}|{op:'clear';evidence:E};
export interface TimeWindow {from:string;to:string;}
export interface FilterSpec {field:string;operator:'eq'|'in'|'range'|'not_in';values:(string|number)[];}
export type IntentTask='map_display'|'map_with_data'|'map_edit'|'data_query'|'analysis'|'other'|'clarification';
export interface IntentLayerRequest<E=Evidence> {id:string;skillId?:string;outputRef?:SpatialOutputRef;rendering:MapRendering;pointSize?:'fixed'|'value';dataRegion?:SlotUpdate<RegionSelection,E>;time?:SlotUpdate<TimeWindow,E>;filters?:Record<string,SlotUpdate<FilterSpec,E>>;}
export interface InteractionIntent<E=Evidence> {task:IntentTask;relation:'new'|'continue'|'modify'|'reset';displayRegion:SlotUpdate<RegionSelection,E>;dataRegion:SlotUpdate<RegionSelection,E>;time:SlotUpdate<TimeWindow,E>;filters:Record<string,SlotUpdate<FilterSpec,E>>;layerRequests:IntentLayerRequest<E>[];mapOperations:MapSceneOperation[];mapOptions:{basemap:'vec'|'img';boundaryLevels?:('province'|'city'|'county')[];cameraPolicy?:'preserve'|'fitDisplayRegion'|'fitVisibleLayers'};questions?:string[];}
export interface IntentDraft {queryBinding?:{sql:string};task:IntentTask;relation:InteractionIntent['relation'];displayRegion:BoundRegionSet|null;dataRegion:BoundRegionSet|null;time:TimeWindow|null;filters:Record<string,FilterSpec>;layerRequests:IntentLayerRequest[];mapOperations:MapSceneOperation[];mapOptions:{basemap:'vec'|'img';boundaryLevels?:('province'|'city'|'county')[];cameraPolicy?:'preserve'|'fitDisplayRegion'|'fitVisibleLayers'};}
export interface IntentState {revision:number;contextRef:string;draft:IntentDraft;updatedAt:number;}
export interface PendingIntent {sessionId:string;questions:string[];input:string;createdAt:number;expiresAt:number;revision:number;}
export interface IntentDiagnostic {attempt:number;code:string;message:string;}
// Older recognition failures were stored as clarification questions. They cannot
// supply context for a new attempt because there was no actual question to answer.
export function isLegacyRecognitionFailure(pending:PendingIntent):boolean{return pending.questions.length===1&&pending.questions[0]==='本次请求识别失败，请重试原指令。';}
export type IntentResolution={status:'RESOLVED';intent:InteractionIntent}|{status:'CLARIFICATION';questions:string[];pending?:PendingIntent}|{status:'FAILED';error:{code:string;message:string};diagnostics?:IntentDiagnostic[]};
