'use client';
import React from 'react';
import {AnalyticsResultCard} from './AnalyticsResultCard';

/** Compatibility with saved legacy views; share the current evidence renderer. */
export const Icd10InferenceCard:React.FC<{data?:any}>=({data={}})=>{
 if(!data.parsedCertificate&&!data.inferredUnderlyingCause)return <div role="status" className="p-4 border rounded-xl">{data.message??'无可支持的编码候选，需人工复核'}</div>;
 return <AnalyticsResultCard data={{type:'ANALYTICS_RESULT',title:'死因文本与 ICD-10 编码复核',data}}/>;
};
