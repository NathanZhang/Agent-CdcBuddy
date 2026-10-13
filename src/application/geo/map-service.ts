import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import type {ExecutionContext} from '@/contracts/execution-context';
import type {SkillExecution} from '@/contracts/skill-definition';
import type {MapDisplayInput,MapView,MapResource} from '@/contracts/map-view';
import {loadRegionCatalog,bindRegionSelection,regionContains} from '@/infrastructure/geo/region-catalog';
import type {FeatureCollection} from 'geojson';
export async function executeMapDisplay(input:MapDisplayInput,ctx:ExecutionContext):Promise<SkillExecution & {payload:MapView|null}>{
 const catalog=loadRegionCatalog();const displayRegion=bindRegionSelection({includeCandidateIds:input.regionCodes,excludeCandidateIds:input.excludeCodes??[]},catalog.regions);
 const regions=catalog.regions.filter(r=>input.regionCodes.includes(r.code));const boundaryLevels=input.boundaryLevels??Array.from(new Set(regions.map(r=>r.level)));
 const resources:MapResource[]=catalog.resources.filter(a=>boundaryLevels.some(l=>a.assetId===`henan-${l}`)).map(a=>{
 const raw=readFileSync(path.join(process.cwd(),'public/geo',a.filename));const sha256=createHash('sha256').update(raw).digest('hex');if(sha256!==a.sha256)throw Error('MAP_RESOURCE_VERSION_MISMATCH');
 const full=JSON.parse(raw.toString()) as FeatureCollection;
 const features=full.features.filter(f=>{const code=String(f.properties?.gb).slice(3);return displayRegion.includeCodes.some(p=>regionContains(p,code))&&!displayRegion.excludeCodes.some(p=>regionContains(p,code));});
 return {assetId:a.assetId,sourceRef:`/geo/${encodeURIComponent(a.filename)}`,version:catalog.version,sha256,featureCount:features.length,geometry:{type:'FeatureCollection',features}};
 });
 if(!resources.length||!resources.some(r=>r.featureCount))throw Error('MAP_GEOMETRY_REQUIRED');
 const boxes=regions.map(r=>r.bbox),bbox:[number,number,number,number]=[Math.min(...boxes.map(b=>b[0])),Math.min(...boxes.map(b=>b[1])),Math.max(...boxes.map(b=>b[2])),Math.max(...boxes.map(b=>b[3]))];
 return {status:'SUCCESS',datasets:[],metrics:{},payload:{type:'MAP_VIEW',mapId:`${ctx.runId}-map`,title:regions.map(r=>r.name).join('、')+'地图',displayRegion,bbox,basemap:input.basemap??'vec',boundaryLevels,resources},qualityFlags:['local-boundary-catalog-not-current-national-coverage']};
}
