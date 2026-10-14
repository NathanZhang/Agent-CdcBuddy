#!/usr/bin/env python3
"""Run actual Iris acceptance. Missing runtime is BLOCKED, never a passing mock test."""
import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from analytics_engine.chronic.icd10_nlp_inference import infer_underlying_cause_and_icd10

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', type=Path, default=ROOT / 'docs/reviews/2026-10-14/mortality-coding/native-acceptance.json')
args = parser.parse_args()
suite = json.loads((ROOT / 'tests/fixtures/mortality/acceptance-cases.json').read_text())
results = []
for case in suite['nativeCases']:
    result = infer_underlying_cause_and_icd10(input_chain=case['inputChain'], demographics=case['demographics'], mode='graph', entry_mode='code')
    engine = result['engineResult']
    passed = (engine.get('candidateCode') == case['expectedCode'] if 'expectedCode' in case else engine.get('selectionStatus') == case['expectedSelectionStatus'])
    results.append({'id': case['id'], 'input': case, 'passed': passed, 'result': result})
    print(case['id'], engine['selectionStatus'], 'PASS' if passed else 'NOT_PASSED')
output = {'purpose': suite['purpose'], 'nativeEngineVerified': all(r['passed'] for r in results),
          'status': 'PASSED' if all(r['passed'] for r in results) else 'BLOCKED' if all(r['result']['engineResult']['selectionStatus']=='ENGINE_NOT_CONFIGURED' for r in results) else 'FAILED',
          'results': results}
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n')
sys.exit(0 if output['nativeEngineVerified'] else 2)
