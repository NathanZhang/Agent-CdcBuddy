import {it,expect} from 'vitest';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {GenerativeComponentRenderer} from '@/components/ag-ui/GenerativeComponentRenderer';
import {ChatMessageContent} from '@/components/common/ChatMessageContent';
import {ThemeProvider} from '@/lib/theme/theme-context';
import {viewFromTurn} from '@/features/workbench/result-adapter';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const runProcess=promisify(execFile);
it('runs every displayed recommendation, then exports reports, edits templates, syncs samples and resolves a reviewed ticket',async()=>{
 const root=mkdtempSync(join(tmpdir(),'cdc-full-requirement-')),bundle=join(root,'bundle');
 try{
  await runProcess('./.venv/bin/python',['scripts/seed-requirement-acceptance.py','--output-dir',bundle],{timeout:30000});
  await runProcess('node',['scripts/run-requirement-flows.cjs',bundle],{timeout:180000,maxBuffer:8*1024*1024,env:{...process.env,REQUIREMENT_IDS:'',REQUIREMENT_LLM_MODE:'contract',REQUIREMENT_RESULT_FILE:'scenario-execution.json',REQUIREMENT_DOMAIN:''}}).catch(error=>{if(error.code!==1)throw error;});
  const run=JSON.parse(readFileSync(join(bundle,'scenario-execution.json'),'utf8'));
  expect(run.results).toHaveLength(54);expect(run.results.filter((r:any)=>!r.passed).map((r:any)=>({id:r.requirementId,error:r.error,checks:r.checks.filter((c:any)=>!c.passed)}))).toEqual([]);
  for(const row of run.results){
   expect(row.phaseCalls).toContain('intent');expect(row.phaseCalls).toContain('planning');expect(row.session?.id).toBeTruthy();
   const view=viewFromTurn({...row,interactionId:'acceptance'});
   for(const compact of [false,true]){
    const html=renderToStaticMarkup(React.createElement(ThemeProvider,null,React.createElement(React.Fragment,null,
      React.createElement(ChatMessageContent,{message:{id:'user',timestamp:'',sender:'user',text:row.prompt}}),
      React.createElement(ChatMessageContent,{message:{id:'agent',timestamp:'',sender:'agent',text:row.replyText}}),
      view?React.createElement(GenerativeComponentRenderer,{view,isCompact:compact}):null)));
    expect(html).toContain(row.replyText);expect(html.length).toBeGreaterThan(100);
   }
  }
  for(const id of [23,30,37,44,45,50,51,64,68]){const row=run.results.find((r:any)=>r.requirementId===id);const text=JSON.stringify(row.skillRuns);expect(text).toContain('validation');expect(text).not.toContain('ANALYTICS_FAILED');}
  await runProcess('node',['scripts/verify-requirement-business.cjs',bundle],{timeout:180000,maxBuffer:8*1024*1024});
  const business=JSON.parse(readFileSync(join(bundle,'business-execution.json'),'utf8'));
  expect(business.checks).toHaveLength(7);expect(business.checks.every((r:any)=>r.passed)).toBe(true);
  expect(business.checks.find((r:any)=>r.ticketStatus)?.ticketStatus).toBe('RESOLVED');
 }finally{rmSync(root,{recursive:true,force:true});}
},360000);
