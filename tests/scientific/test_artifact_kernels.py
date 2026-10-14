import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
import sqlite3
import numpy as np
from analytics_engine.artifact_kernels import scan, kmeans
from scripts.init_vector_mock import generate_mock_data


class ArtifactKernelsTests(unittest.TestCase):
    def sites(self, hotspot=True):
        return {'exposureUnit': 'trap-hour', 'sites': [
            {'locationKey': 's'+str(i), 'latitude': 34.8 if i < 4 else 35+i*.01,
             'longitude': 113.7 if i < 4 else 114+i*.01,
             'count': [2000, 3000, 4500, 6500][i] if hotspot and i < 4 else 10,
             'exposure': 8} for i in range(12)]}

    def params(self):
        return {'seed': 42, 'maxRadiusKm': 120, 'simulations': 99, 'pThreshold': .05}

    def test_reproducible_hotspot_members_with_colocated_stable_ids(self):
        result = scan(self.sites(), self.params())
        self.assertEqual(result, scan(self.sites(), self.params()))
        self.assertEqual(set(result['clusters'][0]['locationKeys']), {'s0', 's1', 's2', 's3'})
        self.assertEqual(result['clusters'][0]['pValue'], .01)
        self.assertEqual(result['exposureUnit'], 'trap-hour')

    def test_equal_counts_per_exposure_do_not_invent_hotspots(self):
        self.assertEqual(scan(self.sites(False), self.params())['clusters'], [])
        data = self.sites(False)
        for i, site in enumerate(data['sites']):
            site['exposure'] *= i+1
            site['count'] *= i+1
        self.assertEqual(scan(data, self.params())['clusters'], [])

    def test_invalid_counts_exposure_and_site_budget(self):
        for field, value in [('count', float('nan')), ('count', .5), ('count', -1), ('exposure', 0)]:
            data = self.sites()
            data['sites'][0][field] = value
            with self.assertRaisesRegex(ValueError, 'SCAN_COUNTS_EXPOSURE_INVALID'):
                scan(data, self.params())
        data = self.sites()
        data['sites'] = data['sites'][:2]
        with self.assertRaisesRegex(ValueError, 'INSUFFICIENT'):
            scan(data, self.params())

    def test_kmeans_partition_reproducibility_and_standardization(self):
        data = {'rowKeys': ['a', 'b', 'c', 'd'], 'columns': [{'key': 'density', 'unit': 'capture/trap-hour'}, {'key': 'visits', 'unit': 'visit'}],
                'values': [[1, 2], [2, 2], [40, 2], [41, 2]]}
        result = kmeans(data, {'k': 2, 'seed': 42})
        self.assertEqual(result, kmeans(data, {'k': 2, 'seed': 42}))
        labels = {a['locationKey']: a['cluster'] for a in result['assignments']}
        self.assertEqual(labels['a'], labels['b'])
        self.assertEqual(labels['c'], labels['d'])
        self.assertNotEqual(labels['a'], labels['c'])
        self.assertEqual(result['scale'][1], 1)
        np.testing.assert_allclose(result['mean'], [21, 2])
        self.assertLess(result['inertia'], .01)

    def test_kmeans_rejects_null_and_insufficient_distinct_rows(self):
        data = {'rowKeys': ['a', 'b'], 'columns': [{'key': 'x', 'unit': 'capture'}], 'values': [[1], [None]]}
        with self.assertRaisesRegex(ValueError, 'KMEANS_INSUFFICIENT'):
            kmeans(data, {'k': 2, 'seed': 42})
        data['values'] = [[1], [1]]
        with self.assertRaisesRegex(ValueError, 'KMEANS_INSUFFICIENT'):
            kmeans(data, {'k': 2, 'seed': 42})

    def test_scientific_mock_profile_has_explicit_shared_visits_complete_history_and_hotspots(self):
        with TemporaryDirectory() as directory:
            file = Path(directory)/'vector.db'
            generate_mock_data(file, 42, audit_dir=Path(directory)/'audit', profile='scientific-dag')
            db = sqlite3.connect(file)
            try:
                self.assertEqual(db.execute('SELECT COUNT(*) FROM mock_scientific_visits').fetchone(), db.execute('SELECT COUNT(*) FROM fact_monitoring').fetchone())
                self.assertEqual(db.execute("SELECT COUNT(DISTINCT date_id) FROM fact_monitoring WHERE location_id='dag-hot-0'").fetchone()[0], 83)
                self.assertEqual(db.execute("SELECT COUNT(DISTINCT visit_id),SUM(effort_value) FROM mock_scientific_visits WHERE location_id='dag-hot-0' AND sampled_on='2024-06-15'").fetchone()[0], 1)
                self.assertEqual(db.execute('PRAGMA foreign_key_check').fetchall(), [])
                metadata = db.execute('SELECT metadata_json FROM _cdc_mock_provenance').fetchone()[0]
                self.assertIn('"origin": "mock"', metadata)
            finally:
                db.close()


if __name__ == '__main__':
    unittest.main()
