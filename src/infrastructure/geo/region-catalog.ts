import raw from '../../../config/regions.json';
import type {RegionCatalog,RegionCandidate,RegionSelection,BoundRegionSet,CandidateSearchResult} from '@/contracts/region';
export function validateRegionCatalog(value:RegionCatalog):RegionCatalog{
 const codes=new Set<string>();for(const r of value.regions){if(codes.has(r.code))throw Error('Duplicate region code');codes.add(r.code);if(!/^\d{6}$/.test(r.code)||!r.name||!value.resources.some(a=>a.assetId===r.assetId)||r.bbox.length!==4||!r.bbox.every(Number.isFinite))throw Error('Invalid region geometry/resource');}
 for(const r of value.regions)if(r.parentCode&&!codes.has(r.parentCode))throw Error('Missing region parent');
 return value;
}
export function loadRegionCatalog():RegionCatalog{return validateRegionCatalog(structuredClone(raw) as RegionCatalog);}
export function searchRegionCandidates(mention:string,parentCode?:string,limit=20):CandidateSearchResult{
 if(!Number.isSafeInteger(limit)||limit<1||limit>20)throw Error('Invalid candidate limit');const c=loadRegionCatalog(),query=mention.trim();
 const exact=c.regions.filter(r=>r.aliases.includes(query)&&(!parentCode||r.parentCode===parentCode||r.code===parentCode));
 const rows=exact.length?exact:c.regions.filter(r=>(!query||r.aliases.some(a=>a.includes(query)))&&(!parentCode||r.parentCode===parentCode||r.code===parentCode));
 return {candidates:rows.slice(0,limit),hasMore:rows.length>limit,catalogVersion:c.version};
}
export function bindRegionSelection(selection:RegionSelection,candidates:RegionCandidate[]):BoundRegionSet{
 const all=[...selection.includeCandidateIds,...selection.excludeCandidateIds];if(!selection.includeCandidateIds.length||all.length>10||new Set(all).size!==all.length)throw Error('Invalid region selection');
 const known=new Set(candidates.map(c=>c.code));if(all.some(id=>!known.has(id)))throw Error('REGION_CANDIDATE_INVALID');
 return {includeCodes:[...selection.includeCandidateIds].sort(),excludeCodes:[...selection.excludeCandidateIds].sort(),catalogVersion:loadRegionCatalog().version};
}
export function regionContains(parent:string,child:string):boolean{const regions=loadRegionCatalog().regions;let current=regions.find(r=>r.code===child);const seen=new Set<string>();while(current&&!seen.has(current.code)){if(current.code===parent)return true;seen.add(current.code);current=regions.find(r=>r.code===current!.parentCode);}return false;}
