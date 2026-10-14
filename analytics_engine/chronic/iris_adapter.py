"""Bounded local process adapter. The licensed Iris/MUSE installation owns all rules."""
import hashlib
import json
import os
import re
import subprocess
import tempfile
import time

PROTOCOL = 'cdcbuddy-iris-v1'


def request_for(parsed, demographics, entry_mode='text'):
    if entry_mode not in ('text', 'code'):
        raise ValueError('Invalid Iris entry mode')
    demographics = demographics or {}
    allowed = {'sex', 'age', 'mannerOfDeath', 'pregnancy', 'pregnancyContributeDeath', 'stillbirth',
               'completedWeeks', 'birthWeight', 'ageOfMother', 'conditionMother', 'externalFreeText'}
    if set(demographics) - allowed:
        raise ValueError('Unknown demographic field')
    if demographics.get('sex') not in ('1', '2', '9', None):
        raise ValueError('Invalid sex')
    age = demographics.get('age')
    if age is not None and (not isinstance(age, dict) or set(age) != {'value', 'unit'} or
                            type(age['value']) is not int or not 0 <= age['value'] <= 100000 or
                            age['unit'] not in ('Y', 'M', 'D', 'H', 'N')):
        raise ValueError('Invalid age')
    if age and ((age['unit'] == 'Y' and age['value'] > 130) or (age['unit'] == 'M' and age['value'] > 1560)):
        raise ValueError('Implausible age')
    if demographics.get('mannerOfDeath') not in (0, 1, 2, 3, 4, 5, 6, 8, 9, None):
        raise ValueError('Invalid manner of death')
    for field, values in {'pregnancy': ('0', '1', '2', '3', '9'), 'pregnancyContributeDeath': ('0', '1', '2'), 'stillbirth': ('1', 'N', 'U')}.items():
        if field in demographics and demographics[field] not in values:
            raise ValueError('Invalid ' + field)
    for field, length in {'completedWeeks': 2, 'birthWeight': 4, 'ageOfMother': 2}.items():
        if field in demographics and not re.fullmatch('[0-9]{1,' + str(length) + '}', str(demographics[field])):
            raise ValueError('Invalid ' + field)
    for field in ['conditionMother', 'externalFreeText']:
        if field in demographics and (not isinstance(demographics[field], str) or len(demographics[field]) > 4000):
            raise ValueError('Invalid ' + field)
    issues = [i for i in parsed['issues'] if i in {
        'unassigned-text-before-certificate', 'duplicate-certificate-position', 'missing-part-one',
        'gap-in-part-one', 'unstructured-causal-order-requires-review', 'non-affirmed-diagnosis',
        'unsupported-code-or-national-extension'}]
    if not age:
        issues.append('missing-age')
    elif age['unit'] not in ('Y', 'D'):
        # Iris Ident.Age accepts years/days only; months cannot be converted exactly.
        issues.append('iris-age-requires-years-or-days')
    if 'sex' not in demographics:
        issues.append('missing-sex')
    if 'mannerOfDeath' not in demographics:
        issues.append('missing-manner-of-death')
    lines = []
    for row in parsed['rows']:
        # Text mode delegates full lexical coding to the institution's Iris dictionary.
        # In code mode the human supplies codes; category guesses are NEVER sent as codes.
        if entry_mode == 'code':
            stripped = re.sub(r'[\s,，;；]+', '', row['text'])
            codes = [e['code'] for e in row['explicitCodes']]
            if not codes or stripped != ''.join(codes) or any(len(c.replace('.', '')) > 5 for c in codes):
                issues.append('code-mode-requires-explicit-codes-only')
            content = ' '.join(c.replace('.', '') for c in codes)
        else:
            content = row['text']
        lines.append({'position': row['position'], 'text': content})
    body = {'protocol': PROTOCOL, 'classification': 'ICD-10', 'entryMode': entry_mode,
            'lines': lines, 'demographics': demographics, 'sourceInputSha256': parsed['inputSha256']}
    body['requestId'] = hashlib.sha256(json.dumps(body, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
    return body, list(dict.fromkeys(issues))


def validate_response(raw, request):
    if not isinstance(raw, dict) or raw.get('protocol') != PROTOCOL or raw.get('requestId') != request['requestId']:
        raise ValueError('IRIS_RESPONSE_IDENTITY_MISMATCH')
    if raw.get('classification') != 'ICD-10' or raw.get('engine') != 'Iris/MUSE':
        raise ValueError('IRIS_CLASSIFICATION_MISMATCH')
    if raw.get('executionKind') != 'native-engine':
        raise ValueError('IRIS_NATIVE_EXECUTION_REQUIRED')
    identity = raw.get('ident', {})
    provenance = raw.get('provenance', {})
    if not isinstance(identity, dict) or not isinstance(provenance, dict):
        raise ValueError('IRIS_INVALID_RESPONSE')
    if not provenance.get('rulesVersion') or not provenance.get('dictionaryVersion') or not provenance.get('artifacts'):
        raise ValueError('IRIS_PROVENANCE_MISSING')
    if not isinstance(provenance['artifacts'], list):
        raise ValueError('IRIS_INVALID_RESPONSE')
    for artifact in provenance['artifacts']:
        if not isinstance(artifact, dict) or not isinstance(artifact.get('sha256'), str) or not re.fullmatch('[0-9a-f]{64}', artifact['sha256']):
            raise ValueError('IRIS_ARTIFACT_HASH_MISSING')
    if identity.get('CodingVersion') != provenance.get('expectedCodingVersion') or not identity.get('CodingVersion'):
        raise ValueError('IRIS_RULE_VERSION_MISMATCH')
    code = str(identity.get('UCCode') or '').replace('.', '')
    final = (raw.get('exitCode') == 0 and identity.get('Status') == 'Final' and
             identity.get('Reject') == 'No' and identity.get('Coding') == 'Automatic')
    if final and not re.fullmatch('[A-Z][0-9]{2}[0-9]{0,2}', code):
        raise ValueError('IRIS_INVALID_UNDERLYING_CODE')
    return {**raw, 'selectionStatus': 'CANDIDATE_READY' if final else 'ENGINE_REJECTED',
            'candidateCode': (code[:3] + '.' + code[3:] if len(code) > 3 else code) if final else None,
            'reviewRequired': True, 'autoFinalized': False,
            'ruleTraceAvailable': bool(raw.get('ruleTrace'))}


def invoke_iris(request, input_issues):
    command = os.environ.get('CDC_IRIS_COMMAND')
    if not command:
        return {'selectionStatus': 'ENGINE_NOT_CONFIGURED', 'reviewRequired': True,
                'candidateCode': None, 'message': '未配置获授权的 Iris 5 / MUSE 引擎与 ICD-10 决策表。'}
    if input_issues:
        return {'selectionStatus': 'INPUT_REVIEW_REQUIRED', 'reviewRequired': True,
                'candidateCode': None, 'issues': input_issues, 'message': '补齐或更正证明书信息后再调用 Iris。'}
    process = None
    try:
        argv = json.loads(command)
        if not isinstance(argv, list) or not argv or any(not isinstance(a, str) or not a or '\x00' in a for a in argv):
            raise ValueError('IRIS_INVALID_COMMAND')
        timeout = int(os.environ.get('CDC_IRIS_TIMEOUT_SECONDS', '60'))
        if not 1 <= timeout <= 90:
            raise ValueError('IRIS_INVALID_TIMEOUT')
        with tempfile.TemporaryFile() as source, tempfile.TemporaryFile() as out, tempfile.TemporaryFile() as err:
            # A worker that never reads stdin must still be bounded by the timeout.
            source.write(json.dumps(request, ensure_ascii=False).encode('utf-8'))
            source.seek(0)
            process = subprocess.Popen(argv, stdin=source, stdout=out, stderr=err, shell=False)
            start = time.monotonic()
            while process.poll() is None:
                if time.monotonic() - start > timeout:
                    raise TimeoutError('IRIS_TIMEOUT')
                if os.fstat(out.fileno()).st_size > 1024 * 1024 or os.fstat(err.fileno()).st_size > 65536:
                    raise ValueError('IRIS_OUTPUT_LIMIT')
                time.sleep(.05)
            if process.returncode != 0:
                raise ValueError('IRIS_WORKER_FAILED')
            out.seek(0)
            content = out.read(1024 * 1024 + 1)
            if len(content) > 1024 * 1024:
                raise ValueError('IRIS_OUTPUT_LIMIT')
            response = validate_response(json.loads(content), request)
            response['responseSha256'] = hashlib.sha256(content).hexdigest()
            return response
    except (OSError, ValueError, TimeoutError) as error:
        # Do not expose command arguments, local paths, credentials or clinical stderr.
        code = str(error) if re.fullmatch(r'IRIS_[A-Z_]+', str(error)) else 'IRIS_UNAVAILABLE'
        return {'selectionStatus': 'ENGINE_ERROR', 'errorCode': code, 'candidateCode': None,
                'reviewRequired': True, 'message': 'Iris 执行未完成，保留输入并转人工复核。'}
    finally:
        if process and process.poll() is None:
            process.kill()
            process.wait()
