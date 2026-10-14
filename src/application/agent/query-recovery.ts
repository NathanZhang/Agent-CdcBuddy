import { Parser } from 'node-sql-parser';
import type { SkillRun } from '@/contracts/agent-interaction';
import { normalizeProvinceCity } from '@/domains/shared/skill-factory';
import { mapPoints, type MapSpec } from '@/lib/geo/result-map';

const parser=new Parser();
const stable=(value:unknown)=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item);

/** Conservative proof: the same tables and filters, ignoring table alias spelling.
 * If invalid SQL cannot be parsed, retain the failure rather than claiming recovery.
 */
function queryScope(sql:unknown, repairedScope=false):string|undefined {
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
  return stable({tables:ast.from.map((table:any)=>table.table).sort(),where:repairedScope?undefined:normalize(ast.where),...(repairedScope?{columns:normalize(ast.columns),groupby:normalize(ast.groupby),distinct:ast.distinct,limit:ast.limit}:{}),joins:ast.from.slice(1).map((table:any)=>normalize(table.on))});
 }catch {return;}
}

function visualizationScope(args:Record<string,any>):string {
 try {
  const parsed=parser.astify(args.sql,{database:'SQLite'});const ast=(Array.isArray(parsed)?parsed[0]:parsed) as any;
  const columns=new Map<string,string>();for(const item of ast.columns??[])if(item.expr?.type==='column_ref')columns.set(item.as??item.expr.column,item.expr.column);
  return stable(Object.fromEntries(Object.entries(args.visualization??{}).map(([key,value])=>[key,key.endsWith('Key')&&typeof value==='string'?columns.get(value)??value:value])));
 }catch{return stable(args.visualization);}
}

export function isCorrectedSkillRun(failed:SkillRun,later:SkillRun):boolean {
 if(failed.result.error?.code==='EXECUTION_FAILED'&&failed.result.method==='bounded-domain-query-v1'&&later.skillId===failed.skillId&&later.result.status==='SUCCESS'&&typeof failed.args.sql==='string'&&typeof later.args.sql==='string'){
  // Quote-only Unicode identifier repairs preserve the exact query semantics.
  const quoteIdentifiers=(sql:string)=>sql.replace(/'(?:''|[^'])*'|"(?:""|[^"])*"|`[^`]*`|[\p{Script=Han}][\p{L}\p{N}_]*/gu,token=>/^[\p{Script=Han}]/u.test(token)?'"'+token+'"':token);
  try {
   const before=stable(parser.astify(quoteIdentifiers(failed.args.sql),{database:'SQLite'}));
   const after=stable(parser.astify(later.args.sql,{database:'SQLite'}));
   const extras=(args:Record<string,unknown>)=>Object.fromEntries(Object.entries(args).filter(([key])=>!['sql','query'].includes(key)));
   if(before===after&&stable(extras(failed.args))===stable(extras(later.args)))return true;
  }catch{/* A semantic repair without equivalent AST remains unresolved. */}
 }
 if(failed.result.error?.code==='SCOPE_MISMATCH'&&failed.result.method==='bounded-domain-query-v1'&&later.skillId===failed.skillId&&later.result.status==='SUCCESS'){
  const before=queryScope(failed.args.sql,true),after=queryScope(later.args.sql,true);
  return Boolean(before&&before===after&&visualizationScope(failed.args)===visualizationScope(later.args)&&['city','district','from','to','layerRequestId'].every(key=>failed.args[key]===later.args[key])&&Array.isArray((later.result.payload as any)?.data));
 }
 if(failed.result.error?.code==='SCOPE_MISMATCH'&&failed.result.method!=='bounded-domain-query-v1'&&later.skillId===failed.skillId&&later.result.method===failed.result.method&&later.result.status==='SUCCESS'){
  const bound=new Set(['city','district','from','to','asOf','year','month','category','speciesName','methodName','pathogenName','pesticideName','pathogen','pathogenType','diseaseName','basinName','pathogenId','clusterId']);
  const algorithm=(args:Record<string,unknown>)=>Object.fromEntries(Object.entries(args).filter(([key])=>!bound.has(key)));
  return stable(algorithm(failed.args))===stable(algorithm(later.args));
 }
 if(failed.result.error?.code!=='EXECUTION_FAILED'||failed.result.method!=='bounded-domain-query-v1'||later.skillId!==failed.skillId||later.result.status!=='SUCCESS')return false;
 const spec=failed.args.visualization as MapSpec|undefined;
 if(spec?.kind!=='map'||stable(later.args.visualization)!==stable(spec))return false;
 if(normalizeProvinceCity(later.args.city as string|undefined)!==normalizeProvinceCity(failed.args.city as string|undefined)||!['district','from','to'].every(key=>later.args[key]===failed.args[key]))return false;
 const scope=queryScope(failed.args.sql);
 if(!scope||scope!==queryScope(later.args.sql))return false;
 const payload=later.result.payload as {data?:Record<string,unknown>[]}|null;
 return Array.isArray(payload?.data)&&mapPoints(payload.data,spec).length>0;
}
