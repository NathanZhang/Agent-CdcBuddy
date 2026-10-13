import {expect,it} from 'vitest';
const context={runId:'r',callId:'c',skillId:'skill_monitoring_data_table',method:'bounded-domain-query-v1',datasetRefs:[],scopeFingerprint:'scope',sourceCRS:'EPSG:4326' as const};
it('supports nonnumeric points, preserves zero, and never fills missing coordinates',async()=>{
 const module=await import('@/application/geo/spatial-adapters').catch(()=>null);expect(module).not.toBeNull();if(!module)return;
 const output=module.adaptQuerySpatialOutput([{id:'a',lat:34,lon:113,label:'站点'},{id:'b',lat:35,lon:114,label:'零值',n:0},{id:'bad',lat:91,lon:113}],{latKey:'lat',lonKey:'lon',labelKey:'label',valueKey:'n',unit:'条',sourceCRS:'EPSG:4326'},context);
 expect(output.geometry.features).toHaveLength(2);expect(output.geometry.features[0].properties?.value).toBeUndefined();expect(output.geometry.features[1].properties?.value).toBe(0);expect(output.quality.missingGeometry).toBe(1);
 expect(()=>module.adaptQuerySpatialOutput([{lat:34,lon:113}],{latKey:'lat',lonKey:'lon'}, {...context,sourceCRS:undefined})).toThrow(/COORDINATE_REFERENCE_REQUIRED/);
});
it('rejects duplicate feature identities and negative quantitative heatmap weights',async()=>{
 const module=await import('@/application/geo/spatial-adapters').catch(()=>null);const contract=await import('@/contracts/spatial-output').catch(()=>null);expect(contract).not.toBeNull();if(!module||!contract)return;
 const output=module.adaptQuerySpatialOutput([{lat:34,lon:113,n:-2}],{latKey:'lat',lonKey:'lon',valueKey:'n',unit:'条'},context);
 expect(output.renderings).not.toContain('heatmap');
 expect(()=>contract.validateSpatialOutput({...output,geometry:{...output.geometry,features:[output.geometry.features[0],output.geometry.features[0]]}})).toThrow(/feature/i);
});
