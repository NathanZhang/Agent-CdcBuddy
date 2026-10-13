export interface MapFeatureRef {mapId:string;surfaceId:string;layerId:string;featureId:string;}
const listeners=new Set<{target:Pick<MapFeatureRef,'mapId'|'surfaceId'>;receive:(ref:MapFeatureRef)=>void}>();
export function emitMapFeature(ref:MapFeatureRef):void{for(const listener of listeners)if(listener.target.mapId===ref.mapId&&listener.target.surfaceId===ref.surfaceId)listener.receive(ref);}
export function subscribeMapFeature(target:Pick<MapFeatureRef,'mapId'|'surfaceId'>,receive:(ref:MapFeatureRef)=>void):()=>void{const entry={target,receive};listeners.add(entry);return ()=>{listeners.delete(entry);};}
export function mapFeatureForRow(row:Record<string,unknown>,index:number,visualization:import('@/contracts/query-visualization').QueryVisualization|undefined,refs:Record<string,MapFeatureRef>|undefined,featureIdKey?:string):MapFeatureRef|undefined{
 const idKey=featureIdKey??(visualization?.kind==='map'&&'idKey' in visualization?visualization.idKey:undefined);
 if(idKey&&row[idKey]===undefined)return undefined;
 return refs?.[String(idKey?row[idKey]:index)];
}
