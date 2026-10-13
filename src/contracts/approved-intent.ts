import type {BoundRegionSet} from './region';
import type {AgentDomain} from './dataset';
import type {IntentDraft,TimeWindow,FilterSpec,IntentLayerRequest} from './interaction-intent';
export interface ApprovedIntent {domain:AgentDomain;owner:{userId:string;organizationId:string};draft:IntentDraft;displayScope:{region:BoundRegionSet;basemap:'vec'|'img'};effectiveDataScope:{region:BoundRegionSet;time:TimeWindow|null;filters:Record<string,FilterSpec>};fingerprint:string;mappingVersion:string;datasetVersion:string;}
export interface ApprovedMapPlan {base:ApprovedIntent;layerPlans:{layerRequestId:string;request:IntentLayerRequest;approved:ApprovedIntent;scopeFingerprint:string}[];}
