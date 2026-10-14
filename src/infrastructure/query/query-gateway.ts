import { Parser } from 'node-sql-parser';
import type { QueryScope } from '../db/domain-repository';
export type QuerySchema = Record<string, readonly string[]>;
const parser = new Parser();
const functions = new Set(['COUNT','AVG','SUM','MIN','MAX','ROUND','SUBSTR','SUBSTRING','STRFTIME','DATE','DATETIME','COALESCE','IFNULL','NULLIF','ABS','CAST','TOTAL','LENGTH','LOWER','UPPER']);

/** Shared by read validation and scope validation: only a single keyed join is allowed. */
export function isKeyedJoinPredicate(on:any,from:any[]):boolean {
  if(on?.type!=='binary_expr'||on.operator!=='='||on.left?.type!=='column_ref'||on.right?.type!=='column_ref'||!on.left.table||!on.right.table||on.left.table===on.right.table)return false;
  const left=from.find(f=>(f.as??f.table)===on.left.table),right=from.find(f=>(f.as??f.table)===on.right.table);
  if(!left||!right)return false;
  const a=on.left.column,b=on.right.column;
  if(a===b&&(/_id$/.test(String(a))||['city','district'].includes(a)))return true;
  const keys=[['fact_food_sampling','food_category_id','dim_food_category','category_id'],['fact_food_sampling','detected_pathogen_id','dim_pathogen_type','pathogen_id']];
  return keys.some(([x,xc,y,yc])=>left.table===x&&a===xc&&right.table===y&&b===yc||left.table===y&&a===yc&&right.table===x&&b===xc);
}

/** Only the SQL subset used by current query skills is supported. */
export function validateReadQuery(sql: string, schema: QuerySchema, maxRows = 200): string {
  if (typeof sql !== 'string' || sql.length > 20000 || !Number.isSafeInteger(maxRows) || maxRows < 1 || maxRows > 1000) throw new Error('Invalid read query budget');
  const parsed = parser.astify(sql, { database:'SQLite' });
  const statements = Array.isArray(parsed) ? parsed : [parsed];
  if (statements.length !== 1) throw new Error('Exactly one SELECT statement is required');
  const ast = statements[0] as any;
  if (ast.type !== 'select' || ast.with || ast._next || ast.set_op || ast.into || ast.for_update || !Array.isArray(ast.from) || ast.from.length === 0) throw new Error('Unsupported SELECT construction');
  const tables = new Map<string,string>();
  if(ast.from.length>4)throw new Error("Join budget exceeded");
  for (const [index,item] of ast.from.entries()) {
    if (item.db || item.expr || !item.table || !Object.hasOwn(schema,item.table)) throw new Error('Table outside allowed domain');
    if(index>0&&!item.join)throw new Error("Implicit cross products are not supported");
    if(tables.has(item.as??item.table))throw new Error("Duplicate table alias");
    if(index>0&&item.table.startsWith("fact_")&&[...tables.values()].some(t=>t.startsWith("fact_")))throw new Error("Fact-to-fact joins are outside the compute budget");
    if(item.join&&!isKeyedJoinPredicate(item.on,ast.from))throw new Error("Join requires distinct keyed column equality");
    tables.set(item.as ?? item.table, item.table);
    if (item.join && (!item.on || /CROSS/i.test(item.join))) throw new Error('Unconstrained joins are not supported');
  }
  const aliases = new Set<string>((Array.isArray(ast.columns) ? ast.columns : []).map((c:any) => c.as).filter(Boolean));
  // Running SELECT 76 AS recordCount is not a data calculation: it merely
  // launders a model-supplied number through the database. Statistical outputs
  // must depend on source columns or a database aggregate over actual rows.
  const statisticsAlias = /^(?:n\d*|count|total|sum|mean|average|avg|median|min|max|percentage|percent|ratio|rate|growth|.*(?:count|records|rate|ratio|percentage)|.*(?:记录数|数量|总数|合计|总和|均值|平均|中位数|比例|占比|增长率|最大值|最小值))$/i;
  const dependsOnData = (node:any):boolean => {
    if(!node||typeof node!=='object')return false;
    if(node.type==='column_ref'||node.type==='aggr_func')return true;
    return Object.values(node).some(value=>Array.isArray(value)?value.some(dependsOnData):dependsOnData(value));
  };
  for(const column of ast.columns)if(statisticsAlias.test(column.as??'')&&!dependsOnData(column.expr))throw new Error('Statistical projection must be computed from source data, not a constant');
  function visit(node: any, allowAlias = false): void {
    if (!node || typeof node !== 'object') return;
    if (node !== ast && node.type === 'select') throw new Error('Subqueries are not supported');
    if (node.type === 'column_ref') {
      const column = typeof node.column === 'string' ? node.column : node.column?.expr?.value;
      if(node.db||node.schema||node.table&&!tables.has(node.table))throw new Error('Column qualifier outside scoped views');
      if (column !== '*') {
        const candidates = node.table ? [tables.get(node.table)] : [...tables.values()];
        if (!candidates.some(t => t && schema[t].includes(column)) && !(allowAlias && node.table === null && aliases.has(column))) throw new Error(`Column outside allowed schema: ${column}`);
      }
    }
    if (node.type === 'function' || node.type === 'aggr_func') {
      const name = typeof node.name === 'string' ? node.name : node.name?.name?.map((n:any) => n.value).join('.');
      if (!name || !functions.has(name.toUpperCase())) throw new Error('Unsupported SQL function');
      if (node.over) throw new Error('Window functions are not supported');
    }
    for (const [key,value] of Object.entries(node)) {
      const aliasScope = node === ast && ['orderby','groupby'].includes(key);
      if (Array.isArray(value)) value.forEach(v=>visit(v,allowAlias || aliasScope)); else visit(value,allowAlias || aliasScope);
    }
  }
  visit(ast);
  if (ast.limit) {
    const values = ast.limit.value;
    if (!Array.isArray(values) || values.length < 1 || values.length > 2 || values.some((v:any) => v.type !== 'number' || !Number.isSafeInteger(v.value) || v.value < 0 || v.value > maxRows)) throw new Error('Query LIMIT exceeds budget');
  }
  const normalized = sql.trim().replace(/;\s*$/, '');
  return ast.limit ? normalized : `${normalized} LIMIT ${maxRows}`;
}

export async function executeReadQuery(query: string, scope: QueryScope, params: unknown[] = []): Promise<Record<string,unknown>[]> {
  const { getDomainRepository } = await import('../db/domain-repository');
  return getDomainRepository(scope.domain).query(query,params,scope);
}

/** Cached rows were materialized with older privileges: never expand old wildcard projections. */
export function assertCachedQueryColumns(sql:string,schema:QuerySchema,roleChanged:boolean):void {
 validateReadQuery(sql,schema);const parsed=parser.astify(sql,{database:'SQLite'});const ast=(Array.isArray(parsed)?parsed[0]:parsed) as any;
 if(roleChanged&&ast.columns.some((c:any)=>c.expr?.type==='column_ref'&&(c.expr.column==='*'||c.expr.column?.expr?.value==='*')))throw Error('FORBIDDEN_SOURCE_COLUMNS');
}
