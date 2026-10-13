export interface MapFeatureRef {mapId:string;surfaceId:string;layerId:string;featureId:string;}
const listeners=new Set<{target:Pick<MapFeatureRef,'mapId'|'surfaceId'>;receive:(ref:MapFeatureRef)=>void}>();
export function emitMapFeature(ref:MapFeatureRef):void{for(const listener of listeners)if(listener.target.mapId===ref.mapId&&listener.target.surfaceId===ref.surfaceId)listener.receive(ref);}
export function subscribeMapFeature(target:Pick<MapFeatureRef,'mapId'|'surfaceId'>,receive:(ref:MapFeatureRef)=>void):()=>void{const entry={target,receive};listeners.add(entry);return ()=>{listeners.delete(entry);};}
