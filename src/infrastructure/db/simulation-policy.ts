import fs from 'node:fs';
import path from 'node:path';
import type {DatasetRef} from '@/contracts/dataset';
/** Explicit acceptance sandbox only. Never enable it against the normal business DB. */
export function isolatedSimulationSources(refs:DatasetRef[]|undefined):boolean {
 if(process.env.DEPLOYMENT_TIER!=='demo'||!process.env.CDC_SIMULATION_CONFIG||!process.env.APP_BUSINESS_DB_PATH||!process.env.DATASET_MANIFEST_PATH||!refs?.length)return false;
 try{
  const configPath=fs.realpathSync(process.env.CDC_SIMULATION_CONFIG),root=path.dirname(configPath);
  const config=JSON.parse(fs.readFileSync(configPath,'utf8'));
  const manifestPath=fs.realpathSync(process.env.DATASET_MANIFEST_PATH),businessPath=path.join(fs.realpathSync(path.dirname(path.resolve(process.env.APP_BUSINESS_DB_PATH))),path.basename(process.env.APP_BUSINESS_DB_PATH));
  if(config.purpose!=='requirement-acceptance-simulation'||config.manifestPath!==manifestPath||config.businessPath!==businessPath||path.dirname(manifestPath)!==root||path.dirname(businessPath)!==root||path.basename(businessPath)!=='simulation-business.db')return false;
  if(fs.existsSync(businessPath)&&(fs.lstatSync(businessPath).isSymbolicLink()||fs.statSync(businessPath).nlink!==1))return false;
  const sources=JSON.parse(fs.readFileSync(manifestPath,'utf8')) as (DatasetRef&{path:string})[];
  if(sources.length!==4||sources.some(s=>s.origin!=='mock'||path.dirname(fs.realpathSync(s.path))!==root||(process.env[`DATASET_${s.domain.toUpperCase()}_PATH`]&&fs.realpathSync(path.resolve(root,process.env[`DATASET_${s.domain.toUpperCase()}_PATH`]!))!==fs.realpathSync(s.path))))return false;
  return refs.every(ref=>ref.origin==='mock'&&sources.some(({path:_path,...source})=>(['id','domain','origin','version','schemaVersion','asOf'] as const).every(key=>source[key]===ref[key])));
 }catch{return false;}
}
