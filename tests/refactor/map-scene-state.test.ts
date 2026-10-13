import {expect,it} from 'vitest';
it('rejects stale scene updates and retains underlying output references when rendering changes',async()=>{
 const module=await import('@/application/geo/map-scene-state').catch(()=>null);expect(module).not.toBeNull();if(!module)return;
 const state={mapId:'m',revision:2,basemap:'vec' as const,layers:[{id:'a',outputRef:{runId:'r',callId:'c',outputId:'points'},rendering:'points' as const,scopeFingerprint:'scope',visible:true}]};
 const changed=module.applyMapSceneOperation(state,{type:'setRendering',layerId:'a',rendering:'heatmap'},2);expect(changed.layers[0].outputRef).toEqual(state.layers[0].outputRef);expect(changed.layers[0].rendering).toBe('heatmap');expect(changed.revision).toBe(3);
 expect(()=>module.applyMapSceneOperation(changed,{type:'removeLayers',layerIds:['a']},2)).toThrow(/SCENE_REVISION_CONFLICT/);expect(state.layers).toHaveLength(1);
});
