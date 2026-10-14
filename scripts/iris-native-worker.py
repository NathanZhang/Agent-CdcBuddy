#!/usr/bin/env python3
"""One JSON request -> official Iris 5 CLI -> one JSON response (Windows only).

Uses the documented Ident/MedCod lot contract, not an invented MUSE HTTP API.
Run under a dedicated Windows Iris profile configured for the same certificate DB.
Licensed binaries, decision tables and the institutional dictionary are not bundled.
"""
import hashlib
import json
import os
import re
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from analytics_engine.chronic.iris_adapter import PROTOCOL


def load_config():
    path = os.environ.get('CDC_IRIS_NATIVE_CONFIG')
    if not path:
        raise ValueError('IRIS_NATIVE_CONFIG_MISSING')
    config = json.loads(Path(path).read_text(encoding='utf-8'))
    if config.get('classification') != 'ICD-10' or config.get('licenseConfirmedByInstitution') is not True:
        raise ValueError('IRIS_LICENSE_OR_CLASSIFICATION_NOT_CONFIRMED')
    for key in ['irisExe', 'certificatesDb', 'expectedCodingVersion', 'rulesVersion', 'dictionaryVersion']:
        if not config.get(key):
            raise ValueError('IRIS_NATIVE_CONFIG_INCOMPLETE')
    if not isinstance(config.get('codingYear'), int) or not 1990 <= config['codingYear'] <= 2100:
        raise ValueError('IRIS_CODING_YEAR_REQUIRED')
    if set(config.get('ageUnits', {})) != {'Y', 'D'}:
        raise ValueError('IRIS_AGE_UNIT_CONFIGURATION_REQUIRED')
    artifacts = config.get('artifacts', [])
    required = {'iris-executable', 'muse-library', 'decision-tables', 'iris-tables'}
    if not required <= {a.get('role') for a in artifacts}:
        raise ValueError('IRIS_ARTIFACT_MANIFEST_INCOMPLETE')
    actual = []
    for artifact in artifacts:
        file = Path(artifact['path'])
        checksum = hashlib.sha256(file.read_bytes()).hexdigest()
        if checksum != artifact.get('sha256'):
            raise ValueError('IRIS_ARTIFACT_VERSION_CHANGED')
        actual.append({'role': artifact['role'], 'file': file.name, 'sha256': checksum})
    exe = Path(config['irisExe']).resolve()
    if not any(a['role'] == 'iris-executable' and Path(a['path']).resolve() == exe for a in artifacts):
        raise ValueError('IRIS_EXECUTABLE_NOT_PINNED')
    return config, actual


def execute(request, config, artifacts):
    if os.name != 'nt':
        raise ValueError('IRIS_REQUIRES_WINDOWS')
    import pyodbc  # Optional Windows integration dependency; not required by the app.
    if request.get('protocol') != PROTOCOL or request.get('classification') != 'ICD-10':
        raise ValueError('IRIS_INVALID_REQUEST')
    request_id = request.get('requestId', '')
    if not re.fullmatch('[0-9a-f]{64}', request_id):
        raise ValueError('IRIS_INVALID_REQUEST_ID')
    expected = hashlib.sha256(json.dumps({k: v for k, v in request.items() if k != 'requestId'}, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
    if expected != request_id:
        raise ValueError('IRIS_REQUEST_HASH_MISMATCH')
    # Fresh lot per attempt, so a prior run can never provide a stale successful result.
    import uuid
    lot = 'CDC' + uuid.uuid4().hex[:20]
    key = request_id[:30]
    db = Path(config['certificatesDb']).resolve()
    driver = config.get('odbcDriver', 'Microsoft Access Driver (*.mdb, *.accdb)')
    if any(c in str(db) + driver for c in ';{}'):
        raise ValueError('IRIS_INVALID_DB_CONFIGURATION')
    connection = pyodbc.connect(f'DRIVER={{{driver}}};DBQ={db};', autocommit=False)
    cursor = connection.cursor()
    try:
        # The supplied empty reference tables carry the installed version's schema.
        for suffix in ['Ident', 'MedCod']:
            cursor.execute(f'SELECT TOP 0 * INTO [{lot}{suffix}] FROM [aaaReference{suffix}]')
        demo = request['demographics']
        age = demo['age']
        if age['unit'] not in ('Y', 'D'):
            raise ValueError('IRIS_AGE_REQUIRES_YEARS_OR_DAYS')
        ident = {'CertificateKey': key, 'Age': str(age['value']) + config['ageUnits'][age['unit']], 'Sex': demo['sex'],
                 'MannerOfDeath': demo['mannerOfDeath'], 'Status': 'Initial', 'Reject': 'No', 'Coding': 'Automatic'}
        # Field spelling follows the official Iris V5 certificate schema.
        for field in ['pregnancy', 'pregnancyContributeDeath', 'stillbirth', 'completedWeeks',
                      'birthWeight', 'ageOfMother', 'conditionMother', 'externalFreeText']:
            if field in demo:
                ident[field[0].upper() + field[1:]] = demo[field]
        fields = ','.join('[' + f + ']' for f in ident)
        cursor.execute(f'INSERT INTO [{lot}Ident] ({fields}) VALUES ({",".join("?" for _ in ident)})', *ident.values())
        for row in request['lines']:
            number = ['a', 'b', 'c', 'd', 'e', 'part2'].index(row['position'])
            code_mode = request['entryMode'] == 'code'
            cursor.execute(f'INSERT INTO [{lot}MedCod] ([CertificateKey],[LineNb],[TextLine],[CodeLine],[CodeOnly],[LineCoded]) VALUES (?,?,?,?,?,?)',
                           key, number, '' if code_mode else row['text'], row['text'] if code_mode else '', '1' if code_mode else '0', '0')
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
    # Iris uses its dedicated Windows user's configured MUSE options and certificate DB.
    # Never use -r: supplied explicit codes must not be overwritten by text recoding.
    with open(os.devnull, 'wb') as sink:
        process = subprocess.Popen([config['irisExe'], 'lname=' + lot, 'year=' + str(config['codingYear']), '-n'],
                                   cwd=str(Path(config['irisExe']).parent), stdout=sink, stderr=sink)
        try:
            exit_code = process.wait(timeout=45)
        except subprocess.TimeoutExpired:
            subprocess.run(['taskkill', '/PID', str(process.pid), '/T', '/F'], stdout=sink, stderr=sink, check=False)
            raise ValueError('IRIS_NATIVE_TIMEOUT')
    connection = pyodbc.connect(f'DRIVER={{{driver}}};DBQ={db};')
    try:
        cursor = connection.cursor()
        cursor.execute(f'SELECT UCCode,MainInjury,Status,Reject,Coding,CodingVersion,SelectedCodes,MultipleCodes,Comments,ToDoList FROM [{lot}Ident] WHERE CertificateKey=?', key)
        record = cursor.fetchone()
        if record is None:
            raise ValueError('IRIS_RESULT_MISSING')
        identity = {d[0]: (None if v is None else str(v)) for d, v in zip(cursor.description, record)}
        cursor.execute(f'SELECT LineNb,TextLine,CodeLine,IntervalLine FROM [{lot}MedCod] WHERE CertificateKey=? ORDER BY LineNb', key)
        names = [d[0] for d in cursor.description]
        lines = [dict(zip(names, list(r))) for r in cursor.fetchall()]
    finally:
        connection.close()
    # Re-check artifact versions after execution to reject updates during a run.
    _, current = load_config()
    if current != artifacts:
        raise ValueError('IRIS_ARTIFACT_VERSION_CHANGED')
    return {'protocol': PROTOCOL, 'requestId': request_id, 'classification': 'ICD-10',
            'engine': 'Iris/MUSE', 'executionKind': 'native-engine', 'exitCode': exit_code,
            'ident': identity, 'codedLines': lines, 'workLot': lot,
            'ruleTrace': [], 'ruleTraceNote': '详细 SP/M 规则日志请在该工作批次的 MUSE explanation 窗口复核；未从日志推测规则。',
            'provenance': {'rulesVersion': config['rulesVersion'], 'dictionaryVersion': config['dictionaryVersion'],
                           'expectedCodingVersion': config['expectedCodingVersion'], 'codingYear': config['codingYear'],
                           'artifacts': artifacts}}


if __name__ == '__main__':
    try:
        configuration, hashes = load_config()
        if '--check' in sys.argv:
            if os.name != 'nt':
                raise ValueError('IRIS_REQUIRES_WINDOWS')
            import pyodbc
            print(json.dumps({'configuration': 'verified', 'artifacts': hashes, 'engineExecutionVerified': False}))
        else:
            raw = sys.stdin.buffer.read(65537)
            if len(raw) > 65536:
                raise ValueError('IRIS_REQUEST_TOO_LARGE')
            # ASCII JSON is independent of the Windows console code page.
            print(json.dumps(execute(json.loads(raw), configuration, hashes), ensure_ascii=True, default=str))
    except Exception as error:
        message = str(error) if re.fullmatch('IRIS_[A-Z_]+', str(error)) else 'IRIS_NATIVE_WORKER_FAILED'
        print(message, file=sys.stderr)
        sys.exit(1)
