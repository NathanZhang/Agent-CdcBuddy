import type {Evidence,InteractionIntent,QuoteEvidence,SlotUpdate} from '@/contracts/interaction-intent';
import type {RegionSelection} from '@/contracts/region';
import {loadRegionCatalog} from '@/infrastructure/geo/region-catalog';

/** Do not feed stored server offsets back to the model as examples to imitate. */
export function quoteOnlyContext(value:unknown):unknown {
 if(Array.isArray(value))return value.map(quoteOnlyContext);
 if(!value||typeof value!=='object')return value;
 const object=value as Record<string,unknown>;
 if(object.source==='current'&&typeof object.quote==='string')return {source:'current',quote:object.quote};
 if(object.source==='context'&&object.cue)return {source:'context',contextRef:object.contextRef,cue:{quote:(object.cue as {quote:string}).quote}};
 return Object.fromEntries(Object.entries(object).map(([key,item])=>[key,quoteOnlyContext(item)]));
}

/** Anchor only schema-validated quotes; never accept the model's own offsets. */
export function anchorIntentEvidence(model:InteractionIntent<QuoteEvidence>,text:string):InteractionIntent {
 const anchor=<T>(slot:SlotUpdate<T,QuoteEvidence>,region=false):SlotUpdate<T>=>{
  const evidence=slot.evidence;
  const quote=evidence.source==='current'?evidence.quote:evidence.cue.quote;
  const start=text.indexOf(quote);
  if(!quote||start<0)throw Error('INTENT_EVIDENCE_INVALID');
  if(text.indexOf(quote,start+1)>=0){
   // A repeated place may be anchored deterministically only if it refers to
   // the same unique catalog identity, with no exclusions or context relation.
   const selection=slot.op==='set'&&region?slot.value as RegionSelection:undefined;
   const matches=loadRegionCatalog().regions.filter(r=>r.aliases.includes(quote));
   if(evidence.source!=='current'||!selection||selection.relation||selection.includeCandidateIds.length!==1||selection.excludeCandidateIds.length||matches.length!==1||matches[0].code!==selection.includeCandidateIds[0]){
    throw Error(`INTENT_EVIDENCE_AMBIGUOUS: 引用${JSON.stringify(quote)}在原文重复，请引用包含周边词的唯一完整短语，不要计算或提供字符位置`);
   }
  }
  const span={quote,start,end:start+quote.length};
  const anchored:Evidence=evidence.source==='current'?{source:'current',...span}:{source:'context',contextRef:evidence.contextRef,cue:span};
  return {...slot,evidence:anchored};
 };
 const filters=(value:InteractionIntent<QuoteEvidence>['filters'])=>Object.fromEntries(Object.entries(value).map(([key,slot])=>[key,anchor(slot)]));
 return {...model,
  displayRegion:anchor(model.displayRegion,true),dataRegion:anchor(model.dataRegion,true),time:anchor(model.time),filters:filters(model.filters),
  layerRequests:model.layerRequests.map(({dataRegion,time,filters:layerFilters,...layer})=>({...layer,...(dataRegion?{dataRegion:anchor(dataRegion,true)}:{}),...(time?{time:anchor(time)}:{}),...(layerFilters?{filters:filters(layerFilters)}:{})})),
 };
}
