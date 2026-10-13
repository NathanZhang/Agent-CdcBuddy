import type {StyleSpecification,LayerSpecification} from 'maplibre-gl';
import type {MapView} from '@/contracts/map-view';
import {resultMapStyle} from './result-map';
export function administrativeMapStyle(view:MapView,isDark:boolean,key:string):StyleSpecification{
 const base=resultMapStyle({isDark,key,basemap:view.basemap,points:[],boundaries:false});
 const layers:LayerSpecification[]=view.resources.flatMap(r=>[{id:`${r.assetId}-outline`,type:'line',source:r.assetId,paint:{'line-color':isDark?'#38bdf8':'#0284c7','line-width':1.4}}] as LayerSpecification[]);
 return {...base,glyphs:'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',sources:{...Object.fromEntries(Object.entries(base.sources).filter(([id])=>id.startsWith('tianditu'))),...Object.fromEntries(view.resources.map(r=>[r.assetId,{type:'geojson',data:r.geometry}]))},layers:[...base.layers.filter(l=>l.id==='background'||l.id.startsWith('tianditu')), ...layers]};
}
export function syncAdministrativeBase(map:Pick<import('maplibre-gl').Map,'getSource'>,view:MapView):void{for(const r of view.resources){const source=map.getSource(r.assetId) as import('maplibre-gl').GeoJSONSource|undefined;source?.setData(r.geometry);}}
export function applyCompositionCamera(map:Pick<import('maplibre-gl').Map,'fitBounds'>,composition:import('@/contracts/map-composition').MapComposition):void{
 if(composition.cameraPolicy==='preserve')return;let bounds:number[]=composition.base.bbox;
 if(composition.cameraPolicy==='fitVisibleLayers'){const positions:number[][]=[];const collect=(c:any)=>{if(!Array.isArray(c))return;if(typeof c[0]==='number')positions.push(c);else c.forEach(collect);};for(const l of composition.layers.filter(l=>l.visible))for(const f of l.output.geometry.features)collect((f.geometry as any).coordinates);if(positions.length)bounds=[Math.min(...positions.map(p=>p[0])),Math.min(...positions.map(p=>p[1])),Math.max(...positions.map(p=>p[0])),Math.max(...positions.map(p=>p[1]))];}
 map.fitBounds([[bounds[0],bounds[1]],[bounds[2],bounds[3]]],{padding:35,maxZoom:13});
}
