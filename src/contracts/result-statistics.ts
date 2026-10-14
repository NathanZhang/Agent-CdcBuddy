export interface ColumnStatistics {
  field: string;
  presentCount: number;
  missingCount: number;
}
export interface TableStatistics {
  path: string[];
  rowCount: number;
  columns: ColumnStatistics[];
}
export interface ResultStatistics {
  version: '1';
  basis: 'returned_rows';
  tables: TableStatistics[];
}
export const isMissingValue = (value: unknown): boolean => value === null || value === undefined || value === '';
const isRow = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);

/** Count the actual returned rows, including duplicates and rows with missing values.
 * This is never a COUNT of all database matches or of independent sampling visits. */
export function computeResultStatistics(data: unknown, rootPath: string[] = ['data']): ResultStatistics {
  const tables: TableStatistics[] = [];
  const visit = (value: unknown, path: string[]): void => {
    if (Array.isArray(value)) {
      if (value.every(isRow)) {
        const fields = Array.from(new Set(value.flatMap(row => Object.keys(row))));
        tables.push({path, rowCount: value.length, columns: fields.map(field => {
          const missingCount = value.filter(row => isMissingValue(row[field])).length;
          return {field, presentCount: value.length - missingCount, missingCount};
        })});
      }
      value.forEach((item, index) => visit(item, [...path, String(index)]));
    } else if (isRow(value)) {
      Object.entries(value).forEach(([key, item]) => visit(item, [...path, key]));
    }
  };
  visit(data, rootPath);
  return {version: '1', basis: 'returned_rows', tables};
}

/** Enrich all query and analytics outputs at the server's shared skill boundary. */
export function resultStatisticsSource(payload: unknown): {data: unknown; path: string[]} | undefined {
  if (!isRow(payload)) return;
  if (['DATA_TABLE_VIEW','ANALYTICS_RESULT'].includes(String(payload.type))) return {data:payload.data,path:['data']};
  if (payload.type === 'CUSTOM_SKILL_CREATED') return {data:payload.previewData,path:['previewData']};
}
export function withResultStatistics<T>(payload: T): T {
  const source = resultStatisticsSource(payload);
  if (!source) return payload;
  return {...payload, statistics: computeResultStatistics(source.data, source.path)};
}

export function tableStatisticsText(table: TableStatistics, label: (field: string) => string): string {
  if (table.rowCount === 0) return '本次返回 0 行，无法根据空明细判断字段缺失情况。';
  const missing = table.columns.filter(column => column.missingCount > 0);
  const details = missing.map(column => `${label(column.field)}：有效 ${column.presentCount} 行，缺失 ${column.missingCount} 行`).join('；');
  return `本次返回 ${table.rowCount} 行。${details ? details + '。' : '各字段均无缺失值。'}`;
}
