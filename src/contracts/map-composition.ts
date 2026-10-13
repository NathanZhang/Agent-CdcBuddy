import type {MapView} from './map-view';
import type {SpatialOutput,MapRendering} from './spatial-output';
import type {ResultStatus} from './skill-result';
export interface SpatialOutputRef {runId:string;callId:string;outputId:string;}
export interface MapLayerRequest {id:string;outputRef:SpatialOutputRef;rendering:MapRendering;scopeFingerprint:string;visible?:boolean;opacity?:number;sourceOutcome?:{status:ResultStatus;error?:{code:string;message:string}};}
export interface MapLayer {id:string;sourceId:string;output:SpatialOutput;request:MapLayerRequest;visible:boolean;opacity:number;colorDomain?:[number,number];}
export interface MapLayerOutcome {requestId:string;status:ResultStatus;state:'ready'|'empty'|'geometry-required'|'incompatible'|'rejected'|'failed'|'loading';error?:{code:string;message:string};}
export interface MapComposition {type:'MAP_COMPOSITION';mapId:string;revision:number;baseResultRef:{runId:string};base:MapView;layers:MapLayer[];layerOutcomes:MapLayerOutcome[];legendGroups:{layerId:string;title:string;unit?:string;definition?:string;semantics:string;precision:string;runId:string;domain?:[number,number];categories?:string[]}[];cameraPolicy:'preserve'|'fitDisplayRegion'|'fitVisibleLayers';lineage:SpatialOutputRef[];}
export type MapSceneOperation={type:'replaceScene';layers:MapLayerRequest[]}|{type:'addLayers';layers:MapLayerRequest[]}|{type:'replaceLayer';layerId:string;layer:MapLayerRequest}|{type:'removeLayers';layerIds:string[]}|{type:'setVisibility';layerId:string;visible:boolean}|{type:'setRendering';layerId:string;rendering:MapRendering}|{type:'setBasemap';basemap:'vec'|'img'};
export interface MapSceneState {mapId:string;revision:number;basemap:'vec'|'img';base?:MapView;layers:(MapLayerRequest&{visible?:boolean})[];}
