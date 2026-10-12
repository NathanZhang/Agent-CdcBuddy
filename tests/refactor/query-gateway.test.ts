import { describe,it,expect } from 'vitest';
import { validateReadQuery } from '@/infrastructure/query/query-gateway';
const schema={fact_water_monitoring:['record_id','city','hazard_quotient','monitoring_date']};
describe('controlled read SQL',()=>{
  it('accepts bounded aggregates and validates order aliases',()=>{
    const sql=validateReadQuery('SELECT city, AVG(hazard_quotient) AS hq FROM fact_water_monitoring GROUP BY city ORDER BY hq DESC LIMIT 5',schema,100);
    expect(sql).toContain('LIMIT 5');
  });
  it('adds a bounded limit when absent',()=>{
    expect(validateReadQuery('SELECT city FROM fact_water_monitoring',schema,20)).toMatch(/LIMIT 20$/i);
  });
  it.each([
    'SELECT * FROM fact_water_monitoring LIMIT 1000000',
    'SELECT city FROM fact_water_monitoring; DELETE FROM fact_water_monitoring',
    'SELECT * FROM fact_monitoring',
    'SELECT patient_name FROM fact_water_monitoring',
    'SELECT * FROM main.fact_water_monitoring',
    "SELECT load_extension('x') FROM fact_water_monitoring",
    'SELECT randomblob(10000000) FROM fact_water_monitoring',
    'SELECT * FROM fact_water_monitoring UNION SELECT * FROM fact_water_monitoring',
    'SELECT (SELECT city FROM fact_water_monitoring) FROM fact_water_monitoring',
    'SELECT * FROM sqlite_master',
    'SELECT * FROM fact_water_monitoring LIMIT -1'
  ])('rejects unsafe or unsupported SQL: %s',sql=>{
    expect(()=>validateReadQuery(sql,schema,100)).toThrow();
  });
});

import { getVectorDataProvider } from '@/lib/db/sqlite-provider';
it('legacy custom SQL also obeys the query cap',async()=>{ await expect(getVectorDataProvider().queryCustomSql('SELECT COUNT(*) AS n FROM fact_monitoring LIMIT 1000000')).rejects.toThrow(); });
