"""Parser + process-contract tests. These do NOT certify native Iris or rule accuracy."""
import copy
import importlib.util
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

from analytics_engine.chronic.mortality_parser import parse_certificate, catalogue
from analytics_engine.chronic.iris_adapter import request_for, invoke_iris, validate_response, PROTOCOL
from analytics_engine.chronic.icd10_nlp_inference import infer_underlying_cause_and_icd10

ROOT = Path(__file__).resolve().parents[2]
DEMOGRAPHICS = {'sex': '1', 'age': {'value': 68, 'unit': 'Y'}, 'mannerOfDeath': 0}


def contract_response(request):
    return {'protocol': PROTOCOL, 'requestId': request['requestId'], 'classification': 'ICD-10',
            'engine': 'Iris/MUSE', 'executionKind': 'native-engine', 'exitCode': 0,
            'ident': {'UCCode': 'C349', 'Status': 'Final', 'Reject': 'No', 'Coding': 'Automatic', 'CodingVersion': 'test-contract-version'},
            'provenance': {'rulesVersion': 'test-contract-rules', 'dictionaryVersion': 'test-contract-dictionary',
                           'expectedCodingVersion': 'test-contract-version', 'artifacts': [{'sha256': 'a' * 64}]}}


class MortalityCoding(unittest.TestCase):
    def test_supplied_workbook_category_provenance_and_no_invented_subcodes(self):
        source, entries, _ = catalogue()
        self.assertEqual(len(entries), 2047)
        self.assertEqual(source['sourceSha256'], '68604558bdaaa41cf922d01e1f095946935dee26a5bd58d3cc9f202f2a22b4a0')
        self.assertEqual(entries['I21']['sourceRow'], 658)
        result = infer_underlying_cause_and_icd10(text='急性心肌梗死')
        self.assertEqual(result['categoryCandidates'][0]['candidateCodes'], ['I21'])
        self.assertIsNone(result['inferredUnderlyingCause'])
        self.assertIsNone(result['accuracyRate'])

    def test_acceptance_cases_preserve_entities_negation_parts_and_blockers(self):
        suite = json.loads((ROOT / 'tests/fixtures/mortality/acceptance-cases.json').read_text())
        for case in suite['cases']:
            with self.subTest(case=case['id']):
                parsed = parse_certificate(input_chain=case.get('inputChain'), text=case.get('text'))
                entities = [e for r in parsed['rows'] for e in r['entities']]
                if 'expectedCategories' in case:
                    self.assertEqual(sorted({c for e in entities for c in e['candidateCodes']}), sorted(case['expectedCategories']))
                if 'expectedPositions' in case:
                    self.assertEqual([r['position'] for r in parsed['rows']], case['expectedPositions'])
                if 'expectedAssertions' in case:
                    self.assertEqual([e['assertion'] for e in entities], case['expectedAssertions'])
                _, issues = request_for(parsed, DEMOGRAPHICS)
                if case.get('blockedIssue'):
                    self.assertIn(case['blockedIssue'], issues)
                if case.get('expectedIssue'):
                    self.assertIn(case['expectedIssue'], parsed['issues'])
                for entity in entities:
                    original = case['text'] if entity['sourceField'] == 'text' else case['inputChain'][entity['sourceField']]
                    self.assertEqual(original[entity['start']:entity['end']], entity['text'])

    def test_durations_and_arrow_order_remain_lossless(self):
        text = 'a: 心源性休克（2小时）；b: 急性心肌梗死（2天）；第二部分：2型糖尿病（10年）'
        rows = parse_certificate(text=text)['rows']
        self.assertEqual([r['durations'][0]['unit'] for r in rows], ['小时', '天', '年'])
        for r in rows:
            for d in r['durations']:
                self.assertEqual(text[d['start']:d['end']], d['text'])
        for text in ['呼吸衰竭→肺癌', '呼吸衰竭->肺癌']:
            parsed = parse_certificate(text=text)
            self.assertEqual([r['text'] for r in parsed['rows']], ['呼吸衰竭', '肺癌'])
            for row in parsed['rows']:
                self.assertEqual(text[row['sourceStart']:row['sourceStart']+len(row['text'])], row['text'])

    def test_request_keeps_part_two_and_never_substitutes_dictionary_codes(self):
        parsed = parse_certificate(input_chain={'a': '呼吸衰竭', 'b': '肺癌', 'part2': '糖尿病'})
        request, issues = request_for(parsed, DEMOGRAPHICS)
        self.assertEqual(request['lines'][2], {'position': 'part2', 'text': '糖尿病'})
        self.assertNotIn('CodeLine', json.dumps(request))
        self.assertFalse(issues)
        _, issues = request_for(parsed, DEMOGRAPHICS, 'code')
        self.assertIn('code-mode-requires-explicit-codes-only', issues)
        request, issues = request_for(parse_certificate(input_chain={'a': 'J96.9', 'b': 'C34.9'}), DEMOGRAPHICS, 'code')
        self.assertEqual(request['lines'][1]['text'], 'C349')
        self.assertFalse(issues)

    def test_missing_demographics_are_not_fabricated(self):
        parsed = parse_certificate(text='肺癌')
        request, issues = request_for(parsed, {})
        self.assertEqual(request['demographics'], {})
        self.assertEqual(set(issues), {'missing-age', 'missing-sex', 'missing-manner-of-death'})
        with patch.dict(os.environ, {'CDC_IRIS_COMMAND': '["must-not-start"]'}):
            self.assertEqual(invoke_iris(request, issues)['selectionStatus'], 'INPUT_REVIEW_REQUIRED')
        for unit in ['M', 'H', 'N']:
            _, issues = request_for(parsed, {**DEMOGRAPHICS, 'age': {'value': 2, 'unit': unit}})
            self.assertIn('iris-age-requires-years-or-days', issues)

    def test_missing_runtime_never_falls_back_to_last_line_or_demo_edges(self):
        with patch.dict(os.environ, {}, clear=True):
            for chain in [{'a': '呼吸衰竭', 'b': '肺癌'}, {'a': '肺癌', 'b': '脑出血'}]:
                result = infer_underlying_cause_and_icd10(input_chain=chain, demographics=DEMOGRAPHICS, mode='graph')
                self.assertEqual(result['engineResult']['selectionStatus'], 'ENGINE_NOT_CONFIGURED')
                self.assertIsNone(result['inferredUnderlyingCause'])
                self.assertFalse(result['causeGraph']['selectionSupported'])
                self.assertFalse(result['review']['autoFinalized'])

    def test_output_identity_version_and_classification_are_checked(self):
        request, _ = request_for(parse_certificate(text='肺癌'), DEMOGRAPHICS)
        response = contract_response(request)
        good = validate_response(response, request)
        self.assertEqual(good['candidateCode'], 'C34.9')
        self.assertTrue(good['reviewRequired'])
        for field, bad in [('requestId', 'other-certificate'), ('classification', 'ICD-11'), ('executionKind', 'mock')]:
            changed = copy.deepcopy(response); changed[field] = bad
            with self.assertRaises(ValueError): validate_response(changed, request)
        changed = copy.deepcopy(response); changed['ident']['CodingVersion'] = 'different-release'
        with self.assertRaises(ValueError): validate_response(changed, request)
        changed = copy.deepcopy(response); changed['provenance']['artifacts'] = []
        with self.assertRaises(ValueError): validate_response(changed, request)
        for field in ['ident', 'provenance']:
            changed = copy.deepcopy(response); changed[field] = None
            with self.assertRaises(ValueError): validate_response(changed, request)
        changed = copy.deepcopy(response); changed['provenance']['artifacts'] = [{'sha256': None}]
        with self.assertRaises(ValueError): validate_response(changed, request)

    def test_native_reject_or_failure_cannot_be_promoted_by_a_present_code(self):
        request, _ = request_for(parse_certificate(text='肺癌'), DEMOGRAPHICS)
        response = contract_response(request)
        for field, value in [('Reject', 'Interval'), ('Status', 'Rejected'), ('Coding', 'Manual')]:
            changed = copy.deepcopy(response); changed['ident'][field] = value
            result = validate_response(changed, request)
            self.assertIsNone(result['candidateCode'])
            self.assertEqual(result['selectionStatus'], 'ENGINE_REJECTED')
        response['exitCode'] = 6
        self.assertIsNone(validate_response(response, request)['candidateCode'])

    def test_process_contract_failure_paths_and_no_secret_error_echo(self):
        request, _ = request_for(parse_certificate(text='肺癌'), DEMOGRAPHICS)
        with tempfile.TemporaryDirectory() as folder:
            file = Path(folder) / 'contract-worker.py'
            file.write_text('import sys,json\nr=json.load(sys.stdin)\nprint(json.dumps('+repr(contract_response(request))+'))\n')
            with patch.dict(os.environ, {'CDC_IRIS_COMMAND': json.dumps([sys.executable, str(file)])}):
                self.assertEqual(invoke_iris(request, [])['candidateCode'], 'C34.9')
                file.write_text('print("malformed secret clinical output")')
                result = invoke_iris(request, [])
                self.assertEqual(result['selectionStatus'], 'ENGINE_ERROR')
                self.assertNotIn('secret', json.dumps(result))
                file.write_text('import time\ntime.sleep(3)')
                with patch.dict(os.environ, {'CDC_IRIS_TIMEOUT_SECONDS': '1'}):
                    large_request = {**request, 'padding': '测' * 12000}
                    self.assertEqual(invoke_iris(large_request, [])['errorCode'], 'IRIS_TIMEOUT')

    def test_input_limits_and_no_implicit_certificate_selection(self):
        with self.assertRaises(ValueError): infer_underlying_cause_and_icd10()
        for data in [{'text':'a'*12001}, {'input_chain':{'unknown':'肺癌'}}, {'text':'肺癌','input_chain':{'a':'肺癌'}}]:
            with self.assertRaises(ValueError): parse_certificate(**data)
        with self.assertRaises(ValueError): request_for(parse_certificate(text='肺癌'), {'age':{'value':False,'unit':'Y'}})


if __name__ == '__main__':
    unittest.main()
