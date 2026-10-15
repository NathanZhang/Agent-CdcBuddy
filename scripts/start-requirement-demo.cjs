// One supervisor for isolated acceptance web + worker; normal source configuration is untouched.
const fs=require('node:fs'),path=require('node:path'),{spawn,spawnSync}=require('node:child_process');
const domains=['vector','foodborne','env','chronic'];
function demoEnvironment(domain,directory,parent=process.env){
 if(!domains.includes(domain))throw Error('未知智能体领域');
 const bundle=fs.realpathSync(directory),configPath=path.join(bundle,'simulation.json');
 const config=JSON.parse(fs.readFileSync(configPath,'utf8'));
 const manifest=path.join(bundle,'manifest.json'),business=path.join(bundle,'simulation-business.db');
 if(config.purpose!=='requirement-acceptance-simulation'||config.manifestPath!==manifest||config.businessPath!==business)throw Error('Mock验收配置必须使用包内独立来源和业务库');
 for(const file of [manifest,path.join(bundle,'region-bindings.json'),configPath,business]){
  if(fs.existsSync(file)&&(fs.lstatSync(file).isSymbolicLink()||fs.statSync(file).nlink!==1))throw Error('Mock验收文件不能使用符号链接或硬链接');
 }
 const sources=JSON.parse(fs.readFileSync(manifest,'utf8'));
 if(sources.length!==4||new Set(sources.map(s=>s.domain)).size!==4||sources.some(s=>!domains.includes(s.domain)||s.origin!=='mock'||path.dirname(fs.realpathSync(s.path))!==bundle||fs.lstatSync(s.path).isSymbolicLink()||fs.statSync(s.path).nlink!==1))throw Error('完整Mock验收必须使用包内四域Mock来源');
 const port=3101+domains.indexOf(domain);
 const env={...parent,DEPLOYMENT_TIER:'demo',AGENT_DOMAIN:domain,NEXT_PUBLIC_AGENT_DOMAIN:domain,DATASET_MANIFEST_PATH:manifest,DATASET_REGION_BINDINGS_PATH:path.join(bundle,'region-bindings.json'),CDC_SIMULATION_CONFIG:configPath,APP_BUSINESS_DB_PATH:business,NEXT_BUILD_DIR:'.next_acceptance_'+domain,APP_ORIGIN:'http://localhost:'+port,PORT:String(port)};
 // Explicit values prevent .env.local from reintroducing normal source overrides.
 for(const source of sources)env['DATASET_'+source.domain.toUpperCase()+'_PATH']=fs.realpathSync(source.path);
 return env;
}
async function main(){
 require('@next/env').loadEnvConfig(process.cwd());
 const domain=process.argv[2]||'vector';
 const env=demoEnvironment(domain,process.argv[3]||'.mock-data/requirement-demo');
 Object.assign(process.env,env);
 require('./register-runtime.cjs');
 const {resolveDatasetLocation}=require('../src/infrastructure/db/dataset-manifest.ts');
 const {mockMarker}=require('../src/infrastructure/db/dataset-policy.ts');
 for(const d of domains){const source=resolveDatasetLocation(d);if(!mockMarker(source.path))throw Error('缺少Mock来源标记，拒绝启动');}
 const migration=spawnSync(process.execPath,['scripts/migrate.cjs'],{env,stdio:'inherit'});
 if(migration.status!==0)throw Error('Mock业务库迁移失败');
 if(process.argv.includes('--check')){console.log('四域Mock隔离与生命周期检查通过');return;}
 const children=[];let stopping=false;
 function stop(code=0){
  if(stopping)return;stopping=true;process.exitCode=code;
  for(const child of children)if(child.exitCode===null)child.kill('SIGTERM');
  const timer=setTimeout(()=>{for(const child of children)if(child.exitCode===null)child.kill('SIGKILL');},5000);timer.unref();
 }
 for(const args of [['node_modules/next/dist/bin/next','dev','-p',env.PORT],['scripts/job-worker.cjs']]){
  const child=spawn(process.execPath,args,{stdio:'inherit',env});children.push(child);
  child.on('error',error=>{console.error('Mock子进程启动失败：',error.message);stop(1);});
  child.on('exit',code=>{if(!stopping)stop(code||1);});
 }
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>stop());
 console.log(`Mock验收模式：${domain}，端口${env.PORT}；后台任务Worker已启动，所有写入使用独立业务库。`);
}
module.exports={demoEnvironment};
if(require.main===module)main().catch(error=>{console.error('Mock验收启动失败：'+error.message);process.exitCode=1;});
