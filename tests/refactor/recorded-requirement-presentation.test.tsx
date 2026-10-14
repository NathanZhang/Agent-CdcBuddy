import {it,expect} from 'vitest';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {GenerativeComponentRenderer} from '@/components/ag-ui/GenerativeComponentRenderer';
import {ChatMessageContent} from '@/components/common/ChatMessageContent';
import {ThemeProvider} from '@/lib/theme/theme-context';
import {viewFromTurn} from '@/features/workbench/result-adapter';
const bundle=process.env.REQUIREMENT_RECORDED_BUNDLE;

// Opt-in because actual model run artifacts are generated separately, not CI fixtures.
it.skipIf(!bundle)('renders all recorded real-model prompts, conclusions and outputs in both presentation modes',()=>{
 const turns=['vector','foodborne','env','chronic'].flatMap(domain=>JSON.parse(readFileSync(join(bundle!,'live-'+domain+'.json'),'utf8')).results);
 expect(turns).toHaveLength(54);
 const results=turns.map(turn=>{
  expect(turn.llmMode).toBe('live');
  const view=viewFromTurn({...turn,interactionId:'recorded-verification'});
  const renderings=[false,true].map(isCompact=>{
   const prompt=renderToStaticMarkup(<ChatMessageContent message={{id:'user',timestamp:'',sender:'user',text:turn.prompt}}/>);
   const conclusion=renderToStaticMarkup(<ChatMessageContent message={{id:'agent',timestamp:'',sender:'agent',text:turn.replyText,reasoningText:turn.reasoningText}}/>);
   const result=renderToStaticMarkup(<ThemeProvider>{view&&<GenerativeComponentRenderer view={view} isCompact={isCompact}/>}</ThemeProvider>);
   expect(prompt.length).toBeGreaterThan(20);expect(conclusion.length).toBeGreaterThan(20);expect(result.length,`requirement ${turn.requirementId}`).toBeGreaterThan(20);
   expect(result).not.toContain('暂不支持的');
   return {mode:isCompact?'floating-inline':'workbench',promptVisible:true,conclusionVisible:true,resultVisible:true,htmlSha256:createHash('sha256').update(prompt+conclusion+result).digest('hex')};
  });
  return {requirementId:turn.requirementId,runId:turn.runId,renderings};
 });
 writeFileSync(join(bundle!,'presentation-verification.json'),JSON.stringify({generatedAt:new Date().toISOString(),results},null,2));
});
