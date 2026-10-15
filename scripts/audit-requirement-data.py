#!/usr/bin/env python3
"""Audit one scenario per source requirement. PASS means input coverage, not model acceptance."""
import argparse
from contextlib import closing
import json
from pathlib import Path
import sqlite3
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from analytics_engine.input_errors import input_failure, public_error

ROOT = Path(__file__).resolve().parents[1]


def audit(bundle=None, manifest=None):
    cases = json.loads((ROOT / 'config/requirement-data-checks.json').read_text())
    scenes = json.loads((ROOT / 'config/requirement-scenarios.json').read_text())
    if [c['requirementId'] for c in cases] != [s['requirementId'] for s in scenes]:
        raise ValueError('Requirement/data-check mismatch')
    source_path=Path(manifest).resolve() if manifest else Path(bundle).resolve()/'manifest.json'
    sources={r['domain']:(source_path.parent/r['path']).resolve() for r in json.loads(source_path.read_text())}
    results = []
    for case, scene in zip(cases, scenes):
        checks = []
        with closing(sqlite3.connect(f'file:{sources[case["domain"]]}?mode=ro', uri=True)) as conn:
            for check in case['checks']:
                try:
                    count = conn.execute(check['sql']).fetchone()[0]
                    checks.append({**check, 'actual': count, 'passed': count >= check['minimum']})
                except sqlite3.DatabaseError as error:
                    failure=input_failure(error)
                    checks.append({**check,'actual':None,'passed':False,'reason':failure['reason'] if failure else public_error(error)})
        results.append({'requirementId':case['requirementId'], 'domain':case['domain'], 'checks':checks,
                        'inputStatus': 'manual-upload' if case['kind']=='upload' else 'deferred' if case['kind']=='deferred' else 'ready' if all(c['passed'] for c in checks) else 'missing',
                        'functionalLimitation':scene['limitation']})
    return {'purpose':'source-input-coverage-not-functional-acceptance', 'scenarios':results}


if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    source=parser.add_mutually_exclusive_group(required=True)
    source.add_argument('--bundle',type=Path)
    source.add_argument('--manifest',type=Path)
    parser.add_argument('--output',type=Path)
    args=parser.parse_args()
    result=audit(args.bundle,args.manifest)
    text=json.dumps(result,ensure_ascii=False,indent=2)+'\n'
    if args.output:
        args.output.parent.mkdir(parents=True,exist_ok=True)
        args.output.write_text(text)
    else:
        print(text)
    raise SystemExit(any(s['inputStatus']=='missing' for s in result['scenarios']))
