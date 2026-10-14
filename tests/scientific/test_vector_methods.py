import unittest,sqlite3,tempfile,sys,math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'analytics_engine'))
class VectorMethods(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.db=str(Path(self.temp.name)/'vector.db');c=sqlite3.connect(self.db)
  c.executescript('''CREATE TABLE dim_species(species_id TEXT,species_name TEXT,latin_name TEXT,category TEXT);CREATE TABLE dim_location(location_id TEXT,city TEXT,district TEXT,street TEXT,latitude REAL,longitude REAL);CREATE TABLE dim_method(method_id TEXT,method_name TEXT);CREATE TABLE dim_pesticide(pesticide_id TEXT,pesticide_name TEXT);CREATE TABLE fact_monitoring(monitoring_id TEXT,date_id TEXT,location_id TEXT,species_id TEXT,method_id TEXT,capture_count REAL,sampling_unit INTEGER,weather_temp REAL,weather_humidity REAL);CREATE TABLE fact_pathogen_detection(location_id TEXT,tested_count INTEGER,positive_groups INTEGER,total_groups INTEGER);CREATE TABLE fact_insecticide_resistance(species_id TEXT,pesticide_id TEXT,location_id TEXT,date_id TEXT,corrected_mortality REAL,lc50 REAL,resistance_level TEXT);INSERT INTO dim_species VALUES('s','测试蚊','test','蚊');INSERT INTO dim_location VALUES('l','测试市','测试区','监测点',34.0,113.0);INSERT INTO dim_method VALUES('a','诱蚊灯法'),('b','人诱停落法');INSERT INTO dim_pesticide VALUES('p','测试药');INSERT INTO fact_pathogen_detection VALUES('l',10,0,10);INSERT INTO fact_insecticide_resistance VALUES('s','p','l','2023-01-01',NULL,NULL,NULL);''')
  for year in range(2019,2025):
   for month in range(1,13):
    value=10+month+(year-2019)
    for method,multiplier in [('a',1),('b',100)]:c.execute('INSERT INTO fact_monitoring VALUES(?,?,?,?,?,?,?,?,?)',(f'{year}-{month}-{method}',f'{year}-{month:02d}-15','l','s',method,value*multiplier,1 if method=='a' else None,20,60))
  c.commit();c.close()
 def tearDown(self):self.temp.cleanup()
 def test_colocated_sites_keep_distinct_source_identity_in_kmeans_members(self):
  from species_clustering import calculate_species_clustering
  c=sqlite3.connect(self.db);c.execute("INSERT INTO dim_location VALUES('l2','测试市','测试区','监测点',34.0,113.0)");c.execute("INSERT INTO fact_monitoring VALUES('new-site','2023-06-15','l2','s','a',30,1,20,60)");c.commit();c.close()
  result=calculate_species_clustering(self.db,category='蚊',year=2023,method_name='诱蚊灯法');members=[m for cluster in result['clusters'] for m in cluster['members']]
  self.assertEqual({m['locationId'] for m in members},{'l','l2'});self.assertTrue(all(m['speciesId']=='s' and m['methodId']=='a' for m in members));self.assertEqual(sum(cluster['samplePointCount'] for cluster in result['clusters']),2)
 def test_cutoff_blocks_future_records_and_keeps_real_training_window(self):
  from population_dynamics import calculate_population_dynamics
  args=dict(db_path=self.db,category='蚊',as_of='2023-12-31',data_window=24)
  before=calculate_population_dynamics(**args)
  c=sqlite3.connect(self.db);c.execute("INSERT INTO fact_monitoring VALUES('future','2025-01-15','l','s','a',999999,1,60,100)");c.commit();c.close()
  after=calculate_population_dynamics(**args);self.assertEqual(before,after);self.assertEqual(before['groups'][0]['trainingWindow']['end'],'2023-12')
 def test_sampling_methods_are_separate_and_missing_effort_is_explicit(self):
  from population_dynamics import calculate_population_dynamics
  result=calculate_population_dynamics(self.db,as_of='2023-12-31')
  groups={g['methodName']:g for g in result['groups']};self.assertEqual(set(groups),{'诱蚊灯法','人诱停落法'})
  self.assertAlmostEqual(groups['人诱停落法']['history'][-1]['value']/groups['诱蚊灯法']['history'][-1]['value'],100)
  self.assertEqual(groups['人诱停落法']['unit'],'captures/record');self.assertIn('sampling-effort-unavailable',groups['人诱停落法']['qualityFlags'])
 def test_negative_r2_is_not_clamped_and_rolling_backtest_uses_actual_holdouts(self):
  from vector_backtest import coefficient_of_determination,evaluate_vector_forecast
  self.assertAlmostEqual(coefficient_of_determination([1,2,3],[20,20,20]),-486)
  result=evaluate_vector_forecast('fixture','2023-12-31',2,db_path=self.db)
  self.assertGreater(result['evaluatedPairs'],0);self.assertTrue(result['groups']);self.assertEqual(result['metrics']['mae']['evaluationKind'],'synthetic');self.assertIn('baseline',result)
 def test_recent_daily_window_does_not_select_oldest_sixty(self):
  from vector_methods import load_capture_history
  rows=load_capture_history(self.db,as_of='2023-12-31',data_window=3,frequency='month',method_name='诱蚊灯法')
  self.assertEqual([r['period'] for r in rows],['2023-10','2023-11','2023-12'])
 def test_untrained_lstm_returns_unavailable_without_synthetic_forecasts(self):
  from lstm_predictor import calculate_lstm_short_term_forecast
  result=calculate_lstm_short_term_forecast(self.db,target_cities=['测试市']);self.assertEqual(result['status'],'FAILED');self.assertEqual(result['error']['code'],'CAPABILITY_UNAVAILABLE');self.assertFalse(result.get('predictionsByCity'))
 def test_no_genotype_or_missing_bioassay_does_not_create_confidence_or_allele_frequency(self):
  from resistance_ml import calculate_resistance_prediction
  from resistance_evolution import calculate_resistance_evolution
  resistance=calculate_resistance_prediction(self.db);self.assertIsNone(resistance['items'][0]['predictionConfidence']);self.assertIsNone(resistance['items'][0]['correctedMortality'])
  evolution=calculate_resistance_evolution(self.db,species_name='测试蚊',pesticide_name='测试药');self.assertEqual(evolution['status'],'INSUFFICIENT_DATA');self.assertTrue(all(v is None for v in evolution['kdrGeneFrequency']))
 def test_spatial_scan_cannot_substitute_another_time_window_or_force_top_three_significant_clusters(self):
  from satscan_cluster import calculate_satscan_spatial_clusters
  absent=calculate_satscan_spatial_clusters(self.db,year=2030,month=1,seed=7);self.assertEqual(absent['status'],'NO_DATA');self.assertEqual(absent['clusters'],[])
  first=calculate_satscan_spatial_clusters(self.db,year=2023,month=1,seed=7,method_name='诱蚊灯法',num_simulations=19)
  second=calculate_satscan_spatial_clusters(self.db,year=2023,month=1,seed=7,method_name='诱蚊灯法',num_simulations=19)
  self.assertEqual(first,second);self.assertTrue(all(c['p_value']<=.05 for c in first['clusters']))
 def test_gbdt_trains_a_real_model_and_does_not_return_fixed_weather_or_growth(self):
  from density_gbdt import calculate_gbdt_density_forecast
  result=calculate_gbdt_density_forecast(self.db,as_of='2023-12-31',method_name='诱蚊灯法');self.assertEqual(result['status'],'SUCCESS');self.assertEqual(result['method'],'gradient-boosting-capture-v1');self.assertEqual(len(result['groups'][0]['forecasts']),2);self.assertNotIn('35%~60%',str(result))

 def test_idw_keeps_zero_values_and_cannot_invent_points_for_missing_district(self):
  from spatial_interpolation import calculate_spatial_idw,idw_values
  self.assertEqual(idw_values([(34,113,0),(34,114,20)],[(34,113),(34,113.5)]),[0.,10.])
  absent=calculate_spatial_idw(self.db,city='测试市',district='不存在区',method_name='诱蚊灯法',as_of='2023-12-31')
  self.assertEqual(absent['status'],'NO_DATA');self.assertFalse(absent['monitoringPoints']);self.assertFalse(absent['alerts'])
 def test_kmeans_degenerate_points_are_finite_and_not_assigned_risk_by_cluster_number(self):
  from species_clustering import cluster_features
  groups=cluster_features([[5,34,113]]*4,seed=7)
  self.assertEqual(groups['labels'],[0]*4);self.assertEqual(groups['clusterCount'],1)
 def test_apriori_pair_support_and_confidence_are_actual_filtered_counts(self):
  from pathogen_apriori import pair_rules
  result=pair_rules([{'物种:A','阳性:P'},{'物种:A','阳性:P'},{'物种:A'},{'物种:B'}])
  self.assertEqual(len(result),1);self.assertAlmostEqual(result[0]['support'],.5);self.assertAlmostEqual(result[0]['confidence'],2/3);self.assertAlmostEqual(result[0]['lift'],4/3)

 def test_pipeline_with_untrained_lstm_cannot_report_success_or_synthetic_profiles(self):
  from satscan_lstm_pipeline import run_satscan_kmeans_lstm_pipeline
  r=run_satscan_kmeans_lstm_pipeline(self.db,year=2023,month=1)
  self.assertEqual(r['status'],'FAILED');self.assertEqual(r['error']['code'],'CAPABILITY_UNAVAILABLE');self.assertFalse(r.get('kmeans_subgroups'))

 def test_legacy_composable_graph_cannot_complete_an_unregistered_skill(self):
  from composable_workflow import run_dynamic_composable_workflow
  r=run_dynamic_composable_workflow(self.db,workflow_name='反例',steps=[{'stepId':1,'skillId':'imaginary_skill','args':{}}])
  self.assertEqual(r['status'],'FAILED');self.assertFalse(r.get('success'))

 def test_scan_permutation_detects_actual_hotspot_without_forced_radius(self):
  from satscan_cluster import calculate_satscan_spatial_clusters
  c=sqlite3.connect(self.db);c.execute('DELETE FROM fact_monitoring')
  for idx,(lat,lon,count) in enumerate([(34,113,50),(35,114,0),(36,115,0),(37,116,0)]):
   loc=f'p{idx}';c.execute('INSERT INTO dim_location VALUES(?,?,?,?,?,?)',(loc,'测试市',loc,'点',lat,lon));c.execute('INSERT INTO fact_monitoring VALUES(?,?,?,?,?,?,?,?,?)',(loc,'2023-01-15',loc,'s','a',count,1,20,60))
  c.commit();c.close()
  r=calculate_satscan_spatial_clusters(self.db,year=2023,month=1,method_name='诱蚊灯法',seed=7,num_simulations=99)
  self.assertEqual(r['status'],'SUCCESS');self.assertEqual(len(r['clusters']),1);self.assertAlmostEqual(r['clusters'][0]['expected_count'],12.5);self.assertAlmostEqual(r['clusters'][0]['log_likelihood_ratio'],50*math.log(4));self.assertEqual(r['clusters'][0]['radius_km'],0);self.assertLessEqual(r['clusters'][0]['p_value'],.05)
 def test_pcr_pairs_use_the_same_city_and_cutoff_as_descriptive_counts(self):
  from pathogen_apriori import calculate_pathogen_risk_apriori
  c=sqlite3.connect(self.db);c.execute('CREATE TABLE dim_pathogen(pathogen_id TEXT,pathogen_name TEXT)');c.execute("INSERT INTO dim_pathogen VALUES('p','病原P')")
  for name in ['date_id','pathogen_id','species_id','pcr_result']:c.execute('ALTER TABLE fact_pathogen_detection ADD COLUMN '+name+' TEXT')
  c.execute("UPDATE fact_pathogen_detection SET date_id='2023-01-01',pathogen_id='p',species_id='s',pcr_result='阴性'")
  for date in ['2023-01-02','2023-01-03','2023-02-01']:c.execute("INSERT INTO fact_pathogen_detection(location_id,date_id,pathogen_id,species_id,pcr_result) VALUES('l',?,'p','s','阳性')",(date,))
  c.commit();c.close()
  r=calculate_pathogen_risk_apriori(self.db,city='测试市',as_of='2023-01-31')
  self.assertEqual(r['transactionCount'],3);self.assertEqual(r['items'][0]['positiveCount'],2);self.assertAlmostEqual(r['associationRules'][0]['confidence'],2/3)
  self.assertEqual(calculate_pathogen_risk_apriori(self.db,city='不存在市')['status'],'NO_DATA')

 def test_future_forecasts_start_after_requested_cutoff_when_latest_records_are_older(self):
  from population_dynamics import calculate_population_dynamics
  c=sqlite3.connect(self.db);c.execute("DELETE FROM fact_monitoring WHERE date_id>='2023-11-01'");c.commit();c.close()
  r=calculate_population_dynamics(self.db,as_of='2023-12-31',method_name='诱蚊灯法',forecast_months=2)
  self.assertEqual([p['period'] for p in r['groups'][0]['forecasts']],['2024-01','2024-02']);self.assertIn('missing-months-recursively-extrapolated',r['groups'][0]['qualityFlags']);self.assertEqual(r['groups'][0]['trainingWindow']['end'],'2023-10')
