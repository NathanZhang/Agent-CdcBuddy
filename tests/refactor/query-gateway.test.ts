import { describe,it,expect } from 'vitest';
import { validateReadQuery } from '@/infrastructure/query/query-gateway';
const schema={fact_water_monitoring:['record_id','city','hazard_quotient','monitoring_date']};
describe('controlled read SQL',()=>{
  it('rejects model-precomputed statistical constants while allowing real database formulas',()=>{
    for(const sql of ['SELECT 76 AS recordCount FROM fact_water_monitoring','SELECT 1+75 AS n FROM fact_water_monitoring','SELECT ROUND(45.21,2) AS percentage FROM fact_water_monitoring',"SELECT '45.21%' AS \"占比\" FROM fact_water_monitoring"]){expect(()=>validateReadQuery(sql,schema)).toThrow('must be computed from source data');}
    expect(()=>validateReadQuery('SELECT COUNT(*) AS recordCount,COUNT(hazard_quotient)*100.0/COUNT(*) AS percentage FROM fact_water_monitoring',schema)).not.toThrow();
    expect(()=>validateReadQuery('SELECT 1 AS referenceThreshold,AVG(hazard_quotient) AS mean FROM fact_water_monitoring',schema)).not.toThrow();
  });
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
it('rejects implicit cross products and wildcard qualifiers outside the scoped tables',()=>{const schema={fact_monitoring:['capture_count','location_id'],dim_location:['location_id','city']};expect(()=>validateReadQuery('SELECT COUNT(*) FROM fact_monitoring, dim_location',schema)).toThrow();expect(()=>validateReadQuery('SELECT forbidden.* FROM fact_monitoring',schema)).toThrow();expect(()=>validateReadQuery('SELECT main.fact_monitoring.* FROM fact_monitoring',schema)).toThrow();});
