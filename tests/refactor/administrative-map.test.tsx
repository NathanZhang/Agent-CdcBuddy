import React from 'react';
import {expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {executeSkill} from '@/application/skills/skill-service';
import {createDevelopmentContext} from '@/lib/skills/server-executor';
import {ThemeProvider} from '@/lib/theme/theme-context';
it('renders independent map controls without invented observations or risk levels',async()=>{
 const component=await import('@/components/ag-ui/AdministrativeMap').catch(()=>null);expect(component).not.toBeNull();if(!component)return;
 const result=await executeSkill('skill_map_display',{regionCodes:['410000']},createDevelopmentContext('vector'));
 const html=renderToStaticMarkup(<ThemeProvider><component.AdministrativeMap view={result.payload as any}/></ThemeProvider>);
 expect(html).toContain('河南省');expect(html).toContain('卫星');expect(html).toContain('data-map-engine');expect(html).not.toContain('风险等级');expect(html).not.toContain('捕获量');
});
