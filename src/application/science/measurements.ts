import {explicitMockVisits} from './mock-visits';
import {randomUUID} from 'node:crypto';
import type {ExecutionContext} from '@/contracts/execution-context';
import type {DatasetRef} from '@/contracts/dataset';
import {EFFORT_UNITS,type EffortUnit,type MeasurementRecord,type Measurements} from '@/contracts/scientific-artifact';
import {scopeFromArgs} from '@/domains/shared/skill-factory';
import {getDomainRepository} from '@/infrastructure/db/domain-repository';
import {loadDatasetManifest} from '@/infrastructure/db/dataset-manifest';
import {withBusinessDb} from '@/infrastructure/db/business-store';
import {scientificHash} from './artifact-store';
export function stableLocationKey(datasetId:string,sourceLocationId:string):string{if(!datasetId||!sourceLocationId)throw Error('LOCATION_ID_REQUIRED');return `location:${encodeURIComponent(datasetId)}:${encodeURIComponent(sourceLocationId)}`;}

function vectorDataset(ctx:ExecutionContext):DatasetRef{if(ctx.domain!=='vector')throw Error('FORBIDDEN_MEASUREMENT_DOMAIN');return loadDatasetManifest().find(d=>d.domain==='vector')!;}
export function loadMeasurementRows(args:Record<string,any>,ctx:ExecutionContext,maxRecords=10000):{dataset:DatasetRef;measurements:Measurements}{
 const dataset=vectorDataset(ctx);const scope={...scopeFromArgs(args,ctx),maxRows:1000};const repo=getDomainRepository('vector');
 const total=Number(repo.query('SELECT COUNT(*) AS n FROM fact_monitoring',[],scope)[0]?.n??0);
 if(!Number.isSafeInteger(maxRecords)||maxRecords<1||maxRecords>50000)throw Error('MEASUREMENT_BUDGET_INVALID');
 const rows:Record<string,any>[]=[];let cursor='';
 while(rows.length<Math.min(total,maxRecords)){
  ctx.signal?.throwIfAborted();if(ctx.deadlineAt&&Date.now()>ctx.deadlineAt)throw Error('MEASUREMENT_DEADLINE');
  const page=repo.readMonitoringRecords({afterId:cursor,limit:Math.min(1000,maxRecords-rows.length)},scope);
  if(!page.length)break;rows.push(...page);cursor=String(page.at(-1)!.recordId);
 }
 if(total<rows.length)throw Error('MEASUREMENT_SNAPSHOT_CHANGED');
 const bindings=withBusinessDb(db=>db.prepare('SELECT r.monitoring_id,e.* FROM biz_sampling_event_records r JOIN biz_sampling_events e ON r.event_id=e.event_id WHERE r.dataset_id=? AND r.dataset_version=? AND r.organization_id=?').all(dataset.id,dataset.version,ctx.principal.organizationId)) as any[];
 const byRecord=new Map(bindings.map(b=>[b.monitoring_id,b]));
 const nativeVisits=explicitMockVisits(dataset,ctx,rows.map(r=>r.recordId));
 const records=rows.map(r=>{
  const key=stableLocationKey(dataset.id,r.sourceLocationId);const binding=byRecord.get(r.recordId);
  const {latitude:_,longitude:__,...legacyRecord}=r;
  if(binding&&![scientificHash(r),scientificHash(legacyRecord)].includes(JSON.parse(binding.record_hashes_json)[r.recordId]))throw Error('MEASUREMENT_SOURCE_CHANGED');
  const finite=(v:any)=>typeof v==='number'&&Number.isFinite(v)&&v>=0?v:null;
  const native=nativeVisits.get(r.recordId);if(native&&(native.location_id!==r.sourceLocationId||native.method_id!==r.methodId||native.sampled_on!==r.date||!native.evidence||!EFFORT_UNITS.includes(native.effort_unit)||!Number.isFinite(native.effort_value)||native.effort_value<=0))throw Error('MOCK_VISIT_METADATA_INVALID');
  return {...r,locationKey:key,captureCount:finite(r.captureCount),legacySamplingUnit:finite(r.legacySamplingUnit),visitId:binding?.event_id??(native?`mock-visit:${dataset.id}:${dataset.version}:${native.visit_id}`:null),effortValue:binding?.effort_value??native?.effort_value??null,effortUnit:binding?.effort_unit??native?.effort_unit??null} as MeasurementRecord;
 });
 return {dataset,measurements:{records,matchedRecords:total,complete:rows.length===total}};
}
export function registerSamplingEvent(args:Record<string,any>,ctx:ExecutionContext){
 if(!EFFORT_UNITS.includes(args.effortUnit as EffortUnit)||!Number.isFinite(args.effortValue)||args.effortValue<=0||!args.evidence?.trim()||!args.sourceEventKey?.trim())throw Error('SAMPLING_EVENT_INVALID');
 const ids=args.recordIds as string[];if(!Array.isArray(ids)||!ids.length||ids.length>1000||new Set(ids).size!==ids.length)throw Error('SAMPLING_RECORDS_INVALID');
 const dataset=vectorDataset(ctx);const scope=scopeFromArgs(args,ctx);const raw=getDomainRepository('vector').readMonitoringRecords({recordIds:ids,limit:1000},scope) as Record<string,any>[];
 if(raw.length!==ids.length)throw Error('FORBIDDEN_SAMPLING_RECORDS');
 const first=raw[0];if(raw.some(r=>r.sourceLocationId!==first.sourceLocationId||r.methodId!==first.methodId||r.date!==first.date))throw Error('SAMPLING_VISIT_CONFLICT');
 const hashes=Object.fromEntries(raw.map(r=>[r.recordId,scientificHash(r)]));const key=stableLocationKey(dataset.id,first.sourceLocationId);
 const value={locationKey:key,methodId:first.methodId,date:first.date,effortValue:args.effortValue,effortUnit:args.effortUnit,evidence:args.evidence,hashes};
 return withBusinessDb(db=>db.transaction(()=>{
  const existing=db.prepare('SELECT * FROM biz_sampling_events WHERE dataset_id=? AND dataset_version=? AND organization_id=? AND source_event_key=?').get(dataset.id,dataset.version,ctx.principal.organizationId,args.sourceEventKey) as any;
  if(existing){const previous={locationKey:existing.location_key,methodId:existing.method_id,date:existing.sampled_on,effortValue:existing.effort_value,effortUnit:existing.effort_unit,evidence:existing.evidence,hashes:JSON.parse(existing.record_hashes_json)};const legacyHashes=Object.fromEntries(raw.map(({latitude:_,longitude:__,...r})=>[r.recordId,scientificHash(r)]));if(![scientificHash(value),scientificHash({...value,hashes:legacyHashes})].includes(scientificHash(previous)))throw Error('SAMPLING_IDEMPOTENCY_CONFLICT');return {eventId:existing.event_id,locationKey:key,recordCount:raw.length,reused:true};}
  const eventId=randomUUID();db.prepare('INSERT INTO biz_sampling_events VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(eventId,dataset.id,dataset.version,ctx.principal.organizationId,args.sourceEventKey,key,first.methodId,first.date,args.effortValue,args.effortUnit,args.evidence,JSON.stringify(hashes),ctx.principal.userId,Date.now());
  for(const id of ids)db.prepare('INSERT INTO biz_sampling_event_records VALUES(?,?,?,?,?)').run(dataset.id,dataset.version,ctx.principal.organizationId,id,eventId);
  return {eventId,locationKey:key,recordCount:raw.length,reused:false};
 }).immediate());
}
