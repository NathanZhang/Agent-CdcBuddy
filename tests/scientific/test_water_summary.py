import json
import sqlite3
import tempfile
import unittest
from pathlib import Path
from analytics_engine.env.water_rf_kriging import evaluate_water_health_risk


class WaterSummaryTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.db = str(Path(self.tmp.name) / 'water.db')
        self.conn = sqlite3.connect(self.db)
        self.addCleanup(self.conn.close)
        self.conn.executescript('CREATE TABLE dim_env_stations(station_id TEXT,latitude REAL,longitude REAL); CREATE TABLE fact_water_monitoring(record_id TEXT,station_id TEXT,city TEXT,district TEXT,monitoring_date TEXT,is_standard_met INTEGER,lead_val REAL,cadmium_val REAL,arsenic_val REAL,chloroform_val REAL,carcinogenic_risk REAL,hazard_quotient REAL);')

    def insert(self, i, station, passed=None, hq=None, cr=None, lead=None, date='2026-08-01'):
        self.conn.execute('INSERT INTO fact_water_monitoring VALUES(?,?,?,?,?,?,?,?,?,?,?,?)', (str(i), station, '郑州市', '金水区', date, passed, lead, None, None, None, cr, hq))
        self.conn.commit()

    def run_summary(self, **kwargs):
        result = evaluate_water_health_risk(db_path=self.db, **kwargs)
        json.dumps(result, allow_nan=False)
        return result

    def test_all_missing_never_becomes_risk_or_success(self):
        self.insert(1, 's')
        r = self.run_summary()
        self.assertEqual(r['status'], 'INSUFFICIENT_DATA')
        self.assertIsNone(r['passRate'])
        self.assertTrue(all(v == 0 for v in r['validValueCounts'].values()))
        self.assertTrue(all(v is None for v in r['healthRiskSummary'].values()))
        self.assertIsNone(r['disposalAdvice'])

    def test_counts_use_distinct_stations_and_known_compliance_with_zero_preserved(self):
        self.insert(1, 'a', 1, 0, 0, 0)
        self.insert(2, 'a', None, None)
        self.insert(3, 'b', 0, 2)
        r = self.run_summary()
        self.assertEqual(r['totalSamples'], 3)
        self.assertEqual(r['evaluationResult']['totalStationsSampled'], 2)
        self.assertEqual(r['complianceKnownSamples'], 2)
        self.assertEqual(r['passRate'], 50)
        self.assertEqual(r['validValueCounts']['hazard_quotient'], 2)
        self.assertEqual(r['healthRiskSummary']['nonCarcinogenicHqAverage'], 1)
        self.assertEqual(r['contaminantAverages']['leadMgL'], 0)
        self.assertIsNone(r['contaminantAverages']['cadmiumMgL'])

    def test_limit_and_time_scope_are_explicit(self):
        for i in range(4):
            self.insert(i, f's{i}', 1, i, date=f'2026-08-0{i+1}')
        r = self.run_summary(limit=2, from_date='2026-08-02', as_of='2026-08-04')
        self.assertEqual(r['matchedSamples'], 3)
        self.assertEqual(r['matchedStations'], 3)
        self.assertEqual(r['returnedSamples'], 2)
        self.assertEqual(r['evaluationResult']['totalStationsSampled'], 2)
        self.assertTrue(r['truncated'])
        self.assertIn('sample-limit-applied', r['qualityFlags'])

    def test_nonfinite_and_no_data_are_handled(self):
        self.insert(1, 'a', None, float('inf'))
        self.assertEqual(self.run_summary()['status'], 'INSUFFICIENT_DATA')
        self.insert(2, 'a', None, -1)
        result = self.run_summary()
        self.assertEqual(result['validValueCounts']['hazard_quotient'], 0)
        self.assertIn('invalid-measurement-values-excluded', result['qualityFlags'])
        self.assertEqual(self.run_summary(city='不存在市')['status'], 'NO_DATA')
