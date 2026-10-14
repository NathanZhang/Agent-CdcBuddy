// Start a dedicated acceptance instance without replacing normal dataset configuration.
const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const domain=process.argv[2]||'vector',domains=['vector','foodborne','env','chronic'];
if(!domains.includes(domain))throw Error('Usage: node scripts/start-requirement-demo.cjs vector|foodborne|env|chronic [bundle-directory]');
const bundle=fs.realpathSync(process.argv[3]||'.mock-data/requirement-demo');
const config=JSON.parse(fs.readFileSync(path.join(bundle,'simulation.json'),'utf8'));
if(config.purpose!=='requirement-acceptance-simulation')throw Error('Not an acceptance bundle');
const port=3101+domains.indexOf(domain);
const env={...process.env,DEPLOYMENT_TIER:'demo',AGENT_DOMAIN:domain,NEXT_PUBLIC_AGENT_DOMAIN:domain,DATASET_MANIFEST_PATH:config.manifestPath,DATASET_REGION_BINDINGS_PATH:path.join(bundle,'region-bindings.json'),CDC_SIMULATION_CONFIG:path.join(bundle,'simulation.json'),APP_BUSINESS_DB_PATH:config.businessPath,NEXT_BUILD_DIR:'.next_acceptance_'+domain,APP_ORIGIN:'http://localhost:'+port};
for(const key of Object.keys(env))if(/^DATASET_(VECTOR|FOODBORNE|ENV|CHRONIC)_PATH$/.test(key))delete env[key];
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','-p',String(port)],{stdio:'inherit',env});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
child.on('exit',code=>{process.exitCode=code??0;});
