import {beforeAll,afterAll,it,expect} from 'vitest';
import {mkdtempSync,realpathSync,readFileSync,writeFileSync,rmSync,symlinkSync} from 'node:fs';
import {join} from 'node:path';import {tmpdir} from 'node:os';import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {demoEnvironment}=require('../../scripts/start-requirement-demo.cjs');
const root=mkdtempSync(join(tmpdir(),'cdc-mock-startup-')),bundle=join(root,'bundle');
beforeAll(()=>{execFileSync('./.venv/bin/python',['scripts/seed-requirement-acceptance.py','--output-dir',bundle],{stdio:'pipe'});},30000);
afterAll(()=>rmSync(root,{recursive:true,force:true}));
it('pins all four facts and business writes to the bundle even with inherited production overrides',()=>{
 const env=demoEnvironment('vector',bundle,{DATASET_VECTOR_PATH:'/real/vector.db',APP_BUSINESS_DB_PATH:'/real/business.db',DEPLOYMENT_TIER:'pilot'});
 expect(env.PORT).toBe('3101');expect(env.DEPLOYMENT_TIER).toBe('demo');expect(env.APP_BUSINESS_DB_PATH).toBe(join(realpathSync(bundle),'simulation-business.db'));
 for(const d of ['vector','foodborne','env','chronic'])expect(env['DATASET_'+d.toUpperCase()+'_PATH']).toBe(join(realpathSync(bundle),d+'.db'));
 expect(env.NEXT_BUILD_DIR).toBe('.next_acceptance_vector');
});
it('refuses relabelled sources, paths outside the bundle and business symlinks',()=>{
 const manifest=join(bundle,'manifest.json'),original=readFileSync(manifest,'utf8'),rows=JSON.parse(original);
 try{rows[0].origin='observed';writeFileSync(manifest,JSON.stringify(rows));expect(()=>demoEnvironment('vector',bundle)).toThrow('四域Mock');}finally{writeFileSync(manifest,original);}
 const config=join(bundle,'simulation.json'),old=readFileSync(config,'utf8');
 try{writeFileSync(config,JSON.stringify({...JSON.parse(old),businessPath:'/real/business.db'}));expect(()=>demoEnvironment('vector',bundle)).toThrow('独立来源和业务库');}finally{writeFileSync(config,old);}
 const outside=join(root,'outside.db'),business=join(bundle,'simulation-business.db');writeFileSync(outside,'untouched');symlinkSync(outside,business);
 try{expect(()=>demoEnvironment('vector',bundle)).toThrow('链接');expect(readFileSync(outside,'utf8')).toBe('untouched');}finally{rmSync(business);}
});
it('validates lifecycle and migrates only the isolated business database',()=>{
 const output=execFileSync('node',['scripts/start-requirement-demo.cjs','vector',bundle,'--check'],{encoding:'utf8'});
 expect(output).toContain('隔离与生命周期检查通过');
});
