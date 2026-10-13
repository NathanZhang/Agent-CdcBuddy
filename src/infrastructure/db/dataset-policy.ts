import fs from 'node:fs';
import path from 'node:path';
import {hostname} from 'node:os';
import {createHash,randomUUID} from 'node:crypto';
import Database from 'better-sqlite3';
import type {DatasetRef} from '@/contracts/dataset';
import type {DeploymentTier} from '@/contracts/execution-context';
import {getDeploymentTier} from '@/application/config/deployment-tier';

export class DatasetPolicyError extends Error {
  constructor(readonly code:string,message:string){super(message);this.name='DatasetPolicyError';}
}
export function formalRuntime(tier?:DeploymentTier):boolean{return tier==='pilot'||getDeploymentTier()==='pilot'||process.env.NODE_ENV==='production'&&getDeploymentTier()!=='demo';}
const deny=(code:string,message:string):never=>{throw new DatasetPolicyError(code,message);};
interface Marker {datasetId:string;origin:'mock';purpose:'simulation';path:string;registryPath:string;domain:string;}
export function mockMarker(file:string):Marker|undefined {
  if(!fs.existsSync(file))return;
  const db=new Database(file,{readonly:true,fileMustExist:true});
  try{
    if(!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='_cdc_mock_provenance'").get())return;
    const rows=db.prepare('SELECT metadata_json FROM _cdc_mock_provenance').all() as {metadata_json:string}[];
    if(rows.length!==1)deny('MOCK_PROVENANCE_INVALID','模拟数据来源标记无效');
    const marker=JSON.parse(rows[0].metadata_json);
    if(marker.origin!=='mock'||marker.purpose!=='simulation'||typeof marker.registryPath!=='string'||typeof marker.datasetId!=='string')deny('MOCK_PROVENANCE_INVALID','模拟数据来源标记无效');
    return marker;
  }finally{db.close();}
}
export function assertDatasetReadable(dataset:DatasetRef&{path:string},tier?:DeploymentTier):void {
  if(dataset.origin==='mock'&&formalRuntime(tier))deny('MOCK_PRODUCTION_FORBIDDEN','正式运行禁止读取模拟数据，请配置真实来源');
  const marker=mockMarker(dataset.path);
  if(marker&&dataset.origin!=='mock')deny('MOCK_ORIGIN_MISMATCH','生成的模拟快照不能改标为真实来源');
  if(marker&&formalRuntime(tier))deny('MOCK_PRODUCTION_FORBIDDEN','正式运行禁止读取模拟数据');
}
export function assertResultSources(refs:DatasetRef[]|undefined,tier?:DeploymentTier,requireObserved=false):void {
  if(!formalRuntime(tier)&&!requireObserved)return;
  if(!Array.isArray(refs)||!refs.length||refs.some(r=>!r||r.origin!=='observed'||!r.id||!r.version||!r.domain||!r.schemaVersion||!r.asOf))deny('MOCK_BUSINESS_FORBIDDEN','正式业务只接受带有完整真实来源的证据；模拟或来源不明的结果不能继续处理');
}
export function acquireDatasetLease(dataset:DatasetRef&{path:string},tier?:DeploymentTier):()=>void {
  assertDatasetReadable(dataset,tier);
  const marker=mockMarker(dataset.path);
  if(!marker)return ()=>{};
  if(!fs.existsSync(marker.registryPath)||fs.lstatSync(marker.registryPath).isSymbolicLink())deny('MOCK_REGISTRY_REQUIRED','模拟快照登记不存在');
  const leaseId=randomUUID();
  const connect=()=>new Database(marker.registryPath,{fileMustExist:true,timeout:10000});
  const db=connect();
  try{db.transaction(()=>{
    const row=db.prepare('SELECT *,CAST(root_dev AS TEXT) exact_root_dev,CAST(root_ino AS TEXT) exact_root_ino,CAST(file_dev AS TEXT) exact_file_dev,CAST(file_ino AS TEXT) exact_file_ino FROM mock_datasets WHERE dataset_id=?').get(marker.datasetId) as any;
    if(!row||row.status!=='READY'||row.expires_at<=Date.now())deny('MOCK_DATASET_INACTIVE','模拟快照已停用或过期');
    if(fs.realpathSync(dataset.path)!==row.path||fs.lstatSync(dataset.path).isSymbolicLink())deny('MOCK_PATH_UNSAFE','模拟快照路径与登记不一致');
    for(let parent=path.dirname(row.path);;parent=path.dirname(parent)){if(fs.lstatSync(parent).isSymbolicLink())deny('MOCK_PATH_UNSAFE','模拟快照目录含符号链接');if(parent===path.dirname(parent))break;}
    const root=fs.statSync(path.dirname(row.path),{bigint:true}),file=fs.statSync(row.path,{bigint:true});
    if(file.nlink!==1n||!file.isFile()||root.dev.toString()!==row.exact_root_dev||root.ino.toString()!==row.exact_root_ino||file.dev.toString()!==row.exact_file_dev||file.ino.toString()!==row.exact_file_ino)deny('MOCK_FILE_IDENTITY_CHANGED','模拟快照文件身份已变化');
    if(JSON.stringify(JSON.parse(row.metadata_json))!==JSON.stringify(marker)||createHash('sha256').update(fs.readFileSync(row.path)).digest('hex')!==row.sha256)deny('MOCK_CONTENT_CHANGED','模拟快照来源或内容校验失败');
    const columns=db.prepare('PRAGMA table_info(mock_leases)').all() as {name:string}[];
    if(columns.some(c=>c.name==='owner_pid'))db.prepare('INSERT INTO mock_leases VALUES(?,?,?,?,?)').run(leaseId,marker.datasetId,Date.now()+120000,process.pid,hostname());
    else db.prepare('INSERT INTO mock_leases VALUES(?,?,?)').run(leaseId,marker.datasetId,Date.now()+120000);
  }).immediate();}finally{db.close();}
  const timer=setInterval(()=>{const connection=connect();try{connection.prepare('UPDATE mock_leases SET expires_at=? WHERE lease_id=?').run(Date.now()+120000,leaseId);}finally{connection.close();}},20000);timer.unref();
  let released=false;
  return ()=>{if(released)return;released=true;clearInterval(timer);const connection=connect();try{connection.prepare('DELETE FROM mock_leases WHERE lease_id=?').run(leaseId);}finally{connection.close();}};
}
