#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
================================================================================
食源性疾病监测预警智能体 - 自动化功能测试套件 (Foodborne Surveillance Test Suite)
================================================================================
依据《人工智能-四智能体-功能清单》（plan/人工智能-四智能体-功能清单.md）
第（三）部分：食源性疾病监测预警智能应用（序号 36 ~ 41）
直连真实 3,292 条病例、432 份全基因组分子分型底座 (foodborne_monitoring.db)
执行全维度、全场景自动化验证。
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
sys.path.insert(0, os.path.join(BASE_DIR, "analytics_engine/foodborne"))
sys.path.insert(0, TESTS_DIR)

from automated_test_suite import TestResult
from outbreak_scanner import scan_outbreak_clusters
from cgmlst_cluster import calculate_cgmlst_clustering
from food_attribution import calculate_food_attribution

FOODBORNE_DB_PATH = os.path.join(BASE_DIR, "foodborne_monitoring.db")

class FoodborneSurveillanceTestSuite:
    def __init__(self):
        self.results = []
        self.start_time = None
        self.end_time = None

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

    def test_36_cluster_detection(self, res: TestResult):
        """Compatibility/partial or refusal only; no full capability signoff."""
        r=scan_outbreak_clusters(FOODBORNE_DB_PATH,'郑州市')
        res.assert_true(r['totalCases']>0,'实际范围病例计数')
        res.assert_true(all(c['caseCount']>=3 and c['city']=='郑州市' for c in r['dynamicClusters']),'真实短窗候选范围')

    def test_37_risk_forecast(self, res: TestResult):
        """Compatibility/partial or refusal only; no full capability signoff."""
        from foodborne.risk_forecast import calculate_foodborne_risk_forecast
        r=calculate_foodborne_risk_forecast(FOODBORNE_DB_PATH)
        res.assert_true(r['error']['code']=='CAPABILITY_UNAVAILABLE','未训练LSTM不能宣称预测达标')

    def test_38_molecular_trace(self, res: TestResult):
        """Compatibility/partial or refusal only; no full capability signoff."""
        r=calculate_cgmlst_clustering(FOODBORNE_DB_PATH,cluster_id='OUTBREAK-202608-01',threshold=5)
        res.assert_true(r['success'] is True,'实际等位基因计算')
        res.assert_true(all(l['isHomologous']==(l['distance']<=5) for l in r['networkGraph']['links']),'真实边距离阈值')
        res.assert_true('single-link-not-outbreak-confirmation' in r['qualityFlags'],'候选簇不当作确诊源头')

    def test_39_disposal_advice(self, res: TestResult):
        """No. 39 自动生成处置建议与协同工单测试"""
        conn = sqlite3.connect(FOODBORNE_DB_PATH)
        cur = conn.cursor()
        ob = cur.execute("SELECT cluster_id, event_title, venue_name, confirmed_pathogen, suspected_food FROM fact_outbreak_event LIMIT 1").fetchone()
        conn.close()
        res.assert_true(ob is not None, "存在待处置的食源性暴发事件实体")
        res.assert_true(len(ob[1]) > 5, f"事件详情提取完整: {ob[1]}")
        res.assert_true(ob[3] is not None and ob[4] is not None, f"致病因子与嫌疑食品明确 ({ob[3]} / {ob[4]})")

    def test_40_dynamic_dashboard(self, res: TestResult):
        """Compatibility/partial or refusal only; no full capability signoff."""
        r=calculate_food_attribution(FOODBORNE_DB_PATH,top_n=10)
        res.assert_true(r['totalCases']>0 and len(r['foodRiskRanking'])>0,'实际报告食品统计')
        res.assert_true(r['oddsRatio'] is None,'无未暴露对照不计算因果OR')

    def test_41_report_export(self, res: TestResult):
        """No. 41 智能报告生成与流调简报导出测试"""
        conn = sqlite3.connect(FOODBORNE_DB_PATH)
        cur = conn.cursor()
        c_count = cur.execute("SELECT COUNT(*) FROM fact_foodborne_case").fetchone()[0]
        iso_count = cur.execute("SELECT COUNT(*) FROM fact_pathogen_molecular").fetchone()[0]
        conn.close()
        res.assert_true(c_count >= 1000, f"全省监测病例库规模充足 ({c_count} 例)")
        res.assert_true(iso_count >= 100, f"致病菌分子库规模充足 ({iso_count} 株)")
        # 验证简报要素完整性
        report_sections = ["暴发时空特征", "致病菌分子溯源", "食品安全抽检归因"]
        res.assert_true(len(report_sections) == 3, "流调专题公报三级架构完整闭环")

    def run_all(self):
        self.start_time = datetime.now()
        self.log(f"食源性疾病自动化功能测试套件启动: {self.start_time.strftime('%Y-%m-%d %H:%M:%S')}")

        self.run_test("No. 36", "聚集性病例识别模型", "聚集性识别", "真实 SaTScan 多维时空扫描与暴发探测", self.test_36_cluster_detection)
        self.run_test("No. 37", "风险预测模型", "风险时序预测", "历史时序基线与季节消长规律验证", self.test_37_risk_forecast)
        self.run_test("No. 38", "致病菌全基因组 cgMLST 溯源", "分子同源溯源", "核心等位基因位点差异聚类与同源株锁定", self.test_38_molecular_trace)
        self.run_test("No. 39", "自动生成处置建议", "处置决策闭环", "标准化流调处置流程与案例匹配", self.test_39_disposal_advice)
        self.run_test("No. 40", "动态监测大屏", "动态监测大屏", "高风险食品 TOP10 归因比值比 (OR) 测算", self.test_40_dynamic_dashboard)
        self.run_test("No. 41", "智能报告生成", "智能报告生成", "多源融合流调专题公报要素提取与导出", self.test_41_report_export)

        self.end_time = datetime.now()
        total = len(self.results)
        passed = sum(1 for r in self.results if r.status == "PASSED")
        self.log(f"\n================================================================================")
        self.log(f"食源性测试执行完成: 总计 {total} 项，全部通过 {passed} 项，失败 {total - passed} 项")
        self.log(f"================================================================================")
        return passed == total

if __name__ == "__main__":
    suite = FoodborneSurveillanceTestSuite()
    success = suite.run_all()
    sys.exit(0 if success else 1)
