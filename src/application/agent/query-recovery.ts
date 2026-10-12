import { Parser } from 'node-sql-parser';
import type { SkillRun } from '@/contracts/agent-interaction';
import { normalizeProvinceCity } from '@/domains/shared/skill-factory';
import { mapPoints, type MapSpec } from '@/lib/geo/result-map';

const parser=new Parser();
const stable=(value:unknown)=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item);

/** Conservative proof: the same tables and filters, ignoring table alias spelling.
 * If invalid SQL cannot be parsed, retain the failure rather than claiming recovery.
 */
function queryScope(sql:unknown):string|undefined {
 if(typeof sql!=='string')return;
 try {
  const parsed=parser.astify(sql,{database:'SQLite'});
  const ast=(Array.isArray(parsed)?parsed[0]:parsed) as any;
  if(!ast||!Array.isArray(ast.from))return;
  const aliases=new Map<string,string>(ast.from.map((table:any)=>[table.as??table.table,table.table]));
  const normalize=(node:any):any=>{
   if(!node||typeof node!=='object')return node;
   if(Array.isArray(node))return node.map(normalize);
   return Object.fromEntries(Object.entries(node).map(([key,value])=>[key,key==='table'&&node.type==='column_ref'?aliases.get(String(value))??value:normalize(value)]));
  };
  return stable({tables:ast.from.map((table:any)=>table.table).sort(),where:normalize(ast.where),joins:ast.from.slice(1).map((table:any)=>normalize(table.on))});
 }catch {return;}
}

export function isCorrectedMapQuery(failed:SkillRun,later:SkillRun):boolean {
 if(failed.result.error?.code!=='EXECUTION_FAILED'||failed.result.method!=='bounded-domain-query-v1'||later.skillId!==failed.skillId||later.result.status!=='SUCCESS')return false;
 const spec=failed.args.visualization as MapSpec|undefined;
 if(spec?.kind!=='map'||stable(later.args.visualization)!==stable(spec))return false;
 if(normalizeProvinceCity(later.args.city as string|undefined)!==normalizeProvinceCity(failed.args.city as string|undefined)||!['district','from','to'].every(key=>later.args[key]===failed.args[key]))return false;
 const scope=queryScope(failed.args.sql);
 if(!scope||scope!==queryScope(later.args.sql))return false;
 const payload=later.result.payload as {data?:Record<string,unknown>[]}|null;
 return Array.isArray(payload?.data)&&mapPoints(payload.data,spec).length>0;
}
