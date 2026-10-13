"""Explicit domain dataset locations; read-only facts and no developer-machine fallback."""
import json
import os
import sqlite3
from analytics_engine.mock_lifecycle import assert_read_allowed,dataset_lease
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
DOMAINS = {'vector','foodborne','env','chronic'}

def resolve_dataset_path(domain, dataset_id=None):
    if domain not in DOMAINS: raise ValueError('Unknown domain')
    manifest = Path(os.environ.get('DATASET_MANIFEST_PATH',ROOT/'config/datasets.json')).resolve()
    rows = json.loads(manifest.read_text())
    if not isinstance(rows,list): raise ValueError('Invalid dataset manifest')
    ids = set()
    for row in rows:
        if row.get('domain') not in DOMAINS or row.get('origin') not in ('observed','mock'):
            raise ValueError('Invalid dataset domain or origin')
        if any(not isinstance(row.get(k),str) or not row[k] for k in ('id','path','version','asOf','schemaVersion')):
            raise ValueError('Missing dataset metadata')
        if row['id'] in ids: raise ValueError('Duplicate dataset ID')
        ids.add(row['id'])
    matches = [row for row in rows if row['domain']==domain and (dataset_id is None or row['id']==dataset_id)]
    if len(matches) != 1: raise ValueError(f'Expected one configured dataset for {domain}')
    configured = os.environ.get(f'DATASET_{domain.upper()}_PATH',matches[0]['path'])
    path = (manifest.parent / configured).resolve()
    assert_read_allowed(path, matches[0]['origin'])
    return path

from analytics_engine.repositories.scoped import ACTIVE_SCOPE,connect_scoped_readonly

def connect_readonly(path):
    assert_read_allowed(path)
    lease=dataset_lease(path);lease.__enter__()
    class LeasedConnection(sqlite3.Connection):
        def __exit__(self, *args):
            try:return super().__exit__(*args)
            finally:self.close()
        def close(self):
            try:super().close()
            finally:
                if getattr(self,'mock_lease',None):
                    self.mock_lease=None;lease.__exit__(None,None,None)
    try:
        scope=ACTIVE_SCOPE.get()
        conn=connect_scoped_readonly(path,scope,LeasedConnection) if scope is not None else sqlite3.connect(f'{Path(path).resolve().as_uri()}?mode=ro',uri=True,factory=LeasedConnection)
        conn.mock_lease=lease
        return conn
    except BaseException:
        lease.__exit__(None,None,None)
        raise

def connect_dataset(domain,dataset_id=None):
    return connect_readonly(resolve_dataset_path(domain,dataset_id))

def resolve_dataset_ref(domain,dataset_id=None):
    from analytics_engine.contracts.result import DatasetRef
    resolve_dataset_path(domain,dataset_id)
    manifest=Path(os.environ.get('DATASET_MANIFEST_PATH',ROOT/'config/datasets.json')).resolve()
    matches=[row for row in json.loads(manifest.read_text()) if row['domain']==domain and (dataset_id is None or row['id']==dataset_id)]
    return DatasetRef.model_validate({k:v for k,v in matches[0].items() if k!='path'})
