import type {Map as LibreMap,GeoJSONSource,LayerSpecification} from 'maplibre-gl';
import type {FeatureCollection,Geometry,Polygon,Point} from 'geojson';
import type {MapComposition,MapLayer} from '@/contracts/map-composition';
export function geodesicCircle(center:number[],radiusKm:number):Polygon|Point{
 if(center.length!==2||!center.every(Number.isFinite)||Math.abs(center[0])>180||Math.abs(center[1])>90||!Number.isFinite(radiusKm)||radiusKm<0||radiusKm>20000)throw Error('SPATIAL_RADIUS_INVALID');
 if(radiusKm===0)return {type:'Point',coordinates:center};const rad=Math.PI/180,lat=center[1]*rad,lon=center[0]*rad,d=radiusKm/6371.0088;const ring=[];
 for(let i=0;i<=72;i++){const b=(i%72)*2*Math.PI/72;const y=Math.asin(Math.sin(lat)*Math.cos(d)+Math.cos(lat)*Math.sin(d)*Math.cos(b));const x=lon+Math.atan2(Math.sin(b)*Math.sin(d)*Math.cos(lat),Math.cos(d)-Math.sin(lat)*Math.sin(y));ring.push([((x/rad+540)%360)-180,y/rad]);}return {type:'Polygon',coordinates:[ring]};
}
export function buildMapLayers(layer:MapLayer):{geometry:FeatureCollection;layers:LayerSpecification[]}{
 const {request,output}=layer;let geometry=structuredClone(output.geometry);const base={id:layer.id,source:layer.sourceId,layout:{visibility:layer.visible?'visible' as const:'none' as const}};const color='#0284c7';
 if(request.rendering==='circle')geometry={...geometry,features:geometry.features.map(f=>({...f,geometry:geodesicCircle((f.geometry as Point).coordinates,f.properties?.radiusKm)}))};
 if(request.rendering==='grid'){const m=output.quality.gridMetadata;if(!m||m.spacingLon<=0||m.spacingLat<=0)throw Error('GRID_METADATA_REQUIRED');geometry={...geometry,features:geometry.features.map(f=>{const [x,y]=(f.geometry as Point).coordinates;const [w,s,e,n]=m.extent;const x1=Math.max(w,x-m.spacingLon/2),x2=Math.min(e,x+m.spacingLon/2),y1=Math.max(s,y-m.spacingLat/2),y2=Math.min(n,y+m.spacingLat/2);return {...f,geometry:{type:'Polygon',coordinates:[[[x1,y1],[x2,y1],[x2,y2],[x1,y2],[x1,y1]]]} as Geometry};})};}
 const values=geometry.features.map(f=>f.properties?.value).filter((v):v is number=>typeof v==='number'&&Number.isFinite(v));const min=layer.colorDomain?.[0]??(values.length?Math.min(...values):0),max=layer.colorDomain?.[1]??(values.length?Math.max(...values):1);const valueColor=values.length&&max>min?['interpolate',['linear'],['get','value'],min,'#bae6fd',max,'#0369a1']:color;
 let layers:LayerSpecification[];
 switch(request.rendering){
 case 'points':layers=[{...base,type:'circle',paint:{'circle-color':output.channels.value?['case',['has','value'],valueColor,'#94a3b8']:output.channels.category?['match',['to-string',['get','category']],'0','#64748b','1','#0284c7','2','#16a34a','3','#f59e0b','#a855f7']:color,'circle-radius':request.pointSize==='value'&&max>0?['interpolate',['linear'],['sqrt',['max',0,['coalesce',['get','value'],0]]],0,3,Math.sqrt(max),16]:request.pointSize==='value'?3:5,'circle-opacity':layer.opacity,'circle-stroke-width':1,'circle-stroke-color':'#ffffff'}} as LayerSpecification];break;
 case 'labels':layers=[{...base,type:'symbol',layout:{...base.layout,'text-field':['get','label'],'text-size':12,'text-offset':[0,1.1],'text-anchor':'top'},paint:{'text-color':color,'text-halo-color':'#ffffff','text-halo-width':1,'text-opacity':layer.opacity}}];break;
 case 'heatmap':layers=[{...base,type:'heatmap',...(output.channels.value?{filter:['has','value']}:{ }),paint:{'heatmap-weight':output.channels.value?['get','value']:1,'heatmap-radius':25,'heatmap-opacity':layer.opacity,'heatmap-color':['interpolate',['linear'],['heatmap-density'],0,'rgba(0,0,0,0)',.2,'#38bdf8',.6,'#fbbf24',1,'#ef4444']}}];break;
 case 'line':layers=[{...base,type:'line',paint:{'line-color':color,'line-width':2,'line-opacity':layer.opacity}}];break;
 case 'area':case 'grid':layers=[{...base,type:'fill',paint:{'fill-color':valueColor,'fill-opacity':layer.opacity},...(output.channels.value?{filter:['has','value']}:{})} as LayerSpecification];break;
 case 'circle':layers=[{...base,id:base.id+'-area',type:'fill',filter:['==',['geometry-type'],'Polygon'],paint:{'fill-color':color,'fill-opacity':layer.opacity*.25}},{...base,id:base.id+'-line',type:'line',filter:['==',['geometry-type'],'Polygon'],paint:{'line-color':color,'line-width':2}},{...base,id:base.id+'-zero',type:'circle',filter:['==',['geometry-type'],'Point'],paint:{'circle-color':color,'circle-radius':4}}];break;
 }
 return {geometry,layers};
}
const installed=new WeakMap<object,{layers:string[];sources:string[];revision:number}>();
export function syncMapLayers(map:LibreMap,composition:MapComposition):void{
 const old=installed.get(map);if(old&&old.revision>composition.revision)return;
 const layers=composition.layers.flatMap(l=>buildMapLayers(l).layers),sources=new Map(composition.layers.map(l=>[l.sourceId,buildMapLayers(l).geometry]));
 for(const id of old?.layers??[])if(map.getLayer(id))map.removeLayer(id);
 for(const id of old?.sources??[])if(!sources.has(id)&&map.getSource(id))map.removeSource(id);
 for(const [id,data] of sources){const existing=map.getSource(id) as GeoJSONSource|undefined;if(existing)existing.setData(data);else map.addSource(id,{type:'geojson',data});}
 for(const layer of layers)map.addLayer(layer);installed.set(map,{layers:layers.map(l=>l.id),sources:[...sources.keys()],revision:composition.revision});
}
