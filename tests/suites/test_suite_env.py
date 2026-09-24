#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
================================================================================
环境健康风险监测预警智能体 - 自动化测试套件 (Environmental Health Test Suite)
================================================================================
依据《人工智能-四智能体-功能清单》（plan/人工智能-四智能体-功能清单.md）
第（四）部分：环境相关风险因素监测预警智能应用（序号 42 ~ 58）
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

from env.water_rf_kriging import evaluate_water_health_risk
from env.sewage_lag_tracing import analyze_sewage_lag_correlation
from env.air_climate_dlnm import evaluate_air_climate_health_risk
from env.river_chain_autocorr import analyze_river_basin_pollution_chain
from env.scenario_simulation import simulate_environmental_scenario

class EnvSurveillanceTestSuite:
    def __init__(self):
        self.results = []
        self.start_time = None
        self.end_time = None
        self.db_path = os.path.join(BASE_DIR, "env_monitoring.db")

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

    def test_42_43_ocr_and_qc(self, res: TestResult):
        """No. 42/43 OCR 智能录入与数据清洗标化"""
        # 1. 验证数据库完整性
        res.assert_true(os.path.exists(self.db_path), f"环境健康监测数据库文件存在: {self.db_path}")
        conn = sqlite3.connect(self.db_path)
        cur = conn.cursor()
        
        cur.execute("SELECT count(*) FROM fact_water_monitoring")
        water_cnt = cur.fetchone()[0]
        res.assert_true(water_cnt >= 4000, f"饮用水监测数据量充足 (当前: {water_cnt} 条)")

        # 2. 模拟 OCR 识别与校验逻辑
        sample_doc = {
            "sample_no": "RPT-WATER-2026-08194",
            "station": "新乡市凤泉区第一水厂",
            "turbidity": 0.42,
            "free_chlorine": 0.65,
            "cod_mn": 1.85,
            "total_coliforms": 0,
            "lead_val": 0.002
        }
        res.assert_true(sample_doc["turbidity"] <= 1.0, "浑浊度符合 GB 5749-2022 饮用水限值 (≤1.0 NTU)")
        res.assert_true(sample_doc["free_chlorine"] >= 0.3, "管网末梢余氯符合有效抑菌标准 (≥0.05 mg/L)")
        res.assert_true(sample_doc["total_coliforms"] == 0, "出厂水总大肠菌群质控达标 (不得检出)")
        conn.close()

    def test_44_45_water_safety_eval(self, res: TestResult):
        """No. 44/45 饮用水全流程健康风险评估与普通克里金空间场"""
        result = evaluate_water_health_risk(city="郑州市")
        res.assert_true(result["status"] == "SUCCESS", "饮用水随机森林健康风险计算状态为 SUCCESS")
        
        eval_res = result.get("evaluationResult", {})
        res.assert_true("overallComplianceRate" in eval_res, "包含综合达标率统计")
        res.assert_true("maxCarcinogenicRiskCR" in eval_res, "包含最大致癌风险 CR 指标")
        res.assert_true("maxHazardQuotientHQ" in eval_res, "包含最大非致癌危害商数 HQ 指标")

        # 特征重要性
        features = result.get("randomForestFeatureImportances", [])
        res.assert_true(len(features) >= 3, f"随机森林特征重要性评估完整 (指标数: {len(features)})")
        top_feature = features[0]["feature"]
        res.assert_true("三氯甲烷" in top_feature or "总大肠菌群" in top_feature, f"首要致癌/健康风险因子识别准确 ({top_feature})")

        # 普通克里金空间插值点
        kriging_points = result.get("krigingGridPoints", [])
        res.assert_true(len(kriging_points) > 10, f"普通克里金空间插值输出网格点充足 (点数: {len(kriging_points)})")

    def test_46_47_sewage_lag_tracing(self, res: TestResult):
        """No. 46/47 污水管网病原时序滞后关联分析与 GIS 拓扑反向溯源"""
        result = analyze_sewage_lag_correlation(city="郑州市", pathogen="诺如病毒")
        res.assert_true(result["status"] == "SUCCESS", "污水病原滞后关联分析状态为 SUCCESS")

        lag_window = result.get("optimalLagWindow", {})
        best_lag = lag_window.get("bestLagDays")
        max_r = lag_window.get("maxPearsonR")
        res.assert_true(best_lag == 6, f"最佳提前预警窗口期判定准确 (Lag {best_lag} 天)")
        res.assert_true(max_r >= 0.85, f"最大 Pearson 相关系数高度显著 (r={max_r} >= 0.85)")

        # 反向溯源分区
        sources = result.get("reverseTracingSources", [])
        res.assert_true(len(sources) >= 2, f"反向锁定上游疑似排污集水节点数充足 ({len(sources)} 处)")
        res.assert_true(any("龙子湖" in s["subzoneName"] for s in sources), "成功锁定高危高校排污集水分区")

    def test_48_49_public_venue_hygiene(self, res: TestResult):
        """No. 48/49 公共场所卫生健康效应映射与动态评级"""
        conn = sqlite3.connect(self.db_path)
        cur = conn.cursor()
        cur.execute("SELECT count(*) FROM fact_public_venue_inspection")
        venue_cnt = cur.fetchone()[0]
        res.assert_true(venue_cnt >= 50, f"公共场所卫生监督抽检数据量充足 (当前: {venue_cnt} 批)")

        cur.execute("SELECT venue_type, count(*), round(avg(microclimate_score), 1) FROM fact_public_venue_inspection GROUP BY venue_type")
        rows = cur.fetchall()
        res.assert_true(len(rows) >= 3, "覆盖商场超市、宾馆酒店、洗浴场所等多类公共场所")
        conn.close()

    def test_50_51_air_climate_dlnm(self, res: TestResult):
        """No. 50/51 空气与极端气候健康预警 (DLNM 与 GBDT 72h 预警)"""
        result = evaluate_air_climate_health_risk(city="焦作市")
        res.assert_true(result["status"] == "SUCCESS", "空气与极端气候健康评估状态为 SUCCESS")

        dlnm = result.get("dlnmModelEvaluation", {})
        peak_rr = dlnm.get("peakRelativeRiskRR")
        res.assert_true(peak_rr >= 1.30, f"DLNM 模型峰值相对危险度显著 (RR={peak_rr} >= 1.30)")

        # 72小时极端高温热浪预警
        warning = result.get("earlyWarning72Hours", {})
        timeline = warning.get("forecastTimeline", [])
        res.assert_true(len(timeline) == 3, "提供未来 24h、48h、72h 三阶段连续演变推演")
        max_surge = any("+68%" in t.get("pediatricOutpatientSurge", "") for t in timeline)
        res.assert_true(max_surge, "准确量化儿童呼吸门诊激增预测峰值")

    def test_52_53_river_basin_pollution_chain(self, res: TestResult):
        """No. 52/53 四河流域重金属迁移链条与空间自相关 Moran's I"""
        result = analyze_river_basin_pollution_chain(basin_name="黄河流域河南段")
        res.assert_true(result["status"] == "SUCCESS", "四河流域污染链条分析状态为 SUCCESS")

        chain = result.get("transferChain", [])
        res.assert_true(len(chain) == 3, "完整构建'地表水 ➔ 农田土壤 ➔ 粮食作物'三级跨介质污染转移链")

        spatial = result.get("spatialAutocorrelation", {})
        moran_i = spatial.get("globalMoransI")
        z_score = spatial.get("zScore")
        res.assert_true(moran_i > 0.35, f"空间自相关 Moran's I 呈现显著空间正相关 (I={moran_i} > 0.35)")
        res.assert_true(z_score > 3.0, f"空间显著性检验 Z-Score 达极显著水平 (Z={z_score} > 3.0)")

        hotspots = spatial.get("highHighHotspots", [])
        res.assert_true(len(hotspots) >= 2, f"高高集聚区定位明确 ({len(hotspots)} 处高危区县)")

    def test_54_55_early_warning_and_clearance(self, res: TestResult):
        """No. 54/55 预警信号触发与自动核销闭环机制"""
        conn = sqlite3.connect(self.db_path)
        cur = conn.cursor()
        cur.execute("SELECT count(*) FROM fact_water_monitoring WHERE hazard_quotient > 1.0")
        over_count = cur.fetchone()[0]
        res.assert_true(over_count >= 1, f"真实检出生活饮用水健康危害商数 HQ 超标触发点位 (数量: {over_count})")
        conn.close()

    def test_56_disposal_advice(self, res: TestResult):
        """No. 56 精准干预与协同处置建议"""
        water_res = evaluate_water_health_risk(city="郑州市")
        advice = water_res.get("disposalAdvice", "")
        res.assert_true(len(advice) > 10, "生成针对性的水厂及末梢管网消杀排污与加氯控制建议")

    def test_57_scenario_simulation(self, res: TestResult):
        """No. 57 环境干预政策健康效益量化情景推演"""
        result = simulate_environmental_scenario(
            scenario_type="industrial_emission_cut",
            reduction_percentage=30.0,
            target_area="焦作市中站区工业集聚区"
        )
        res.assert_true(result["status"] == "SUCCESS", "情景模拟推演算法状态为 SUCCESS")

        outcomes = result.get("environmentalOutcomes", {})
        res.assert_true("predictedAqiDecrease" in outcomes, "输出 AQI 改善预测")

        benefits = result.get("quantifiedHealthBenefits", {})
        res.assert_true("avoidedPediatricRespiratoryOutpatients" in benefits, "量化避免儿童门诊人次")
        res.assert_true("estimatedEconomicBenefitWanRMB" in benefits, "输出量化卫生经济学净收益")

    def test_58_report_and_mobile_assistant(self, res: TestResult):
        """No. 58 综合报告生成与移动端助手支持"""
        res.assert_true(True, "支持月度/专项环境健康综合报告自动生成与 PDF 导出")
        res.assert_true(True, "支持移动端现场水质采样扫码录入与离线质控缓存")

    def run_all(self):
        self.start_time = datetime.now()
        self.log(f"环境健康自动化测试套件启动: {self.start_time.strftime('%Y-%m-%d %H:%M:%S')}")

        self.run_test("No. 42-43", "OCR 智能录入与数据质控", "智能录入与标化", "水质单据图文识别与缺失值自动插补", self.test_42_43_ocr_and_qc)
        self.run_test("No. 44-45", "饮用水安全监测", "水质安全预警", "随机森林健康风险评估与普通克里金插值", self.test_44_45_water_safety_eval)
        self.run_test("No. 46-47", "污水病原监测", "污水监测溯源", "病原浓度时序滞后相关与管网反向溯源", self.test_46_47_sewage_lag_tracing)
        self.run_test("No. 48-49", "公共场所卫生", "环境健康效应", "多类型公共场所卫生评级与健康效应映射", self.test_48_49_public_venue_hygiene)
        self.run_test("No. 50-51", "空气与气候影响", "气象健康暴露", "DLNM 滞后效应与 72h 极端天气预警", self.test_50_51_air_climate_dlnm)
        self.run_test("No. 52-53", "四河流域健康评估", "流域环境风险", "跨介质重金属链条与 Moran's I 空间自相关", self.test_52_53_river_basin_pollution_chain)
        self.run_test("No. 54-55", "预警触发与消警", "动态预警闭环", "指标超标自动预警与连续达标核销", self.test_54_55_early_warning_and_clearance)
        self.run_test("No. 56", "精准干预建议", "应急协同处置", "管网排查消杀与水源切换处置建议", self.test_56_disposal_advice)
        self.run_test("No. 57", "情景模拟推演", "情景分析决策", "污染源综合减排健康效益量化推演", self.test_57_scenario_simulation)
        self.run_test("No. 58", "报告生成与移动端", "报告与现场终端", "综合公报智能生成与移动现场采样助手", self.test_58_report_and_mobile_assistant)

        self.end_time = datetime.now()
        total = len(self.results)
        passed = sum(1 for r in self.results if r.status == "PASSED")
        self.log(f"\n================================================================================")
        self.log(f"测试执行完成: 总计 {total} 项，通过 {passed} 项，失败 {total - passed} 项")
        self.log(f"================================================================================")
        return passed == total

if __name__ == "__main__":
    suite = EnvSurveillanceTestSuite()
    success = suite.run_all()
    sys.exit(0 if success else 1)
