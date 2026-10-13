import type {FeatureCollection} from 'geojson';
import type {BoundRegionSet,RegionLevel} from './region';
export interface MapDisplayInput {regionCodes:string[];excludeCodes?:string[];basemap?:'vec'|'img';boundaryLevels?:RegionLevel[];}
export interface MapResource {assetId:string;sourceRef:string;version:string;sha256:string;featureCount:number;geometry:FeatureCollection;}
export interface MapView {type:'MAP_VIEW';mapId:string;title:string;displayRegion:BoundRegionSet;bbox:[number,number,number,number];basemap:'vec'|'img';boundaryLevels:RegionLevel[];resources:MapResource[];}
