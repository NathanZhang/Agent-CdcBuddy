import unittest,sys,sqlite3,tempfile,json
from pathlib import Path
from datetime import date,timedelta
import numpy as np
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'analytics_engine'))
class MockMethods(unittest.TestCase):
 def test_calendar_lag_and_constant_undefined(self):
  from mock_methods import lag_correlations
  rng=np.random.default_rng(7);x=rng.normal(size=50);start=date(2023,1,1)
  a={(start+timedelta(days=i)).isoformat():float(v) for i,v in enumerate(x)}
  b={(start+timedelta(days=i+6)).isoformat():float(v) for i,v in enumerate(x)}
  curves=lag_correlations(a,b,14);best=max((r for r in curves if r['pearsonCorrelation'] is not None),key=lambda r:r['pearsonCorrelation'])
  self.assertEqual(best['lagDays'],6);self.assertAlmostEqual(best['pearsonCorrelation'],1);self.assertEqual(best['pairedDates'],50)
  constant={k:1 for k in a};self.assertTrue(all(r['pearsonCorrelation'] is None for r in lag_correlations(constant,b,14)))
 def test_moran_formula_and_weight_change(self):
  from mock_methods import moran_statistic
  w=[[0,1,0,0],[1,0,1,0],[0,1,0,1],[0,0,1,0]]
  self.assertAlmostEqual(moran_statistic([1,2,3,4],w),1/3)
  self.assertNotEqual(moran_statistic([1,2,3,4],w),moran_statistic([1,4,2,3],w))
  self.assertIsNone(moran_statistic([1,1,1,1],w))
  with self.assertRaises(ValueError):moran_statistic([1,2],[[1,0],[0,1]])
 def test_dbscan_moves_with_coordinates(self):
  from mock_methods import coordinate_clusters
  near=[[34,113],[34.001,113.001],[36,115]]
  self.assertEqual(coordinate_clusters(near,2,2),[0,0,-1])
  self.assertEqual(coordinate_clusters([[34,113],[35,114],[36,115]],2,2),[-1,-1,-1])
 def test_invalid_or_different_species_alleles_not_joined(self):
  from foodborne.cgmlst_cluster import calculate_cgmlst_clustering
  with tempfile.TemporaryDirectory() as tmp:
   db=str(Path(tmp)/'f.db');c=sqlite3.connect(db);c.execute('CREATE TABLE fact_pathogen_molecular(isolate_id TEXT,case_id TEXT,pathogen_id TEXT,pathogen_name TEXT,serotype TEXT,pfge_pattern TEXT,mlst_st TEXT,cgmlst_vector TEXT,isolation_source TEXT,isolation_date TEXT,city TEXT,district TEXT,is_outbreak_isolate INT,cluster_id TEXT)')
   for i,p,v in [('a','p',[1,2]),('b','q',[1,2])]:c.execute('INSERT INTO fact_pathogen_molecular VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',(i,i,p,p,None,None,None,json.dumps(v),'sample','2023-01-01','X','Y',0,None))
   c.commit();r=calculate_cgmlst_clustering(db);self.assertEqual(r['homologousGroupsCount'],0)
   c.execute("UPDATE fact_pathogen_molecular SET cgmlst_vector='[]' WHERE isolate_id='a'");c.commit();c.close();self.assertEqual(calculate_cgmlst_clustering(db)['status'],'INSUFFICIENT_DATA')
if __name__=='__main__':unittest.main()
