import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {it,expect,vi} from 'vitest';
import {getRuntimeProfile} from '@/application/config/runtime-profile';
import {buildMarketplaceSkills} from '@/lib/skills/marketplace';
import {AGENT_PROFILES} from '@/lib/config/agent-profile';
import {SkillsDrawer} from '@/components/layout/SkillsDrawer';
import {RecommendationPrompts} from '@/components/layout/RecommendationPrompts';
vi.mock('@/lib/rbac/rbac-context',()=>({useRbac:()=>({canAccessSkill:()=>true})}));
vi.mock('@/features/workbench/use-workbench-controller',()=>({useFunctionalInteraction:()=>vi.fn()}));
it.each(['vector','foodborne','env','chronic'] as const)('lists only runnable, classified, scenario-backed capabilities for %s',domain=>{
 const profile=getRuntimeProfile(domain),skills=buildMarketplaceSkills(domain,profile.capabilities);
 const scenes=AGENT_PROFILES[domain].categories.flatMap(c=>c.prompts);
 expect(skills.length).toBeGreaterThan(5);
 expect(skills.filter(s=>s.marketplace?.kind==='general').map(s=>s.marketplace?.capabilityId).sort()).toEqual(['arima-forecast','map-annotation','map-display','report-templates','text2sql-visualization']);
 for(const skill of skills){
  expect(skill.availability).toBe('available');expect(skill.recommendedPrompts.length).toBeGreaterThan(0);
  for(const prompt of skill.recommendedPrompts){expect(typeof prompt).toBe('object');expect(scenes).toContain(prompt);}
 }
 expect(skills.some(s=>['skill_session_manage','skill_catalog_manage','skill_lstm_predictor','skill_selection_build','skill_disposal_workflow'].includes(s.id))).toBe(false);
 expect(skills.filter(s=>s.description.includes('生成实际统计趋势'))).toHaveLength(1);
 const html=renderToStaticMarkup(<SkillsDrawer skills={skills} loaded isOpen onClose={()=>{}} onRunSkill={()=>{}} onCreateCustomSkill={()=>{}}/>);
 expect(html).toContain(`已登记 ${skills.length} 项`);
 expect(html).toContain('业务场景技能');expect(html).toContain('通用技能');
 for(const s of skills)for(const p of s.recommendedPrompts)expect(html).toContain((typeof p==='string'?p:p.prompt).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll("'",'&#x27;').replaceAll('<','&lt;').replaceAll('>','&gt;'));
});
it('deduplicates custom IDs, isolates domains and keeps custom skills in business category',()=>{
 const profile=getRuntimeProfile('vector');const custom={skill_id:'custom_skill_1',name:'每月统计',domain:'vector',recommended_prompts:'展示每月统计表;展示趋势图'};
 const base=buildMarketplaceSkills('vector',profile.capabilities);
 const merged=buildMarketplaceSkills('vector',[...profile.capabilities,...profile.capabilities],[custom,custom,{...custom,skill_id:'foreign',domain:'env'},{...custom,skill_id:'unbound',domain:undefined}]);
 expect(merged).toHaveLength(base.length+1);
 expect(merged.at(-1)).toMatchObject({id:'custom_skill_1',marketplace:{kind:'business'},recommendedPrompts:['展示每月统计表','展示趋势图']});
 expect(buildMarketplaceSkills('vector',profile.capabilities,[])).toHaveLength(base.length);
 const html=renderToStaticMarkup(<RecommendationPrompts defaultExpanded customSkills={merged.filter(s=>s.category==='custom')} onSelectPrompt={()=>{}}/>);
 expect(html).toContain('自定义业务场景');expect(html).toContain('展示每月统计表');
});
it('does not invent executable catalog entries when server metadata is absent',()=>{
 expect(buildMarketplaceSkills('env',[],[])).toEqual([]);
 expect(buildMarketplaceSkills('env',[{id:'legacy',domain:'env',availability:'available'}],[])).toEqual([]);
});
