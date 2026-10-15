import unittest,tempfile,sqlite3
from pathlib import Path
class ScopedReadonly(unittest.TestCase):
 def test_exposure_pathogen_ids_follow_recorded_case_links_and_keep_scope(self):
  from analytics_engine.repositories.datasets import connect_scoped_readonly
  with tempfile.TemporaryDirectory() as directory:
   path=Path(directory)/'food.db';c=sqlite3.connect(path)
   c.executescript("""CREATE TABLE fact_foodborne_case(pathogen_id TEXT,cluster_id TEXT,city TEXT,visit_date TEXT);
    CREATE TABLE fact_food_exposure(cluster_id TEXT,city TEXT,exposure_date TEXT);
    INSERT INTO fact_foodborne_case VALUES('p','cluster-p','郑州市','2024-06-01'),('q','cluster-q','郑州市','2024-06-01');
    INSERT INTO fact_food_exposure VALUES('cluster-p','郑州市','2024-06-01'),('cluster-q','郑州市','2024-06-01'),
     ('cluster-p','洛阳市','2024-06-01'),('cluster-p','郑州市','2023-06-01'),('unlinked','郑州市','2024-06-01');""")
   c.close()
   scope={'domain':'foodborne','scopeFingerprint':'s','regionPaths':[{'city':'郑州市'}],
    'from':'2024-01-01','to':'2024-12-31','filters':{}}
   for operator,values,expected in [('eq',['p'],[('cluster-p',)]),('in',['p','q'],[('cluster-p',),('cluster-q',)]),('eq',['missing'],[])]:
    with self.subTest(operator=operator,values=values):
     scope['filters']={'pathogenId':{'operator':operator,'values':values}}
     with connect_scoped_readonly(path,scope) as connection:
      self.assertEqual(connection.execute('SELECT cluster_id FROM fact_food_exposure ORDER BY cluster_id').fetchall(),expected)
      with self.assertRaises(sqlite3.DatabaseError):connection.execute('SELECT * FROM main.fact_food_exposure').fetchall()

 def test_every_connection_enforces_region_and_time(self):
  from analytics_engine.repositories.datasets import connect_scoped_readonly
  with tempfile.TemporaryDirectory() as directory:
   path=Path(directory)/'facts.db';c=sqlite3.connect(path);c.executescript("CREATE TABLE fact_foodborne_case(city TEXT,district TEXT,visit_date TEXT);INSERT INTO fact_foodborne_case VALUES('郑州市','金水区','2024-01-01'),('郑州市','金水区','2023-01-01'),('洛阳市','西工区','2024-01-01');");c.close()
   scope={'domain':'foodborne','scopeFingerprint':'scope','regionPaths':[{'city':'郑州市'}],'excludePaths':[],'from':'2024-01-01','to':'2024-12-31','filters':{}}
   for _ in range(2):
    with connect_scoped_readonly(path,scope) as c:
     self.assertEqual(c.execute('SELECT COUNT(*) FROM fact_foodborne_case').fetchone()[0],1)
     with self.assertRaises(sqlite3.DatabaseError):c.execute('SELECT * FROM main.fact_foodborne_case').fetchall()
 def test_pathogen_filters_apply_and_unsupported_filters_deny_selected_source(self):
  from analytics_engine.repositories.datasets import connect_scoped_readonly
  with tempfile.TemporaryDirectory() as directory:
   path=Path(directory)/'food.db';c=sqlite3.connect(path);c.executescript("CREATE TABLE dim_pathogen_type(pathogen_id TEXT,pathogen_name TEXT,category TEXT);CREATE TABLE fact_foodborne_case(city TEXT,pathogen_id TEXT,visit_date TEXT);INSERT INTO dim_pathogen_type VALUES('p','沙门菌','细菌');INSERT INTO fact_foodborne_case VALUES('郑州市','p','2024-01-01');");c.close()
   scope={'domain':'foodborne','scopeFingerprint':'s','regionPaths':[{}],'filters':{'pathogenType':{'operator':'eq','values':['不存在病原']}}}
   with connect_scoped_readonly(path,scope) as c:self.assertEqual(c.execute('SELECT COUNT(*) FROM fact_foodborne_case').fetchone()[0],0)
   scope['filters']={'speciesName':{'operator':'eq','values':['蚊']}}
   with connect_scoped_readonly(path,scope) as c:
    with self.assertRaises(sqlite3.DatabaseError):c.execute('SELECT COUNT(*) FROM fact_foodborne_case').fetchone()
 def test_named_species_exposure_is_filtered_through_category_dimension(self):
  from analytics_engine.repositories.datasets import connect_scoped_readonly
  with tempfile.TemporaryDirectory() as directory:
   path=Path(directory)/'vector.db';c=sqlite3.connect(path);c.executescript("CREATE TABLE dim_species(species_id TEXT,species_name TEXT,category TEXT); CREATE TABLE fact_vector_exposure(city TEXT,monitoring_date TEXT,species_name TEXT); INSERT INTO dim_species VALUES('m','白纹伊蚊','蚊'),('r','褐家鼠','鼠'); INSERT INTO fact_vector_exposure VALUES('郑州市','2024-01-01','白纹伊蚊'),('郑州市','2024-01-01','褐家鼠'),('洛阳市','2024-01-01','白纹伊蚊'),('郑州市','2023-01-01','白纹伊蚊');");c.close()
   scope={'domain':'vector','scopeFingerprint':'s','regionPaths':[{'city':'郑州市'}],'from':'2024-01-01','to':'2024-12-31','filters':{'category':{'operator':'eq','values':['蚊']}}}
   with connect_scoped_readonly(path,scope) as c:
    self.assertEqual(c.execute('SELECT species_name FROM fact_vector_exposure').fetchall(),[('白纹伊蚊',)])
    with self.assertRaises(sqlite3.DatabaseError):c.execute('SELECT * FROM main.fact_vector_exposure').fetchall()

 def test_unmapped_unused_table_does_not_block_authorized_table_or_allow_access(self):
  from analytics_engine.repositories.datasets import connect_scoped_readonly
  with tempfile.TemporaryDirectory() as directory:
   path=Path(directory)/'facts.db';c=sqlite3.connect(path);c.executescript("CREATE TABLE fact_foodborne_case(city TEXT,visit_date TEXT); CREATE TABLE fact_unmapped(value REAL); INSERT INTO fact_foodborne_case VALUES('郑州市','2024-01-01'),('洛阳市','2024-01-01'); INSERT INTO fact_unmapped VALUES(5);");c.close()
   scope={'domain':'foodborne','scopeFingerprint':'scope','regionPaths':[{'city':'郑州市'}],'filters':{}}
   with connect_scoped_readonly(path,scope) as c:
    self.assertEqual(c.execute('SELECT COUNT(*) FROM fact_foodborne_case').fetchone()[0],1)
    with self.assertRaises(sqlite3.DatabaseError):c.execute('SELECT * FROM fact_unmapped').fetchall()

 def test_bilingual_pathogen_name_matches_only_its_exact_chinese_name(self):
  from analytics_engine.repositories.datasets import connect_scoped_readonly
  with tempfile.TemporaryDirectory() as directory:
   path=Path(directory)/'food.db';c=sqlite3.connect(path);c.executescript("CREATE TABLE dim_pathogen_type(pathogen_id TEXT,pathogen_name TEXT); CREATE TABLE fact_foodborne_case(pathogen_id TEXT,cluster_id TEXT,city TEXT); CREATE TABLE fact_food_exposure(cluster_id TEXT,city TEXT); INSERT INTO dim_pathogen_type VALUES('p','副溶血性弧菌 (Vibrio parahaemolyticus)'),('q','沙门菌 (Salmonella)'); INSERT INTO fact_foodborne_case VALUES('p','cluster-p','郑州市'),('q','cluster-q','郑州市'); INSERT INTO fact_food_exposure VALUES('cluster-p','郑州市'),('cluster-q','郑州市');");c.close()
   scope={'domain':'foodborne','scopeFingerprint':'s','regionPaths':[{'city':'郑州市'}],'filters':{'pathogenName':{'operator':'eq','values':['副溶血性弧菌']}}}
   with connect_scoped_readonly(path,scope) as c:
    self.assertEqual(c.execute('SELECT cluster_id FROM fact_foodborne_case').fetchall(),[('cluster-p',)])
    self.assertEqual(c.execute('SELECT cluster_id FROM fact_food_exposure').fetchall(),[('cluster-p',)])
