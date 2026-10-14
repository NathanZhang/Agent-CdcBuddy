"""Explicit, isolated four-domain fixtures with matching source region bindings."""
from contextlib import closing
import json
from pathlib import Path
import sqlite3
import subprocess
import sys
import uuid

ROOT = Path(__file__).resolve().parents[1]
DOMAINS = ('vector', 'foodborne', 'env', 'chronic')
AS_OF = {'vector': '2025-11-05', 'foodborne': '2026-08-31', 'env': '2026-08-31', 'chronic': '2026-08-19'}


def generate_bundle(output_dir, seed=7, kind='ci', audit_dir=None, retention_days=7, vector_profile='historical-demo'):
    sys.path.insert(0, str(ROOT))
    from analytics_engine.mock_lifecycle import assert_generation_allowed
    assert_generation_allowed()
    output_dir = Path(output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=False)
    catalog = json.loads((ROOT / 'config/regions.json').read_text())
    by_code = {r['code']: r for r in catalog['regions']}
    version = f'synthetic-{kind}-v3-{uuid.uuid4()}'
    manifest, bindings = [], {}
    for domain in DOMAINS:
        output = output_dir / f'{domain}.db'
        command = [sys.executable, str(ROOT / f'scripts/init_{domain}_mock.py'),
                   '--output', str(output), '--seed', str(seed), '--retention-days', str(retention_days)]
        if domain == 'vector':
            command += ['--profile', vector_profile]
        if audit_dir:
            command += ['--audit-dir', str(Path(audit_dir).resolve())]
        subprocess.run(command, check=True, stdout=subprocess.DEVNULL)
        manifest.append({'id': domain + '-monitoring', 'domain': domain, 'origin': 'mock',
                         'version': version, 'schemaVersion': '1', 'asOf': AS_OF[domain], 'path': str(output)})
        pairs = set()
        with closing(sqlite3.connect(output)) as connection:
            if connection.execute('PRAGMA integrity_check').fetchone()[0] != 'ok' or connection.execute('PRAGMA foreign_key_check').fetchall():
                raise ValueError(f'Invalid generated dataset: {domain}')
            for table, in connection.execute("SELECT name FROM sqlite_master WHERE type='table' AND (name GLOB 'dim_*' OR name GLOB 'fact_*')"):
                columns = [row[1] for row in connection.execute(f'PRAGMA table_info("{table}")')]
                if 'city' in columns:
                    pairs.update(connection.execute(f'SELECT DISTINCT city,{"district" if "district" in columns else "NULL"} FROM "{table}"'))
        regions = [{'code': '410000'}]
        for region in catalog['regions']:
            if region['level'] == 'province':
                continue
            if region['level'] == 'city':
                names = sorted({city for city, district in pairs if city in region['aliases']})
                if names:
                    regions.append({'code': region['code'], 'city': names[0]})
            else:
                parent = by_code.get(region['parentCode'])
                matches = sorted((city, district) for city, district in pairs
                                 if parent and city in parent['aliases'] and district in region['aliases'])
                if matches:
                    city, district = matches[0]
                    regions.append({'code': region['code'], 'city': city, 'district': district})
        bindings[domain] = {'datasetVersion': version, 'mappingVersion': 'synthetic-source-names-v2',
                            'sourceCRS': 'EPSG:4326',
                            'coordinateEvidence': 'Synthetic interior points from repository boundaries; county centroid or interior representative, city fallback for unlisted districts; not observed sites',
                            'regions': regions}
    # Publish configuration only after every dataset is successfully generated.
    (output_dir / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    (output_dir / 'region-bindings.json').write_text(json.dumps(bindings, ensure_ascii=False, indent=2) + '\n')
    return manifest
