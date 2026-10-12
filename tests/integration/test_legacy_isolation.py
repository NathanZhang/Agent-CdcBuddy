from contextlib import closing
import importlib.util
import sqlite3
import tempfile
import unittest
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
class LegacyIsolationTests(unittest.TestCase):
    def test_snapshot_writes_never_reach_source(self):
        spec = importlib.util.spec_from_file_location('isolated', ROOT / 'tests/run_isolated_legacy.py')
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory() as temp:
            base = Path(temp)
            source = base / 'source.db'
            with closing(sqlite3.connect(source)) as conn, conn:
                conn.execute('CREATE TABLE records(value INTEGER)')
                conn.execute('INSERT INTO records VALUES (7)')
            target = base / 'snapshot.db'
            module.snapshot_database(source, target)
            with closing(sqlite3.connect(target)) as conn, conn:
                conn.execute('UPDATE records SET value=99')
            with closing(sqlite3.connect(source)) as conn, conn:
                self.assertEqual(conn.execute('SELECT value FROM records').fetchone()[0], 7)
