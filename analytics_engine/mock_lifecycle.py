"""Audited immutable Mock snapshots; explicit, identity-checked cleanup only."""
from contextlib import contextmanager, closing
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import socket
import stat
import threading
import time
import uuid

MARKER = '_cdc_mock_provenance'
ROOT = Path(__file__).resolve().parents[1]


def production_tier():
    tier = os.environ.get('DEPLOYMENT_TIER', 'pilot' if os.environ.get('NODE_ENV') == 'production' else 'local')
    if tier not in ('local', 'demo', 'pilot'):
        raise ValueError('Invalid deployment tier')
    return tier == 'pilot' or os.environ.get('NODE_ENV') == 'production' and tier != 'demo'


def assert_generation_allowed():
    if production_tier():
        raise ValueError('MOCK_PRODUCTION_FORBIDDEN: Mock generation is disabled in pilot/production')


def digest(path):
    with open(path, 'rb') as source:
        return hashlib.file_digest(source, 'sha256').hexdigest()


def registry(path):
    conn = sqlite3.connect(path, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA busy_timeout=10000')
    return conn


def initialize_registry(directory):
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / 'mock-registry.sqlite3'
    if path.exists():
        if path.is_symlink() or path.stat().st_nlink != 1:
            raise ValueError('MOCK_REGISTRY_UNSAFE')
        with closing(sqlite3.connect(f'{path.as_uri()}?mode=ro', uri=True)) as probe:
            tables = {r[0] for r in probe.execute("SELECT name FROM sqlite_master WHERE type='table'")}
            if tables != {'mock_datasets', 'mock_leases', 'mock_audit'}:
                raise ValueError('MOCK_REGISTRY_INVALID: Existing non-audit databases are protected')
    with closing(registry(path)) as conn:
        conn.executescript('''CREATE TABLE IF NOT EXISTS mock_datasets(
            dataset_id TEXT PRIMARY KEY,path TEXT NOT NULL,domain TEXT NOT NULL,status TEXT NOT NULL,
            created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,sha256 TEXT,metadata_json TEXT NOT NULL,
            root_dev INTEGER NOT NULL,root_ino INTEGER NOT NULL,file_dev INTEGER,file_ino INTEGER);
            CREATE TABLE IF NOT EXISTS mock_leases(lease_id TEXT PRIMARY KEY,dataset_id TEXT NOT NULL,expires_at INTEGER NOT NULL,owner_pid INTEGER,owner_host TEXT);
            CREATE TABLE IF NOT EXISTS mock_audit(event_id TEXT PRIMARY KEY,created_at INTEGER NOT NULL,
            dataset_id TEXT NOT NULL,action TEXT NOT NULL,payload_json TEXT NOT NULL);''')
        conn.commit()
    path.chmod(0o600)
    return path


def audit(conn, dataset_id, action, payload):
    conn.execute('INSERT INTO mock_audit VALUES(?,?,?,?,?)',
                 (str(uuid.uuid4()), int(time.time() * 1000), dataset_id, action, json.dumps(payload, ensure_ascii=False)))


def read_marker(path):
    with closing(sqlite3.connect(f'{Path(path).resolve().as_uri()}?mode=ro', uri=True)) as conn:
        if not conn.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (MARKER,)).fetchone():
            return None
        rows = conn.execute(f'SELECT metadata_json FROM {MARKER}').fetchall()
        if len(rows) != 1:
            raise ValueError('MOCK_PROVENANCE_INVALID')
        marker = json.loads(rows[0][0])
        if marker.get('origin') != 'mock' or marker.get('purpose') != 'simulation':
            raise ValueError('MOCK_PROVENANCE_INVALID')
        return marker


@contextmanager
def generation(path, domain, seed, generator_path, audit_dir=None, retention_days=7, allow_empty=False):
    assert_generation_allowed()
    if not isinstance(retention_days, int) or not 1 <= retention_days <= 365:
        raise ValueError('retention_days must be 1..365')
    raw = Path(path).absolute()
    if raw.is_symlink():
        raise ValueError('Mock output cannot be a symlink')
    target = raw.resolve()
    target.parent.mkdir(parents=True, exist_ok=True)
    store = initialize_registry(Path(audit_dir).resolve() if audit_dir else target.parent / '.mock-audit')
    dataset_id = str(uuid.uuid4())
    now = int(time.time() * 1000)
    metadata = {'schemaVersion': 1, 'datasetId': dataset_id, 'origin': 'mock', 'purpose': 'simulation',
                'domain': domain, 'seed': seed, 'createdAt': datetime.now(timezone.utc).isoformat(),
                'generatorVersion': 'audited-mock-v1', 'generatorSha256': digest(generator_path),
                'operator': os.environ.get('MOCK_OPERATOR') or str(getattr(os, 'getuid', lambda: 'unknown')()),
                'operatorUid': str(getattr(os, 'getuid', lambda: 'unknown')()), 'host': socket.gethostname(),
                'registryPath': str(store), 'path': str(target), 'expiresAt': now + retention_days * 86400000}
    # Never enroll an existing database as Mock. The connection API can accept a
    # newly opened SQLite file only while it still contains no user tables.
    if target.exists():
        empty = allow_empty and target.is_file() and target.stat().st_nlink == 1
        if empty:
            with closing(sqlite3.connect(f'{target.as_uri()}?mode=ro', uri=True)) as conn:
                empty = not conn.execute("SELECT 1 FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'").fetchone()
        if not empty:
            with closing(registry(store)) as conn:
                audit(conn, dataset_id, 'GENERATION_REFUSED', {'reason': 'existing output', 'path': str(target)})
                conn.commit()
            raise FileExistsError(f'Dataset already exists: {target}; choose a new --output')
    else:
        with target.open('xb'):
            pass
    target.chmod(0o600)
    root_stat, file_stat = target.parent.stat(), target.stat()
    with closing(registry(store)) as conn:
        conn.execute('INSERT INTO mock_datasets VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
                     (dataset_id, str(target), domain, 'GENERATING', now, metadata['expiresAt'], None,
                      json.dumps(metadata), root_stat.st_dev, root_stat.st_ino, file_stat.st_dev, file_stat.st_ino))
        audit(conn, dataset_id, 'GENERATING', metadata)
        conn.commit()
    with closing(sqlite3.connect(target)) as conn:
        conn.execute(f'CREATE TABLE {MARKER}(metadata_json TEXT NOT NULL)')
        conn.execute(f'INSERT INTO {MARKER} VALUES(?)', (json.dumps(metadata),))
        conn.commit()
    try:
        yield metadata
        with closing(sqlite3.connect(f'{target.as_uri()}?mode=ro', uri=True)) as conn:
            if conn.execute('PRAGMA integrity_check').fetchone()[0] != 'ok' or conn.execute('PRAGMA foreign_key_check').fetchall():
                raise ValueError('Generated snapshot failed integrity checks')
            counts = {t: conn.execute(f'SELECT COUNT(*) FROM "{t}"').fetchone()[0] for t, in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND (name GLOB 'fact_*' OR name GLOB 'dim_*')")}
        if read_marker(target) != metadata or target.stat().st_ino != file_stat.st_ino:
            raise ValueError('MOCK_PROVENANCE_CHANGED')
        with closing(registry(store)) as conn:
            sha256 = digest(target)
            conn.execute("UPDATE mock_datasets SET status='READY',sha256=? WHERE dataset_id=?", (sha256, dataset_id))
            audit(conn, dataset_id, 'READY', {'sha256': sha256, 'tableCounts': counts})
            conn.commit()
    except BaseException as error:
        failure_sha = None
        try:
            if read_marker(target) == metadata and (target.stat().st_dev, target.stat().st_ino) == (file_stat.st_dev, file_stat.st_ino):
                failure_sha = digest(target)
        except (OSError, ValueError, sqlite3.Error):
            pass
        with closing(registry(store)) as conn:
            conn.execute("UPDATE mock_datasets SET status='FAILED',sha256=? WHERE dataset_id=?", (failure_sha, dataset_id))
            audit(conn, dataset_id, 'FAILED', {'error': type(error).__name__, 'message': str(error)[:500], 'sha256': failure_sha})
            conn.commit()
        raise


def checked_snapshot(row, marker, physical_path=None):
    target = Path(physical_path or row['path'])
    if physical_path is not None:
        if target.parent != Path(row['path']).parent or not target.name.startswith('.mock-quarantine-'):
            raise ValueError('MOCK_QUARANTINE_PATH_UNSAFE')
        uuid.UUID(target.name.removeprefix('.mock-quarantine-'))
    if target != target.resolve() or target.is_symlink():
        raise ValueError('MOCK_PATH_UNSAFE')
    if any(Path(str(target) + suffix).exists() for suffix in ('-wal', '-shm', '-journal')):
        raise ValueError('MOCK_ACTIVE_JOURNAL: Snapshot may contain concurrent writes; data preserved')
    for parent in target.parents:
        if parent.is_symlink():
            raise ValueError('MOCK_PATH_UNSAFE')
    root_stat, file_stat = target.parent.stat(), target.stat()
    if not stat.S_ISREG(file_stat.st_mode) or file_stat.st_nlink != 1:
        raise ValueError('MOCK_FILE_UNSAFE')
    if (root_stat.st_dev, root_stat.st_ino, file_stat.st_dev, file_stat.st_ino) != (
            row['root_dev'], row['root_ino'], row['file_dev'], row['file_ino']):
        raise ValueError('MOCK_FILE_IDENTITY_CHANGED')
    if not isinstance(marker, dict) or json.loads(row['metadata_json']) != marker or marker.get('origin') != 'mock' or marker.get('path') != row['path']:
        raise ValueError('MOCK_PROVENANCE_CHANGED')
    if not row['sha256'] or digest(target) != row['sha256']:
        raise ValueError('MOCK_CONTENT_CHANGED')
    return target


def assert_read_allowed(path, origin=None):
    if production_tier() and origin == 'mock':
        raise ValueError('MOCK_PRODUCTION_FORBIDDEN')
    marker = read_marker(path) if Path(path).exists() else None
    if marker and origin == 'observed':
        raise ValueError('MOCK_ORIGIN_MISMATCH: Generated Mock cannot be relabelled as observed')
    if not production_tier():
        return
    if marker or origin == 'mock':
        raise ValueError('MOCK_PRODUCTION_FORBIDDEN')
    if origin is None:
        manifest = Path(os.environ.get('DATASET_MANIFEST_PATH', ROOT / 'config/datasets.json')).resolve()
        rows = json.loads(manifest.read_text())
        matches = [r for r in rows if (manifest.parent / os.environ.get('DATASET_' + r['domain'].upper() + '_PATH', r['path'])).resolve() == Path(path).resolve()]
        if not matches or any(r['origin'] != 'observed' for r in matches):
            raise ValueError('UNREGISTERED_PRODUCTION_DATASET')


@contextmanager
def dataset_lease(path):
    marker = read_marker(path)
    if not marker:
        yield
        return
    if production_tier():
        raise ValueError('MOCK_PRODUCTION_FORBIDDEN')
    store = Path(marker['registryPath'])
    if not store.is_file() or store.is_symlink():
        raise ValueError('MOCK_REGISTRY_REQUIRED')
    lease_id = str(uuid.uuid4())
    with closing(registry(store)) as conn:
        conn.execute('BEGIN IMMEDIATE')
        row = conn.execute('SELECT * FROM mock_datasets WHERE dataset_id=?', (marker['datasetId'],)).fetchone()
        if not row or row['status'] != 'READY' or row['expires_at'] <= int(time.time() * 1000):
            raise ValueError('MOCK_DATASET_INACTIVE')
        checked_snapshot(row, marker)
        columns = {r[1] for r in conn.execute('PRAGMA table_info(mock_leases)')}
        if 'owner_pid' in columns:
            conn.execute('INSERT INTO mock_leases VALUES(?,?,?,?,?)', (lease_id, marker['datasetId'], int(time.time() * 1000) + 120000, os.getpid(), socket.gethostname()))
        else:
            conn.execute('INSERT INTO mock_leases VALUES(?,?,?)', (lease_id, marker['datasetId'], int(time.time() * 1000) + 120000))
        conn.commit()
    stop = threading.Event()
    def heartbeat():
        while not stop.wait(20):
            with closing(registry(store)) as conn:
                conn.execute('UPDATE mock_leases SET expires_at=? WHERE lease_id=?', (int(time.time() * 1000) + 120000, lease_id))
                conn.commit()
    thread = threading.Thread(target=heartbeat, daemon=True)
    thread.start()
    try:
        yield
    finally:
        stop.set()
        thread.join(timeout=10)
        with closing(registry(store)) as conn:
            conn.execute('DELETE FROM mock_leases WHERE lease_id=?', (lease_id,))
            conn.commit()


def active_paths(manifest_path=None):
    manifest = Path(manifest_path or os.environ.get('DATASET_MANIFEST_PATH', ROOT / 'config/datasets.json')).resolve()
    if not manifest.is_file():
        raise ValueError('Active manifest missing; cleanup refused')
    rows = json.loads(manifest.read_text())
    if not isinstance(rows, list) or not rows or any(r.get('domain') not in ('vector', 'foodborne', 'env', 'chronic') or r.get('origin') not in ('mock', 'observed') or not isinstance(r.get('path'), str) or not r['path'] for r in rows):
        raise ValueError('Invalid active manifest')
    return {str((manifest.parent / os.environ.get('DATASET_' + r['domain'].upper() + '_PATH', r['path'])).resolve()) for r in rows}


def live_lease(lease, now):
    if lease['expires_at'] > now:
        return True
    # A blocked event loop cannot heartbeat, but a live local PID still owns
    # the snapshot. Unknown/remote owners are conservatively retained.
    if 'owner_pid' not in lease.keys() or not lease['owner_pid'] or lease['owner_host'] != socket.gethostname():
        return True
    try:
        os.kill(lease['owner_pid'], 0)
        return True
    except ProcessLookupError:
        return False
    except PermissionError:
        return True


def cleanup(store_dir, dataset_id=None, expired=False, apply=False, manifest_path=None):
    store = Path(store_dir).resolve() / 'mock-registry.sqlite3'
    if not store.is_file() or store.is_symlink():
        raise ValueError('Registered audit store required; no files were removed')
    protected = active_paths(manifest_path)
    results = []
    with closing(registry(store)) as conn:
        rows = conn.execute('SELECT * FROM mock_datasets' + (' WHERE dataset_id=?' if dataset_id else ''),
                            (dataset_id,) if dataset_id else ()).fetchall()
        if dataset_id and not rows:
            raise ValueError('Unknown registered Mock dataset')
        for row in rows:
            now = int(time.time() * 1000)
            if expired and row['expires_at'] > now or row['status'] == 'DELETED':
                continue
            outcome = {'datasetId': row['dataset_id'], 'path': row['path'], 'status': 'REFUSED'}
            conn.execute('BEGIN IMMEDIATE')
            try:
                current = conn.execute('SELECT * FROM mock_datasets WHERE dataset_id=?', (row['dataset_id'],)).fetchone()
                if current['status'] not in ('READY', 'RETIRED', 'FAILED'):
                    raise ValueError('Only finalized, registered snapshots can be cleaned')
                if row['path'] in protected:
                    raise ValueError('Currently configured source is protected')
                if any(live_lease(lease, now) for lease in conn.execute('SELECT * FROM mock_leases WHERE dataset_id=?', (row['dataset_id'],))):
                    raise ValueError('Active execution lease; retry after it finishes')
                physical_path = None
                if current['status'] == 'RETIRED' and not Path(row['path']).exists():
                    intent = conn.execute("SELECT payload_json FROM mock_audit WHERE dataset_id=? AND action='CLEANUP_STARTED' ORDER BY created_at DESC,rowid DESC LIMIT 1", (row['dataset_id'],)).fetchone()
                    if not intent:
                        raise ValueError('Missing cleanup recovery intent; data preserved')
                    physical_path = json.loads(intent[0])['quarantine']
                    if not Path(physical_path).exists():
                        outcome['status'] = 'DELETED' if apply else 'WOULD_FINALIZE'
                        if apply:
                            conn.execute("UPDATE mock_datasets SET status='DELETED' WHERE dataset_id=?", (row['dataset_id'],))
                            audit(conn, row['dataset_id'], 'CLEANUP_RECOVERED', {'noAdditionalFilesRemoved': True})
                        conn.commit()
                        results.append(outcome)
                        continue
                marker = read_marker(physical_path or row['path'])
                target = checked_snapshot(current, marker, physical_path)
                if not apply:
                    outcome['status'] = 'WOULD_DELETE'
                else:
                    # Quarantine first and check the actual moved inode. If an
                    # external writer raced the rename, preserve and restore it;
                    # never unlink unvalidated replacement data.
                    quarantine = target.parent / ('.mock-quarantine-' + str(uuid.uuid4()))
                    conn.execute("UPDATE mock_datasets SET status='RETIRED' WHERE dataset_id=?", (row['dataset_id'],))
                    audit(conn, row['dataset_id'], 'CLEANUP_STARTED', {'path': str(target), 'quarantine': str(quarantine)})
                    conn.commit()  # Durable intent precedes any physical removal.
                    conn.execute('BEGIN IMMEDIATE')
                    # No new leases can start once RETIRED has been published.
                    checked_snapshot(current, read_marker(target), physical_path)
                    os.rename(target, quarantine)
                    try:
                        moved = quarantine.stat()
                        if any(Path(row['path'] + suffix).exists() for suffix in ('-wal', '-shm', '-journal')) or (moved.st_dev, moved.st_ino, moved.st_nlink) != (row['file_dev'], row['file_ino'], 1) or digest(quarantine) != row['sha256'] or read_marker(quarantine) != marker:
                            raise ValueError('Cleanup race detected; data preserved')
                        quarantine.unlink()
                    except BaseException:
                        if not target.exists():
                            os.link(quarantine, target)  # Exclusive restore; cannot overwrite another file.
                            quarantine.unlink()
                        raise
                    conn.execute("UPDATE mock_datasets SET status='DELETED' WHERE dataset_id=?", (row['dataset_id'],))
                    outcome['status'] = 'DELETED'
                audit(conn, row['dataset_id'], 'CLEANUP_' + outcome['status'], {'apply': apply, 'path': row['path']})
                conn.commit()
            except Exception as error:
                conn.rollback()
                outcome['reason'] = str(error)
                audit(conn, row['dataset_id'], 'CLEANUP_REFUSED', {'apply': apply, 'reason': str(error)})
                conn.commit()
            results.append(outcome)
    return results
