import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {expect,it,vi} from 'vitest';
import {mortalitySkill} from '@/domains/chronic/skills/mortality';
import Ajv from 'ajv';
import {MortalityCodingReview} from '@/components/ag-ui/MortalityCodingReview';
import {AnalyticsResultCard} from '@/components/ag-ui/AnalyticsResultCard';

vi.mock('@/features/workbench/use-workbench-controller',()=>({useFunctionalInteraction:()=>vi.fn()}));

it('renders the real runtime blocker and keeps human review separate from a final diagnosis',()=>{
 const html=renderToStaticMarkup(<MortalityCodingReview data={{inputDeathChain:{a:'呼吸衰竭',b:'肺癌',part2:'糖尿病'},engineResult:{selectionStatus:'ENGINE_NOT_CONFIGURED'},review:{autoFinalized:false}}}/>);
 expect(html).toContain('待接入 Iris/MUSE');expect(html).toContain('其他重要情况');expect(html).toContain('糖尿病');
 expect(html).toContain('未写入正式死因登记');expect(html).toContain('disabled');expect(html).not.toContain('98.2%');
});

it('displays a native candidate as pending review without inventing a fine-grained label',()=>{
 const html=renderToStaticMarkup(<AnalyticsResultCard data={{title:'死因复核',data:{method:'icd10-iris-mortality-v2',engineResult:{selectionStatus:'CANDIDATE_READY'},inferredUnderlyingCause:{standardIcd10:'C34.9',diseaseName:'支气管和肺恶性肿瘤'},review:{autoFinalized:false}}}}/>);
 expect(html).toContain('尚未签署');expect(html).toContain('C34.9');expect(html).toContain('三位类目名称');expect(html).not.toContain('98.2%');
});

it('accepts one explicit source and rejects mixed source identities and invented execution paths',()=>{
 const validator=new Ajv({strict:false}).compile(mortalitySkill.inputSchema!);
 const validateSkillInput=(_definition:any,args:any)=>{if(!validator(args))throw Error('Rejected input');};const definition=mortalitySkill;
 expect(()=>validateSkillInput(definition,{text:'a: 肺癌',demographics:{age:{value:68,unit:'Y'},sex:'1',mannerOfDeath:0}})).not.toThrow();
 for(const args of [{text:'肺癌',certId:'CERT-1'},{inputChain:{a:'肺癌'},text:'其他证明书'},{text:'肺癌',irisCommand:'arbitrary'},{text:'肺癌',demographics:{age:{value:68,unit:'INVALID'}}}])expect(()=>validateSkillInput(definition,args)).toThrow();
});
