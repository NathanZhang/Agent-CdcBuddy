"""Audit generated fixtures, not the developer's existing database snapshots."""
from contextlib import closing
import hashlib
import json
import os
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


class MockDemoCoverageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(prefix='cdc-mock-scenes-')
        cls.addClassCleanup(cls.temp.cleanup)
        cls.directory = Path(cls.temp.name) / 'fixtures'
        subprocess.run([sys.executable, str(ROOT / 'scripts/ci-fixtures.py'),
                        '--output-dir', str(cls.directory)], check=True, capture_output=True)

    def connect(self, domain):
        return closing(sqlite3.connect(self.directory / f'{domain}.db'))

    def test_recommendation_sql_scenes_have_data(self):
        # The TS reference file contains one JSON object per recommendation.
        # Reuse it so changes to UI examples cannot leave this audit behind.
        cases = [json.loads(line.strip().rstrip(',')) for line in
                 (ROOT / 'tests/refactor/fixtures/recommendation-data-cases.ts').read_text().splitlines()
                 if line.strip().startswith('{')]
        self.assertEqual(len(cases), 48)
        for case in cases:
            if 'sql' not in case['args']:
                continue  # Analytical scenes are verified through their actual algorithms below.
            with self.subTest(scene=case['title']), self.connect(case['domain']) as conn:
                rows = conn.execute(case['args']['sql']).fetchall()
                self.assertTrue(rows, case['title'])

    def test_water_months_and_station_references(self):
        with self.connect('env') as conn:
            months = conn.execute("SELECT DISTINCT substr(monitoring_date,1,7) FROM fact_water_monitoring WHERE city='郑州市' AND sample_type='出厂水'").fetchall()
            self.assertEqual(len(months), 32)
            for table, column, kind in [('fact_water_monitoring', 'station_id', 'water_plant'),
                                        ('fact_air_climate_monitoring', 'station_id', 'air_station'),
                                        ('fact_sewage_monitoring', 'plant_id', 'sewage_plant')]:
                with self.subTest(table=table):
                    self.assertEqual(conn.execute(f'''SELECT COUNT(*) FROM {table} f LEFT JOIN dim_env_stations s
                        ON f.{column}=s.station_id WHERE s.station_id IS NULL OR s.station_type!=?
                        OR f.city!=s.city OR f.district!=s.district''', (kind,)).fetchone()[0], 0)

    def test_sewage_daily_series_has_computed_six_day_lag(self):
        from analytics_engine.mock_methods import sewage
        result = sewage(db_path=str(self.directory / 'env.db'), city='郑州市',
                        from_date='2026-07-01', as_of='2026-08-31', max_lag=14)
        self.assertEqual(result['status'], 'SUCCESS')
        self.assertEqual(len(result['groups']), 11)
        for plant in result['groups']:
            with self.subTest(plant=plant['plantId']):
                self.assertEqual(plant['observedDates'], 62)
                self.assertEqual(plant['optimalLagWindow']['lagDays'], 6)
                self.assertGreater(plant['optimalLagWindow']['pearsonCorrelation'], .95)
                self.assertTrue(all(lag['pairedDates'] >= 48 for lag in plant['lagCorrelationTrend']))

    def test_environment_alerts_are_backed_by_measurements(self):
        with self.connect('env') as conn:
            self.assertEqual(set(r[0] for r in conn.execute('SELECT DISTINCT status FROM fact_env_alerts')),
                             {'pending', 'in_progress', 'resolved'})
            self.assertEqual(conn.execute('''SELECT COUNT(*) FROM fact_env_alerts a
                WHERE NOT EXISTS (SELECT 1 FROM fact_water_monitoring f WHERE f.city=a.city
                AND f.district=a.district AND f.is_standard_met=0
                AND f.monitoring_date=substr(a.created_at,1,10))''').fetchone()[0], 0)

    def test_foodborne_events_and_molecular_records_are_consistent(self):
        with self.connect('foodborne') as conn:
            self.assertEqual(conn.execute('''SELECT COUNT(*) FROM fact_foodborne_case c
                LEFT JOIN dim_hospital h ON c.hospital_id=h.hospital_id
                LEFT JOIN dim_location l ON c.city=l.city_name AND c.district=l.district_name
                LEFT JOIN dim_food_category f ON c.food_category_id=f.category_id
                WHERE h.hospital_id IS NULL OR h.city!=c.city OR l.city_name IS NULL OR f.category_id IS NULL''').fetchone()[0], 0)
            for cluster, start, end, expected in conn.execute('SELECT cluster_id,start_time,end_time,case_count FROM fact_outbreak_event'):
                with self.subTest(cluster=cluster):
                    count, first, last = conn.execute('SELECT COUNT(*),MIN(symptom_onset_time),MAX(symptom_onset_time) FROM fact_foodborne_case WHERE cluster_id=?', (cluster,)).fetchone()
                    self.assertEqual(count, expected)
                    self.assertGreaterEqual(first, start)
                    self.assertLessEqual(last, end)
            self.assertEqual(conn.execute('''SELECT COUNT(*) FROM fact_pathogen_molecular m
                LEFT JOIN fact_foodborne_case c ON m.case_id=c.case_id JOIN dim_pathogen_type p ON m.pathogen_id=p.pathogen_id
                WHERE c.case_id IS NULL OR c.is_pathogen_positive!=1 OR p.category!='细菌'
                OR m.pathogen_id!=c.pathogen_id OR m.city!=c.city OR m.district!=c.district''').fetchone()[0], 0)
        from analytics_engine.foodborne.cgmlst_cluster import calculate_cgmlst_clustering
        result = calculate_cgmlst_clustering(str(self.directory / 'foodborne.db'), cluster_id='OUTBREAK-202608-01', threshold=5)
        self.assertEqual(result['status'], 'SUCCESS')
        self.assertEqual(result['analyzedIsolatesCount'], 8)
        self.assertEqual(result['homologousGroupsCount'], 1)

    def test_chronic_candidates_and_quality_controls(self):
        from analytics_engine.mock_methods import mortality, injury
        from analytics_engine.chronic.death_cert_qc import validate_death_certificate_quality
        db = str(self.directory / 'chronic.db')
        rare = mortality(db_path=db, target_city='郑州市', district='金水区', from_date='2026-08-01', as_of='2026-08-19')
        self.assertTrue(any(r['icd10_code'] == 'A81.0' and r['caseCount'] >= 3 for r in rare['rareMortalityClustersDetected']))
        injuries = injury(db_path=db, from_date='2026-01-01', as_of='2026-08-18')
        self.assertTrue(any(r['city'] == '平顶山市' and r['district'] == '郏县' and r['caseCount'] >= 5 for r in injuries['clusterIncidentsDetected']))
        qc = validate_death_certificate_quality(db, from_date='2026-01-01', as_of='2026-08-19')
        self.assertTrue({'CERT-2026-ERR-001', 'CERT-2026-ERR-002'} <= {r['certId'] for r in qc['flaggedConflictCases']})
        with self.connect('chronic') as conn:
            for table in ['fact_death_registry', 'fact_chronic_cases', 'fact_injury_surveillance', 'fact_chronic_alerts']:
                self.assertEqual(conn.execute(f'''SELECT COUNT(*) FROM {table} f LEFT JOIN dim_districts d
                    ON f.city=d.city AND f.district=d.district WHERE d.district_id IS NULL''').fetchone()[0], 0)
            self.assertEqual(conn.execute("SELECT COUNT(*) FROM fact_death_registry WHERE qc_status='VALID' AND age<40 AND underlying_cause LIKE '%阿尔茨海默%'").fetchone()[0], 0)
            self.assertEqual(conn.execute("SELECT COUNT(*) FROM fact_death_registry WHERE underlying_cause LIKE '%跌倒%' AND icd10_code NOT LIKE 'W%'").fetchone()[0], 0)

    def test_vector_comparisons_have_multiple_locations_species_and_pesticides(self):
        with self.connect('vector') as conn:
            self.assertEqual(conn.execute('SELECT COUNT(DISTINCT city) FROM dim_location').fetchone()[0], 18)
            self.assertGreaterEqual(conn.execute("SELECT COUNT(DISTINCT l.district) FROM fact_monitoring f JOIN dim_location l USING(location_id) WHERE l.city='郑州市' AND date_id LIKE '2024-%'").fetchone()[0], 3)
            self.assertGreaterEqual(conn.execute("SELECT COUNT(DISTINCT f.species_id) FROM fact_monitoring f JOIN dim_species s USING(species_id) WHERE s.category='蚊' AND date_id LIKE '2024-%'").fetchone()[0], 2)
            self.assertGreaterEqual(conn.execute("SELECT COUNT(DISTINCT pesticide_id) FROM fact_insecticide_resistance f JOIN dim_species s USING(species_id) WHERE s.species_name='家蝇'").fetchone()[0], 2)
            self.assertGreater(conn.execute('SELECT COUNT(*) FROM fact_insecticide_resistance WHERE lc50 IS NOT NULL').fetchone()[0], 0)
            self.assertGreater(conn.execute('SELECT COUNT(*) FROM fact_insecticide_resistance WHERE lc50 IS NULL').fetchone()[0], 0)

    def test_database_integrity_and_manifest_bindings(self):
        manifest = json.loads((self.directory / 'manifest.json').read_text())
        bindings = json.loads((self.directory / 'region-bindings.json').read_text())
        self.assertEqual({r['domain'] for r in manifest}, {'vector', 'foodborne', 'env', 'chronic'})
        for entry in manifest:
            with self.subTest(domain=entry['domain']), self.connect(entry['domain']) as conn:
                self.assertEqual(entry['origin'], 'mock')
                self.assertEqual(conn.execute('PRAGMA integrity_check').fetchone()[0], 'ok')
                self.assertFalse(conn.execute('PRAGMA foreign_key_check').fetchall())
                self.assertEqual(bindings[entry['domain']]['datasetVersion'], entry['version'])
                self.assertEqual(bindings[entry['domain']]['sourceCRS'], 'EPSG:4326')

    def test_points_belong_to_their_declared_administration(self):
        sys.path.insert(0, str(ROOT / 'scripts'))
        try:
            from mock_geography import region_geometry, contains
            for domain, table in [('vector', 'dim_location'), ('env', 'dim_env_stations'), ('chronic', 'dim_districts')]:
                with self.connect(domain) as conn:
                    for city, district, lat, lon in conn.execute(f'SELECT city,district,latitude,longitude FROM {table}'):
                        with self.subTest(domain=domain, city=city, district=district):
                            geometry = region_geometry(city, district)
                            polygons = geometry['coordinates'] if geometry['type'] == 'MultiPolygon' else [geometry['coordinates']]
                            self.assertTrue(any(contains(p, lon, lat) for p in polygons))
        finally:
            sys.path.pop(0)

    def test_demo_entrypoint_enforces_tier_and_protects_existing_bundle(self):
        destination = Path(self.temp.name) / 'forbidden'
        command = [sys.executable, str(ROOT / 'scripts/seed-demo.py'), '--domain', 'all',
                   '--output-dir', str(destination), '--seed', '7']
        process = subprocess.run(command, env={**os.environ, 'DEPLOYMENT_TIER': 'pilot'}, capture_output=True, text=True)
        self.assertNotEqual(process.returncode, 0)
        self.assertIn('DEPLOYMENT_TIER=demo required', process.stderr)
        self.assertFalse(destination.exists())
        before = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in self.directory.iterdir() if p.is_file()}
        command[command.index(str(destination))] = str(self.directory)
        process = subprocess.run(command, env={**os.environ, 'DEPLOYMENT_TIER': 'demo'}, capture_output=True, text=True)
        self.assertNotEqual(process.returncode, 0)
        self.assertEqual(before, {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in self.directory.iterdir() if p.is_file()})


if __name__ == '__main__':
    unittest.main()
