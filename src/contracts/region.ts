export type RegionLevel='province'|'city'|'county';
export interface RegionCandidate {code:string;name:string;level:RegionLevel;parentCode:string|null;aliases:string[];assetId:string;sourceId:string;bbox:[number,number,number,number];}
export interface RegionCatalog {schemaVersion:1;version:string;source:string;resources:{assetId:string;filename:string;sha256:string;featureCount:number}[];regions:RegionCandidate[];}
export interface RegionSelection {includeCandidateIds:string[];excludeCandidateIds:string[];relation?:'parent'|'exclude'|'include';baseContextRef?:string;}
export interface BoundRegionSet {includeCodes:string[];excludeCodes:string[];catalogVersion:string;}
export interface CandidateSearchResult {candidates:RegionCandidate[];hasMore:boolean;catalogVersion:string;}
