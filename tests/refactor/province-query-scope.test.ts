import {it,expect} from 'vitest';
import {executeSkill} from '@/application/skills/skill-service';
import {createDevelopmentContext} from '@/lib/skills/server-executor';

it.each(['河南省','河南','全省'])('treats %s as a province-wide read without a city equality constraint',async city=>{
 const result=await executeSkill('skill_monitoring_data_table',{city,sql:"SELECT street AS label,latitude AS lat,longitude AS lon FROM dim_location WHERE province='河南省' LIMIT 1"},createDevelopmentContext('vector'));
 expect(result.status).toBe('SUCCESS');expect((result.payload as any).data).toHaveLength(1);expect((result.payload as any).scope.city).toBeUndefined();
});
it('does not normalize province arguments past server city jurisdiction authorization',async()=>{
 const ctx=createDevelopmentContext('vector');ctx.principal={...ctx.principal,role:'CITY_EXPERT',jurisdiction:{city:'郑州市'}};
 const result=await executeSkill('skill_monitoring_data_table',{city:'河南省',sql:'SELECT COUNT(*) AS n FROM dim_location'},ctx);
 expect(result.error?.code).toBe('FORBIDDEN_SCOPE');
});
