import Database from 'better-sqlite3';
import { createHash,randomUUID } from 'node:crypto';
import path from 'node:path';
import type { ExecutionContext } from '@/contracts/execution-context';
import type { AgentTurnResult,AgentInteraction } from '@/contracts/agent-interaction';
export function withBusinessDb<T>(operation:(db:Database.Database)=>T):T{
 const db=new Database(path.resolve(process.env.APP_BUSINESS_DB_PATH ?? path.join(process.cwd(),'app_business.db')));
 try{return operation(db);}finally{db.close();}
}
function ensureTraceTables(db:Database.Database){db.exec(`CREATE TABLE IF NOT EXISTS biz_agent_runs(run_id TEXT PRIMARY KEY,user_id TEXT NOT NULL,domain TEXT NOT NULL,interaction_json TEXT NOT NULL,result_json TEXT NOT NULL,created_at TEXT NOT NULL);CREATE TABLE IF NOT EXISTS biz_artifacts(artifact_id TEXT PRIMARY KEY,user_id TEXT NOT NULL,domain TEXT NOT NULL,city TEXT,district TEXT,file_name TEXT NOT NULL,mime_type TEXT NOT NULL,content BLOB NOT NULL,sha256 TEXT NOT NULL,source_json TEXT NOT NULL,created_at TEXT NOT NULL)`);}
export function recordAgentTurn(interaction:AgentInteraction,result:AgentTurnResult,ctx:ExecutionContext){return withBusinessDb(db=>{ensureTraceTables(db);db.prepare('INSERT OR REPLACE INTO biz_agent_runs VALUES(?,?,?,?,?,?)').run(ctx.runId,ctx.principal.userId,ctx.domain,JSON.stringify(interaction),JSON.stringify(result),new Date().toISOString());});}
export function getRecordedTurn(runId:string,ctx:ExecutionContext):{interaction:AgentInteraction;result:AgentTurnResult}{return withBusinessDb(db=>{ensureTraceTables(db);const row=db.prepare('SELECT * FROM biz_agent_runs WHERE run_id=? AND user_id=? AND domain=?').get(runId,ctx.principal.userId,ctx.domain) as any;if(!row)throw new Error('Recorded run not found or unauthorized');return {interaction:JSON.parse(row.interaction_json),result:JSON.parse(row.result_json)};});}
export function saveArtifact(input:{fileName:string;mimeType:string;content:Buffer;source:unknown;city?:string;district?:string},ctx:ExecutionContext){return withBusinessDb(db=>{
 ensureTraceTables(db);const id=randomUUID();const sha256=createHash('sha256').update(input.content).digest('hex');
 const fileName=Array.from(input.fileName).filter(char=>char.charCodeAt(0)>=32).join('').slice(0,160);if(!fileName)throw new Error('Invalid artifact filename');
 db.prepare('INSERT INTO biz_artifacts VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(id,ctx.principal.userId,ctx.domain,input.city ?? ctx.principal.jurisdiction.city ?? null,input.district ?? ctx.principal.jurisdiction.district ?? null,fileName,input.mimeType,input.content,sha256,JSON.stringify(input.source),new Date().toISOString());
 return {artifactId:id,fileName,mimeType:input.mimeType,byteLength:input.content.byteLength,sha256,downloadUrl:`/api/artifacts/${id}`};
 });}
export function getArtifact(id:string,ctx:ExecutionContext):{content:Buffer;file_name:string;mime_type:string}{return withBusinessDb(db=>{ensureTraceTables(db);const row=db.prepare('SELECT * FROM biz_artifacts WHERE artifact_id=? AND user_id=? AND domain=?').get(id,ctx.principal.userId,ctx.domain) as any;if(!row || (ctx.principal.jurisdiction.city && row.city!==ctx.principal.jurisdiction.city)||(ctx.principal.jurisdiction.district && row.district!==ctx.principal.jurisdiction.district))throw new Error('Artifact not found or unauthorized');if(createHash('sha256').update(row.content).digest('hex')!==row.sha256)throw new Error('Artifact integrity check failed');return row;});}
