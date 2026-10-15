import React from 'react';
import {readFileSync} from 'node:fs';
import {renderToStaticMarkup} from 'react-dom/server';
import {it,expect} from 'vitest';
import {AGENT_PROFILES} from '@/lib/config/agent-profile';
import {REQUIREMENT_SCENARIOS,recommendationsForSkill} from '@/lib/config/recommended-prompts';
import {getRuntimeProfile} from '@/application/config/runtime-profile';
import {RecommendationPrompts} from '@/components/layout/RecommendationPrompts';
import checks from '../../config/requirement-data-checks.json';
it('has exactly one scene for every original requirement, preserving domain counts and names',()=>{
 const original=readFileSync('plan/人工智能-四智能体-功能清单.md','utf8');
 const rows=[...original.matchAll(/^\| (\d+) \| (.*?) \|/gm)];
 expect(REQUIREMENT_SCENARIOS.map(s=>s.requirementId)).toEqual(rows.map(m=>Number(m[1])));
 for(const [domain,count] of Object.entries({vector:13,foodborne:6,env:17,chronic:18})){
  const profile=AGENT_PROFILES[domain as keyof typeof AGENT_PROFILES];
  const scenes=profile.categories.flatMap(c=>c.prompts).filter(s=>s.requirementId);
  expect(scenes).toHaveLength(count);
  expect(new Set(scenes.map(s=>s.requirementId)).size).toBe(count);
  for(const p of profile.floatingWidget.quickPrompts)expect(scenes).toContain(p);
 }
 for(const [i,s] of REQUIREMENT_SCENARIOS.entries()){
  expect(s.title).toBe(`${s.requirementId} · ${rows[i][2]}`);
  expect(s.acceptance.length).toBeGreaterThan(4);expect(s.limitation.length).toBeGreaterThan(4);
 }
 expect(checks.map(c=>c.requirementId)).toEqual(REQUIREMENT_SCENARIOS.map(s=>s.requirementId));
 expect(REQUIREMENT_SCENARIOS.filter(s=>s.deferred).map(s=>s.requirementId)).toEqual([42]);
});
it('shares scenario references with the server marketplace without cross-domain report leakage',()=>{
 for(const domain of ['vector','foodborne','env','chronic'] as const){
  const catalog=getRuntimeProfile(domain).capabilities;
  for(const s of REQUIREMENT_SCENARIOS.filter(s=>s.domain===domain))for(const id of s.skillIds)expect(catalog.some(c=>c.id===id),`${domain}/${s.requirementId}/${id}`).toBe(true);
  for(const skill of catalog){const recommendations=recommendationsForSkill(domain,skill.id);if(recommendations.length)expect(skill.recommendedPrompts).toEqual(recommendations);}
 }
 expect(recommendationsForSkill('env','skill_auto_report_gen').map(s=>s.requirementId)).toEqual([56]);
});
it('renders numbered acceptance criteria, search and actual capability limitations',()=>{
 const html=renderToStaticMarkup(<RecommendationPrompts onSelectPrompt={()=>{}} defaultExpanded/>);
 expect(html).toContain('13');expect(html).toContain('23 · 种群动态模型');expect(html).toContain('35 · AI助手信息');
 expect(html).toContain('按需求编号或名称筛选');expect(html).toContain('条件Beta-Binomial网络');
});
