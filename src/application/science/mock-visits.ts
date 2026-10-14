import Database from 'better-sqlite3';
import type {DatasetRef} from '@/contracts/dataset';
import type {ExecutionContext} from '@/contracts/execution-context';
import {resolveDatasetLocation} from '@/infrastructure/db/dataset-manifest';
import {acquireDatasetLease,mockMarker} from '@/infrastructure/db/dataset-policy';
/** Explicit native Mock visits only. Observed/legacy sampling_unit is never inferred. */
export function explicitMockVisits(dataset:DatasetRef,ctx:ExecutionContext,recordIds:string[]):Map<string,any>{
 if(dataset.origin!=='mock'||!recordIds.length)return new Map();const location=resolveDatasetLocation('vector',dataset.id),release=acquireDatasetLease(location,ctx.deploymentTier);
 try{if(!mockMarker(location.path))return new Map();const db=new Database(location.path,{readonly:true,fileMustExist:true});try{
  if(!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='mock_scientific_visits'").get())return new Map();
  const result=new Map<string,any>();for(let i=0;i<recordIds.length;i+=500){const ids=recordIds.slice(i,i+500);for(const r of db.prepare('SELECT * FROM mock_scientific_visits WHERE monitoring_id IN ('+ids.map(()=>'?').join(',')+')').all(...ids) as any[])result.set(r.monitoring_id,r);}return result;
 }finally{db.close();}}finally{release();}
}
