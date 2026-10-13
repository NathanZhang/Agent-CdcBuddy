import {expect,it} from 'vitest';
import {executeSkill} from '@/application/skills/skill-service';import {createDevelopmentContext} from '@/lib/skills/server-executor';
it('creates authorized regional labels without inventing measurements or exact patient locations',async()=>{
 const result=await executeSkill('skill_map_annotation',{annotations:[{regionCode:'410100',text:'郑州市区域标注'}]},createDevelopmentContext('vector'));
 expect(result.status).toBe('SUCCESS');const output=(result.payload as any).spatialOutputs[0];expect(output.semantics).toBe('annotation');expect(output.precision).toBe('region-boundary');expect(output.geometry.features[0].properties.value).toBeUndefined();
});
it('rejects invented coordinates that are not present in user evidence',async()=>{
 const result=await executeSkill('skill_map_annotation',{annotations:[{coordinates:[113,34],text:'模型补点'}]},createDevelopmentContext('vector'));expect(result.status).toBe('FAILED');
});

it('accepts only coordinates directly evidenced in the server user input',async()=>{const ctx=createDevelopmentContext('vector');ctx.userInput='标注经度113.62、纬度34.75为现场入口';const result=await executeSkill('skill_map_annotation',{annotations:[{coordinates:[113.62,34.75],text:'现场入口',evidence:{start:0,end:ctx.userInput.length,quote:ctx.userInput}}]},ctx);expect(result.status).toBe('SUCCESS');const o=(result.payload as any).spatialOutputs[0];expect(o.geometry.features[0].geometry.coordinates).toEqual([113.62,34.75]);expect(o.geometry.features[0].properties.value).toBeUndefined();});
