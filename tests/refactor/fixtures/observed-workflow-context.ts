/** Tiny hand-built source for the observed-policy branch, never efficacy evidence. */
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import {readDatasetLocations} from '@/infrastructure/db/dataset-manifest';
export function observedWorkflowFixture(directory:string):()=>void {
 const previous=process.env.DATASET_MANIFEST_PATH;
 const rows=readDatasetLocations();const source=rows.find(r=>r.domain==='vector')!;
 const file=path.join(directory,'observed-contract.db'),manifest=path.join(directory,'observed-contract.json');
 const db=new Database(file);
 try{db.exec(fs.readFileSync(path.join(process.cwd(),'analytics_engine/mock_schemas/vector.sql'),'utf8'));
  db.exec("INSERT INTO dim_location(location_id,province,city,district,street,latitude,longitude) VALUES('l','河南省','郑州市','金水区','Observed-policy contract fixture',34.8,113.7);INSERT INTO dim_species VALUES('s','蚊','白纹伊蚊','test');INSERT INTO dim_method VALUES('m','诱蚊灯法');INSERT INTO dim_date VALUES('2024-06-15',2024,6,15,'夏');INSERT INTO fact_monitoring(monitoring_id,date_id,location_id,species_id,method_id,capture_count,sampling_unit) VALUES('f','2024-06-15','l','s','m',5,1);");
 }finally{db.close();}
 fs.writeFileSync(manifest,JSON.stringify(rows.map(row=>({...row,path:path.resolve(path.dirname(previous??path.join(process.cwd(),'config/datasets.json')),row.path),...(row.domain==='vector'?{origin:'observed',path:file}: {})}))));
 process.env.DATASET_MANIFEST_PATH=manifest;
 // The version and source spellings remain the existing binding fixture's;
 // the test source itself is entirely isolated from demo/observed deployments.
 if(!source)throw Error('Missing vector fixture metadata');
 return ()=>{if(previous===undefined)delete process.env.DATASET_MANIFEST_PATH;else process.env.DATASET_MANIFEST_PATH=previous;};
}
