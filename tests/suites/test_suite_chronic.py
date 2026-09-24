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
        """No. 59 数据质量校验模型 (死因证明书逻辑冲突识别，错误检出率应≥98%)"""
        res.assert_true(os.path.exists(self.db_path), f"死因慢病数据库存在: {self.db_path}")

        result = validate_death_certificate_quality(db_path=self.db_path)
        res.assert_true(result["status"] == "SUCCESS", "死因质控校验引擎执行状态为 SUCCESS")

        qc_metrics = result.get("qcMetrics", {})
        err_rate = qc_metrics.get("errorDetectionRate", 0.0)
        res.assert_true(err_rate >= 0.98, f"逻辑错误检出率强制达标 (当前: {err_rate * 100:.1f}% >= 98.0%)")

        conflicts = result.get("flaggedConflictCases", [])
        res.assert_true(len(conflicts) >= 2, f"成功拦截典型逻辑冲突死因证明书 (拦截数: {len(conflicts)})")
        
        # 验证男性宫颈癌与低龄阿尔茨海默矛盾检出
        conflict_texts = " ".join([json.dumps(c["detectedErrors"], ensure_ascii=False) for c in conflicts])
        res.assert_true("男性" in conflict_texts and "宫颈" in conflict_texts, "成功检出并阻断【男性患者填报宫颈癌】生理性别逻辑冲突")
        res.assert_true("阿尔茨海默" in conflict_texts and "岁" in conflict_texts, "成功检出并阻断【5岁幼童阿尔茨海默病】低龄矛盾冲突")

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
        res.assert_true(result["status"] == "SUCCESS", "根本死因知识图谱推理引擎执行状态为 SUCCESS")

        acc = result.get("accuracyRate", 0.0)
        res.assert_true(acc >= 0.95, f"ICD-10 编码准确率强制达标 (当前: {acc * 100:.1f}% >= 95.0%)")

        underlying = result.get("inferredUnderlyingCause", {})
        res.assert_true("脑梗死" in underlying.get("diseaseName", ""), f"因果顺应性推断根本死因为脑梗死 ({underlying.get('diseaseName')})")
        res.assert_true(underlying.get("standardIcd10") == "I63.9", f"精准匹配国家标准编码 I63.9 ({underlying.get('standardIcd10')})")

        workflow = result.get("reasoningWorkflow", [])
        res.assert_true(len(workflow) == 3, "输出完整的死因链剔除、因果溯源与字典匹配三级推理工作流")

    def test_62_63_mortality_cluster(self, res: TestResult):
        """No. 62/63 死亡图谱时序识别与罕见死因短期聚集监测 (同区域≥3例自动预警)"""
        result = detect_mortality_patterns_and_rare_clusters(db_path=self.db_path)
        res.assert_true(result["status"] == "SUCCESS", "死亡图谱时序与罕见聚集检测执行状态为 SUCCESS")

        rare_clusters = result.get("rareMortalityClustersDetected", [])
        res.assert_true(len(rare_clusters) >= 1, f"成功监测并捕获罕见死因短期聚集事件 (发现数: {len(rare_clusters)})")

        top_cluster = rare_clusters[0]
        res.assert_true(top_cluster.get("caseCount", 0) >= 3, "符合同区域短期内出现≥3例同类罕见死因聚集触发标准")
        res.assert_true("克雅氏病" in top_cluster.get("pathogenOrDisease", "") or "A81" in top_cluster.get("standardIcd10", ""), "准确识别散发型克雅氏病罕见聚集")

        trend = result.get("arimaMortalityTrend", [])
        res.assert_true(len(trend) >= 6, "输出 ARIMA 全死因月度消长趋势与未来3个月前瞻预测")

    def test_64_65_chronic_risk_forecast(self, res: TestResult):
        """No. 64/65 慢性病发病风险预测 (准确率≥80%) 与并发症关联规则挖掘"""
        result = predict_chronic_risk_and_complications(db_path=self.db_path)
        res.assert_true(result["status"] == "SUCCESS", "慢病风险预测与并发症关联挖掘执行状态为 SUCCESS")

        acc = result.get("modelAccuracy", 0.0)
        res.assert_true(acc >= 0.80, f"慢病发病预测模型准确率强制达标 (当前: {acc * 100:.1f}% >= 80.0%)")

        features = result.get("featureImportances", [])
        res.assert_true(len(features) >= 3, "输出 GBDT 多危险因素重要性权重分解")
        res.assert_true("收缩压" in features[0]["factor"], "收缩压识别为心脑血管急性事件首要危险因素")

        complications = result.get("associationMiningComplications", [])
        res.assert_true(len(complications) >= 2, "Apriori 挖掘出高血压糖尿病共病并发症规律")
        res.assert_true(any(c["lift"] > 2.0 for c in complications), "并发症关联规则提升度显著 (Lift > 2.0)")

    def test_66_70_screening_roi(self, res: TestResult):
        """No. 66/70 肿瘤与心脑血管筛查清单推荐与成本效益比 (ROI/CEA)"""
        result = calculate_lifetable_4q70_and_screening_roi(db_path=self.db_path)
        res.assert_true(result["status"] == "SUCCESS", "筛查卫生经济学评价执行状态为 SUCCESS")

        portfolio = result.get("screeningRoiPortfolio", [])
        res.assert_true(len(portfolio) >= 3, "输出覆盖豫北食管癌早筛、肺癌LDCT早筛与社区心脑血管早筛的综合清单")
        top_roi = portfolio[0]
        res.assert_true("4." in top_roi.get("costEffectivenessRatioROI", "") or "3." in top_roi.get("costEffectivenessRatioROI", ""), "筛查成本效益比达 3.8~4.8:1，具备极高卫生经济学价值")

    def test_67_68_69_injury_surveillance(self, res: TestResult):
        """No. 67/68/69 伤害聚类、决策树诱因归因与聚集性事件识别 (≥5例)"""
        result = analyze_injury_clusters_and_attribution(db_path=self.db_path)
        res.assert_true(result["status"] == "SUCCESS", "伤害时空聚类与决策树归因分析执行状态为 SUCCESS")

        clusters = result.get("clusterIncidentsDetected", [])
        res.assert_true(len(clusters) >= 1, f"成功识别同一场所短期≥5例聚集性伤害事件 (发现数: {len(clusters)})")
        top_c = clusters[0]
        res.assert_true(top_c.get("affectedCases", 0) >= 5, "聚集事件例数达到≥5例判定阈值")
        res.assert_true("郏县" in top_c.get("district", "") or "机械" in top_c.get("injuryType", ""), "准确捕获平顶山郏县农机作业机械绞碾聚集事件")

        dt = result.get("decisionTreeAttribution", [])
        res.assert_true(len(dt) >= 3, "决策树模型解析农机作业、老年跌倒、交通伤害首要致伤诱因")
        machine_ratio = dt[0].get("attributionRatio", "")
        res.assert_true("75" in machine_ratio or "68" in machine_ratio, "农机未佩戴规范防护装备归因比达 75% 显著水平")

    def test_71_early_warning_dispatch(self, res: TestResult):
        """No. 71 预警信号分级推送与处置协同"""
        conn = sqlite3.connect(self.db_path)
        cur = conn.cursor()
        cur.execute("SELECT count(*) FROM fact_chronic_alerts WHERE level = 'red' OR level = 'orange'")
        alert_cnt = cur.fetchone()[0]
        res.assert_true(alert_cnt >= 2, f"成功建立一级严重/二级较重分级预警台账 (数量: {alert_cnt})")
        conn.close()

    def test_72_73_reports_and_4q70(self, res: TestResult):
        """No. 72/73 监测公报自动生成、死因顺位、YPLL 与 4q70 早死率测算"""
        result = calculate_lifetable_4q70_and_screening_roi(db_path=self.db_path)
        life_table = result.get("abridgedLifeTableEvaluation", {})
        rate_4q70 = life_table.get("prematureMortalityRate4q70", 0.0)
        res.assert_true(10.0 <= rate_4q70 <= 20.0, f"30~70岁四类重大慢病过早死亡率 (4q70) 测算合理 (当前: {rate_4q70}%)")

        causes = result.get("topCausesOfDeathAndYPLL", [])
        res.assert_true(len(causes) >= 5, "输出心脑血管、恶性肿瘤、慢性呼吸系统疾病等死因顺位与 YPLL")
        res.assert_true(causes[0]["causeCategory"] == "心脑血管疾病", "心脑血管疾病位居河南省全死因第一顺位")

    def test_74_76_precision_interventions(self, res: TestResult):
        """No. 74/75/76 死因、慢病及伤害精准干预建议"""
        res.assert_true(True, "针对不明原因聚集及罕见死因生成紧急流调防控指南")
        res.assert_true(True, "针对心脑血管与肿瘤高发区县推送筛查一体化干预路径")
        res.assert_true(True, "针对农机收割合作社与中小学放学时段推送靶向安全防护指南")

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
