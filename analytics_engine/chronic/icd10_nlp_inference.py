from analytics_engine.repositories.datasets import resolve_dataset_path, connect_readonly
#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
No. 60/61: 非结构化数据 NLP 解析与根本死因知识图谱推理判定模型
基于知识图谱（《死因登记规范》《ICD-10 编码规则》），对死因链文本进行因果推理，自动判定根本死因，编码准确率应≥95%。
"""

import os
import sqlite3
import json

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


ICD10_KNOWLEDGE_BASE = {
    "急性心肌梗死": {"code": "I21.9", "full_code": "I21.900", "chapter": "第九章 循环系统疾病", "block": "缺血性心脏病 (I20-I25)"},
    "心肌梗死": {"code": "I21.1", "full_code": "I21.101", "chapter": "第九章 循环系统疾病", "block": "缺血性心脏病 (I20-I25)"},
    "脑梗死": {"code": "I63.9", "full_code": "I63.902", "chapter": "第九章 循环系统疾病", "block": "脑血管疾病 (I60-I69)"},
    "脑出血": {"code": "I61.9", "full_code": "I61.901", "chapter": "第九章 循环系统疾病", "block": "脑血管疾病 (I60-I69)"},
    "肺癌": {"code": "C34.9", "full_code": "C34.901", "chapter": "第二章 肿瘤", "block": "恶性肿瘤 (C00-C97)"},
    "食管癌": {"code": "C15.9", "full_code": "C15.901", "chapter": "第二章 肿瘤", "block": "恶性肿瘤 (C00-C97)"},
    "胃癌": {"code": "C16.9", "full_code": "C16.901", "chapter": "第二章 肿瘤", "block": "恶性肿瘤 (C00-C97)"},
    "慢性阻塞性肺疾病": {"code": "J44.9", "full_code": "J44.900", "chapter": "第十章 呼吸系统疾病", "block": "慢性下呼吸道疾病 (J40-J47)"},
    "糖尿病": {"code": "E11.9", "full_code": "E11.901", "chapter": "第四章 内分泌营养代谢", "block": "糖尿病 (E10-E14)"},
    "阿尔茨海默病": {"code": "G30.9", "full_code": "G30.901", "chapter": "第六章 神经系统疾病", "block": "神经系统其他退行性变 (G30-G32)"},
    "克雅氏病": {"code": "A81.0", "full_code": "A81.001", "chapter": "第一章 传染病和寄生虫病", "block": "中枢神经系统非典型病毒感染 (A81)"},
    "跌倒": {"code": "W19.9", "full_code": "W19.901", "chapter": "第二十章 疾病和死亡的外因", "block": "跌倒 (W00-W19)"}
}

def infer_underlying_cause_and_icd10(
    db_path: str = None,
    cert_id: str = None,
    input_chain: dict = None
):
    if not db_path:
        db_path = str(resolve_dataset_path('chronic'))

    if input_chain is not None:
        a,b,c,d = [str(input_chain.get(key) or "") for key in ["a","b","c","d"]]
    else:
        conn = connect_readonly(db_path)
        try:
            cur = conn.cursor()
            if cert_id:
                cur.execute("SELECT cause_chain_a,cause_chain_b,cause_chain_c,cause_chain_d FROM fact_death_registry WHERE death_cert_id = ?",(cert_id,))
            else:
                cur.execute("SELECT cause_chain_a,cause_chain_b,cause_chain_c,cause_chain_d FROM fact_death_registry ORDER BY death_cert_id LIMIT 1")
            row = cur.fetchone()
        finally:
            conn.close()
        if not row:
            return {"status":"NO_DATA","payload":None,"inferredUnderlyingCause":None,"accuracyRate":None,"message":"未查询到死亡证明书"}
        a,b,c,d = [str(value or "") for value in row]
    candidate = None
    # Prefer the earliest supplied chain item; a match only proposes a dictionary candidate.
    for item in [d,c,b,a]:
        for keyword in sorted(ICD10_KNOWLEDGE_BASE,key=len,reverse=True):
            if keyword in item:
                info = ICD10_KNOWLEDGE_BASE[keyword]
                candidate = {"diseaseName":keyword,"standardIcd10":info["code"],"icd10ExpandedCode":info["full_code"],"chapter":info["chapter"],"block":info["block"],"confidenceScore":None}
                break
        if candidate: break
    workflow = [
        {"step":1,"title":"读取死因链","content":f"按原始输入读取 (a)={a}, (b)={b}, (c)={c}, (d)={d}"},
        {"step":2,"title":"字典候选检索","content":f"检索结果：{candidate['diseaseName']}" if candidate else "未找到可支持编码的字典条目"},
        {"step":3,"title":"人工复核","content":"字典匹配不能验证因果链或替代专业编码审核，需人工复核"}
    ]
    return {
        "status":"REVIEW_REQUIRED","method":"icd10-dictionary-candidate-v1","message":"死因编码候选需人工复核" if candidate else "死因链未匹配，需人工复核",
        "accuracyRate":None,"accuracyCompliance":"未评估",
        "metrics":{"accuracy":{"value":None,"evaluationKind":"unvalidated","datasetIds":[],"definition":"未进行独立标注集编码准确率评估"}},
        "qualityFlags":["clinical-review-required","accuracy-unvalidated"],
        "inputDeathChain":{"part1_a":a,"part1_b":b,"part1_c":c,"part1_d":d},
        "inferredUnderlyingCause":candidate,"reasoningWorkflow":workflow,
        "replacementBenefit":"仅提供可追溯的字典候选，保留人工编码审核"
    }

if __name__ == "__main__":
    res = infer_underlying_cause_and_icd10()
    print(json.dumps(res, ensure_ascii=False, indent=2))
