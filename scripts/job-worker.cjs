require('./register-runtime.cjs');const {randomUUID}=require('node:crypto');const {runWorkerTick}=require('../src/application/jobs/worker-service.ts');
const owner=randomUUID();let stopping=false;process.on('SIGTERM',()=>{stopping=true;});process.on('SIGINT',()=>{stopping=true;});
(async()=>{do{try{console.log(JSON.stringify(await runWorkerTick(owner)));}catch(e){console.error(e.message);process.exitCode=1;if(process.argv.includes('--once'))break;}if(process.argv.includes('--once'))break;await new Promise(r=>setTimeout(r,2000));}while(!stopping);})();
