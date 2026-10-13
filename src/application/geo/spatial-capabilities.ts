import config from '../../../config/spatial-capabilities.json';
import type {SkillDefinition} from '@/contracts/skill-definition';
import type {MapRendering} from '@/contracts/spatial-output';
export interface SpatialCapability {skillId:string;method:string;outputVersion:1;disposition:'producer'|'adapter'|'region-summary'|'non-spatial'|'unavailable';renderings:MapRendering[];reason:string;}
export function spatialCapabilityFor(skill:Pick<SkillDefinition,'id'|'method'|'availability'>):SpatialCapability{
 if(skill.availability==='planned')return {skillId:skill.id,method:skill.method,outputVersion:1,disposition:'unavailable',renderings:[],reason:'Capability not implemented'};
 const entry=(config.methods as Record<string,Omit<SpatialCapability,'skillId'|'method'|'outputVersion'>>)[skill.method];if(!entry)throw Error(`SPATIAL_CAPABILITY_UNREGISTERED: ${skill.id}/${skill.method}`);
 return {...entry,skillId:skill.id,method:skill.method,outputVersion:1};
}
export function listSpatialCapabilities(definitions:SkillDefinition[]):SpatialCapability[]{return definitions.map(spatialCapabilityFor);}
