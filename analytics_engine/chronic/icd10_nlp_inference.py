"""Requirements 60/61: lossless parsing, ICD-10 categories and licensed Iris selection.

No local edge list or last-line heuristic may substitute for the official engine.
"""
from analytics_engine.repositories.datasets import resolve_dataset_path, connect_readonly
from analytics_engine.chronic.mortality_parser import parse_certificate, catalogue
from analytics_engine.chronic.iris_adapter import request_for, invoke_iris


def infer_underlying_cause_and_icd10(db_path=None, cert_id=None, input_chain=None,
                                    mode='dictionary', text=None, demographics=None,
                                    entry_mode='text'):
    if mode not in ('dictionary', 'graph'):
        raise ValueError('UNKNOWN_CAUSE_INFERENCE_MODE')
    if input_chain is None and text is None:
        if not cert_id:
            raise ValueError('A certificate identifier or explicit text is required')
        connection = connect_readonly(db_path or str(resolve_dataset_path('chronic')))
        try:
            row = connection.execute('SELECT cause_chain_a,cause_chain_b,cause_chain_c,cause_chain_d,age,gender FROM fact_death_registry WHERE death_cert_id=?', (cert_id,)).fetchone()
        finally:
            connection.close()
        if row is None:
            return {'status': 'NO_DATA', 'inferredUnderlyingCause': None, 'message': '未查询到死亡证明书'}
        input_chain = dict(zip('abcd', [str(v or '') for v in row[:4]]))
        demographics = demographics or {'sex': {'男': '1', '女': '2'}.get(row[5], '9'),
                                        'age': {'value': int(row[4]), 'unit': 'Y'}}
    parsed = parse_certificate(input_chain, text)
    request, input_issues = request_for(parsed, demographics, entry_mode)
    engine = invoke_iris(request, input_issues) if mode == 'graph' else {
        'selectionStatus': 'PARSING_ONLY', 'candidateCode': None,
        'message': '本步骤提取原文与类目候选；根本死因选择通过第61项的 Iris/MUSE 执行。'}
    candidate = None
    if engine.get('candidateCode'):
        code = engine['candidateCode']
        entry = catalogue()[1].get(code[:3])
        candidate = {'standardIcd10': code, 'classification': 'ICD-10',
                     'diseaseName': entry['label'] if entry else '以 Iris 安装版本的分类名称为准',
                     'labelGranularity': 'category-only', 'confidenceScore': None,
                     'source': 'Iris/MUSE', 'requiresReview': True}
    categories = []
    for row in parsed['rows']:
        for entity in row['entities']:
            if entity['assertion'] == 'negated':
                continue
            categories.append({'position': row['position'], 'text': entity['text'],
                               'assertion': entity['assertion'], 'candidateCodes': entity['candidateCodes'],
                               'granularity': entity['granularity'], 'requiresReview': True})
    part_one = [r for r in parsed['rows'] if r['position'] != 'part2']
    graph = {'nodes': [{'position': r['position'], 'text': r['text']} for r in parsed['rows']],
             'reportedEdges': [{'from': cause['position'], 'to': effect['position'], 'evidence': 'certificate-reported-order-not-validated-causality'}
                               for effect, cause in zip(part_one, part_one[1:])],
             'selectionSupported': candidate is not None,
             'ruleVersion': engine.get('provenance', {}).get('rulesVersion'),
             'scope': '关系箭头仅反映原始填报次序；根本死因候选只接受 Iris/MUSE 实际输出。'}
    issues = list(dict.fromkeys(parsed['issues'] + input_issues))
    return {'status': 'REVIEW_REQUIRED', 'method': 'icd10-iris-mortality-v2',
            'message': '解析完成，等待人工核对与编码细化' if mode == 'dictionary' else engine.get('message', 'Iris/MUSE 已返回候选，等待人工复核'),
            'accuracyRate': None, 'accuracyCompliance': '独立标注集尚未验收',
            'metrics': {'accuracy': {'value': None, 'evaluationKind': 'unvalidated', 'datasetIds': [],
                                     'definition': '功能案例不代表独立临床编码准确率'}},
            'qualityFlags': ['clinical-review-required', 'accuracy-unvalidated', 'category-table-not-terminal-codes'] +
                            (['iris-engine-not-configured'] if engine['selectionStatus'] == 'ENGINE_NOT_CONFIGURED' else []),
            'parsedCertificate': parsed, 'categoryCandidates': categories, 'causeGraph': graph,
            'inferredUnderlyingCause': candidate, 'engineResult': engine, 'inputIssues': issues,
            'inputDeathChain': {r['position']: r['text'] for r in parsed['rows']},
            'demographics': demographics or {}, 'entryMode': entry_mode,
            'review': {'status': 'PENDING', 'required': True, 'autoFinalized': False,
                       'checks': ['逐行核对原文、否定词及同一行多个疾病', '核对年龄、性别、第二部分及死亡方式',
                                  '核对 Iris 规则版本、退回原因、编码及原生规则日志', '确认后由有权限编码员在正式登记系统签署']},
            'reasoningWorkflow': [
                {'step': 1, 'title': '提取证明书结构', 'content': '保留第一部分、第二部分、同一行多个疾病和原文偏移。'},
                {'step': 2, 'title': '检索类目候选', 'content': f"使用用户提供的 {parsed['categoryCount']} 条三位类目；不自动补成四位或六位编码。"},
                {'step': 3, 'title': '调用正式规则引擎', 'content': engine.get('selectionStatus')},
                {'step': 4, 'title': '人工复核', 'content': '所有机器结果保留为草稿；未知、冲突、引擎异常均不自动定案。'}]}
