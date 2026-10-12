import json
import os
import sys
import subprocess
import sqlite3
from contextlib import closing
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'analytics_engine'))
from repositories.datasets import resolve_dataset_path,connect_dataset
class DomainPathTests(unittest.TestCase):
    def test_manifest_change_takes_effect_without_reimport(self):
        with tempfile.TemporaryDirectory() as temp:
            base=Path(temp).resolve();manifest=base/'datasets.json'
            def configure(name):
                manifest.write_text(json.dumps([{'id':'env-test','domain':'env','origin':'mock','version':'1','asOf':'2026-08-31','schemaVersion':'1','path':name}]))
            configure('one.db')
            with patch.dict(os.environ,{'DATASET_MANIFEST_PATH':str(manifest)}):
                self.assertEqual(resolve_dataset_path('env'),base/'one.db')
                configure('two.db')
                self.assertEqual(resolve_dataset_path('env'),base/'two.db')
                with self.assertRaises(ValueError): resolve_dataset_path('vector',dataset_id='env-test')
    def test_missing_dataset_is_not_created(self):
        with tempfile.TemporaryDirectory() as temp:
            base=Path(temp).resolve();manifest=base/'datasets.json';missing=base/'absent.db'
            manifest.write_text(json.dumps([{'id':'env-test','domain':'env','origin':'mock','version':'1','asOf':'2026-08-31','schemaVersion':'1','path':str(missing)}]))
            with patch.dict(os.environ,{'DATASET_MANIFEST_PATH':str(manifest)}):
                with self.assertRaises(Exception): connect_dataset('env')
            self.assertFalse(missing.exists())

class TaskRoutingTests(unittest.TestCase):
    def test_foodborne_alias_uses_foodborne_domain(self):
        with tempfile.TemporaryDirectory() as temp:
            db=Path(temp)/'foodborne.db'
            generated=subprocess.run([sys.executable,str(ROOT/'scripts/init_foodborne_mock.py'),'--output',str(db),'--seed','7'],capture_output=True,text=True)
            self.assertEqual(generated.returncode,0,generated.stderr)
            for alias in ['cgmlst_clustering','molecular_trace']:
                with self.subTest(alias=alias):
                    result=subprocess.run([sys.executable,str(ROOT/'analytics_engine/engine.py'),'--task',alias,'--domain','foodborne','--db',str(db),'--args',json.dumps({'clusterId':'OUTBREAK-202608-01'})],capture_output=True,text=True)
                    self.assertEqual(result.returncode,0,result.stderr)
                    self.assertGreater(json.loads(result.stdout)['analyzedIsolatesCount'],0)
