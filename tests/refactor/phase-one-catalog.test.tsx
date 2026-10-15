import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {it,expect,vi,afterEach} from 'vitest';
import {getRuntimeProfile} from '@/application/config/runtime-profile';
import {listSkillDefinitions} from '@/application/skills/skill-service';
import {SkillsDrawer} from '@/components/layout/SkillsDrawer';
vi.mock('@/lib/rbac/rbac-context',()=>({useRbac:()=>({canAccessSkill:()=>true})}));
vi.mock('@/features/workbench/use-workbench-controller',()=>({useFunctionalInteraction:()=>vi.fn()}));
afterEach(()=>vi.unstubAllGlobals());
const render=()=>renderToStaticMarkup(<SkillsDrawer isOpen onClose={()=>{}} onRunSkill={()=>{}} onCreateCustomSkill={()=>{}}/>);
it.each(['vector','foodborne','env','chronic'] as const)('marketplace is exactly the public server catalog for %s',domain=>{
 const profile=getRuntimeProfile(domain);vi.stubGlobal('window',{__CDC_RUNTIME_PROFILE__:profile});
 expect(profile.capabilities.map(s=>s.id)).toEqual(listSkillDefinitions(domain).map(s=>s.id));
 const html=render();for(const s of profile.capabilities.filter(s=>s.marketplace.listed))expect(html).toContain(s.name);
 for(const s of profile.capabilities.filter(s=>!s.marketplace.listed))expect(html).not.toContain(`data-skill-id="${s.id}"`);
 expect(html).not.toContain('内部会话运行记录');expect(html).toContain('部分实现');expect(html).toContain('专业效果未验收');
 expect(profile.capabilities.every(s=>s.implementationStatus&&s.validationStatus&&s.parametersSchema)).toBe(true);
 if(domain==='vector'){expect(html).toContain('病媒捕获量滚动回测');expect(html).toContain('已做实测历史回测');}
});
it('never falls back to legacy capability promises before the server profile loads',()=>{
 vi.stubGlobal('window',{});const html=render();expect(html).toContain('能力目录加载中');expect(html).not.toContain('误差率≤10%');expect(html).not.toContain('LSTM');
});
it('keeps planned capabilities unavailable and reports limited methods accurately',()=>{
 const chronic=getRuntimeProfile('chronic');expect(chronic.capabilities.find(s=>s.id==='skill_chronic_risk_forecast')).toMatchObject({implementationStatus:'partial',validationStatus:'contract',availability:'available'});
 expect(chronic.capabilities.find(s=>s.id==='skill_chronic_death_report')?.name).not.toContain('4q70');
 expect(chronic.capabilities.find(s=>s.id==='skill_icd10_nlp_inference')?.name).toContain('Iris/MUSE');
});

it('advertises server role eligibility for the newly discoverable backtest and public map',()=>{const vector=getRuntimeProfile('vector');expect(vector.capabilities.find(s=>s.id==='skill_vector_backtest')?.requiredRoles).toContain('CITY_EXPERT');expect(vector.capabilities.find(s=>s.id==='skill_map_display')?.requiredRoles).toContain('PUBLIC_VIEWER');expect(vector.capabilities.find(s=>s.id==='skill_spatial_early_warning')?.requiredRoles).not.toContain('PUBLIC_VIEWER');});
