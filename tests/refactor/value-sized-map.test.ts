import {afterAll,beforeAll,expect,it} from 'vitest';
import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import path from 'node:path';
import {validateStyleMin,expression} from '@maplibre/maplibre-gl-style-spec';
import {resolveInteractionIntent} from '@/application/agent/intent-resolver';
import {createMainAgent} from '@/application/agent/main-agent';import {collectDispatch} from '@/application/dispatch/dispatch-service';
import {listSkillDefinitions,executeSkill} from '@/application/skills/skill-service';import {createDevelopmentContext} from '@/lib/skills/server-executor';
import {adaptQuerySpatialOutput} from '@/application/geo/spatial-adapters';import {buildMapLayers} from '@/lib/geo/map-layers';
import {composeMap} from '@/application/geo/map-composer';import {executeMapDisplay} from '@/application/geo/map-service';
const text='展示河南省2024年诱蚊灯法蚊类监测点位地图，以圆点大小表示平均捕获量（只/记录），附点位、监测次数和日期范围明细，最多展示200个点位。';
const evidence={source:'current',start:0,end:text.length,quote:text};
const intent={task:'map_with_data',relation:'new',displayRegion:{op:'set',value:{includeCandidateIds:['410000'],excludeCandidateIds:[]},evidence},dataRegion:{op:'set',value:{includeCandidateIds:['410000'],excludeCandidateIds:[]},evidence},time:{op:'set',value:{from:'2024-01-01',to:'2024-12-31'},evidence},filters:{category:{op:'set',value:{field:'category',operator:'eq',values:['蚊']},evidence},methodName:{op:'set',value:{field:'methodName',operator:'eq',values:['诱蚊灯法']},evidence}},layerRequests:[{id:'sites',skillId:'skill_monitoring_data_table',rendering:'points',pointSize:'value'}],mapOperations:[],mapOptions:{basemap:'vec'}};
const dir=mkdtempSync(path.join(tmpdir(),'cdc-value-map-')),previous=process.env.APP_BUSINESS_DB_PATH;
beforeAll(()=>process.env.APP_BUSINESS_DB_PATH=path.join(dir,'business.db'));afterAll(()=>{if(previous===undefined)delete process.env.APP_BUSINESS_DB_PATH;else process.env.APP_BUSINESS_DB_PATH=previous;rmSync(dir,{recursive:true,force:true});});
it('accepts a complete metric-sized point request without treating presentation as a scope filter',async()=>{
 const result=await resolveInteractionIntent({text,domain:'vector',now:'2026-10-13',previous:null},{complete:async()=>({role:'assistant',content:JSON.stringify(intent)})});
 expect(result.status).toBe('RESOLVED');
});
it.each([false,true])('carries approved value sizing through grouped query output (date dimension join: %s)',async withDateJoin=>{
 const date=withDateJoin?'d.date_id':'f.date_id';
 const sql=`SELECT l.location_id AS site_id, l.latitude AS lat, l.longitude AS lon, COALESCE(l.street,l.address) AS label, AVG(f.capture_count) AS average_capture, COUNT(*) AS monitoring_count, MIN(${date}) AS first_date, MAX(${date}) AS last_date FROM fact_monitoring f JOIN dim_location l ON f.location_id=l.location_id${withDateJoin?' JOIN dim_date d ON f.date_id=d.date_id':''} GROUP BY l.location_id,l.latitude,l.longitude,l.street,l.address ORDER BY l.location_id LIMIT 200`;
 const agent=createMainAgent({llm:{complete:async request=>request.phase==='intent'?{role:'assistant',content:JSON.stringify(intent)}:request.messages[0].content?.includes('你负责提炼会话标题')?{role:'assistant',content:'{"title":"诱蚊灯点位地图"}'}:request.toolChoice==='auto'?{role:'assistant',content:null,tool_calls:[{id:'query',type:'function',function:{name:'skill_monitoring_data_table',arguments:JSON.stringify({sql,visualization:{kind:'map',latKey:'lat',lonKey:'lon',labelKey:'label',valueKey:'average_capture',idKey:'site_id',unit:'只/记录'}})}}]}:{role:'assistant',content:'{"mode":"answer","replyText":"地图与明细已展示。"}'}},listSkills:listSkillDefinitions,executeSkill,enableRegionIntent:true});
 const result=await collectDispatch(agent({interactionId:'value-map',kind:'conversation',userInput:text},createDevelopmentContext('vector')));
 expect(result.status).toBe('SUCCESS');expect(result.mapComposition?.layers[0].request).toMatchObject({pointSize:'value'});
 const table=result.agui.find(v=>v.component==='DATA_TABLE_VIEW')?.result.payload as any;
 expect(table.data.length).toBeGreaterThan(0);expect(table.data.length).toBeLessThanOrEqual(200);
 expect(table.data[0]).toMatchObject({monitoring_count:expect.any(Number),average_capture:expect.any(Number),first_date:expect.stringMatching(/^2024/),last_date:expect.stringMatching(/^2024/)});
 expect(result.mapComposition?.layers[0].output.geometry.features[0].id).toBe(table.data[0].site_id);
 expect(result.mapComposition?.layers[0].output.geometry.features[0].properties?.value).toBe(table.data[0].average_capture);
});
const source={runId:'r',callId:'q',skillId:'skill_monitoring_data_table',method:'bounded-domain-query-v1',datasetRefs:[],scopeFingerprint:'scope',sourceCRS:'EPSG:4326' as const};
const request={id:'sites',outputRef:{runId:'r',callId:'q',outputId:'points'},rendering:'points' as const,pointSize:'value',scopeFingerprint:'scope'};
it('renders larger measured values with larger bounded circles and retains zero and missing distinctions',()=>{
 const output=adaptQuerySpatialOutput([{lat:34,lon:113,n:0},{lat:35,lon:114,n:4},{lat:36,lon:115,n:16},{lat:37,lon:116}],{valueKey:'n',unit:'只/记录'},source);
 const built=buildMapLayers({id:'sites',sourceId:'s',output,request,visible:true,opacity:.8} as any);
 expect(validateStyleMin({version:8,sources:{s:{type:'geojson',data:built.geometry}},layers:built.layers})).toEqual([]);
 const radius=(built.layers[0] as any).paint['circle-radius'];expect(typeof radius).not.toBe('number');
 const compiled=expression.createExpression(radius,{type:'number',default:5,expression:{interpolated:true,parameters:['feature']},'property-type':'data-driven'} as any);
 expect(compiled.result).toBe('success');if(compiled.result!=='success')return;
 expect([0,4,16].map(value=>compiled.value.evaluate({zoom:5} as any,{type:1,properties:{value}} as any))).toEqual([3,9.5,16]);
 expect(compiled.value.evaluate({zoom:5} as any,{type:1,properties:{}} as any)).toBe(3);
 expect(output.geometry.features[0].properties?.value).toBe(0);expect(output.geometry.features[3].properties).not.toHaveProperty('value');
});
it('refuses metric-sized circles with no usable values instead of silently rendering fixed circles',async()=>{
 const output=adaptQuerySpatialOutput([{lat:34,lon:113}],{valueKey:'n',unit:'只/记录'},source),base=(await executeMapDisplay({regionCodes:['410000']},createDevelopmentContext('vector'))).payload!;
 const result=composeMap(base,[request as any],[output],{authorizedRunIds:['r']});
 expect(result.layers).toEqual([]);expect(result.layerOutcomes[0]).toMatchObject({state:'incompatible',error:{code:'SPATIAL_METRIC_VALUES_REQUIRED'}});
});
it('rejects a value-size request attached to a heatmap before execution',async()=>{
 const invalid={...intent,layerRequests:[{...intent.layerRequests[0],rendering:'heatmap'}]};
 expect((await resolveInteractionIntent({text,domain:'vector',now:'2026-10-13',previous:null},{complete:async()=>({role:'assistant',content:JSON.stringify(invalid)})})).status).not.toBe('RESOLVED');
});
it('identifies ambiguous repeated filter evidence so the remaining LLM attempt can repair it',async()=>{
 const ambiguous={...intent,filters:{...intent.filters,category:{...intent.filters.category,evidence:{source:'current',start:10,end:11,quote:'蚊'}}}};
 const result=await resolveInteractionIntent({text,domain:'vector',now:'2026-10-13',previous:null},{complete:async request=>({role:'assistant',content:JSON.stringify(request.messages[0].content?.includes('INTENT_EVIDENCE_AMBIGUOUS')?intent:ambiguous)})});
 expect(result.status).toBe('RESOLVED');
});
it('links a detail row by its real point identity and never falls back to another indexed feature',async()=>{
 const m=await import('@/lib/geo/map-interaction');expect(m).toHaveProperty('mapFeatureForRow');
 const ref={mapId:'map',surfaceId:'web',layerId:'sites',featureId:'site-a'},refs={'site-a':ref,'0':{...ref,featureId:'wrong'}};
 const visualization={kind:'map' as const,latKey:'lat',lonKey:'lon',labelKey:'label',idKey:'site_id'};
 expect((m as any).mapFeatureForRow({site_id:'site-a'},0,visualization,refs)).toEqual(ref);
 expect((m as any).mapFeatureForRow({},0,visualization,refs)).toBeUndefined();
 expect((m as any).mapFeatureForRow({},0,{...visualization,idKey:undefined},refs)?.featureId).toBe('wrong');
 expect((m as any).mapFeatureForRow({site_id:'site-a'},0,undefined,refs,'site_id')).toEqual(ref);
});
it('drops point-only sizing when an existing layer is changed to a heatmap',async()=>{
 const {applyMapSceneOperation}=await import('@/application/geo/map-scene-state');
 const scene={mapId:'map',revision:1,basemap:'vec' as const,layers:[request as any]};
 const changed=applyMapSceneOperation(scene,{type:'setRendering',layerId:'sites',rendering:'heatmap'},1);
 expect(changed.layers[0].rendering).toBe('heatmap');expect(changed.layers[0]).not.toHaveProperty('pointSize');expect(scene.layers[0].pointSize).toBe('value');
});
