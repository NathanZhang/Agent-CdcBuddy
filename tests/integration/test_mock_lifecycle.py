"""Safety invariants: no unregistered/changed/active/real file can be deleted."""
from contextlib import closing
import json
import os
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
import socket
import uuid

ROOT = Path(__file__).resolve().parents[2]
from analytics_engine.mock_lifecycle import generation, read_marker, digest, cleanup, dataset_lease, assert_read_allowed


class MockLifecycleTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='cdc-mock-safety-')
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name).resolve()
        self.env = patch.dict(os.environ, {'DEPLOYMENT_TIER': 'demo'})
        self.env.start(); self.addCleanup(self.env.stop)
        self.real = self.base / 'observed.db'
        with sqlite3.connect(self.real) as conn:
            conn.execute('CREATE TABLE real_records(value TEXT)')
            conn.execute("INSERT INTO real_records VALUES('preserve actual source')")
        self.real_hash = digest(self.real)
        self.manifest = self.base / 'active.json'
        self.manifest.write_text(json.dumps([{'domain': 'vector', 'origin': 'observed', 'path': str(self.real)}]))
        self.mock = self.base / 'mock.db'
        self.store = self.base / 'audit'
        with generation(self.mock, 'vector', 7, __file__, self.store) as meta:
            self.dataset_id = meta['datasetId']
            with sqlite3.connect(self.mock) as conn:
                conn.execute('CREATE TABLE fact_monitoring(value INTEGER)')
                conn.execute('INSERT INTO fact_monitoring VALUES(7)')

    def result(self, apply=False):
        return cleanup(self.store, self.dataset_id, apply=apply, manifest_path=self.manifest)[0]

    def tearDown(self):
        self.assertTrue(self.real.exists())
        self.assertEqual(digest(self.real), self.real_hash)

    def test_generation_audit_has_identity_hash_parameters_and_counts(self):
        marker = read_marker(self.mock)
        self.assertEqual(marker['origin'], 'mock'); self.assertEqual(marker['seed'], 7)
        self.assertTrue(marker['createdAt']); self.assertTrue(marker['generatorSha256']); self.assertTrue(marker['operator'])
        with closing(sqlite3.connect(self.store / 'mock-registry.sqlite3')) as conn:
            status, sha = conn.execute('SELECT status,sha256 FROM mock_datasets').fetchone()
            self.assertEqual((status, sha), ('READY', digest(self.mock)))
            events = conn.execute('SELECT action,payload_json FROM mock_audit ORDER BY created_at,rowid').fetchall()
            self.assertEqual([e[0] for e in events], ['GENERATING', 'READY'])
            self.assertEqual(json.loads(events[-1][1])['tableCounts']['fact_monitoring'], 1)

    def test_preview_and_apply_remove_only_registered_mock_and_keep_audit(self):
        self.assertEqual(self.result()['status'], 'WOULD_DELETE'); self.assertTrue(self.mock.exists())
        self.assertEqual(self.result(True)['status'], 'DELETED'); self.assertFalse(self.mock.exists())
        with closing(sqlite3.connect(self.store / 'mock-registry.sqlite3')) as conn:
            self.assertEqual(conn.execute('SELECT status FROM mock_datasets').fetchone()[0], 'DELETED')
            self.assertEqual(conn.execute("SELECT COUNT(*) FROM mock_audit WHERE action='CLEANUP_DELETED'").fetchone()[0], 1)

    def test_selected_manifest_and_path_override_are_protected(self):
        self.manifest.write_text(json.dumps([{'domain': 'vector', 'origin': 'mock', 'path': str(self.mock)}]))
        self.assertEqual(self.result(True)['status'], 'REFUSED')
        self.manifest.write_text(json.dumps([{'domain': 'vector', 'origin': 'observed', 'path': str(self.real)}]))
        with patch.dict(os.environ, {'DATASET_VECTOR_PATH': str(self.mock)}):
            self.assertEqual(self.result(True)['status'], 'REFUSED')
        self.assertTrue(self.mock.exists())

    def test_active_lease_prevents_cleanup_and_new_reads_fail_after_deletion(self):
        with dataset_lease(self.mock):
            result = self.result(True)
            self.assertEqual(result['status'], 'REFUSED'); self.assertIn('lease', result['reason'])
        backup = self.mock.read_bytes()
        self.assertEqual(self.result(True)['status'], 'DELETED')
        self.mock.write_bytes(backup)
        with self.assertRaisesRegex(ValueError, 'INACTIVE'):
            with dataset_lease(self.mock):
                pass

    def test_mutated_snapshot_including_real_rows_is_preserved(self):
        with sqlite3.connect(self.mock) as conn:
            conn.execute('CREATE TABLE newly_imported_real_data(value TEXT)')
            conn.execute("INSERT INTO newly_imported_real_data VALUES('real')")
        self.assertEqual(self.result(True)['status'], 'REFUSED')
        self.assertTrue(self.mock.exists())
        with sqlite3.connect(self.mock) as conn:
            self.assertEqual(conn.execute('SELECT value FROM newly_imported_real_data').fetchone()[0], 'real')

    def test_symlinks_hardlinks_and_replaced_inodes_are_never_unlinked(self):
        backup = self.mock.read_bytes()
        self.mock.unlink(); self.mock.symlink_to(self.real)
        self.assertEqual(self.result(True)['status'], 'REFUSED'); self.assertTrue(self.mock.is_symlink())
        self.mock.unlink(); self.mock.write_bytes(backup)
        self.assertEqual(self.result(True)['status'], 'REFUSED'); self.assertTrue(self.mock.exists())
        link = self.base / 'other-link.db'; os.link(self.mock, link)
        self.assertEqual(self.result(True)['status'], 'REFUSED'); self.assertTrue(link.exists())

    def test_registry_path_tampering_cannot_delete_observed_database(self):
        with sqlite3.connect(self.store / 'mock-registry.sqlite3') as conn:
            conn.execute('UPDATE mock_datasets SET path=?', (str(self.real),))
        self.assertEqual(self.result(True)['status'], 'REFUSED')
        self.assertTrue(self.mock.exists())
        with self.assertRaisesRegex(ValueError, 'Unknown'):
            cleanup(self.store, 'unregistered', apply=True, manifest_path=self.manifest)

    def test_existing_non_audit_registry_and_active_sidecars_are_protected(self):
        other_store=self.base/'not-an-audit';other_store.mkdir()
        registry_file=other_store/'mock-registry.sqlite3';registry_file.write_bytes(self.real.read_bytes())
        with self.assertRaisesRegex(ValueError,'non-audit'):
            with generation(self.base/'new.db','vector',7,__file__,other_store):pass
        self.assertEqual(digest(registry_file),self.real_hash)
        sidecar=Path(str(self.mock)+'-wal');sidecar.write_bytes(b'potential real writes')
        self.assertEqual(self.result(True)['status'],'REFUSED')
        self.assertTrue(sidecar.exists());self.assertTrue(self.mock.exists())

    def test_generation_refuses_existing_real_file_and_failed_generation_is_audited(self):
        with self.assertRaises(FileExistsError):
            with generation(self.real, 'vector', 7, __file__, self.store):
                self.fail('Existing real source was enrolled')
        broken = self.base / 'failed.db'
        with self.assertRaisesRegex(RuntimeError, 'intentional'):
            with generation(broken, 'vector', 7, __file__, self.store):
                raise RuntimeError('intentional generation failure')
        with sqlite3.connect(self.store / 'mock-registry.sqlite3') as conn:
            self.assertGreater(conn.execute("SELECT COUNT(*) FROM mock_audit WHERE action='FAILED'").fetchone()[0], 0)
        failed_id = read_marker(broken)['datasetId']
        self.assertEqual(cleanup(self.store, failed_id, apply=True, manifest_path=self.manifest)[0]['status'], 'DELETED')

    def test_live_pid_protects_snapshot_when_heartbeat_has_expired(self):
        with sqlite3.connect(self.store / 'mock-registry.sqlite3') as conn:
            conn.execute('INSERT INTO mock_leases VALUES(?,?,?,?,?)', ('paused-heartbeat', self.dataset_id, 0, os.getpid(), socket.gethostname()))
        self.assertEqual(self.result(True)['status'], 'REFUSED')
        self.assertTrue(self.mock.exists())

    def test_quarantine_recovery_and_cleanup_race_preserve_actual_replacement_data(self):
        quarantine = self.base / ('.mock-quarantine-' + str(uuid.uuid4()))
        self.mock.rename(quarantine)
        with sqlite3.connect(self.store / 'mock-registry.sqlite3') as conn:
            conn.execute("UPDATE mock_datasets SET status='RETIRED'")
            conn.execute('INSERT INTO mock_audit VALUES(?,?,?,?,?)', (str(uuid.uuid4()), 1, self.dataset_id, 'CLEANUP_STARTED', json.dumps({'quarantine': str(quarantine)})))
        self.assertEqual(self.result(True)['status'], 'DELETED')
        self.assertFalse(quarantine.exists())

    def test_race_between_validation_and_rename_never_deletes_real_replacement(self):
        original_rename = os.rename
        def replace_then_rename(source, target):
            # Simulate another writer replacing the file at exactly the rename boundary.
            Path(source).unlink()
            Path(source).write_bytes(self.real.read_bytes())
            original_rename(source, target)
        with patch('analytics_engine.mock_lifecycle.os.rename', side_effect=replace_then_rename):
            self.assertEqual(self.result(True)['status'], 'REFUSED')
        self.assertEqual(digest(self.mock), self.real_hash)

    def test_every_direct_generator_rejects_production_before_output_creation(self):
        for domain in ['vector', 'foodborne', 'env', 'chronic']:
            for explicit in [True, False]:
                with self.subTest(domain=domain, explicit=explicit):
                    output = self.base / f'forbidden-{domain}-{explicit}.db'
                    environment = {**os.environ, 'NODE_ENV': 'production'}
                    if explicit: environment['DEPLOYMENT_TIER'] = 'pilot'
                    else: environment.pop('DEPLOYMENT_TIER', None)
                    result = subprocess.run([sys.executable, str(ROOT / f'scripts/init_{domain}_mock.py'), '--output', str(output)], env=environment, capture_output=True, text=True)
                    self.assertNotEqual(result.returncode, 0); self.assertIn('MOCK_PRODUCTION_FORBIDDEN', result.stderr)
                    self.assertFalse(output.exists())

    def test_read_policy_rejects_relabelled_mock_and_production_direct_paths(self):
        with self.assertRaisesRegex(ValueError, 'ORIGIN_MISMATCH'):
            assert_read_allowed(self.mock, 'observed')
        with patch.dict(os.environ, {'DEPLOYMENT_TIER': 'pilot'}):
            with self.assertRaisesRegex(ValueError, 'PRODUCTION_FORBIDDEN'): assert_read_allowed(self.mock, 'mock')
            with self.assertRaisesRegex(ValueError, 'PRODUCTION_FORBIDDEN'): assert_read_allowed(self.mock)
        with patch.dict(os.environ, {'DEPLOYMENT_TIER': 'pilot', 'DATASET_MANIFEST_PATH': str(self.manifest)}):
            assert_read_allowed(self.real)

    def test_expired_selection_and_missing_configuration_fail_closed(self):
        self.assertEqual(cleanup(self.store, expired=True, apply=True, manifest_path=self.manifest), [])
        with self.assertRaisesRegex(ValueError, 'manifest missing'):
            cleanup(self.store, self.dataset_id, apply=True, manifest_path=self.base / 'missing.json')
        self.assertTrue(self.mock.exists())
        with sqlite3.connect(self.store / 'mock-registry.sqlite3') as conn:
            conn.execute('UPDATE mock_datasets SET expires_at=0')
        self.assertEqual(cleanup(self.store, expired=True, apply=True, manifest_path=self.manifest)[0]['status'], 'DELETED')


if __name__ == '__main__':
    unittest.main()
