"""Real SQLite fault cases and fitted-model dependency isolation."""
import json
import sqlite3
import tempfile
import unittest
from pathlib import Path
import pandas as pd
from analytics_engine.input_errors import TABLE_LABELS
from analytics_engine.assessments import execute
from analytics_engine.assessments.common import frame,forecast
from analytics_engine.input_errors import InputDataError
from analytics_engine.contracts.task import task_result

class InputDependencies(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.db=str(Path(self.tmp.name)/'input.db')
  sqlite3.connect(self.db).close()
 def tearDown(self):self.tmp.cleanup()
 def table(self,name,rows):
  with sqlite3.connect(self.db) as conn:pd.DataFrame(rows).to_sql(name,conn,index=False,if_exists='replace')
 def assertInput(self,result):
  self.assertEqual(result['status'],'INSUFFICIENT_DATA');self.assertRegex(result['reason'],r'[\u4e00-\u9fff]')
  self.assertNotRegex(json.dumps(result),r'SELECT|no such table|Traceback|Execution failed on sql')
 def test_all_assessment_branches_report_missing_sources_in_chinese(self):
  actions={'vector':['population','density','resistance','evolution','transmission','signals','advice'],
   'foodborne':['forecast','clusters','trace','dashboard','signals','advice'],
   'env':['clean','water_risk','water_trend','sewage_source','venue_risk','venue_grade','exposure','heat','scenario','cross_media','river_health','signals','advice'],
   'chronic':['risk','complications','screening','mortality','rare','injury_clusters','injury_tree','injury_events','quality','cause','signals','advice']}
  for domain,items in actions.items():
   for action in items:
    with self.subTest(domain=domain,action=action):self.assertInput(execute(domain,self.db,{'analysis':action}))
  with sqlite3.connect(self.db) as conn:
   for table in [*TABLE_LABELS,'dim_species','dim_location','dim_method','dim_pesticide']:
    conn.execute(f'CREATE TABLE {table}(placeholder TEXT)')
    conn.execute(f"INSERT INTO {table} VALUES ('缺字段夹具')")
  for domain,items in actions.items():
   for action in items:
    with self.subTest(domain=domain,action=action,fault='missing-columns'):self.assertInput(execute(domain,self.db,{'analysis':action}))
 def test_univariate_population_runs_without_any_exposure_table(self):
  self.table('dim_method',[{'method_id':'M','method_name':'诱蚊灯法'}]);self.table('dim_species',[{'species_id':'S','species_name':'白纹伊蚊','category':'蚊'}]);self.table('dim_location',[{'location_id':'L','city':'郑州市','district':'金水区'}])
  self.table('fact_monitoring',[{'date_id':str(p)+'-01','method_id':'M','species_id':'S','location_id':'L','capture_count':20+i%12,'sampling_unit':2} for i,p in enumerate(pd.period_range('2022-01','2024-12',freq='M'))])
  out=execute('vector',self.db,{'analysis':'population','asOf':'2024-12-31'})
  self.assertEqual(out['status'],'SUCCESS');self.assertEqual(out['weatherFeatures'],[])
  self.assertEqual([m['model'] for m in out['models']],['ARIMA','LSTM'])
  for m in out['models']:self.assertEqual(m['forecasts'][0]['period'],'2025-01');self.assertTrue(m['validation']['rows'])
  self.assertInput(execute('vector',self.db,{'analysis':'density','asOf':'2024-12-31'}))
  self.table('fact_vector_exposure',[{'monitoring_date':str(p)+'-01','temperature_c':20+i%12,'rainfall_mm':50+i%5} for i,p in enumerate(pd.period_range('2022-01','2024-12',freq='M'))])
  density=execute('vector',self.db,{'analysis':'density','asOf':'2024-12-31'})
  self.assertEqual(density['status'],'SUCCESS');self.assertEqual(density['models'][0]['model'],'GBDT')
  self.assertInput(execute('vector',self.db,{'analysis':'evolution'}))
  with sqlite3.connect(self.db) as c:c.execute("DELETE FROM fact_monitoring WHERE date_id='2024-12-01'")
  self.assertInput(execute('vector',self.db,{'analysis':'population','asOf':'2024-12-31'}))
 def test_arima_does_not_validate_unused_weather_covariates(self):
  out=forecast([str(p) for p in pd.period_range('2023-01',periods=24,freq='M')],[10+i%6 for i in range(24)],3,'arima',[[float('nan')]])
  self.assertEqual(len(out['forecasts']),3)
 def test_complications_do_not_require_classifier_columns_or_two_classes(self):
  self.table('fact_chronic_followup',[{'monitoring_date':'2025-01-01','disease_name':'糖尿病','complication':'肾病'}])
  out=execute('chronic',self.db,{'analysis':'complications'});self.assertEqual(out['status'],'SUCCESS');self.assertEqual(out['rules'][0]['jointCount'],1)
  self.assertInput(execute('chronic',self.db,{'analysis':'risk'}))
 def test_rare_causes_do_not_require_population_table(self):
  self.table('fact_death_registry',[{'death_date':'2025-01-01','city':'郑州市','district':'金水区','icd10_category':'罕见死因','icd10_code':'A00','death_cert_id':str(i)} for i in range(3)])
  out=execute('chronic',self.db,{'analysis':'rare'});self.assertEqual(out['clusters'][0]['cases'],3)
  self.assertInput(execute('chronic',self.db,{'analysis':'mortality'}))
 def test_environment_scenario_does_not_require_activity_or_heat_columns(self):
  self.table('fact_air_climate_monitoring',[{'date':'2025-01-01','pm25':20,'pediatric_resp_outpatient':100}]);self.table('fact_env_intervention_inputs',[{'monitoring_date':'2025-01-01','source_name':'模拟源'}])
  out=execute('env',self.db,{'analysis':'scenario'});self.assertEqual(out['status'],'SUCCESS');self.assertGreater(out['estimatedAvoidedVisits'],0)
  self.assertInput(execute('env',self.db,{'analysis':'heat'}))
 def test_venue_grading_does_not_require_health_outcomes(self):
  common={'inspection_date':'2025-01-01','venue_id':'V','city':'郑州市','district':'金水区'}
  self.table('fact_venue_scores',[{**common,**{k:90 for k in ['management','staff','disclosure','testing','smoking','facilities']},'rule_version':'demo'}]);self.table('fact_public_venue_inspection',[{**common,'venue_name':'模拟场所'}])
  out=execute('env',self.db,{'analysis':'venue_grade'});self.assertEqual(out['rows'][0]['calculatedGrade'],'A')
  self.assertInput(execute('env',self.db,{'analysis':'venue_risk'}))
 def test_empty_and_missing_columns_and_legacy_sql_errors(self):
  self.table('fact_env_raw_samples',[{'monitoring_date':'2025-01-01'}]);self.assertInput(execute('env',self.db,{'analysis':'clean'}))
  with sqlite3.connect(self.db) as c:c.execute('DELETE FROM fact_env_raw_samples')
  with self.assertRaises(InputDataError) as ctx:frame(self.db,'fact_env_raw_samples',{},'monitoring_date')
  self.assertIn('没有',str(ctx.exception))
  ref={'id':'vector-monitoring','domain':'vector','origin':'observed','version':'test','asOf':'2025-01-01','schemaVersion':'1'}
  for payload,error in [(None,"Execution failed on sql 'SELECT * FROM private_table': no such table: private_table"),({'error':'no such column: private_column'},None)]:
   result=task_result('test','vector','vector_assessment',ref,payload,error)
   self.assertInput(result['payload']);self.assertNotIn('SELECT',json.dumps(result))

if __name__=='__main__':unittest.main()
