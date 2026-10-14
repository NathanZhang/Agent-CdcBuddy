import React from 'react';
import {renderToStaticMarkup as render} from 'react-dom/server';
import {ThemeProvider} from '@/lib/theme/theme-context';
const renderToStaticMarkup=(element:React.ReactNode)=>render(<ThemeProvider>{element}</ThemeProvider>);
import {describe,it,expect} from 'vitest';
import {AGENT_PROFILES} from '@/lib/config/agent-profile';
import {STANDARD_SKILLS} from '@/lib/skills/registry';
import {executeSkill,listSkillDefinitions} from '@/application/skills/skill-service';
import {GenerativeComponentRenderer} from '@/components/ag-ui/GenerativeComponentRenderer';
import {DataTableComponent} from '@/components/ag-ui/DataTableComponent';
import {RECOMMENDATION_DATA_CASES} from './fixtures/recommendation-data-cases';
import type {ExecutionContext} from '@/contracts/execution-context';

const context=(domain:ExecutionContext['domain']):ExecutionContext=>({runId:'recommendation-check',domain,deploymentTier:'local',principal:{userId:'recommendation-audit',role:'PROVINCIAL_ADMIN',organizationId:'test',domainGrants:[domain],jurisdiction:{},mode:'dev'}});

describe('recommendation data coverage and AG-UI rendering against configured datasets',()=>{
 for(const instruction of RECOMMENDATION_DATA_CASES){
   const profile=AGENT_PROFILES[instruction.domain];
   it(`${profile.domain}: ${instruction.title}`,async()=>{
    const definition=listSkillDefinitions(profile.domain).find(s=>s.id===instruction.skillId);
    expect(definition?.availability).toBe('available');
    expect(definition?.allowedOperations).toEqual(['read']);
    const result=await executeSkill(instruction.skillId,instruction.args,context(profile.domain));
    if(instruction.skillId==='skill_molecular_trace'){expect(result.status,JSON.stringify(result.error)).toBe('INSUFFICIENT_DATA');expect((result.payload as any).data.reason).toContain('fact_food_exposure');return;}
    if(profile.domain==='vector'&&['skill_population_dynamics','skill_density_forecast','skill_resistance_evaluation'].includes(instruction.skillId)){expect(result.status,JSON.stringify(result.error)).toBe('INSUFFICIENT_DATA');expect(result.payload).not.toBeNull();return;}
    expect(result.status,JSON.stringify(result.error)).toBe('SUCCESS');
    const view={...result.payload as object,method:result.method,status:result.status,datasets:result.datasets};
    const html=renderToStaticMarkup(<GenerativeComponentRenderer view={view}/>);
    expect(html).toContain('<table');
    if(profile.domain!=='vector')expect(html).toContain('模拟数据');
    if(instruction.display!=='table')expect(html).toContain(`data-visualization="${instruction.display}"`);
    const payload=result.payload as any;
    if(payload.type==='DATA_TABLE_VIEW'){
     expect(payload.data.length).toBeGreaterThan(0);
     expect(payload.data.some((r:Record<string,unknown>)=>Object.values(r).some(v=>v!==null&&v!==''))).toBe(true);
    }
   });
 }
});

it('query charts render actual zeros, preserve gaps, and never coerce missing values to zero',()=>{
 const html=renderToStaticMarkup(<DataTableComponent {...{data:[{month:'2024-01',n:2},{month:'2024-02',n:null},{month:'2024-03',n:0}],visualization:{kind:'line',xKey:'month',yKey:'n',unit:'例'}}}/>);
 expect(html).toContain('data-visualization="line"');
 expect(html).toContain('2024-03：0 例');
 expect(html).not.toContain('2024-02：0');
 // No connecting segment may bridge the missing February observation.
 expect(html).not.toContain('data-series="line"');
});

it('query maps use actual coordinates and retain a table alongside the interactive basemap',()=>{
 const html=renderToStaticMarkup(<DataTableComponent {...{data:[{name:'监测点A',lat:34.75,lon:113.6,n:0},{name:'缺坐标',lat:null,lon:113.5,n:8}],visualization:{kind:'map',latKey:'lat',lonKey:'lon',labelKey:'name',valueKey:'n',unit:'条'}}}/>);
 expect(html).toContain('data-visualization="map"');expect(html).toContain('监测点A：0 条');expect(html).toContain('<table');expect(html).not.toContain('缺坐标：8 条');
});

it('time series leaves absent calendar months and days unconnected',()=>{
 for(const dates of [['2024-01','2024-02','2024-05'],['2024-08-01','2024-08-02','2024-08-05']]){
  const html=renderToStaticMarkup(<DataTableComponent data={dates.map((month,i)=>({month,n:i}))} visualization={{kind:'line',xKey:'month',yKey:'n',unit:'例'}}/>);
  // Equal actual intervals have equal width; the three-period gap is not compressed.
  const coordinates=[...html.split('<figure')[1].split('</figure>')[0].matchAll(/<circle cx="([\d.]+)" cy=/g)].map(m=>Number(m[1]));
  expect(coordinates).toHaveLength(3);
  expect(coordinates[2]-coordinates[1]).toBeCloseTo(3*(coordinates[1]-coordinates[0]));
  const line=html.match(/data-series="line"[^>]*points="([^"]+)"/);
  expect(line?.[1].split(' ')).toHaveLength(2);
 }
});

it('recommendation entry points send concise natural-language requests without execution instructions',()=>{
 for(const profile of Object.values(AGENT_PROFILES)){
  const entries=[...profile.categories.flatMap(c=>c.prompts),...profile.floatingWidget.quickPrompts,...STANDARD_SKILLS.filter(s=>s.domain===profile.domain).flatMap(s=>s.recommendedPrompts)];
  for(const entry of entries){
   if(typeof entry==='string')throw new Error('Built-in recommendation must have a title and prompt');
   expect(entry.prompt,entry.title).not.toMatch(/\b(?:SELECT|FROM|JOIN|WHERE|sql|skillId|latKey|lonKey|xKey|yKey)\b|\b(?:skill_|fact_|dim_)\w*|执行配置|PATH_\d+/i);
   expect(entry.prompt.length,entry.title).toBeLessThanOrEqual(200);
   expect(entry.requirementId,entry.title).toBeGreaterThanOrEqual(23);
  }
 }
});
