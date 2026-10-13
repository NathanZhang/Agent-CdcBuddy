import unittest
from pathlib import Path
from analytics_engine.spatial_interpolation import calculate_spatial_idw
class SpatialMetadata(unittest.TestCase):
 def test_actual_grid_metadata_matches_computed_samples(self):
  result=calculate_spatial_idw(str(Path(__file__).resolve().parents[2]/'vector_monitoring.db'),city='郑州市',method_name='诱蚊灯法')
  self.assertIn('gridMetadata',result)
  meta=result['gridMetadata'];self.assertGreater(meta['spacingLat'],0);self.assertGreater(meta['spacingLon'],0)
  self.assertAlmostEqual(min(p['lon'] for p in result['grid']),meta['extent'][0])
