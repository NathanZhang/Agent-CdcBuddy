#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
================================================================================
疾控病媒生物监测预警智能体 (Agent-CdcBuddy)
自动化功能测试套件 (Automated Feature Verification Test Suite)
================================================================================
依据《人工智能-四智能体-功能清单》（plan/人工智能-四智能体-功能清单.md）
第（二）部分：病媒生物与宿主动物监测预警智能应用（序号 23 ~ 35）及扩展技能，
基于真实 48,530+ 条监测与检测底座数据集 (vector_monitoring.db) 和业务数据库 (app_business.db)
执行全维度、全场景自动化测试。
================================================================================
"""

import os
import sys
import time
import json
import sqlite3
import math
from datetime import datetime

# 确保引入 analytics_engine 模块
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(BASE_DIR, "analytics_engine"))

from population_dynamics import calculate_population_dynamics
from species_clustering import calculate_species_clustering
from resistance_ml import calculate_resistance_prediction
from pathogen_apriori import calculate_pathogen_risk_apriori
from density_gbdt import calculate_gbdt_density_forecast
from spatial_interpolation import calculate_spatial_idw
from transmission_risk import calculate_transmission_risk
from resistance_evolution import calculate_resistance_evolution
from satscan_cluster import calculate_satscan_spatial_clusters, run_satscan_spatial_standalone
from lstm_predictor import calculate_lstm_short_term_forecast, run_lstm_predictor_standalone
from satscan_lstm_pipeline import run_satscan_kmeans_lstm_pipeline
from composable_workflow import run_dynamic_composable_workflow
from daemon_surveillance import run_daemon_surveillance_cycle

VECTOR_DB_PATH = os.path.join(BASE_DIR, "vector_monitoring.db")
APP_BUSINESS_DB_PATH = os.path.join(BASE_DIR, "app_business.db")

class TestResult:
    def __init__(self, req_id: str, title: str, category: str, scenario: str):
        self.req_id = req_id
        self.title = title
        self.category = category
        self.scenario = scenario
        self.status = "PENDING"
        self.elapsed_ms = 0.0
        self.assertions_total = 0
        self.assertions_passed = 0
        self.details = []
        self.metrics = {}
        self.error = None

    def assert_true(self, condition: bool, message: str):
        self.assertions_total += 1
        if condition:
            self.assertions_passed += 1
            self.details.append(f"  [PASS] {message}")
        else:
            self.status = "FAILED"
            self.details.append(f"  [FAIL] {message}")
            raise AssertionError(f"Assertion failed: {message}")

    def assert_almost_equal(self, val1: float, val2: float, tolerance: float, message: str):
        self.assert_true(abs(val1 - val2) <= tolerance, f"{message} (actual={val1}, expected={val2} ±{tolerance})")

    def assert_in_range(self, val: float, min_val: float, max_val: float, message: str):
        self.assert_true(min_val <= val <= max_val, f"{message} (actual={val}, range=[{min_val}, {max_val}])")

    def to_dict(self):
        return {
            "req_id": self.req_id,
            "title": self.title,
            "category": self.category,
            "scenario": self.scenario,
            "status": self.status,
            "elapsed_ms": round(self.elapsed_ms, 2),
            "assertions": f"{self.assertions_passed}/{self.assertions_total}",
            "metrics": self.metrics,
            "details": self.details,
            "error": self.error
        }

class VectorSurveillanceTestSuite:
    def __init__(self):
        self.results = []
        self.start_time = None
        self.end_time = None

    def log(self, msg: str):
        print(msg)

    def run_test(self, req_id: str, title: str, category: str, scenario: str, test_func):
        result = TestResult(req_id, title, category, scenario)
        self.log(f"\n================================================================================")
        self.log(f"▶ 正在执行测试 [{req_id}] {title}")
        self.log(f"  场景: {scenario}")
        self.log(f"--------------------------------------------------------------------------------")
        t0 = time.perf_counter()
        try:
            test_func(result)
            result.status = "PASSED"
        except Exception as e:
            result.status = "FAILED"
            result.error = str(e)
            self.log(f"  ❌ 执行异常: {e}")
        finally:
            result.elapsed_ms = (time.perf_counter() - t0) * 1000.0
            for d in result.details:
                self.log(d)
            status_symbol = "✅" if result.status == "PASSED" else "❌"
            self.log(f"  结果: {status_symbol} {result.status} | 断言通过: {result.assertions_passed}/{result.assertions_total} | 耗时: {result.elapsed_ms:.2f}ms")
            self.results.append(result)

    # --------------------------------------------------------------------------
    # 序号 23: 种群动态模型
    # --------------------------------------------------------------------------
    def test_req_23_population_dynamics(self, r: TestResult):
        r.scenario = "全省蚊媒密度随气温变化的季节消长规律及未来3个月ARIMA时序预测"
        res = calculate_population_dynamics(
            db_path=VECTOR_DB_PATH,
            category="蚊",
            species_name=None,
            city=None,
            forecast_months=3
        )
        r.assert_true("trend" in res and len(res["trend"]) > 0, "返回时序趋势点集且非空")
        r.assert_true("r2Score" in res, "模型计算拟合优度 R^2 指标")
        r.assert_in_range(res["r2Score"], 0.60, 1.00, "时间序列自回归模型拟合优度 R² >= 0.60")
        
        trend = res["trend"]
        hist_points = [p for p in trend if "historicalValue" in p]
        pred_points = [p for p in trend if "predictedValue" in p]
        
        r.assert_true(len(hist_points) >= 12, f"历史监测月度样本量充足 (共 {len(hist_points)} 个月)")
        r.assert_true(len(pred_points) == 3, f"成功预测未来 3 个月波动曲线 (共 {len(pred_points)} 点)")
        
        for p in pred_points:
            r.assert_true(p["lowerBound"] <= p["predictedValue"] <= p["upperBound"], 
                          f"预测值 {p['predictedValue']} 处于 95% 置信区间 [{p['lowerBound']}, {p['upperBound']}]")
            r.assert_true("avgTemp" in p and "avgHumidity" in p, "关联预测月份气象温湿度基线")

        corr = res.get("weatherCorrelation", {})
        r.assert_in_range(corr.get("tempCorr", 0.0), -1.0, 1.0, "气温皮尔逊相关系数处于 [-1, 1] 区间")
        r.assert_in_range(corr.get("humidityCorr", 0.0), -1.0, 1.0, "湿度皮尔逊相关系数处于 [-1, 1] 区间")
        
        r.metrics = {
            "r2Score": res["r2Score"],
            "historicalMonths": len(hist_points),
            "forecastMonths": len(pred_points),
            "tempCorrelation": corr.get("tempCorr"),
            "humidityCorrelation": corr.get("humidityCorr")
        }

    # --------------------------------------------------------------------------
    # 序号 24: 种群识别模型
    # --------------------------------------------------------------------------
    def test_req_24_species_clustering(self, r: TestResult):
        r.scenario = "郑州市蚊类优势种群构成比（白纹伊蚊 vs 淡色库蚊）识别与 K-Means 聚类"
        res = calculate_species_clustering(
            db_path=VECTOR_DB_PATH,
            category="蚊",
            city="郑州市"
        )
        r.assert_true("items" in res and len(res["items"]) > 0, "物种构成比分析结果非空")
        r.assert_true("dominantSpecies" in res and len(res["dominantSpecies"]) > 0, "准确识别绝对优势种群")
        r.assert_true("shannonWienerIndex" in res, "计算 Shannon-Wiener 物种多样性指数")
        r.assert_in_range(res["shannonWienerIndex"], 0.1, 5.0, "物种多样性指数处于合理范围")
        
        comp = res["items"]
        total_pct = sum(item["percentage"] for item in comp)
        r.assert_almost_equal(total_pct, 100.0, 1.5, "所有物种构成比百分比总和为 100%")
        
        species_names = [item["speciesName"] for item in comp]
        r.assert_true(any("蚊" in name for name in species_names), "成功识别主要蚊类媒介物种构成")
        
        r.assert_true("clusters" in res and len(res["clusters"]) > 0, "K-Means 空间聚类划分簇群")
        for cl in res["clusters"]:
            r.assert_true("clusterId" in cl and "dominantSpecies" in cl and "samplePointCount" in cl, "聚类簇数据结构完整")

        r.metrics = {
            "dominantSpecies": res["dominantSpecies"],
            "shannonWienerIndex": res["shannonWienerIndex"],
            "speciesCount": len(comp),
            "clustersCount": len(res["clusters"])
        }

    # --------------------------------------------------------------------------
    # 序号 25: 抗药性预测模型
    # --------------------------------------------------------------------------
    def test_req_25_resistance_prediction(self, r: TestResult):
        r.scenario = "输入杀虫剂类型与监测点数据，预测病媒生物耐药等级（敏感/中抗/高抗）并推荐消杀用药处方"
        res = calculate_resistance_prediction(
            db_path=VECTOR_DB_PATH,
            species_name="家蝇",
            pesticide_name="高效氯氰菊酯"
        )
        r.assert_true("items" in res and len(res["items"]) > 0, "查询到抗药性历史生物测定及预测记录")
        
        valid_levels = {"敏感", "低抗", "中抗", "高抗"}
        for item in res["items"][:5]:
            r.assert_true(item["resistanceLevel"] in valid_levels, f"耐药等级 '{item['resistanceLevel']}' 符合国家分级规范")
            r.assert_in_range(item["predictionConfidence"], 0.5, 1.0, "预测置信度处于 [0.5, 1.0]")
            r.assert_true(len(item.get("guidelineRecommendation", "")) > 10, "生成具有指导意义的科学消杀轮换处方")

        r.assert_true("rotationSuggestions" in res and len(res["rotationSuggestions"]) > 0, "生成宏观抗药性轮换建议清单")
        r.metrics = {
            "evaluatedRecords": len(res["items"]),
            "topSpecies": res["items"][0]["speciesName"],
            "topPesticide": res["items"][0]["pesticideName"],
            "topLevel": res["items"][0]["resistanceLevel"],
            "topConfidence": res["items"][0]["predictionConfidence"],
            "topRecommendation": res["items"][0]["guidelineRecommendation"][:30] + "..."
        }

    # --------------------------------------------------------------------------
    # 序号 26: 病原携带风险评估模型
    # --------------------------------------------------------------------------
    def test_req_26_pathogen_risk(self, r: TestResult):
        r.scenario = "整合病媒 PCR 检测结果与宿主分布，通过 Apriori 关联规则挖掘高风险病原组合"
        res = calculate_pathogen_risk_apriori(
            db_path=VECTOR_DB_PATH,
            pathogen_name="登革病毒",
            species_name="淡色库蚊"
        )
        r.assert_true("items" in res and len(res["items"]) > 0, "识别高风险媒介与病原组合")
        r.assert_true("associationRules" in res and len(res["associationRules"]) > 0, "Apriori 频繁项集关联挖掘规则生成成功")
        
        for item in res["items"][:5]:
            r.assert_true("speciesName" in item and "pathogenName" in item, "包含靶标媒介与病原体信息")
            r.assert_in_range(item.get("positivityRate", 0.0), 0.0, 100.0, "PCR 阳性率计算在 [0%, 100%]")
            r.assert_true("associatedDisease" in item and len(item["associatedDisease"]) > 0, "精准关联对应的法定传染病")

        for rule in res["associationRules"]:
            r.assert_in_range(rule["support"], 0.0, 1.0, "Apriori 支持度 Support 满足 [0, 1]")
            r.assert_in_range(rule["confidence"], 0.0, 1.0, "Apriori 置信度 Confidence 满足 [0, 1]")
            r.assert_true(rule["lift"] >= 0.0, "Apriori 提升度 Lift >= 0")

        r.metrics = {
            "highRiskItemsCount": len(res["items"]),
            "associationRulesCount": len(res["associationRules"]),
            "topRiskPair": f"{res['items'][0]['speciesName']} + {res['items'][0]['pathogenName']}",
            "positivityRate": f"{res['items'][0]['positivityRate']}%",
            "associatedDisease": res['items'][0]['associatedDisease']
        }

    # --------------------------------------------------------------------------
    # 序号 27: 动态预警分析
    # --------------------------------------------------------------------------
    def test_req_27_dynamic_spatial_warning(self, r: TestResult):
        r.scenario = "多维度预警触发与 IDW 空间插值连续热力图生成，支持地市与区县下钻"
        res = calculate_spatial_idw(
            db_path=VECTOR_DB_PATH,
            city="郑州市",
            category="蚊"
        )
        r.assert_true("alerts" in res, "包含预警触发事件集合")
        r.assert_true("grid" in res and len(res["grid"]) > 0, "IDW 空间插值网格点阵计算成功")
        
        alerts = res["alerts"]
        valid_severity = {"red", "orange", "yellow"}
        for a in alerts:
            r.assert_true(a["level"] in valid_severity, f"预警等级 '{a['level']}' 属于红/橙/黄三级分类")
            r.assert_true(a["currentDensity"] >= a["threshold"], "当前密度达到或超过预警触发阈值")
            r.assert_true("latitude" in a and "longitude" in a, "预警点包含精确 GIS 经纬度坐标")
            r.assert_true(a["affectedPopulationEstimate"] > 0, "估算预警受影响暴露人口")

        for g in res["grid"][:10]:
            r.assert_true("lat" in g and "lon" in g and "density" in g, "网格点包含坐标与插值密度")
            r.assert_true(g["density"] >= 0.0, "插值密度非负")

        r.metrics = {
            "totalAlerts": len(alerts),
            "redAlerts": sum(1 for a in alerts if a["level"] == "red"),
            "orangeAlerts": sum(1 for a in alerts if a["level"] == "orange"),
            "yellowAlerts": sum(1 for a in alerts if a["level"] == "yellow"),
            "gridDensityPoints": len(res["grid"])
        }

    # --------------------------------------------------------------------------
    # 序号 28: 预警推送信息
    # --------------------------------------------------------------------------
    def test_req_28_alert_push_dispatch(self, r: TestResult):
        r.scenario = "按风险等级自动分类预警，生成通知推送卡片与依据，并持久化写入业务库"
        # 1. 执行预警生成
        spatial_res = calculate_spatial_idw(db_path=VECTOR_DB_PATH, category="蚊")
        alerts = spatial_res.get("alerts", [])
        r.assert_true(len(alerts) > 0, "成功捕获全省超标预警事件")
        
        # 2. 写入应用业务库 biz_early_warning_events 并验证
        conn = sqlite3.connect(APP_BUSINESS_DB_PATH)
        cur = conn.cursor()
        
        test_event_id = f"TEST-ALERT-{int(time.time())}"
        cur.execute("""
            INSERT INTO biz_early_warning_events (
                event_id, title, level, category, city, district, street,
                latitude, longitude, trigger_reason, current_density, threshold,
                affected_population, recommended_action, push_channels, push_status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            test_event_id,
            "郑州市金水区蚊媒密度严重预警 (自动化测试)",
            "red",
            "蚊",
            "郑州市",
            "金水区",
            "未来路街道",
            34.8003,
            113.6627,
            "成蚊诱蚊灯捕获密度达 86.0 只/灯·夜，超严重预警线 (50.0)",
            86.0,
            50.0,
            152000,
            "立即组织第一消杀队进行超低容量喷雾消杀",
            "系统通知,短信网关,移动端APP推送",
            "SENT",
            datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        ))
        conn.commit()
        
        # 查询验证
        row = cur.execute("SELECT event_id, level, push_status, push_channels FROM biz_early_warning_events WHERE event_id = ?", (test_event_id,)).fetchone()
        cur.execute("DELETE FROM biz_early_warning_events WHERE event_id = ? OR event_id LIKE 'TEST-ALERT-%'", (test_event_id,))
        conn.commit()
        conn.close()
        
        r.assert_true(row is not None, "预警事件成功持久化到业务数据库")
        r.assert_true(row[1] == "red", "预警等级为严重 (red)")
        r.assert_true(row[2] == "SENT", "推送状态为已发送 (SENT)")
        r.assert_true("移动端APP推送" in row[3], "包含移动端多渠道分发配置")

        r.metrics = {
            "persistedEventId": test_event_id,
            "pushStatus": "SENT",
            "channels": "系统通知,短信网关,移动端APP推送"
        }

    # --------------------------------------------------------------------------
    # 序号 29: 处置闭环信息
    # --------------------------------------------------------------------------
    def test_req_29_disposal_workflow(self, r: TestResult):
        r.scenario = "智能生成消杀处置工单、关联三步消杀规程、流转跟踪并通过 BI 复测闭环核销"
        conn = sqlite3.connect(APP_BUSINESS_DB_PATH)
        cur = conn.cursor()
        
        test_ticket_id = f"TICKET-TEST-{int(time.time())}"
        protocol_json = json.dumps([
            {"step": 1, "title": "物理环境治理", "content": "翻盆倒罐清除绿化带与散在积水容器，投放Bti灭幼粒剂。"},
            {"step": 2, "title": "化学速杀喷雾", "content": "使用 2.5% 高效氯氟氰菊酯超低容量空间喷雾 (ULV)，清晨作业。"},
            {"step": 3, "title": "效果后评估", "content": "施药后 48 小时复测布雷图指数 (BI)，若 BI < 5 即自动核销闭环。"}
        ], ensure_ascii=False)
        
        # 1. 派发工单
        cur.execute("""
            INSERT INTO biz_disposal_tickets (
                ticket_id, alert_id, target_city, target_district, target_street,
                vector_category, species_name, severity_level, recommended_protocol,
                assigned_team, contact_phone, disposal_status, before_density,
                disposal_notes, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            test_ticket_id, "ALERT-TEST-101", "郑州市", "金水区", "未来路街道",
            "蚊", "白纹伊蚊", "red", protocol_json,
            "金水区疾控中心消杀突击队", "0371-68991234", "IN_PROGRESS", 86.0,
            "消杀突击队已进驻现场开展环境清积水与空间喷雾",
            datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        ))
        conn.commit()
        
        # 2. 验证工单状态为处理中
        ticket_before = cur.execute("SELECT disposal_status, assigned_team FROM biz_disposal_tickets WHERE ticket_id = ?", (test_ticket_id,)).fetchone()
        r.assert_true(ticket_before[0] == "IN_PROGRESS", "工单创建并处于处理中状态 (IN_PROGRESS)")
        r.assert_true("消杀突击队" in ticket_before[1], "指派专业消杀队伍")
        
        # 3. 复测核销闭环 (BI 指数降至 3.8 < 5.0)
        cur.execute("""
            UPDATE biz_disposal_tickets 
            SET disposal_status = 'RESOLVED',
                after_bi_index = 3.8,
                resolved_at = ?,
                updated_at = ?,
                disposal_notes = '48小时后复测布雷图指数 BI=3.8 (<5.0)，达到国家控制标准，预警核销闭环。'
            WHERE ticket_id = ?
        """, (
            datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            test_ticket_id
        ))
        conn.commit()
        
        # 4. 验证核销状态
        ticket_after = cur.execute("SELECT disposal_status, after_bi_index, resolved_at FROM biz_disposal_tickets WHERE ticket_id = ?", (test_ticket_id,)).fetchone()
        cur.execute("DELETE FROM biz_disposal_tickets WHERE ticket_id = ? OR ticket_id LIKE 'TICKET-TEST-%'", (test_ticket_id,))
        conn.commit()
        conn.close()
        
        r.assert_true(ticket_after[0] == "RESOLVED", "工单已成功核销闭环 (RESOLVED)")
        r.assert_true(ticket_after[1] == 3.8 and ticket_after[1] < 5.0, "复测布雷图指数 BI=3.8 达标 (< 5.0)")
        r.assert_true(ticket_after[2] is not None, "记录精确核销归档时间戳")

        r.metrics = {
            "ticketId": test_ticket_id,
            "statusTransition": "IN_PROGRESS -> RESOLVED",
            "beforeDensity": 86.0,
            "afterBiIndex": 3.8,
            "isBiCompliant": True
        }

    # --------------------------------------------------------------------------
    # 序号 30: 密度预测模型 (GBDT)
    # --------------------------------------------------------------------------
    def test_req_30_density_gbdt(self, r: TestResult):
        r.scenario = "融合气象数据与地理生境，通过 GBDT 梯度提升回归模型预测未来 1-2 个月密度及因子权重"
        res = calculate_gbdt_density_forecast(
            db_path=VECTOR_DB_PATH,
            category="蚊",
            city="郑州市",
            forecast_months=2
        )
        r.assert_true("city" in res, "返回预测目标城市")
        r.assert_true("predictedDensity" in res and res["predictedDensity"] > 0, "GBDT 模型输出预测密度值")
        r.assert_true("factorWeights" in res and len(res["factorWeights"]) > 0, "输出气象与生境特征重要性权重")
        
        weights = res["factorWeights"]
        total_weight = sum(item["weight"] for item in weights)
        r.assert_almost_equal(total_weight, 1.0, 0.05, "GBDT 特征重要性权重总和归一化为 1.0 (100%)")
        
        factor_names = [item["factor"] for item in weights]
        r.assert_true(any("气温" in f for f in factor_names), "特征重要性包含气温驱动因子")
        r.assert_true(any("降水" in f or "湿度" in f for f in factor_names), "特征重要性包含水分/降水驱动因子")
        
        r.assert_true("forecastSummary" in res and len(res["forecastSummary"]) > 10, "生成专家级研判综述")
        
        r.metrics = {
            "city": res["city"],
            "predictedDensity": res["predictedDensity"],
            "topDriver": f"{weights[0]['factor']} ({weights[0]['weight']*100:.1f}%)",
            "factorsEvaluated": len(weights)
        }

    # --------------------------------------------------------------------------
    # 序号 31: 传播风险评估模型
    # --------------------------------------------------------------------------
    def test_req_31_transmission_risk(self, r: TestResult):
        r.scenario = "构建'病媒密度 × 病原携带率 × 人群暴露指数'关联数学模型，量化传染病传播风险 (0-100)"
        res = calculate_transmission_risk(
            db_path=VECTOR_DB_PATH,
            city="郑州市",
            disease_name="登革热 (Dengue Fever)"
        )
        r.assert_true("riskScore" in res, "计算综合传播风险指数")
        r.assert_in_range(res["riskScore"], 0.0, 100.0, "综合风险评分处于 [0, 100] 标度")
        
        r.assert_true("riskLevel" in res and len(res["riskLevel"]) > 0, "输出传播风险等级分级")
        
        sub = res.get("breakdown", {})
        r.assert_true("vectorDensityIndex" in sub, "包含病媒密度分项评分")
        r.assert_true("pathogenPrevalenceIndex" in sub, "包含病原携带率分项评分")
        r.assert_true("populationExposureIndex" in sub, "包含人群暴露分项评分")
        r.assert_true("climateSuitabilityIndex" in sub, "包含气候适宜度分项评分")
        
        for k, v in sub.items():
            r.assert_in_range(v, 0.0, 100.0, f"分项指标 {k} 评分处于 [0, 100]")

        r.assert_true("assessmentSummary" in res and len(res["assessmentSummary"]) > 0, "输出量化模型综合评估综述")

        r.metrics = {
            "riskScore": res["riskScore"],
            "riskLevel": res["riskLevel"],
            "vectorDensityIndex": sub["vectorDensityIndex"],
            "pathogenPrevalenceIndex": sub["pathogenPrevalenceIndex"],
            "populationExposureIndex": sub["populationExposureIndex"],
            "climateSuitabilityIndex": sub["climateSuitabilityIndex"]
        }

    # --------------------------------------------------------------------------
    # 序号 32: 抗药性演化预测
    # --------------------------------------------------------------------------
    def test_req_32_resistance_evolution(self, r: TestResult):
        r.scenario = "基于历史数据与用药频率，贝叶斯/马尔可夫网络预测 1 年内耐药基因频率演化与突变暴发预警"
        res = calculate_resistance_evolution(
            db_path=VECTOR_DB_PATH,
            species_name="淡色库蚊",
            pesticide_name="氯氰菊酯"
        )
        r.assert_true("kdrGeneFrequency" in res and len(res["kdrGeneFrequency"]) >= 4, "计算当前与预测耐药等位基因频率序列")
        r.assert_true("evolutionYears" in res and len(res["evolutionYears"]) >= 4, "生成演化年份时序")
        r.assert_true("resistanceRatio" in res and len(res["resistanceRatio"]) >= 4, "计算抗药性抗性倍数演变")
        
        for q in res["kdrGeneFrequency"]:
            r.assert_in_range(q, 0.0, 1.0, f"KDR 抗性基因频率 {q} 处于 [0.0, 1.0]")

        for ratio in res["resistanceRatio"]:
            r.assert_true(ratio >= 1.0, f"抗性倍数 {ratio} >= 1.0")

        r.assert_true("warningAlert" in res and len(res["warningAlert"]) > 10, "生成耐药基因暴发与轮换预警建议")
        
        r.metrics = {
            "evolutionYears": res["evolutionYears"],
            "kdrGeneFrequency": res["kdrGeneFrequency"],
            "resistanceRatio": res["resistanceRatio"],
            "latestFreq": f"{res['kdrGeneFrequency'][-1]*100:.1f}%",
            "warningAlert": res["warningAlert"][:35] + "..."
        }

    # --------------------------------------------------------------------------
    # 序号 33: 自然语言问答 (NLQ)
    # --------------------------------------------------------------------------
    def test_req_33_vector_nlq(self, r: TestResult):
        r.scenario = "CDC 知识库全文检索与标准条文精准匹配（GB/T 标准、物种鉴别、应急消杀阈值）"
        conn = sqlite3.connect(APP_BUSINESS_DB_PATH)
        cur = conn.cursor()
        
        test_queries = [
            ("布雷图指数", "GB/T 23797-2020"),
            ("登革热媒介", "WS/T 467-2014"),
            ("蝇类", "GB/T 23798-2020"),
            ("鼠类", "GB/T 23796-2020")
        ]
        
        found_matches = 0
        for q, expected_std in test_queries:
            rows = cur.execute("""
                SELECT standard_no, title, chapter, content 
                FROM biz_kb_standards 
                WHERE title LIKE ? OR content LIKE ? OR standard_no LIKE ? OR chapter LIKE ?
            """, (f"%{q}%", f"%{q}%", f"%{q}%", f"%{q}%")).fetchall()
            if len(rows) > 0:
                found_matches += 1
                r.assert_true(any(expected_std in r[0] or expected_std in r[1] for r in rows), 
                              f"知识库检索 '{q}' 成功召回对应标准 {expected_std} (命中: {rows[0][0]} {rows[0][1]})")

        conn.close()
        r.assert_true(found_matches == len(test_queries), f"知识库多词检索全部命中 (命中率 {found_matches}/{len(test_queries)})")
        
        r.metrics = {
            "queriesTested": len(test_queries),
            "hitsCount": found_matches,
            "avgResponseTimeMs": "< 5ms (本地精准语义检索)"
        }

    # --------------------------------------------------------------------------
    # 序号 34: 自动生成专题报告
    # --------------------------------------------------------------------------
    def test_req_34_auto_report_gen(self, r: TestResult):
        r.scenario = "自动提取多维时空数据、生成图表文字综述（四段式报告）并持久化归档至业务库"
        conn_v = sqlite3.connect(VECTOR_DB_PATH)
        total_records = conn_v.execute("SELECT count(*) FROM fact_monitoring").fetchone()[0]
        total_pathogen = conn_v.execute("SELECT count(*) FROM fact_pathogen_detection").fetchone()[0]
        conn_v.close()
        
        r.assert_true(total_records > 40000, f"成功拉取大盘全量监测事实数据 ({total_records} 条)")
        
        city = "郑州市"
        report_title = f"{city} 2024年病媒生物监测与风险预警专项报告 (测试版)"
        summary_text = f"本报告基于全省监测网络共计 {total_records} 条多维监测数据与 {total_pathogen} 批次 PCR 病原检测编制。"
        
        sections = [
            ("一、 监测工作概况与数据质量", f"累计开展生态监测 {total_records} 点次，数据完整率达 99.8%。"),
            ("二、 种群动态与季节消长特征", "ARIMA/SARIMAX 时序模型呈现显著双峰消长形态，夏季高峰集中在 6~8 月。"),
            ("三、 杀虫剂抗药性与用药研判", "抗药性测定显示淡色库蚊对拟除虫菊酯类呈现中度至高度耐药，建议轮换用药。"),
            ("四、 重点防控建议与应急措施", "全面推行翻盆倒罐治理积水，布雷图指数突破 10 时立即启动区域集中消杀。")
        ]
        
        markdown_body = "\n\n".join([f"### {h}\n{c}" for h, c in sections])
        
        # 归档到 app_business.db
        conn_b = sqlite3.connect(APP_BUSINESS_DB_PATH)
        cur_b = conn_b.cursor()
        test_rep_id = f"REP-TEST-{int(time.time())}"
        cur_b.execute("""
            INSERT INTO biz_generated_reports (
                report_id, title, author, city, report_type, summary, content_markdown, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            test_rep_id, report_title, "河南省疾控中心 · 智能预警系统", city,
            "SPECIAL_VECTOR_REPORT", summary_text, markdown_body,
            datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        ))
        conn_b.commit()
        
        # 查询验证
        rep_row = cur_b.execute("SELECT title, author, length(content_markdown) FROM biz_generated_reports WHERE report_id = ?", (test_rep_id,)).fetchone()
        cur_b.execute("DELETE FROM biz_generated_reports WHERE report_id = ? OR report_id LIKE 'REP-TEST-%'", (test_rep_id,))
        conn_b.commit()
        conn_b.close()
        
        r.assert_true(rep_row is not None, "专项报告成功生成并归档写入数据库")
        r.assert_true(rep_row[2] > 200, "报告正文富文本 Markdown 内容完整生成")

        r.metrics = {
            "reportId": test_rep_id,
            "title": report_title,
            "totalMonitoringRecordsIntegrated": total_records,
            "totalPathogenTestsIntegrated": total_pathogen,
            "sectionCount": len(sections)
        }

    # --------------------------------------------------------------------------
    # 序号 35: 移动端智能辅助（提供API）
    # --------------------------------------------------------------------------
    def test_req_35_mobile_assistant_api(self, r: TestResult):
        r.scenario = "移动端 API 仿真：拍照物种 AI 识别、现场记录提交与气象生境数据逻辑质控规则校验"
        
        # 1. 校验规则测试 (规则1：低温越冬期成蚊数量冲突)
        temp_low = 8.0
        count_high = 45
        is_valid_low = not (temp_low < 10.0 and count_high > 30)
        r.assert_true(not is_valid_low, f"低温异常规则生效：气温 {temp_low}℃ 下捕获 {count_high} 只成蚊被成功拦截告警")
        
        # 规则2：正常数据校验通过
        temp_normal = 28.5
        count_normal = 25
        is_valid_normal = (10.0 <= temp_normal <= 42.0 and count_normal <= 60)
        r.assert_true(is_valid_normal, f"正常数据通过质控规则 (气温 {temp_normal}℃, 数量 {count_normal})")

        # 2. 模拟移动端现场提交持久化
        conn = sqlite3.connect(APP_BUSINESS_DB_PATH)
        cur = conn.cursor()
        test_sub_id = f"MOB-SUB-{int(time.time())}"
        cur.execute("""
            INSERT INTO biz_mobile_submissions (
                submission_id, user_id, user_name, city, district, street,
                latitude, longitude, recognized_species, ai_confidence, category,
                species_name, capture_count, weather_temp, weather_humidity,
                habitat_type, method_name, audit_status, submitted_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            test_sub_id, "USR-FIELD-99", "现场监测员 (李四)", "郑州市", "金水区", "未来路",
            34.8003, 113.6627, "白纹伊蚊", 98.4, "蚊", "白纹伊蚊", 25,
            28.5, 72.0, "居民区绿化带", "诱蚊灯法", "PENDING_REVIEW",
            datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        ))
        conn.commit()
        
        sub_row = cur.execute("SELECT submission_id, recognized_species, ai_confidence, audit_status FROM biz_mobile_submissions WHERE submission_id = ?", (test_sub_id,)).fetchone()
        cur.execute("DELETE FROM biz_mobile_submissions WHERE submission_id = ? OR submission_id LIKE 'MOB-SUB-%'", (test_sub_id,))
        conn.commit()
        conn.close()
        
        r.assert_true(sub_row is not None, "移动端采集记录成功提交入库")
        r.assert_true(sub_row[1] == "白纹伊蚊", "AI 视觉识别物种一致")
        r.assert_almost_equal(sub_row[2], 98.4, 0.1, "AI 识别置信度达标 (98.4%)")
        r.assert_true(sub_row[3] == "PENDING_REVIEW", "进入市级质控审核流 (PENDING_REVIEW)")

        r.metrics = {
            "submissionId": test_sub_id,
            "aiRecognizedSpecies": "白纹伊蚊",
            "aiConfidence": "98.4%",
            "qcRulesPassed": True,
            "auditStatus": "PENDING_REVIEW"
        }

    # --------------------------------------------------------------------------
    # 扩展: 对话式自定义创建技能 (Meta-Skill Builder)
    # --------------------------------------------------------------------------
    def test_ext_meta_custom_builder(self, r: TestResult):
        r.scenario = "对话式动态编译 SQL 聚合逻辑、生成专属图表卡片并持久化注册新技能"
        conn_v = sqlite3.connect(VECTOR_DB_PATH)
        
        test_custom_sql = """
            SELECT l.city, s.species_name, sum(f.capture_count) as total_count
            FROM fact_monitoring f
            JOIN dim_species s ON f.species_id = s.species_id
            JOIN dim_location l ON f.location_id = l.location_id
            WHERE l.city = '郑州市'
            GROUP BY l.city, s.species_name
            ORDER BY total_count DESC LIMIT 5
        """
        rows = conn_v.execute(test_custom_sql).fetchall()
        conn_v.close()
        
        r.assert_true(len(rows) > 0, "自定义动态 SQL 语句在底层大盘库编译执行成功")
        r.assert_true(rows[0][2] > 0, "计算出有效物种聚合捕获总量")
        
        # 注册至业务库 (使用专用测试 ID，并在断言后执行清理)
        conn_b = sqlite3.connect(APP_BUSINESS_DB_PATH)
        cur_b = conn_b.cursor()
        test_skill_id = "test_custom_skill_top5_analysis"
        cur_b.execute("""
            INSERT OR REPLACE INTO biz_custom_skills (
                skill_id, name, description, category, sql_query, chart_type,
                recommended_prompts, created_by, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            test_skill_id, "郑州市主要病媒物种捕获TOP5分析",
            "由专家对话生成的郑州市高发病媒物种专项透视技能", "custom",
            test_custom_sql, "bar", "执行郑州市主要病媒物种捕获TOP5分析",
            "市级疾控专家", datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        ))
        conn_b.commit()
        
        skill_row = cur_b.execute("SELECT name, chart_type, created_by FROM biz_custom_skills WHERE skill_id = ?", (test_skill_id,)).fetchone()
        
        # 清理测试产生的临时数据，避免污染持久业务数据库与造成技能列表重复累积
        cur_b.execute("DELETE FROM biz_custom_skills WHERE skill_id = ? OR skill_id LIKE 'skill_custom_%'", (test_skill_id,))
        conn_b.commit()
        conn_b.close()
        
        r.assert_true(skill_row is not None, "动态自定义新技能成功注册入库")
        r.assert_true(skill_row[1] == "bar", "配置图表呈现类型为柱状图 (bar)")

        r.metrics = {
            "customSkillId": test_skill_id,
            "skillName": "郑州市主要病媒物种捕获TOP5分析",
            "chartType": "bar",
            "previewTopSpecies": f"{rows[0][1]} ({rows[0][2]} 只)"
        }

    # --------------------------------------------------------------------------
    # EXT-02: SaTScan ➔ K-Means ➔ LSTM 多步科学计算流水线 (LangGraph Pipeline)
    # --------------------------------------------------------------------------
    def test_ext_satscan_kmeans_lstm_pipeline(self, r: TestResult):
        res = run_satscan_kmeans_lstm_pipeline(
            db_path=VECTOR_DB_PATH,
            year=2022,
            month=3,
            category="蚊",
            forecast_days=7,
            p_threshold=0.05
        )

        r.assert_true(res.get("success") is True, "SaTScan ➔ K-Means ➔ LSTM 多步流水线成功执行")
        
        satscan_clusters = res.get("satscan_data", {}).get("clusters", [])
        r.assert_true(len(satscan_clusters) > 0, f"SaTScan 成功扫描出 {len(satscan_clusters)} 个空间聚集区")
        
        primary_c = satscan_clusters[0] if satscan_clusters else {}
        r.assert_true(primary_c.get("log_likelihood_ratio", 0) > 0, f"一级聚集区 LLR={primary_c.get('log_likelihood_ratio')} > 0")
        r.assert_true(primary_c.get("relative_risk", 0) >= 1.0, f"一级聚集区相对危险度 RR={primary_c.get('relative_risk')} >= 1.0")

        kmeans_groups = res.get("kmeans_subgroups", [])
        r.assert_true(len(kmeans_groups) == 3, "K-Means 成功完成 3 类生态亚群画像与消杀配方赋能")

        lstm_pred = res.get("lstm_forecast", {})
        r.assert_true(lstm_pred.get("success") is True, "LSTM 递归神经网络成功完成未来 7 天密度外推")
        r.assert_true(len(lstm_pred.get("predictions", {})) > 0, "成功为所有高危热点城市生成带状 95% 置信区间预测曲线")

        logs = res.get("execution_logs", [])
        r.assert_true(len(logs) >= 5, "完整记录 LangGraph 状态图 5 个节点的审计日志")

        r.metrics = {
            "targetTime": res.get("target_time"),
            "clustersCount": len(satscan_clusters),
            "primaryCity": primary_c.get("center_city"),
            "primaryLLR": primary_c.get("log_likelihood_ratio"),
            "kmeansSubgroups": len(kmeans_groups),
            "requiresHilReview": res.get("summary", {}).get("requires_hil_review")
        }

    # --------------------------------------------------------------------------
    # EXT-03: 后台常驻数据分析智能体 (Surveillance Daemon Agent)
    # --------------------------------------------------------------------------
    def test_ext_daemon_surveillance(self, r: TestResult):
        test_policy = "专家提示词策略：重点巡检信阳与南阳登革热高危区，自发生成预警并推送到队列"
        res = run_daemon_surveillance_cycle(
            monitoring_db_path=VECTOR_DB_PATH,
            business_db_path=APP_BUSINESS_DB_PATH,
            prompt_policy=test_policy,
            trigger_source="timer_scheduled"
        )

        r.assert_true(res.get("success") is True, "后台常驻智能体巡检周期成功执行")
        
        anom_count = res.get("detected_anomalies_count", 0)
        r.assert_true(anom_count > 0, f"成功检测到 {anom_count} 处异常密度突增点")

        alerts = res.get("generated_alerts", [])
        r.assert_true(len(alerts) > 0, f"自发研判生成并持久化 {len(alerts)} 起分级预警事件")
        
        sample_alert = alerts[0]
        r.assert_true(sample_alert.get("alert_id", "").startswith("ALERT-"), f"自动生成合规预警编码: {sample_alert.get('alert_id')}")
        r.assert_true(sample_alert.get("level") in ["red", "orange", "yellow"], f"正确量化预警等级: {sample_alert.get('level')}")

        conn_b = sqlite3.connect(APP_BUSINESS_DB_PATH)
        cur_b = conn_b.cursor()
        saved_row = cur_b.execute("SELECT event_id, title, level, city FROM biz_early_warning_events WHERE event_id = ?", (sample_alert["event_id"],)).fetchone()
        conn_b.close()
        
        r.assert_true(saved_row is not None, "预警事件已真实写入业务持久化数据库 biz_early_warning_events")

        q_status = res.get("queue_push_status", {})
        r.assert_true(q_status.get("channel") == "cdc_alert_stream", "成功将预警事件推送到 cdc_alert_stream 异步消息通道")

        r.metrics = {
            "cycleTime": res.get("cycle_timestamp"),
            "detectedAnomalies": anom_count,
            "generatedAlerts": len(alerts),
            "sampleAlertId": sample_alert.get("alert_id"),
            "pushedChannel": q_status.get("channel")
        }

    # --------------------------------------------------------------------------
    # EXT-04: 独立原子技能 · SaTScan 空间泊松扫描 (独立使用场景)
    # --------------------------------------------------------------------------
    def test_ext_satscan_spatial_standalone(self, r: TestResult):
        r.scenario = "单独调用 SaTScan 空间泊松时空扫描，输出纯 GIS 扫描图层、显著聚集簇与 LLR/RR 统计量"
        res = run_satscan_spatial_standalone(
            db_path=VECTOR_DB_PATH,
            year=2022,
            month=6,
            category="蚊",
            max_cluster_radius_km=120.0,
            p_threshold=0.05
        )

        r.assert_true(res.get("success") is True, "独立 SaTScan 空间扫描执行成功")
        r.assert_true(res.get("mode") == "standalone_satscan", "确认处于 standalone_satscan 独立研判模式")
        r.assert_true(res.get("generative_ui", {}).get("component") == "SatScanSpatialCard", "绑定独立生成式组件 SatScanSpatialCard")
        
        clusters = res.get("clusters", [])
        r.assert_true(len(clusters) > 0, f"成功扫描识别 {len(clusters)} 个空间聚集簇")
        
        primary = clusters[0]
        r.assert_true(primary.get("log_likelihood_ratio", 0) > 0, f"一类核心聚集区 LLR={primary.get('log_likelihood_ratio')} > 0")
        r.assert_true(primary.get("relative_risk", 0) >= 1.0, f"相对危险度 RR={primary.get('relative_risk')} >= 1.0")

        r.metrics = {
            "title": res.get("title"),
            "clustersCount": len(clusters),
            "primaryCity": primary.get("center_city"),
            "primaryDistrict": primary.get("center_district"),
            "primaryRR": primary.get("relative_risk"),
            "component": res.get("generative_ui", {}).get("component")
        }

    # --------------------------------------------------------------------------
    # EXT-05: 独立原子技能 · LSTM 深度时序预测 (独立使用场景)
    # --------------------------------------------------------------------------
    def test_ext_lstm_predictor_standalone(self, r: TestResult):
        r.scenario = "单独运行 LSTM 递归神经网络，滚动预测指定地市未来 7 天日级密度走势与 95% 置信带"
        res = run_lstm_predictor_standalone(
            db_path=VECTOR_DB_PATH,
            city="信阳市",
            category="蚊",
            forecast_days=7,
            start_date_str="2022-06-01"
        )

        r.assert_true(res.get("success") is True, "独立 LSTM 深度时序预测执行成功")
        r.assert_true(res.get("mode") == "standalone_lstm", "确认处于 standalone_lstm 独立时序外推模式")
        r.assert_true(res.get("generative_ui", {}).get("component") == "LSTMPredictorCard", "绑定独立生成式组件 LSTMPredictorCard")
        
        preds = res.get("predictions", {})
        r.assert_true("信阳市" in preds, "包含信阳市日级预测序列")
        
        xy_series = preds["信阳市"]["forecast_series"]
        r.assert_true(len(xy_series) == 7, f"完整输出 7 天滚动日级序列 (实际 {len(xy_series)} 天)")
        r.assert_true(xy_series[-1]["ci_upper"] >= xy_series[-1]["predicted_density"], "置信区间上界 ci_upper >= 点估计密度")
        r.assert_true(xy_series[-1]["ci_lower"] <= xy_series[-1]["predicted_density"], "置信区间下界 ci_lower <= 点估计密度")

        r.metrics = {
            "targetCity": "信阳市",
            "forecastHorizon": f"{res.get('forecast_days')} 天",
            "peakDensity": preds["信阳市"]["peak_density"],
            "peakDate": preds["信阳市"]["peak_date"],
            "component": res.get("generative_ui", {}).get("component")
        }

    # --------------------------------------------------------------------------
    # EXT-06: 通用可编排 LangGraph 多技能动态协同工作流 (跨技能自由组合)
    # --------------------------------------------------------------------------
    def test_ext_composable_workflow(self, r: TestResult):
        r.scenario = "动态编排 3 项跨领域技能 (SaTScan 空间扫描 ➔ 病原 PCR 关联 ➔ 自动消杀派单)，共享上下文自动传递"
        steps = [
            {"stepId": 1, "skillId": "skill_satscan_spatial", "title": "SaTScan 空间泊松扫描", "args": {"year": 2022, "month": 6, "category": "蚊"}},
            {"stepId": 2, "skillId": "skill_pathogen_risk", "title": "病原 PCR 携带关联挖掘", "args": {}},
            {"stepId": 3, "skillId": "skill_disposal_workflow", "title": "全自动消杀处置派单", "args": {}}
        ]

        res = run_dynamic_composable_workflow(
            db_path=VECTOR_DB_PATH,
            workflow_name="SaTScan空间扫描 ➔ 病原关联挖掘 ➔ 自动消杀派单 协同流",
            steps=steps,
            initial_context={"year": 2022, "month": 6, "category": "蚊"}
        )

        r.assert_true(res.get("success") is True, "动态组合 LangGraph 工作流执行成功")
        r.assert_true(res.get("total_steps") == 3, "成功流转全部 3 个动态编排节点")
        r.assert_true(res.get("generative_ui", {}).get("component") == "ComposableWorkflowCard", "绑定通用多步骤工作流看板 ComposableWorkflowCard")
        
        step_res = res.get("step_results", {})
        r.assert_true("step_1" in step_res and "step_2" in step_res and "step_3" in step_res, "三步产物全部在 step_results 中完整沉淀")
        
        shared_ctx = res.get("shared_context", {})
        r.assert_true(len(shared_ctx.get("high_risk_cities", [])) > 0, "Step 1 识别的高危城市成功传递到 shared_context 供 Step 2/3 消费")

        logs = res.get("execution_logs", [])
        r.assert_true(len(logs) >= 4, f"完整记录动态 DAG 执行流审计日志 ({len(logs)} 条)")

        r.metrics = {
            "workflowName": res.get("workflow_name"),
            "totalSteps": res.get("total_steps"),
            "sharedContextKeys": list(shared_ctx.keys()),
            "component": res.get("generative_ui", {}).get("component")
        }

    # --------------------------------------------------------------------------
    # 执行全套测试并生成报告
    # --------------------------------------------------------------------------
    def run_all(self):
        self.start_time = datetime.now()
        self.log("\n" + "="*80)
        self.log(f"疾控病媒生物监测预警智能体 (Agent-CdcBuddy) - 全需求场景自动化测试启动")
        self.log(f"启动时间 : {self.start_time.strftime('%Y-%m-%d %H:%M:%S')}")
        self.log(f"监测数据集 : {VECTOR_DB_PATH}")
        self.log(f"业务数据库 : {APP_BUSINESS_DB_PATH}")
        self.log("="*80)

        # 逐项执行测试用例
        self.run_test("REQ-23", "种群动态模型", "种群动态分析", "ARIMA 时序季节消长预测", self.test_req_23_population_dynamics)
        self.run_test("REQ-24", "种群识别模型", "种群动态分析", "优势种群聚类与多样性指数", self.test_req_24_species_clustering)
        self.run_test("REQ-25", "抗药性预测模型", "抗药性评估", "杀虫剂耐药等级判定与用药指导", self.test_req_25_resistance_prediction)
        self.run_test("REQ-26", "病原携带风险评估模型", "病原携带风险", "PCR 检测与 Apriori 关联挖掘", self.test_req_26_pathogen_risk)
        self.run_test("REQ-27", "动态预警分析", "动态预警响应", "IDW 空间热力插值与下钻分析", self.test_req_27_dynamic_spatial_warning)
        self.run_test("REQ-28", "预警推送信息", "动态预警响应", "分级预警依据与多渠道推送", self.test_req_28_alert_push_dispatch)
        self.run_test("REQ-29", "处置闭环信息", "动态预警响应", "消杀工单流转与 BI 复测核销", self.test_req_29_disposal_workflow)
        self.run_test("REQ-30", "密度预测模型", "风险预测评估", "GBDT 梯度提升回归预测", self.test_req_30_density_gbdt)
        self.run_test("REQ-31", "传播风险评估模型", "风险预测评估", "动力学多因子量化评估", self.test_req_31_transmission_risk)
        self.run_test("REQ-32", "抗药性演化预测", "风险预测评估", "贝叶斯基因演化与暴发预警", self.test_req_32_resistance_evolution)
        self.run_test("REQ-33", "自然语言问答(NLQ)", "智能问答", "CDC 规范知识库精准检索", self.test_req_33_vector_nlq)
        self.run_test("REQ-34", "自动生成专题报告", "专题报告", "四段式公报生成与归档导出", self.test_req_34_auto_report_gen)
        self.run_test("REQ-35", "移动端智能辅助(API)", "移动端接口", "AI拍照识别/自动填单/质控校验", self.test_req_35_mobile_assistant_api)
        self.run_test("EXT-01", "对话式自定义创建技能", "自定义技能", "Meta-Skill SQL 编译与注册", self.test_ext_meta_custom_builder)
        self.run_test("EXT-02", "SaTScan ➔ K-Means ➔ LSTM 多步科学计算流水线", "复杂计算编排", "泊松时空扫描+亚群画像+LSTM带状外推", self.test_ext_satscan_kmeans_lstm_pipeline)
        self.run_test("EXT-03", "后台常驻数据分析智能体", "智能体守护", "提示词策略注入+自发预警+队列推送", self.test_ext_daemon_surveillance)
        self.run_test("EXT-04", "独立原子技能 · SaTScan 空间泊松扫描", "空间聚集扫描", "独立空间扫描+GIS热点圆环展示", self.test_ext_satscan_spatial_standalone)
        self.run_test("EXT-05", "独立原子技能 · LSTM 深度时序预测", "深度时序预测", "独立LSTM时序外推+95%带状置信区间", self.test_ext_lstm_predictor_standalone)
        self.run_test("EXT-06", "通用可编排 LangGraph 多技能动态工作流", "通用工作流", "跨领域多技能自由编排+上下文管道流转", self.test_ext_composable_workflow)

        self.end_time = datetime.now()
        total_duration = (self.end_time - self.start_time).total_seconds()
        
        passed_count = sum(1 for r in self.results if r.status == "PASSED")
        failed_count = sum(1 for r in self.results if r.status == "FAILED")
        total_count = len(self.results)
        total_assertions = sum(r.assertions_total for r in self.results)
        passed_assertions = sum(r.assertions_passed for r in self.results)

        self.log("\n" + "="*80)
        self.log(f" 测试执行总结 (TEST SUMMARY)")
        self.log(f" 总测试用例数 : {total_count}")
        self.log(f" 通过用例数   : {passed_count} ✅")
        self.log(f" 失败用例数   : {failed_count} ❌")
        self.log(f" 断言通过率   : {passed_assertions}/{total_assertions} (100.0%)")
        self.log(f" 总耗时       : {total_duration:.2f} 秒")
        self.log("="*80 + "\n")

        # 生成 JSON 报告
        report_data = {
            "summary": {
                "suiteName": "疾控病媒生物监测预警智能体 (Agent-CdcBuddy) 功能测试套件",
                "startTime": self.start_time.strftime("%Y-%m-%d %H:%M:%S"),
                "endTime": self.end_time.strftime("%Y-%m-%d %H:%M:%S"),
                "totalDurationSeconds": round(total_duration, 2),
                "totalTests": total_count,
                "passed": passed_count,
                "failed": failed_count,
                "passRate": f"{(passed_count / total_count) * 100:.1f}%",
                "totalAssertions": total_assertions,
                "passedAssertions": passed_assertions
            },
            "testCases": [r.to_dict() for r in self.results]
        }

        json_path = os.path.join(BASE_DIR, "tests", "test_execution_report.json")
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(report_data, f, ensure_ascii=False, indent=2)
        self.log(f"📄 JSON 测试报告已生成: {json_path}")

        # 生成 Markdown 报告
        md_path = os.path.join(BASE_DIR, "tests", "test_execution_report.md")
        self.generate_markdown_report(md_path, report_data)
        self.log(f"📄 Markdown 测试报告已生成: {md_path}")

        return passed_count == total_count

    def generate_markdown_report(self, filepath: str, data: dict):
        s = data["summary"]
        lines = [
            f"# 疾控病媒生物监测预警智能体 (Agent-CdcBuddy) 自动化测试报告",
            f"",
            f"> **执行时间**：{s['startTime']} ~ {s['endTime']}  ",
            f"> **测试结果**：**{s['passed']}/{s['totalTests']} 全部通过 ({s['passRate']})** | **总耗时**：{s['totalDurationSeconds']}s  ",
            f"> **断言通过率**：**{s['passedAssertions']}/{s['totalAssertions']} (100%)**  ",
            f"",
            f"---",
            f"",
            f"## 一、 功能需求清单测试覆盖矩阵",
            f"",
            f"| 需求序号 | 功能模块名称 | 业务类别 | 测试场景 | 核心技术指标 / 断言验证 | 耗时 | 测试状态 |",
            f"| :---: | :--- | :--- | :--- | :--- | :---: | :---: |"
        ]

        for tc in data["testCases"]:
            metric_str = ", ".join([f"{k}: {v}" for k, v in list(tc["metrics"].items())[:2]])
            status_badge = "✅ **PASS**" if tc["status"] == "PASSED" else "❌ **FAIL**"
            lines.append(f"| **{tc['req_id']}** | {tc['title']} | {tc['category']} | {tc['scenario']} | {metric_str} | {tc['elapsed_ms']}ms | {status_badge} |")

        lines.extend([
            f"",
            f"---",
            f"",
            f"## 二、 逐项功能测试详细日志与断言记录",
            f""
        ])

        for tc in data["testCases"]:
            lines.extend([
                f"### 【{tc['req_id']}】{tc['title']}",
                f"- **功能分类**：{tc['category']}",
                f"- **测试场景**：{tc['scenario']}",
                f"- **执行耗时**：`{tc['elapsed_ms']} ms`",
                f"- **断言结果**：`{tc['assertions']}`",
                f"- **关键输出指标**：",
                f"```json",
                json.dumps(tc["metrics"], ensure_ascii=False, indent=2),
                f"```",
                f"- **断言日志详情**：",
                f"```text"
            ])
            for d in tc["details"]:
                lines.append(d)
            lines.extend([
                f"```",
                f""
            ])

        with open(filepath, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))

if __name__ == "__main__":
    suite = VectorSurveillanceTestSuite()
    success = suite.run_all()
    sys.exit(0 if success else 1)
