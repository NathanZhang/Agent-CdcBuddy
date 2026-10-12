import { Parser } from 'node-sql-parser';
import type { QueryScope } from '../db/domain-repository';
export type QuerySchema = Record<string, readonly string[]>;
const parser = new Parser();
const functions = new Set(['COUNT','AVG','SUM','MIN','MAX','ROUND','SUBSTR','SUBSTRING','STRFTIME','DATE','DATETIME','COALESCE','IFNULL','NULLIF','ABS','CAST','TOTAL','LENGTH','LOWER','UPPER']);

/** Only the SQL subset used by current query skills is supported. */
export function validateReadQuery(sql: string, schema: QuerySchema, maxRows = 200): string {
  if (typeof sql !== 'string' || sql.length > 20000 || !Number.isSafeInteger(maxRows) || maxRows < 1 || maxRows > 1000) throw new Error('Invalid read query budget');
  const parsed = parser.astify(sql, { database:'SQLite' });
  const statements = Array.isArray(parsed) ? parsed : [parsed];
  if (statements.length !== 1) throw new Error('Exactly one SELECT statement is required');
  const ast = statements[0] as any;
  if (ast.type !== 'select' || ast.with || ast._next || ast.set_op || ast.into || ast.for_update || !Array.isArray(ast.from) || ast.from.length === 0) throw new Error('Unsupported SELECT construction');
  const tables = new Map<string,string>();
  for (const item of ast.from) {
    if (item.db || item.expr || !item.table || !Object.hasOwn(schema,item.table)) throw new Error('Table outside allowed domain');
    tables.set(item.as ?? item.table, item.table);
    if (item.join && (!item.on || /CROSS/i.test(item.join))) throw new Error('Unconstrained joins are not supported');
  }
  const aliases = new Set<string>((Array.isArray(ast.columns) ? ast.columns : []).map((c:any) => c.as).filter(Boolean));
  function visit(node: any): void {
    if (!node || typeof node !== 'object') return;
    if (node !== ast && node.type === 'select') throw new Error('Subqueries are not supported');
    if (node.type === 'column_ref') {
      const column = typeof node.column === 'string' ? node.column : node.column?.expr?.value;
      if (column !== '*') {
        const candidates = node.table ? [tables.get(node.table)] : [...tables.values()];
        if (!candidates.some(t => t && schema[t].includes(column)) && !(node.table === null && aliases.has(column))) throw new Error(`Column outside allowed schema: ${column}`);
      }
    }
    if (node.type === 'function' || node.type === 'aggr_func') {
      const name = typeof node.name === 'string' ? node.name : node.name?.name?.map((n:any) => n.value).join('.');
      if (!name || !functions.has(name.toUpperCase())) throw new Error('Unsupported SQL function');
      if (node.over) throw new Error('Window functions are not supported');
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit); else visit(value);
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
