import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { QueryResultVisualization } from '@/components/ag-ui/QueryResultVisualization';
import { AnalyticsResultCard } from '@/components/ag-ui/AnalyticsResultCard';
import { ThemeProvider } from '@/lib/theme/theme-context';
import { mapPoints, pointCollection, resultMapStyle, pointDescription, syncResultMap } from '@/lib/geo/result-map';
import type { QueryVisualization } from '@/contracts/query-visualization';
import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec';
import type { Map as LibreMap } from 'maplibre-gl';

const spec: Extract<QueryVisualization, {kind:'map'}> = {kind:'map',latKey:'lat',lonKey:'lon',labelKey:'name',valueKey:'n',unit:'条'};
const rows = [{name:'零值点',lat:34.75,lon:113.6,n:0},{name:'负值点',lat:0,lon:0,n:-2},{name:'缺值',lat:34,lon:113,n:null},{name:'非法',lat:91,lon:113,n:2},{name:'无穷',lat:34,lon:Infinity,n:2}];

it('updates existing sources and boundary layers while tiles are loading rather than waiting for another style load',()=>{
 const setData=vi.fn(),setLayoutProperty=vi.fn();
 const map={getSource:()=>({setData}),getLayer:()=>({}),setLayoutProperty,isStyleLoaded:()=>false} as unknown as LibreMap;
 expect(syncResultMap(map,[{label:'更新点',lat:34.75,lon:113.62,value:0}],false)).toBe(true);
 expect(setData).toHaveBeenCalledWith({type:'FeatureCollection',features:[{type:'Feature',id:0,geometry:{type:'Point',coordinates:[113.62,34.75]},properties:{label:'更新点',lat:34.75,lon:113.62,value:0}}]});
 expect(setLayoutProperty.mock.calls).toEqual([['city-fill','visibility','none'],['city-line','visibility','none'],['county-fill','visibility','none'],['county-line','visibility','none']]);
});

it('describes the original point coordinates without replacing them with quantized map geometry',()=>{
 expect(pointDescription({label:'郑州测试点',value:0,lat:34.75,lon:113.62},'条')).toBe('郑州测试点：0 条；经度 113.62，纬度 34.75');
});

it('keeps real zero and negative observations and rejects missing values and invalid coordinates',()=>{
 const points=mapPoints(rows,spec);
 expect(points).toEqual([{label:'零值点',lat:34.75,lon:113.6,value:0},{label:'负值点',lat:0,lon:0,value:-2}]);
 expect(pointCollection(points).features.map(f=>[f.geometry.coordinates,f.properties.value])).toEqual([[[113.6,34.75],0],[[0,0],-2]]);
 expect(pointCollection(mapPoints([],spec)).features).toEqual([]);
});

it.each(['vec','img'] as const)('builds %s basemaps with matching labels, administrative overlays and points above them',(basemap)=>{
 const style=resultMapStyle({isDark:false,basemap,key:'test-key',points:mapPoints(rows,spec),boundaries:true});
 expect(validateStyleMin(style)).toEqual([]);
 const base=style.sources['tianditu-base'];const labels=style.sources['tianditu-anno'];
 expect(base.type).toBe('raster');expect(labels.type).toBe('raster');
 if(base.type==='raster'&&labels.type==='raster'){
  expect(base.tiles?.[0]).toContain(`/${basemap}_w/wmts?`);
  expect(labels.tiles?.[0]).toContain(basemap==='vec'?'/cva_w/':'/cia_w/');
  expect(base.attribution).toContain('天地图');
 }
 for(const level of ['city','county']){
  expect(style.sources[`henan-${level}`]).toMatchObject({type:'geojson',data:expect.stringContaining(`henan%20${level}%20border.geojson`)});
  expect(style.layers.find(l=>l.id===`${level}-fill`)).toMatchObject({type:'fill',paint:{'fill-opacity':expect.any(Number)}});
 }
 expect(style.layers.at(-1)?.id).toBe('result-points');
});

it('adapts theme while retaining the observations and hiding administrative fills on request',()=>{
 const options={basemap:'vec' as const,key:'key',points:mapPoints(rows,spec),boundaries:false};
 const light=resultMapStyle({...options,isDark:false});const dark=resultMapStyle({...options,isDark:true});
 expect(dark.sources['result-points']).toEqual(light.sources['result-points']);
 expect(dark.layers.find(l=>l.id==='tianditu-base-layer')?.paint).not.toEqual(light.layers.find(l=>l.id==='tianditu-base-layer')?.paint);
 expect(dark.layers.find(l=>l.id==='county-fill')?.layout?.visibility).toBe('none');
});

it('exposes interactive map controls and accessible real point values instead of a static SVG',()=>{
 const html=renderToStaticMarkup(<ThemeProvider><QueryResultVisualization rows={rows} spec={spec}/></ThemeProvider>);
 for(const label of ['矢量地图','卫星影像','行政区划','复位视野','零值点：0 条','负值点：-2 条'])expect(html).toContain(label);
 expect(html).toContain('data-map-engine="maplibre"');expect(html).not.toContain('<svg role="img"');expect(html).not.toContain('缺值：');
});

it('shows a map for the current spatial analysis using observed capture values, never synthetic alerts',()=>{
 const html=renderToStaticMarkup(<ThemeProvider><AnalyticsResultCard data={{method:'observed-capture-idw-v1',data:{monitoringPoints:[{id:'A',street:'真实点',lat:34.75,lon:113.6,value:0}],grid:[],alerts:[]}}}/></ThemeProvider>);
 expect(html).toContain('data-map-engine="maplibre"');expect(html).toContain('真实点：0 捕获量 / 记录');expect(html).toContain('<table');expect(html).not.toContain('一级暴发');
});

it('shows standalone nonnumeric map points without inventing a zero measurement',()=>{const nonnumeric={kind:'map' as const,latKey:'lat',lonKey:'lon',labelKey:'name'};const html=renderToStaticMarkup(<ThemeProvider><QueryResultVisualization rows={[{name:'入口',lat:34,lon:113}]} spec={nonnumeric}/></ThemeProvider>);expect(html).toContain('入口');expect(html).not.toContain('入口：0');});
