import {expect,it} from 'vitest';
import {executeSkill,listSkillDefinitions} from '@/application/skills/skill-service';
import {createDevelopmentContext} from '@/lib/skills/server-executor';
import {uiOperation} from '@/application/agent/ui-operation';
import {bindOperationInput} from '@/application/agent/operation-intent';
it.each(['vector','foodborne','env','chronic'] as const)('displays genuine administrative maps in %s without querying monitoring data',async domain=>{
 const result=await executeSkill('skill_map_display',{regionCodes:['410000']},createDevelopmentContext(domain));
 expect(result.status).toBe('SUCCESS');expect(result.datasets).toEqual([]);expect(result.metrics).toEqual({});
 expect(result.payload).toMatchObject({type:'MAP_VIEW',displayRegion:{includeCodes:['410000']}});
 const view=result.payload as any;expect(view.resources[0].featureCount).toBeGreaterThan(0);expect(view.resources[0].sha256).toMatch(/^[a-f0-9]{64}$/);
 expect(listSkillDefinitions(domain).find(s=>s.id==='skill_map_display')?.domain).toBe(domain);
});
it('rejects unknown boundaries and arbitrary resource paths',async()=>{
 expect((await executeSkill('skill_map_display',{regionCodes:['999999']},createDevelopmentContext('vector'))).status).toBe('FAILED');
 expect((await executeSkill('skill_map_display',{regionCodes:['410000'],url:'https://example.com'},createDevelopmentContext('vector'))).error?.code).toBe('INVALID_INPUT');
});
it('binds explicit map.display only to the administrative map skill',()=>{
 const interaction={interactionId:'ui',kind:'resource' as const,userInput:'',resourceRef:{type:'map',id:'410000',action:'display'},attachments:[{type:'operation-input',args:{regionCodes:['410000']}}]};
 expect(uiOperation(interaction)?.skillId).toBe('skill_map_display');
 expect(()=>bindOperationInput(interaction,'skill_monitoring_data_table',{},'vector',id=>id)).toThrow();
});
