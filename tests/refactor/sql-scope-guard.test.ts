import {expect,it} from 'vitest';import {approveIntent} from '@/application/agent/intent-guard';import {createDevelopmentContext} from '@/lib/skills/server-executor';import {executeSkill} from '@/application/skills/skill-service';
import {assertSqlMatchesIntent} from '@/application/agent/scope-guard';
import {loadDatasetRegionBindings} from '@/infrastructure/geo/dataset-region-bindings';

const failedMapSql='SELECT dl.location_id, dl.district AS "区县", dl.street AS "街道", dl.latitude, dl.longitude, ROUND(AVG(fm.capture_count), 1) AS "平均捕获量", COUNT(*) AS "监测次数", MIN(dd.date_id) AS "最早日期", MAX(dd.date_id) AS "最晚日期" FROM fact_monitoring fm JOIN dim_location dl ON fm.location_id = dl.location_id JOIN dim_date dd ON fm.date_id = dd.date_id GROUP BY dl.location_id, dl.district, dl.street, dl.latitude, dl.longitude ORDER BY "平均捕获量" DESC LIMIT 200';
function approvedMapContext(){
 const ctx=createDevelopmentContext('vector');
 const region={includeCodes:['410000'],excludeCodes:[],catalogVersion:'local-boundaries-2026-10-13-v1'};
 ctx.approvedIntent=approveIntent({task:'map_with_data',relation:'new',displayRegion:region,dataRegion:region,time:{from:'2024-01-01',to:'2024-12-31'},filters:{category:{field:'category',operator:'eq',values:['蚊']},methodName:{field:'methodName',operator:'eq',values:['诱蚊灯法']}},layerRequests:[],mapOperations:[],mapOptions:{basemap:'vec'}},ctx);
 return ctx;
}
it('accepts the failed mosquito map date-key join and still applies approved filters',async()=>{
 const ctx=approvedMapContext();
 ctx.callId='mosquito-map-date-join';
 const visualization={kind:'map',latKey:'latitude',lonKey:'longitude',labelKey:'街道',idKey:'location_id',valueKey:'平均捕获量',unit:'只/记录'};
 const joined=await executeSkill('skill_monitoring_data_table',{sql:failedMapSql,visualization},ctx);
 expect(joined.status).toBe('SUCCESS');
 const direct=await executeSkill('skill_monitoring_data_table',{sql:failedMapSql.replaceAll('dd.date_id','fm.date_id').replace(' JOIN dim_date dd ON fm.date_id = fm.date_id','')},ctx);
 expect(direct.status).toBe('SUCCESS');
 const data=(joined.payload as any).data;
 expect(data).toEqual((direct.payload as any).data);
 expect(data.length).toBeGreaterThan(0);expect(data.length).toBeLessThanOrEqual(200);
 expect(data[0]).toMatchObject({'平均捕获量':expect.any(Number),'监测次数':expect.any(Number),'最早日期':expect.stringMatching(/^2024/),'最晚日期':expect.stringMatching(/^2024/)});
 expect((joined.payload as any).spatialOutputs[0].geometry.features[0]).toMatchObject({id:data[0].location_id,properties:{value:data[0]['平均捕获量']}});
});
it.each([
 'fm.date_id = dd.date_id AND dd.year = 2023',
 "fm.date_id = '2023-01-01'",
 'fm.date_id < dd.date_id',
 'fm.date_id = fm.date_id',
 'fm.date_id = dd.year',
 "fm.date_id = dd.date_id OR dd.date_id = '2023-01-01'",
])('keeps unapproved date restrictions in JOIN blocked: %s',predicate=>{
 const ctx=approvedMapContext(),approved=ctx.approvedIntent!;
 const sql=`SELECT COUNT(*) FROM fact_monitoring fm JOIN dim_date dd ON ${predicate}`;
 expect(()=>assertSqlMatchesIntent(sql,approved,loadDatasetRegionBindings('vector',approved.datasetVersion))).toThrow();
});
it('does not accept a date-key equality used as a WHERE filter',()=>{
 const ctx=approvedMapContext(),approved=ctx.approvedIntent!;
 expect(()=>assertSqlMatchesIntent(failedMapSql.replace(' GROUP BY',' WHERE fm.date_id = dd.date_id GROUP BY'),approved,loadDatasetRegionBindings('vector',approved.datasetVersion))).toThrow();
});
it('allows date formatting and arithmetic projections without mistaking them for predicates',()=>{
 const ctx=approvedMapContext(),approved=ctx.approvedIntent!;
 const sql="SELECT MIN(dd.year || '-' || dd.month || '-' || dd.day), MAX(dd.year + 0) FROM fact_monitoring fm JOIN dim_date dd ON fm.date_id = dd.date_id";
 expect(()=>assertSqlMatchesIntent(sql,approved,loadDatasetRegionBindings('vector',approved.datasetVersion))).not.toThrow();
});
it('still checks scope predicates nested inside projected arithmetic',()=>{
 const ctx=approvedMapContext(),approved=ctx.approvedIntent!;
 const sql='SELECT SUM((dd.year = 2023) + 0) FROM fact_monitoring fm JOIN dim_date dd ON fm.date_id = dd.date_id';
 expect(()=>assertSqlMatchesIntent(sql,approved,loadDatasetRegionBindings('vector',approved.datasetVersion))).toThrow();
});
it.each(["SELECT COUNT(*) AS n FROM dim_location WHERE city='郑州'","SELECT COUNT(*) AS n FROM fact_monitoring WHERE date_id<'2020-01-01'","SELECT COUNT(CASE WHEN city='洛阳市' THEN 1 END) AS n FROM dim_location","SELECT d.year,COUNT(*) AS n FROM fact_monitoring f JOIN dim_date d ON d.date_id=f.date_id WHERE d.year=2023 GROUP BY d.year","SELECT city,COUNT(*) AS n FROM dim_location GROUP BY city HAVING COUNT(*)>10"])('blocks hidden filtering outside the approved scope: %s',async sql=>{const ctx=createDevelopmentContext('vector');const region={includeCodes:['410100'],excludeCodes:[],catalogVersion:'local-boundaries-2026-10-13-v1'};ctx.approvedIntent=approveIntent({task:'data_query',relation:'new',displayRegion:region,dataRegion:region,time:{from:'2024-01-01',to:'2024-12-31'},filters:{},layerRequests:[],mapOperations:[],mapOptions:{basemap:'vec'}},ctx);const result=await executeSkill('skill_monitoring_data_table',{sql},ctx);expect(result.error?.code).toBe('SCOPE_MISMATCH');});
