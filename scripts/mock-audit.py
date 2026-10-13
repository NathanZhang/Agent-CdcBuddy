"""Read the durable Mock generation/cleanup audit ledger without changing it."""
import argparse
from contextlib import closing
import json
from pathlib import Path
import sqlite3


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--audit-dir', type=Path, required=True)
    parser.add_argument('--dataset-id')
    parser.add_argument('--jsonl', action='store_true')
    args = parser.parse_args()
    store = (args.audit_dir / 'mock-registry.sqlite3').resolve()
    if not store.is_file():
        parser.error('Audit registry does not exist')
    with closing(sqlite3.connect(f'{store.as_uri()}?mode=ro', uri=True)) as conn:
        conn.row_factory = sqlite3.Row
        where = ' WHERE dataset_id=?' if args.dataset_id else ''
        params = (args.dataset_id,) if args.dataset_id else ()
        datasets = [dict(r) for r in conn.execute('SELECT * FROM mock_datasets' + where, params)]
        events = [dict(r) for r in conn.execute('SELECT * FROM mock_audit' + where + ' ORDER BY created_at,rowid', params)]
        for row in datasets: row['metadata'] = json.loads(row.pop('metadata_json'))
        for row in events: row['payload'] = json.loads(row.pop('payload_json'))
    if args.jsonl:
        for row in events: print(json.dumps(row, ensure_ascii=False))
    else:
        print(json.dumps({'datasets': datasets, 'events': events}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
