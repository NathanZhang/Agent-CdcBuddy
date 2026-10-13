import {expect,it} from 'vitest';
import {listSkillDefinitions} from '@/application/skills/skill-service';
it('classifies every runtime skill and refuses undeclared new executable methods',async()=>{
 const module=await import('@/application/geo/spatial-capabilities').catch(()=>null);expect(module).not.toBeNull();if(!module)return;
 for(const domain of ['vector','foodborne','env','chronic'] as const)for(const skill of listSkillDefinitions(domain,{includeInternal:true})){const capability=module.spatialCapabilityFor(skill);expect(capability.skillId).toBe(skill.id);if(skill.availability==='planned')expect(capability.disposition).toBe('unavailable');}
 expect(()=>module.spatialCapabilityFor({...listSkillDefinitions('vector')[0],availability:'available',method:'brand-new-unregistered-method-v1'})).toThrow(/SPATIAL_CAPABILITY_UNREGISTERED/);
});
