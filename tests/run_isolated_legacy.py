"""Run legacy compatibility tests against SQLite backups in a disposable project."""
import hashlib
import json
import shutil
import sqlite3
import subprocess
import sys
import tempfile
from contextlib import closing
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def snapshot_database(source, target):
    with closing(sqlite3.connect(f'{Path(source).resolve().as_uri()}?mode=ro', uri=True)) as original:
        with closing(sqlite3.connect(target)) as snapshot:
            original.backup(snapshot)

def fingerprint(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
    datasets = list(ROOT.glob('*.db'))
    required = ['vector_monitoring.db', 'foodborne_monitoring.db', 'env_monitoring.db', 'chronic_monitoring.db', 'app_business.db']
    missing = [name for name in required if not (ROOT / name).is_file()]
    if missing:
        print(f'Missing baseline datasets: {missing}', file=sys.stderr)
        return 2
    before = {p.name: fingerprint(p) for p in datasets}
    evidence = ROOT / 'docs/reviews/2026-10-12/refactor-evidence/current'
    evidence.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='cdcbuddy-legacy-') as temp:
        isolated = Path(temp)
        for name in ['analytics_engine', 'tests']:
            shutil.copytree(ROOT / name, isolated / name, ignore=shutil.ignore_patterns('__pycache__', '*.pyc'))
        for dataset in datasets:
            snapshot_database(dataset, isolated / dataset.name)
        with (evidence / 'legacy-baseline.log').open('w') as output:
            process = subprocess.run([sys.executable, str(isolated / 'tests/run_all_agent_tests.py')], cwd=isolated, stdout=output, stderr=subprocess.STDOUT)
        for name in ['all_agents_test_report.json', 'all_agents_test_report.md']:
            report = isolated / 'tests/reports' / name
            if report.exists():
                shutil.copy2(report, evidence / name)
        summary_path = isolated / 'tests/reports/all_agents_test_report.json'
        summary = json.loads(summary_path.read_text()) if summary_path.exists() else {}
    unchanged = all(fingerprint(p) == before[p.name] for p in datasets)
    (evidence / 'source-protection.json').write_text(json.dumps({'sha256': before, 'unchanged': unchanged}, indent=2) + '\n')
    print(f"Legacy regression: {summary.get('total_passed', 0)}/{summary.get('total_tests', 0)}; source databases unchanged={unchanged}")
    return 0 if process.returncode == 0 and unchanged and summary.get('total_tests', 0) > 0 else 1

if __name__ == '__main__':
    sys.exit(main())
