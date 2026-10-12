"""Catch ignored output/seed flags, source DB overwrite, and import side effects."""
from contextlib import closing
import hashlib
import importlib.util
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TABLES = {'env': 'fact_water_monitoring', 'foodborne': 'fact_foodborne_case', 'chronic': 'fact_death_registry'}

class FixtureIsolationTests(unittest.TestCase):
    def copy_script(self, base, domain):
        scripts = base / 'project' / 'scripts'
        scripts.mkdir(parents=True, exist_ok=True)
        path = scripts / f'init_{domain}_mock.py'
        path.write_bytes((ROOT / 'scripts' / path.name).read_bytes())
        return path

    def test_import_has_no_filesystem_side_effects(self):
        for domain in TABLES:
            with self.subTest(domain=domain), tempfile.TemporaryDirectory() as temp:
                base = Path(temp)
                path = self.copy_script(base, domain)
                spec = importlib.util.spec_from_file_location(f'generator_{domain}', path)
                module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(module)
                self.assertFalse((base / 'Agent-CdcBuddy-DataMock').exists())

    def test_explicit_output_isolated_and_seeded(self):
        for domain, table in TABLES.items():
            with self.subTest(domain=domain), tempfile.TemporaryDirectory() as temp:
                base = Path(temp)
                path = self.copy_script(base, domain)
                source = path.parents[1] / f'{domain}_monitoring.db'
                source.write_bytes(b'protected source fixture')
                digest = hashlib.sha256(source.read_bytes()).hexdigest()
                snapshots = []
                for idx, seed in enumerate([17, 17, 29]):
                    output = base / f'fixture-{idx}.db'
                    process = subprocess.run([sys.executable, str(path), '--output', str(output), '--seed', str(seed)], capture_output=True, text=True)
                    self.assertEqual(process.returncode, 0, process.stderr)
                    self.assertTrue(output.exists(), 'generator ignored explicit output')
                    self.assertEqual(hashlib.sha256(source.read_bytes()).hexdigest(), digest)
                    with closing(sqlite3.connect(output)) as conn:
                        rows = conn.execute(f'SELECT * FROM {table} ORDER BY 1').fetchall()
                        self.assertGreater(len(rows), 0)
                        snapshots.append(rows)
                self.assertEqual(snapshots[0], snapshots[1])
                self.assertNotEqual(snapshots[0], snapshots[2], 'seed must affect generated facts')
                self.assertFalse((base / 'Agent-CdcBuddy-DataMock').exists())
                output = base / 'fixture-0.db'
                digest = hashlib.sha256(output.read_bytes()).hexdigest()
                repeated = subprocess.run([sys.executable, str(path), '--output', str(output), '--seed', '18'], capture_output=True, text=True)
                self.assertNotEqual(repeated.returncode, 0, 'existing DB must never be silently overwritten')
                self.assertEqual(hashlib.sha256(output.read_bytes()).hexdigest(), digest)

if __name__ == '__main__':
    unittest.main()
