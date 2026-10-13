import {expect,it} from 'vitest';
const context={runId:'r',callId:'c',skillId:'skill_spatial_early_warning',method:'observed-capture-idw-v1',datasetRefs:[],scopeFingerprint:'scope',sourceCRS:'EPSG:4326' as const};
it('keeps observed points and calculated IDW grid as separate evidence outputs',async()=>{
 const module=await import('@/application/geo/spatial-adapters').catch(()=>null);expect(module).not.toBeNull();if(!module)return;
 const outputs=module.adaptAnalyticsSpatialOutputs({monitoringPoints:[{id:'p',lat:34,lon:113,value:0}],grid:[{lat:34,lon:113,value:0}],gridMetadata:{spacingLat:.1,spacingLon:.1,extent:[113,34,113,34]}},context);
 expect(outputs.map(o=>o.semantics)).toEqual(['observed','derived']);expect(outputs[0].geometry.features[0].properties?.value).toBe(0);expect(outputs[1].renderings).not.toContain('heatmap');
});
it('preserves small physical scan radii and centroid precision',async()=>{
 const module=await import('@/application/geo/spatial-adapters').catch(()=>null);expect(module).not.toBeNull();if(!module)return;
 const scan=module.adaptAnalyticsSpatialOutputs({clusters:[{cluster_id:'zero',center_coord:[113,34],radius_km:0},{cluster_id:'half',center_coord:[114,35],radius_km:.5}]},{...context,method:'conditional-poisson-circular-scan-v1'});
 expect(scan[0].geometry.features.map(f=>f.properties?.radiusKm)).toEqual([0,.5]);
 const death=module.adaptAnalyticsSpatialOutputs({dbscanSpatialClusters:[{city:'郑州市',district:'金水区',lat:34,lon:113,observedDeaths:9,clusterId:1}]},{...context,method:'district-centroid-dbscan-v1'});
 expect(death[0].precision).toBe('administrative-centroid');expect(death[0].renderings).not.toContain('heatmap');
});
it('does not interpret molecular links or missing river topology as geographical lines',async()=>{
 const module=await import('@/application/geo/spatial-adapters').catch(()=>null);expect(module).not.toBeNull();if(!module)return;
 expect(module.adaptAnalyticsSpatialOutputs({networkGraph:{links:[{source:'a',target:'b'}]}},{...context,method:'observed-cgmlst-distance-v1'})).toEqual([]);
});
