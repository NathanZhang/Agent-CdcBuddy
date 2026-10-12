import {randomUUID} from 'node:crypto';import {runWorkerTick} from '@/application/jobs/worker-service';
const owner=randomUUID();let stopping=false;process.on('SIGTERM',()=>{stopping=true;});process.on('SIGINT',()=>{stopping=true;});
async function main(){do{try{console.log(JSON.stringify(await runWorkerTick(owner)));}catch(e){console.error(e instanceof Error?e.message:'Worker failed');process.exitCode=1;if(process.argv.includes('--once'))break;}if(process.argv.includes('--once'))break;await new Promise(resolve=>setTimeout(resolve,2000));}while(!stopping);}
void main();
