"""Exercise server.sh in an isolated checkout without touching running services."""
import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]


class ServerStatusTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory(prefix='cdc server status ')
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name).resolve()
        shutil.copy2(ROOT / 'server.sh', self.root / 'server.sh')
        self.bin = self.root / 'bin'
        self.bin.mkdir()
        self.env = {**os.environ, 'PATH': f'{self.bin}:{os.environ["PATH"]}'}
        self.process = subprocess.Popen(['sleep', '60'], cwd=self.root)
        self.addCleanup(self.stop_process)
        self.pid = self.process.pid
        self.tool('lsof', '''import json, os, sys
args = sys.argv[1:]
if '-ti' in args:
    port = next(arg[4:] for arg in args if arg.startswith('tcp:'))
    pid = json.loads(os.environ.get('LISTENERS', '{}')).get(port)
    if pid: print(pid)
    else: sys.exit(1)
elif 'cwd' in args:
    print('n' + os.environ['TEST_CWD'])
''')
        self.tool('ps', '''import os, sys
if 'etime=' in sys.argv: print('  01:23')
else: print(os.environ.get('TEST_COMMAND', ''))
''')
        self.env['TEST_CWD'] = str(self.root)

    def tool(self, name, source):
        script = self.bin / name
        script.write_text(f'#!{sys.executable}\n{source}')
        script.chmod(0o755)

    def stop_process(self):
        self.process.terminate()
        self.process.wait(timeout=5)

    def run_script(self, *args):
        result = subprocess.run(['bash', str(self.root / 'server.sh'), *args],
                                cwd='/', env=self.env, capture_output=True, text=True, timeout=15)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        return result.stdout

    def write_pid(self, domain='vector', mode='mock', pid=None):
        suffix = '_mock' if mode == 'mock' else ''
        file = self.root / f'.server_{domain}{suffix}.pid'
        file.write_text(str(self.pid if pid is None else pid) + '\n')
        return file

    def test_default_status_shows_both_groups_without_changing_pid_files(self):
        stale = self.write_pid(mode='dev', pid='invalid')
        mock = self.write_pid()
        self.env['LISTENERS'] = json.dumps({'3101': self.pid})
        before = {p.name: p.read_bytes() for p in self.root.glob('.server*')}
        output = self.run_script('status')
        self.assertEqual(output.count('[dev/prod]'), 4)
        self.assertEqual(output.count('[mock]'), 4)
        self.assertIn('STALE', output)
        self.assertIn('RUNNING (正常)', output)
        self.assertIn(str(self.root), output)
        self.assertIn('01:23', output)
        self.assertTrue(stale.exists() and mock.exists())
        self.assertEqual(before, {p.name: p.read_bytes() for p in self.root.glob('.server*')})
        self.assertFalse((self.root / '.mock-data').exists())

    def test_mock_shorthand_checks_all_domains_and_conflict_does_not_abort(self):
        self.env['LISTENERS'] = json.dumps({'3101': self.pid})
        output = self.run_script('status', 'mock')
        self.assertEqual(output.count('[mock]'), 4)
        self.assertNotIn('[dev/prod]', output)
        self.assertIn('UNMANAGED', output)
        self.assertIn('chronic', output)
        self.assertIsNone(self.process.poll())
        self.assertFalse((self.root / '.server_vector_mock.pid').exists())

    def test_domain_filter_and_matching_metadata_show_actual_custom_bundle(self):
        pid_file = self.write_pid()
        bundle = self.root / 'custom bundle'
        pid_file.with_suffix('.meta').write_text(f'{self.pid}\nmock\n/recorded/cwd\n{bundle}\n')
        self.env['LISTENERS'] = json.dumps({'3101': self.pid})
        output = self.run_script('status', 'vector', 'mock')
        self.assertEqual(output.count('[mock]'), 1)
        self.assertIn(f'工作目录  : {self.root}', output)
        self.assertIn(f'Mock数据包: {bundle}', output)
        self.assertIn(f'{bundle}/simulation-business.db', output)
        self.assertIn('.next_acceptance_vector', output)
        self.assertIn('server_vector_mock.log', output)
        self.assertNotIn('foodborne [', output)

    def test_process_without_listener_and_stale_metadata_are_distinguished(self):
        pid_file = self.write_pid()
        pid_file.with_suffix('.meta').write_text('999999999\nmock\n/wrong/cwd\n/wrong/bundle\n')
        output = self.run_script('status', 'vector', 'mock')
        self.assertIn('STARTING', output)
        self.assertIn('未记录', output)
        self.assertNotIn('/wrong/', output)

    def test_legacy_mock_bundle_is_recovered_from_command_with_spaces(self):
        self.write_pid()
        self.env['TEST_COMMAND'] = 'node scripts/start-requirement-demo.cjs vector .mock-data/custom bundle'
        output = self.run_script('status', 'vector', 'mock')
        self.assertIn(f'{self.root}/.mock-data/custom bundle/simulation-business.db', output)

    def test_ordinary_port_discovery_is_read_only_and_mode_is_recorded(self):
        self.env['LISTENERS'] = json.dumps({'3001': self.pid})
        output = self.run_script('status', 'vector', 'prod')
        self.assertIn('RUNNING (端口监听)', output)
        self.assertNotIn('[mock]', output)
        self.assertFalse((self.root / '.server_vector.pid').exists())
        pid_file = self.write_pid(mode='prod')
        pid_file.with_suffix('.meta').write_text(f'{self.pid}\nprod\n{self.root}\n-\n')
        self.assertIn('[prod]', self.run_script('status', 'vector', 'prod'))

    def test_mock_start_records_custom_bundle_and_stop_removes_metadata(self):
        (self.root / '.venv').mkdir()
        bundle = self.root / 'custom bundle'
        bundle.mkdir()
        self.tool('node', '''import sys, time
if '--check' not in sys.argv:
    print('Ready in 1ms', flush=True)
    time.sleep(60)
''')
        mock_pid = None
        try:
            self.run_script('start', 'vector', 'mock', str(bundle))
            pid_file = self.root / '.server_vector_mock.pid'
            mock_pid = int(pid_file.read_text())
            self.assertEqual(pid_file.with_suffix('.meta').read_text().splitlines(),
                             [str(mock_pid), 'mock', str(self.root), str(bundle)])
            self.env['LISTENERS'] = json.dumps({'3101': mock_pid})
            self.assertIn(f'Mock数据包: {bundle}', self.run_script('status', 'vector', 'mock'))
            self.run_script('stop', 'vector', 'mock')
            self.assertFalse(pid_file.exists())
            self.assertFalse(pid_file.with_suffix('.meta').exists())
        finally:
            if mock_pid:
                try:
                    os.kill(mock_pid, signal.SIGTERM)
                except ProcessLookupError:
                    pass


if __name__ == '__main__':
    unittest.main()
