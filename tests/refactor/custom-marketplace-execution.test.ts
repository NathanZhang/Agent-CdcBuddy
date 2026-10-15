import {it,expect,vi} from 'vitest';
import {createMainAgent} from '@/application/agent/main-agent';
import {adaptFunctionalInteraction} from '@/application/agent/interaction-adapter';
import {collectDispatch} from '@/application/dispatch/dispatch-service';
import {executeSkill,listSkillDefinitions} from '@/application/skills/skill-service';
import {createDevelopmentContext} from '@/lib/skills/server-executor';

it('executes an authorized selected custom skill by ID without asking the model to rediscover it',async()=>{
 const ctx=createDevelopmentContext('vector');
 const created=await executeSkill('skill_meta_custom_builder',{skillName:'技能集市回归统计',sqlQuery:'SELECT COUNT(*) AS n FROM fact_monitoring',chartType:'table'},ctx);
 expect(created.status).toBe('SUCCESS');const id=(created.payload as any).skill.id;
 const llm={complete:vi.fn(async()=>{throw Error('A saved query needs no model inference');})};
 const agent=createMainAgent({enableRegionIntent:true,listSkills:listSkillDefinitions,executeSkill,llm});
 const result=await collectDispatch(agent(adaptFunctionalInteraction({type:'skill.execute',id,prompt:'执行技能集市回归统计，展示保存的结果。'}),createDevelopmentContext('vector')));
 expect(result.status).toBe('SUCCESS');expect(llm.complete).not.toHaveBeenCalled();
 expect(result.skillRuns.some(s=>s.skillId===id&&s.result.status==='SUCCESS')).toBe(true);
 expect((result.agui[0].result.payload as any).data[0].n).toBeGreaterThan(0);
 const foreign=createDevelopmentContext('env');
 const denied=await collectDispatch(agent(adaptFunctionalInteraction({type:'skill.execute',id}),foreign));
 expect(denied.status).toBe('FAILED');expect(denied.error?.code).toBe('FORBIDDEN_RESOURCE');
 await executeSkill('skill_catalog_manage',{action:'delete',skillId:id},createDevelopmentContext('vector'));
});
