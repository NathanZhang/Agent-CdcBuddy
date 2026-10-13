import unittest,tempfile,sqlite3
from pathlib import Path
class ScopedReadonly(unittest.TestCase):
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
