import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
const testBusinessPath=process.env.APP_BUSINESS_DB_PATH??join(tmpdir(),`cdcbuddy-refactor-${randomUUID()}.db`);
if(!process.env.APP_BUSINESS_DB_PATH)process.once('exit',()=>{for(const suffix of ['', '-wal', '-shm', '-journal'])rmSync(testBusinessPath+suffix,{force:true});});
export default defineConfig({ test: { env:{APP_BUSINESS_DB_PATH:testBusinessPath}, include: ['tests/refactor/**/*.test.{ts,tsx}'], environment: 'node', maxWorkers:2, testTimeout:20000 }, resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } } });
