import sqlite3
import tempfile
import unittest
from pathlib import Path
from analytics_engine.spatial_interpolation import calculate_spatial_idw


class SpatialMetadata(unittest.TestCase):
 def test_actual_grid_metadata_matches_computed_samples(self):
  with tempfile.TemporaryDirectory() as directory:
   db=Path(directory)/'vector.db'
   with sqlite3.connect(db) as connection:
    connection.executescript((Path(__file__).resolve().parents[2]/'tests/fixtures/vector-schema.sql').read_text())
    connection.execute("INSERT INTO dim_species VALUES('s','蚊','测试蚊','synthetic-species')")
    connection.execute("INSERT INTO dim_method VALUES('m','诱蚊灯法')")
    for site,lat,lon,value in [('a',34,113,0),('b',35,113,4),('c',35,114,8)]:
     connection.execute('INSERT INTO dim_location(location_id,city,district,street,latitude,longitude) VALUES(?,?,?,?,?,?)',(site,'测试市','测试区','Mock点位',lat,lon))
     connection.execute('INSERT INTO fact_monitoring(monitoring_id,date_id,location_id,species_id,method_id,capture_count) VALUES(?,?,?,?,?,?)',(site,'2024-01-01',site,'s','m',value))
   result=calculate_spatial_idw(str(db),city='测试市',method_name='诱蚊灯法',as_of='2024-12-31',grid_size=3)
   self.assertEqual(result['status'],'SUCCESS')
   meta=result['gridMetadata']
   self.assertEqual(meta,{'spacingLat':.5,'spacingLon':.5,'extent':[113,34,114,35]})
   self.assertEqual(len(result['grid']),9)
   self.assertEqual(min(p['lon'] for p in result['grid']),113)
   self.assertEqual(max(p['lon'] for p in result['grid']),114)
   self.assertEqual(min(p['lat'] for p in result['grid']),34)
   self.assertEqual(max(p['lat'] for p in result['grid']),35)
