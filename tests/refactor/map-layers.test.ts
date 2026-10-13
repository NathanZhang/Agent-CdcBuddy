import {expect,it} from 'vitest';import {validateStyleMin} from '@maplibre/maplibre-gl-style-spec';import {adaptQuerySpatialOutput} from '@/application/geo/spatial-adapters';
it('renders true geodesic scan circles and never inflates zero or half kilometre radii',async()=>{
 const module=await import('@/lib/geo/map-layers').catch(()=>null);expect(module).not.toBeNull();if(!module)return;
 expect(module.geodesicCircle([113,34],0).type).toBe('Point');const geometry=module.geodesicCircle([113,34],.5);expect(geometry.type).toBe('Polygon');if(geometry.type==='Polygon'){const first=geometry.coordinates[0][0];expect(first[1]).toBeCloseTo(34.0044966,5);expect(first[0]).toBeCloseTo(113,5);}
 expect(()=>module.geodesicCircle([113,34],-1)).toThrow();
});
it('builds valid MapLibre layers for supported geometry and smoothing',async()=>{
 const module=await import('@/lib/geo/map-layers').catch(()=>null);expect(module).not.toBeNull();if(!module)return;
 const o=adaptQuerySpatialOutput([{lat:34,lon:113,n:0}],{latKey:'lat',lonKey:'lon',valueKey:'n',unit:'条'},{runId:'r',callId:'c',skillId:'q',method:'m',datasetRefs:[],scopeFingerprint:'s',sourceCRS:'EPSG:4326'});
 for(const rendering of ['points','labels','heatmap'] as const){const l={id:rendering,sourceId:'s',output:o,request:{id:rendering,outputRef:{runId:'r',callId:'c',outputId:'points'},rendering,scopeFingerprint:'s'},visible:true,opacity:.8};const built=module.buildMapLayers(l);expect(validateStyleMin({version:8,sources:{s:{type:'geojson',data:built.geometry}},layers:built.layers})).toEqual([]);}
});

it('renders actual grids, lines and regional fills without fabricating coordinates',async()=>{const m=await import('@/lib/geo/map-layers');const o=adaptQuerySpatialOutput([{lat:34,lon:113,n:2}],{latKey:'lat',lonKey:'lon',valueKey:'n',unit:'条'},{runId:'r',callId:'c',skillId:'q',method:'m',datasetRefs:[],scopeFingerprint:'s',sourceCRS:'EPSG:4326'});const grid={...o,renderings:['grid' as const],semantics:'derived' as const,quality:{...o.quality,gridMetadata:{spacingLat:.1,spacingLon:.1,extent:[112.9,33.9,113.1,34.1]}}};const built=m.buildMapLayers({id:'g',sourceId:'g-source',output:grid,request:{id:'g',outputRef:{runId:'r',callId:'c',outputId:'points'},rendering:'grid',scopeFingerprint:'s'},visible:true,opacity:.8});expect(built.geometry.features[0].geometry).toEqual({type:'Polygon',coordinates:[[[112.95,33.95],[113.05,33.95],[113.05,34.05],[112.95,34.05],[112.95,33.95]]]});});
