/** Tiny hand-built source for the observed-policy branch, never efficacy evidence. */
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import {readDatasetLocations} from '@/infrastructure/db/dataset-manifest';
import {loadDatasetRegionBindings} from '@/infrastructure/geo/dataset-region-bindings';
export function observedWorkflowFixture(directory:string):()=>void {
 const previous=process.env.DATASET_MANIFEST_PATH;
 const previousBindings=process.env.DATASET_REGION_BINDINGS_PATH;
 const rows=readDatasetLocations();const source=rows.find(r=>r.domain==='vector')!;
 const file=path.join(directory,'observed-contract.db'),manifest=path.join(directory,'observed-contract.json');
 const db=new Database(file);
 try{db.exec(fs.readFileSync(path.join(process.cwd(),'analytics_engine/mock_schemas/vector.sql'),'utf8'));
  db.exec("INSERT INTO dim_location(location_id,province,city,district,street,latitude,longitude) VALUES('l','河南省','郑州市','金水区','Observed-policy contract fixture',34.8,113.7);INSERT INTO dim_species VALUES('s','蚊','白纹伊蚊','test');INSERT INTO dim_method VALUES('m','诱蚊灯法');INSERT INTO dim_date VALUES('2024-06-15',2024,6,15,'夏');INSERT INTO fact_monitoring(monitoring_id,date_id,location_id,species_id,method_id,capture_count,sampling_unit) VALUES('f','2024-06-15','l','s','m',5,1);");
 }finally{db.close();}
 fs.writeFileSync(manifest,JSON.stringify(rows.map(row=>({...row,path:path.resolve(path.dirname(previous??path.join(process.cwd(),'config/datasets.json')),row.path),...(row.domain==='vector'?{origin:'observed',path:file}: {})}))));
 process.env.DATASET_MANIFEST_PATH=manifest;
 const bindings=Object.fromEntries(rows.map(row=>[row.domain,loadDatasetRegionBindings(row.domain,row.version)]));
 bindings.vector={...bindings.vector,mappingVersion:'isolated-observed-policy-v1',regions:[{code:'410000'},{code:'410100',city:'郑州市'},{code:'410105',city:'郑州市',district:'金水区'}]};
 const bindingFile=path.join(directory,'bindings.json');fs.writeFileSync(bindingFile,JSON.stringify(bindings));
 process.env.DATASET_REGION_BINDINGS_PATH=bindingFile;
 // The version and source spellings remain the existing binding fixture's;
 // the test source itself is entirely isolated from demo/observed deployments.
 if(!source)throw Error('Missing vector fixture metadata');
 return ()=>{if(previous===undefined)delete process.env.DATASET_MANIFEST_PATH;else process.env.DATASET_MANIFEST_PATH=previous;if(previousBindings===undefined)delete process.env.DATASET_REGION_BINDINGS_PATH;else process.env.DATASET_REGION_BINDINGS_PATH=previousBindings;};
}
