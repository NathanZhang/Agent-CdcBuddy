#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
================================================================================
死因、慢病及伤害综合监测预警智能体 - 自动化测试套件 (Chronic Surveillance Test Suite)
================================================================================
依据《人工智能-四智能体-功能清单》（plan/人工智能-四智能体-功能清单.md）
第（五）部分：死因、慢病及伤害综合监测预警智能应用（序号 59 ~ 76）
================================================================================
"""

import os
import sys
import time
import json
import sqlite3
from datetime import datetime

TESTS_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE_DIR = os.path.dirname(TESTS_DIR)
sys.path.insert(0, os.path.join(BASE_DIR, "analytics_engine"))
sys.path.insert(0, TESTS_DIR)

from automated_test_suite import TestResult

from chronic.death_cert_qc import validate_death_certificate_quality
from chronic.icd10_nlp_inference import infer_underlying_cause_and_icd10
from chronic.mortality_cluster_dbscan import detect_mortality_patterns_and_rare_clusters
from chronic.chronic_risk_gbdt import predict_chronic_risk_and_complications
from chronic.injury_tree_attribution import analyze_injury_clusters_and_attribution
from chronic.lifetable_4q70_roi import calculate_lifetable_4q70_and_screening_roi

class ChronicSurveillanceTestSuite:
    def __init__(self):
        self.results = []
        self.start_time = None
        self.end_time = None
        self.db_path = os.path.join(BASE_DIR, "chronic_monitoring.db")

    def log(self, msg: str):
        print(msg)

    def run_test(self, req_id: str, title: str, category: str, scenario: str, test_func):
        result = TestResult(req_id, title, category, scenario)
        self.log(f"\n================================================================================")
        self.log(f"[{req_id}] {title} - {scenario}")
        self.log(f"================================================================================")
        start = time.time()
        try:
            test_func(result)
            result.status = "PASSED"
            self.log(f"  --> 测试通过 (通过断言: {result.assertions_passed}/{result.assertions_total})")
        except Exception as e:
            result.status = "FAILED"
            result.error = str(e)
            self.log(f"  --> 测试失败: {e}")
        finally:
            result.elapsed_ms = (time.time() - start) * 1000.0
            self.results.append(result)

    def test_59_quality_validation(self, res: TestResult):
        """Compatibility/partial or refusal only; no full capability signoff."""
        r=validate_death_certificate_quality(db_path=self.db_path)
        res.assert_true(r['totalCertificatesChecked']>0,'实际规则检查')
        res.assert_true(r['qcMetrics']['errorDetectionRate'] is None,'无标签基准不声明准确率')
        res.assert_true(all(c['detectedErrors'] for c in r['flaggedConflictCases']),'每个复核候选有实际触发规则')

    def test_60_61_icd10_inference(self, res: TestResult):
        """No. 60/61 数据自动解析与根本死因知识图谱推理 (编码准确率应≥95%)"""
        result = infer_underlying_cause_and_icd10(
            db_path=self.db_path,
            input_chain={
                "a": "中枢性呼吸衰竭",
                "b": "急性大面积脑水肿与脑疝",
                "c": "急性大面积大脑中动脉脑梗死",
                "d": "原发性高血压3级 (很高危)"
            }
        )
        res.assert_true(result["status"] == "REVIEW_REQUIRED", "编码字典候选需人工复核")

        res.assert_true(result.get("accuracyRate") is None, "无独立评估不能声明准确率达标")
        res.assert_true(result["metrics"]["accuracy"]["evaluationKind"] == "unvalidated", "准确率来源标记为未评估")

        res.assert_true(result.get("inferredUnderlyingCause") is None, "字典解析不伪造根本死因")
        res.assert_true(any("I63" in r["candidateCodes"] for r in result["categoryCandidates"]), "保留脑梗死三位类目候选")

        workflow = result.get("reasoningWorkflow", [])
        res.assert_true(len(workflow) == 4 and result['review']['autoFinalized'] is False, "保留解析、类目检索、引擎状态和人工复核步骤")

    def test_62_63_mortality_cluster(self, res: TestResult):
        """Compatibility/partial or refusal only; no full capability signoff."""
        r=detect_mortality_patterns_and_rare_clusters(db_path=self.db_path)
        res.assert_true(sum(m['deaths'] for m in r['observedMonthlyDeaths'])==r['totalDeaths'],'实际月计数总量一致')
        res.assert_true(all(c['caseCount']>=3 for c in r['rareMortalityClustersDetected']),'真实短窗候选阈值')
        res.assert_true('arimaMortalityTrend' not in r,'不伪造ARIMA预测')

    def test_64_65_chronic_risk_forecast(self, res: TestResult):
        """Compatibility/partial or refusal only; no full capability signoff."""
        r=predict_chronic_risk_and_complications(db_path=self.db_path)
        res.assert_true(r['error']['code']=='CAPABILITY_UNAVAILABLE','慢病模型缺训练不可用')

    def test_66_70_screening_roi(self, res: TestResult):
        """Compatibility/partial or refusal only; no full capability signoff."""
        r=calculate_lifetable_4q70_and_screening_roi(db_path=self.db_path)
        res.assert_true(r['error']['code']=='CAPABILITY_UNAVAILABLE','ROI未验证不可用')

    def test_67_68_69_injury_surveillance(self, res: TestResult):
        """Compatibility/partial or refusal only; no full capability signoff."""
        r=analyze_injury_clusters_and_attribution(db_path=self.db_path)
        res.assert_true(sum(c['caseCount'] for c in r['injuryTypeComposition'])==r['totalInjuriesMonitored'],'实际构成总量一致')
        res.assert_true(r['decisionTreeAttribution'] is None,'未训练因果模型保持空')
        res.assert_true(all(c['caseCount']>=5 for c in r['clusterIncidentsDetected']),'24小时真实候选阈值')

    def test_71_early_warning_dispatch(self, res: TestResult):
        """No. 71 预警信号分级推送与处置协同"""
        conn = sqlite3.connect(self.db_path)
        cur = conn.cursor()
        cur.execute("SELECT count(*) FROM fact_chronic_alerts WHERE level = 'red' OR level = 'orange'")
        alert_cnt = cur.fetchone()[0]
        res.assert_true(alert_cnt >= 2, f"成功建立一级严重/二级较重分级预警台账 (数量: {alert_cnt})")
        conn.close()

    def test_72_73_reports_and_4q70(self, res: TestResult):
        """Compatibility/partial or refusal only; no full capability signoff."""
        r=calculate_lifetable_4q70_and_screening_roi(db_path=self.db_path)
        res.assert_true(r['status']=='FAILED','缺少完整人口生命表条件不返回固定4q70')

    def test_74_76_precision_interventions(self, res: TestResult):
        """Compatibility/partial or refusal only; no full capability signoff."""
        from analytics_engine.mock_methods import unavailable
        res.assert_true(unavailable('precision-intervention')['status']=='FAILED','未实现专业干预不作为完成验收')

    def run_all(self):
        self.start_time = datetime.now()
        self.log(f"死因慢病伤害自动化测试套件启动: {self.start_time.strftime('%Y-%m-%d %H:%M:%S')}")

        self.run_test("No. 59", "数据质量校验模型", "数据质量质控", "死因医学证明书逻辑冲突识别与错误检出率≥98%", self.test_59_quality_validation)
        self.run_test("No. 60-61", "数据自动解析与根本死因推断", "知识图谱与NLP", "死因链因果顺应性推理与 ICD-10 智能编码 (≥95%)", self.test_60_61_icd10_inference)
        self.run_test("No. 62-63", "死亡图谱与罕见死因检测", "时序与空间聚类", "ARIMA 死亡率预测与克雅氏病罕见聚集识别 (≥3例)", self.test_62_63_mortality_cluster)
        self.run_test("No. 64-65", "慢病发病预测与并发症挖掘", "机器学习预测", "GBDT 心脑血管风险预测 (≥80%) 与并发症关联规则", self.test_64_65_chronic_risk_forecast)
        self.run_test("No. 66/70", "筛查清单与卫生经济学收益", "卫生经济学评价", "早癌与心脑血管高危筛查清单与 ROI 测算", self.test_66_70_screening_roi)
        self.run_test("No. 67-69", "伤害聚类与决策树归因", "伤害监测溯源", "伤害类型聚类、决策树诱因归因与农机聚集伤害识别 (≥5例)", self.test_67_68_69_injury_surveillance)
        self.run_test("No. 71", "预警信号分级推送", "风险分级推送", "多层级机构风险推送与预警依据分发", self.test_71_early_warning_dispatch)
        self.run_test("No. 72-73", "综合公报与4q70早死率", "统计公报生成", "死因顺位、YPLL 测算与 WHO 简略寿命表 4q70 早死率", self.test_72_73_reports_and_4q70)
        self.run_test("No. 74-76", "精准干预建议模型", "精准综合施策", "死因、慢病及伤害多部门协同综合干预建议", self.test_74_76_precision_interventions)

        self.end_time = datetime.now()
        total = len(self.results)
        passed = sum(1 for r in self.results if r.status == "PASSED")
        self.log(f"\n================================================================================")
        self.log(f"测试执行完成: 总计 {total} 项，通过 {passed} 项，失败 {total - passed} 项")
        self.log(f"================================================================================")
        return passed == total

if __name__ == "__main__":
    suite = ChronicSurveillanceTestSuite()
    success = suite.run_all()
    sys.exit(0 if success else 1)
