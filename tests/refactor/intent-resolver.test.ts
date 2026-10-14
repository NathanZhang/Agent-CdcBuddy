import {expect,it} from 'vitest';
const input={text:'显示河南省地图',domain:'vector' as const,now:'2026-10-13',previous:null};
const intent={task:'map_display',relation:'new',displayRegion:{op:'set',value:{includeCandidateIds:['410000'],excludeCandidateIds:[]},evidence:{source:'current',quote:'河南省'}},dataRegion:{op:'clear',evidence:{source:'current',quote:'显示河南省地图'}},time:{op:'clear',evidence:{source:'current',quote:'显示河南省地图'}},filters:{},layerRequests:[],mapOperations:[],mapOptions:{basemap:'vec'}};
it('binds model-selected administrative candidates with verified original evidence',async()=>{const m=await import('@/application/agent/intent-resolver').catch(()=>null);expect(m).not.toBeNull();if(!m)return;const llm={complete:async()=>({role:'assistant' as const,content:JSON.stringify(intent)})};const result=await m.resolveInteractionIntent(input,llm);expect(result.status).toBe('RESOLVED');if(result.status==='RESOLVED')expect(result.intent.displayRegion.op).toBe('set');});
it('rejects invented evidence and valid codes unrelated to the quoted place',async()=>{const m=await import('@/application/agent/intent-resolver').catch(()=>null);expect(m).not.toBeNull();if(!m)return;for(const value of [{...intent,principal:{role:'PROVINCIAL_ADMIN'}},{...intent,displayRegion:{...intent.displayRegion,value:{includeCandidateIds:['410100'],excludeCandidateIds:[]}}},{...intent,time:{op:'inherit',contextRef:'fake',evidence:{source:'context',contextRef:'fake',cue:{quote:'显示'}}}}]){const result=await m.resolveInteractionIntent(input,{complete:async()=>({role:'assistant',content:JSON.stringify(value)})});expect(result.status).not.toBe('RESOLVED');}});
it('rejects a repeated candidate search as a recognition failure after one expansion',async()=>{const m=await import('@/application/agent/intent-resolver').catch(()=>null);expect(m).not.toBeNull();if(!m)return;let calls=0;const result=await m.resolveInteractionIntent({...input,text:'显示新郑地图'},{complete:async()=>{calls++;return {role:'assistant',content:JSON.stringify({regionSearch:[{mention:'新郑'}]})};}});expect(calls).toBe(2);expect(result).toMatchObject({status:'FAILED',error:{code:'INTENT_RECOGNITION_FAILED'},diagnostics:[{attempt:2,code:'INTENT_SEARCH_INVALID'}]});});

it('validates real calendar dates rather than allowing JavaScript date rollover',async()=>{const m=await import('@/application/agent/intent-resolver');const value={...intent,task:'data_query',time:{op:'set',value:{from:'2024-02-30',to:'2024-03-03'},evidence:{source:'current',quote:input.text}}};const r=await m.resolveInteractionIntent(input,{complete:async()=>({role:'assistant',content:JSON.stringify(value)})});expect(r.status).not.toBe('RESOLVED');});

it('anchors a unique exact user quote without asking the model for character offsets',async()=>{const m=await import('@/application/agent/intent-resolver');const result=await m.resolveInteractionIntent(input,{complete:async()=>({role:'assistant',content:JSON.stringify(intent)})});expect(result.status).toBe('RESOLVED');if(result.status==='RESOLVED')expect(result.intent.displayRegion.evidence).toEqual({source:'current',start:2,end:5,quote:'河南省'});});

it('rejects a model-added filter whose value has no evidence in the original request',async()=>{const m=await import('@/application/agent/intent-resolver');const value={...intent,task:'data_query',filters:{category:{op:'set',value:{field:'category',operator:'eq',values:['鼠']},evidence:{source:'current',quote:input.text}}}};const result=await m.resolveInteractionIntent(input,{complete:async()=>({role:'assistant',content:JSON.stringify(value)})});expect(result.status).not.toBe('RESOLVED');});
it('can anchor repeated geographic quotes only when every occurrence names the same unique catalog identity',async()=>{const m=await import('@/application/agent/intent-resolver');const text='洛阳地图与洛阳边界',evidence={source:'current',quote:text},value={...intent,displayRegion:{op:'set',value:{includeCandidateIds:['410300'],excludeCandidateIds:[]},evidence:{source:'current',quote:'洛阳'}},dataRegion:{op:'clear',evidence},time:{op:'clear',evidence}};expect((await m.resolveInteractionIntent({...input,text},{complete:async()=>({role:'assistant',content:JSON.stringify(value)})})).status).toBe('RESOLVED');});
it('uses the remaining request for an LLM semantic review before approving a valid draft',async()=>{const m=await import('@/application/agent/intent-resolver');let calls=0;const result=await m.resolveInteractionIntent(input,{complete:async request=>{calls++;return {role:'assistant',content:JSON.stringify(intent)};}});expect(result.status).toBe('RESOLVED');expect(calls).toBe(2);});
it('retains each rejection cause when invalid JSON and an invalid field exhaust recognition',async()=>{
 const {resolveInteractionIntent}=await import('@/application/agent/intent-resolver');let calls=0;
 const result=await resolveInteractionIntent(input,{complete:async()=>({role:'assistant',content:calls++===0?'incomplete':JSON.stringify({...intent,unsupported:true})})});
 expect(result).toMatchObject({status:'FAILED',error:{code:'INTENT_RECOGNITION_FAILED',message:expect.stringContaining('INTENT_SCHEMA_INVALID')},diagnostics:[{attempt:1,code:'INTENT_JSON_INVALID'},{attempt:2,code:'INTENT_SCHEMA_INVALID',message:expect.stringContaining('unsupported')}]});
});
it('does not approve an unreviewed draft when the mandatory semantic review is invalid',async()=>{
 const {resolveInteractionIntent}=await import('@/application/agent/intent-resolver');let calls=0;
 const result=await resolveInteractionIntent(input,{complete:async()=>({role:'assistant',content:calls++===0?JSON.stringify(intent):'{}'})});
 expect(result).toMatchObject({status:'FAILED',diagnostics:[{attempt:2,code:'INTENT_SCHEMA_INVALID'}]});
});
it('ignores legacy recognition failures rather than appending them as clarification context',async()=>{
 const {resolveInteractionIntent}=await import('@/application/agent/intent-resolver');const prompts:string[]=[];
 const result=await resolveInteractionIntent({...input,pending:{sessionId:'s',input:'旧的失败指令',questions:['本次请求识别失败，请重试原指令。'],revision:0,createdAt:Date.now(),expiresAt:Date.now()+10000}},{complete:async request=>{prompts.push(JSON.stringify(request.messages));return {role:'assistant',content:JSON.stringify(intent)};}});
 expect(result.status).toBe('RESOLVED');expect(prompts.every(p=>!p.includes('旧的失败指令'))).toBe(true);
});

it('rejects empty, invented or model-positioned evidence instead of trusting offsets',async()=>{
 const {resolveInteractionIntent}=await import('@/application/agent/intent-resolver');
 for(const evidence of [{source:'current',quote:''},{source:'current',quote:'不存在的地名'},{source:'current',quote:'河南省',start:2,end:5}]){
  const value={...intent,displayRegion:{...intent.displayRegion,evidence}};
  expect((await resolveInteractionIntent(input,{complete:async()=>({role:'assistant',content:JSON.stringify(value)})})).status).toBe('FAILED');
 }
});

it('anchors UTF-16 offsets in top-level and layer evidence and omits them from semantic review',async()=>{
 const {resolveInteractionIntent}=await import('@/application/agent/intent-resolver');
 const text='🦟显示河南省2024年蚊类监测点',evidence={source:'current',quote:text},clear={op:'clear',evidence};
 const dataRegion={op:'set',value:{includeCandidateIds:['410000'],excludeCandidateIds:[]},evidence:{source:'current',quote:'河南省'}};
 const time={op:'set',value:{from:'2024-01-01',to:'2024-12-31'},evidence:{source:'current',quote:'2024年'}};
 const filters={category:{op:'set',value:{field:'category',operator:'eq',values:['蚊']},evidence:{source:'current',quote:'蚊类'}}};
 const value={...intent,task:'map_with_data',displayRegion:dataRegion,dataRegion,time,filters,layerRequests:[{id:'points',skillId:'skill_monitoring_data_table',rendering:'points',dataRegion,time,filters}]};
 const prompts:string[]=[];
 const result=await resolveInteractionIntent({...input,text},{complete:async request=>{prompts.push(request.messages[0].content!);return {role:'assistant',content:JSON.stringify(value)};}});
 expect(result.status).toBe('RESOLVED');
 expect(prompts).toHaveLength(2);expect(prompts.every(prompt=>! /"(?:start|end)":/.test(prompt))).toBe(true);
 if(result.status==='RESOLVED'){
  for(const slot of [result.intent.displayRegion,result.intent.dataRegion,result.intent.time,...Object.values(result.intent.filters),result.intent.layerRequests[0].dataRegion!,result.intent.layerRequests[0].time!,...Object.values(result.intent.layerRequests[0].filters!)]){
   const evidence=slot.evidence;expect(evidence.source).toBe('current');
   if(evidence.source==='current'){expect(text.slice(evidence.start,evidence.end)).toBe(evidence.quote);expect(evidence.start).toBe(text.indexOf(evidence.quote));}
  }
  expect(result.intent.displayRegion.evidence).toMatchObject({start:4,end:7});
 }
});

it('anchors context cues and strips persisted offsets before sending context to the model',async()=>{
 const {resolveInteractionIntent}=await import('@/application/agent/intent-resolver');
 const {quoteOnlyContext}=await import('@/application/agent/intent-evidence');
 const text='继续查询',previous={revision:1,contextRef:'s:1',updatedAt:Date.now(),draft:{task:'data_query' as const,relation:'new' as const,displayRegion:null,dataRegion:{includeCodes:['410000'],excludeCodes:[],catalogVersion:'fixture'},time:null,filters:{},layerRequests:[],mapOperations:[],mapOptions:{basemap:'vec' as const}}};
 const clear={op:'clear',evidence:{source:'current',quote:text}};
 const value={...intent,task:'data_query',relation:'continue',displayRegion:clear,dataRegion:{op:'inherit',contextRef:'s:1',evidence:{source:'context',contextRef:'s:1',cue:{quote:'继续'}}},time:clear};
 const result=await resolveInteractionIntent({...input,text,previous},{complete:async()=>({role:'assistant',content:JSON.stringify(value)})});
 expect(result.status).toBe('RESOLVED');
 if(result.status==='RESOLVED'){
  expect(result.intent.dataRegion.evidence).toEqual({source:'context',contextRef:'s:1',cue:{quote:'继续',start:0,end:2}});
  expect(JSON.stringify(quoteOnlyContext({draft:{layerRequests:[result.intent.dataRegion]}}))).not.toMatch(/"(?:start|end)":/);
 }
});

it('rejects repeated filter fragments even when a model could have pointed to one occurrence',async()=>{
 const {resolveInteractionIntent}=await import('@/application/agent/intent-resolver');
 const text='查询诱蚊灯法蚊类',evidence={source:'current',quote:text},clear={op:'clear',evidence};
 const value={...intent,task:'data_query',displayRegion:clear,dataRegion:clear,time:clear,filters:{category:{op:'set',value:{field:'category',operator:'eq',values:['蚊']},evidence:{source:'current',quote:'蚊'}}}};
 const result=await resolveInteractionIntent({...input,text},{complete:async()=>({role:'assistant',content:JSON.stringify(value)})});
 expect(result).toMatchObject({status:'FAILED',diagnostics:[{code:'INTENT_EVIDENCE_AMBIGUOUS'},{code:'INTENT_EVIDENCE_AMBIGUOUS'}]});
});
