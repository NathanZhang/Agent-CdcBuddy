import {spawnSync} from 'node:child_process';
const child=spawnSync(process.execPath,['node_modules/vite-node/vite-node.mjs','--config','vitest.config.ts','scripts/evaluate-region-intent.ts',...process.argv.slice(2)],{stdio:'inherit'});
process.exit(child.status??1);
