import type { Map as LibreMap, GeoJSONSource, StyleSpecification, LayerSpecification } from 'maplibre-gl';
import type { FeatureCollection, Point } from 'geojson';
import type { QueryVisualization } from '@/contracts/query-visualization';

export type MapSpec = Extract<QueryVisualization, {kind:'map'}>;
export interface ResultMapPoint {label:string;lat:number;lon:number;value?:number}
export function syncResultMap(map:Pick<LibreMap,'getSource'|'getLayer'|'setLayoutProperty'>,points:ResultMapPoint[],boundaries:boolean):boolean {
 const source=map.getSource('result-points') as GeoJSONSource|undefined;
 if(!source)return false;
 source.setData(pointCollection(points));
 for(const level of ['city','county'])for(const type of ['fill','line']){
  const id=`${level}-${type}`;
  if(map.getLayer(id))map.setLayoutProperty(id,'visibility',boundaries?'visible':'none');
 }
 return true;
}
export function pointDescription(point:ResultMapPoint,unit:string):string {
 const format=(value:number)=>value.toLocaleString('zh-CN',{maximumFractionDigits:5});
 return `${point.label}${point.value===undefined?'':`：${format(point.value)} ${unit}`}；经度 ${format(point.lon)}，纬度 ${format(point.lat)}`;
}
const finite = (value:unknown):value is number => typeof value==='number' && Number.isFinite(value);
export function mapPoints(rows:Record<string,unknown>[],spec:MapSpec):ResultMapPoint[] {
 if(!("latKey" in spec))return [];
 return rows.flatMap(row=>{
  const lat=row[spec.latKey],lon=row[spec.lonKey],value=spec.valueKey?row[spec.valueKey]:undefined;
  return finite(lat)&&finite(lon)&&(spec.valueKey?finite(value):true)&&Math.abs(lat)<=90&&Math.abs(lon)<=180
   ? [{lat,lon,...(finite(value)?{value}:{}),label:String(row[spec.labelKey]??'未命名点位')}] : [];
 });
}
export function pointCollection(points:ResultMapPoint[]):FeatureCollection<Point,ResultMapPoint> {
 return {type:'FeatureCollection',features:points.map((point,id)=>({type:'Feature',id,geometry:{type:'Point',coordinates:[point.lon,point.lat]},properties:point}))};
}
export function resultMapStyle({isDark,basemap,key,points,boundaries}:{isDark:boolean;basemap:'vec'|'img';key:string;points:ResultMapPoint[];boundaries:boolean}):StyleSpecification {
 const tiles=(layer:string)=>Array.from({length:8},(_,s)=>`https://t${s}.tianditu.gov.cn/${layer}_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${layer}&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${encodeURIComponent(key)}`);
 const color=isDark?'#38bdf8':'#0284c7';
 const administrative:LayerSpecification[]=['city','county'].flatMap(level=>[
  {id:`${level}-fill`,type:'fill',source:`henan-${level}`,minzoom:level==='county'?8:0,layout:{visibility:boundaries?'visible':'none'},paint:{'fill-color':color,'fill-opacity':level==='county'?0.05:0.08}},
  {id:`${level}-line`,type:'line',source:`henan-${level}`,minzoom:level==='county'?8:0,layout:{visibility:boundaries?'visible':'none'},paint:{'line-color':color,'line-width':level==='county'?0.7:1.2,'line-opacity':level==='county'?0.45:0.65}},
 ] as LayerSpecification[]);
 return {
  version:8,
  sources:{
   'tianditu-base':{type:'raster',tiles:tiles(basemap),tileSize:256,maxzoom:18,attribution:'© <a href="https://www.tianditu.gov.cn/" target="_blank" rel="noopener noreferrer">天地图</a> | 河南省疾控中心'},
   'tianditu-anno':{type:'raster',tiles:tiles(basemap==='vec'?'cva':'cia'),tileSize:256,maxzoom:18},
   'henan-city':{type:'geojson',data:'/geo/henan%20city%20border.geojson'},
   'henan-county':{type:'geojson',data:'/geo/henan%20county%20border.geojson'},
   'result-points':{type:'geojson',data:pointCollection(points)},
  },
  layers:[
   {id:'background',type:'background',paint:{'background-color':isDark?'#0f172a':'#f8fafc'}},
   {id:'tianditu-base-layer',type:'raster',source:'tianditu-base',paint:{'raster-saturation':isDark?(basemap==='vec'?-0.7:-0.2):0.05,'raster-contrast':isDark?0.25:0.05,'raster-brightness-min':isDark?0.15:0,'raster-brightness-max':isDark?0.75:1,'raster-opacity':isDark?0.88:0.98}},
   ...administrative,
   {id:'tianditu-anno-layer',type:'raster',source:'tianditu-anno',paint:{'raster-opacity':0.95}},
   {id:'result-points',type:'circle',source:'result-points',paint:{'circle-radius':['interpolate',['linear'],['sqrt',['abs',['coalesce',['get','value'],0]]],0,4,10,12,100,20],'circle-color':isDark?'#38bdf8':'#0284c7','circle-opacity':0.8,'circle-stroke-color':isDark?'#e0f2fe':'#ffffff','circle-stroke-width':1.5}},
  ],
 };
}
