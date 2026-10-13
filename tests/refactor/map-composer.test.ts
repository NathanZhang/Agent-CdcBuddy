import {expect,it} from 'vitest';import {executeMapDisplay} from '@/application/geo/map-service';import {createDevelopmentContext} from '@/lib/skills/server-executor';import {adaptQuerySpatialOutput} from '@/application/geo/spatial-adapters';
const ctx=createDevelopmentContext('vector');const source={runId:ctx.runId,callId:'query',skillId:'skill_monitoring_data_table',method:'bounded-domain-query-v1',datasetRefs:[],scopeFingerprint:'scope',sourceCRS:'EPSG:4326' as const};
it('combines point, label and heatmap renderings without losing source identity',async()=>{
 const module=await import('@/application/geo/map-composer').catch(()=>null);expect(module).not.toBeNull();if(!module)return;
 const base=(await executeMapDisplay({regionCodes:['410000']},ctx)).payload!;const o=adaptQuerySpatialOutput([{lat:34,lon:113,n:0}],{latKey:'lat',lonKey:'lon',valueKey:'n',unit:'条'},source);
 const requests=['points','labels','heatmap'].map((rendering,i)=>({id:String(i),outputRef:{runId:ctx.runId,callId:'query',outputId:'points'},rendering:rendering as any,scopeFingerprint:'scope'}));
 const map=module.composeMap(base,requests,[o],{authorizedRunIds:[ctx.runId]});expect(map.layers).toHaveLength(3);expect(new Set(map.layers.map(l=>l.sourceId)).size).toBe(1);expect(map.layerOutcomes.every(o=>o.state==='ready')).toBe(true);
 expect(module.composeMap(base,requests,[o],{authorizedRunIds:[]}).layers).toEqual([]);
});
it('keeps good layers when another output is missing and refuses silently truncating geometry',async()=>{
 const module=await import('@/application/geo/map-composer').catch(()=>null);expect(module).not.toBeNull();if(!module)return;
 const base=(await executeMapDisplay({regionCodes:['410000']},ctx)).payload!;const o=adaptQuerySpatialOutput([{lat:34,lon:113}],{latKey:'lat',lonKey:'lon'},source);
 const requests=[{id:'ok',outputRef:{runId:ctx.runId,callId:'query',outputId:'points'},rendering:'points' as const,scopeFingerprint:'scope'},{id:'absent',outputRef:{runId:ctx.runId,callId:'query',outputId:'missing'},rendering:'line' as const,scopeFingerprint:'scope'}];
 const map=module.composeMap(base,requests,[o],{authorizedRunIds:[ctx.runId]});expect(map.layers).toHaveLength(1);expect(map.layerOutcomes[1].state).toBe('geometry-required');
 expect(()=>module.composeMap(base,requests,[o],{authorizedRunIds:[ctx.runId],maxFeatures:0})).toThrow(/MAP_DATA_LIMIT/);
});
