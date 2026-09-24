#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
================================================================================
CDC 全域四智能体平台 - 全量自动化测试回归聚合执行器
(All Agents Test Suite Runner & Aggregator)
================================================================================
同时调度执行：
1. 病媒生物与宿主动物智能体 (Vector: No. 23 ~ 35)
2. 食源性疾病监测预警智能体 (Foodborne: No. 36 ~ 41)
3. 环境健康风险监测预警智能体 (Env Health: No. 42 ~ 58)
4. 死因、慢病及伤害综合监测智能体 (Chronic: No. 59 ~ 76)

生成全域综合执行报告：
- tests/reports/all_agents_test_report.md
- tests/reports/all_agents_test_report.json
================================================================================
"""

import os
import sys
import time
import json
from datetime import datetime

TESTS_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.dirname(TESTS_DIR)
sys.path.insert(0, os.path.join(BASE_DIR, "analytics_engine"))
sys.path.insert(0, TESTS_DIR)
sys.path.insert(0, os.path.join(TESTS_DIR, "suites"))

from automated_test_suite import VectorSurveillanceTestSuite
from test_suite_foodborne import FoodborneSurveillanceTestSuite
from test_suite_env import EnvSurveillanceTestSuite
from test_suite_chronic import ChronicSurveillanceTestSuite

def main():
    print("================================================================================")
    print(" 🏥 CDC 全域四智能体平台自动化测试综合回归启动")
    print(f" 开始时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("================================================================================")

    reports_dir = os.path.join(TESTS_DIR, "reports")
    os.makedirs(reports_dir, exist_ok=True)

    summary = {
        "execution_time": datetime.now().isoformat(),
        "suites": {},
        "total_tests": 0,
        "total_passed": 0,
        "total_failed": 0,
        "overall_status": "PENDING"
    }

    # 1. 执行病媒智能体测试 (已有成熟套件)
    print("\n>>> [1/4] 启动病媒生物与宿主动物智能体测试套件 (Vector)...")
    vector_suite = VectorSurveillanceTestSuite()
    vector_ok = vector_suite.run_all()
    vector_total = len(vector_suite.results)
    vector_passed = sum(1 for r in vector_suite.results if r.status == "PASSED")
    summary["suites"]["vector"] = {
        "name": "病媒生物与宿主动物监测预警智能体",
        "passed": vector_passed,
        "total": vector_total,
        "status": "PASSED" if vector_ok else "FAILED"
    }

    # 2. 执行食源性疾病智能体测试
    print("\n>>> [2/4] 启动食源性疾病监测预警智能体测试套件 (Foodborne)...")
    foodborne_suite = FoodborneSurveillanceTestSuite()
    foodborne_ok = foodborne_suite.run_all()
    food_total = len(foodborne_suite.results)
    food_passed = sum(1 for r in foodborne_suite.results if r.status == "PASSED")
    summary["suites"]["foodborne"] = {
        "name": "食源性疾病监测预警智能体",
        "passed": food_passed,
        "total": food_total,
        "status": "PASSED" if foodborne_ok else "FAILED"
    }

    # 3. 执行环境健康智能体测试
    print("\n>>> [3/4] 启动环境健康风险监测预警智能体测试套件 (Env Health)...")
    env_suite = EnvSurveillanceTestSuite()
    env_ok = env_suite.run_all()
    env_total = len(env_suite.results)
    env_passed = sum(1 for r in env_suite.results if r.status == "PASSED")
    summary["suites"]["env"] = {
        "name": "环境健康风险监测预警智能体",
        "passed": env_passed,
        "total": env_total,
        "status": "PASSED" if env_ok else "FAILED"
    }

    # 4. 执行死因慢病伤害智能体测试
    print("\n>>> [4/4] 启动死因、慢病及伤害综合监测智能体测试套件 (Chronic)...")
    chronic_suite = ChronicSurveillanceTestSuite()
    chronic_ok = chronic_suite.run_all()
    chronic_total = len(chronic_suite.results)
    chronic_passed = sum(1 for r in chronic_suite.results if r.status == "PASSED")
    summary["suites"]["chronic"] = {
        "name": "死因、慢病及伤害综合监测预警智能体",
        "passed": chronic_passed,
        "total": chronic_total,
        "status": "PASSED" if chronic_ok else "FAILED"
    }

    # 聚合汇总
    summary["total_tests"] = vector_total + food_total + env_total + chronic_total
    summary["total_passed"] = vector_passed + food_passed + env_passed + chronic_passed
    summary["total_failed"] = summary["total_tests"] - summary["total_passed"]
    summary["overall_status"] = "PASSED" if summary["total_failed"] == 0 else "FAILED"

    # 保存 JSON
    json_path = os.path.join(reports_dir, "all_agents_test_report.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)

    # 保存 Markdown 汇报文档
    md_path = os.path.join(reports_dir, "all_agents_test_report.md")
    with open(md_path, "w", encoding="utf-8") as f:
        f.write("# CDC 全域四智能体平台自动化测试综合回归报告\n\n")
        f.write(f"- **生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"- **综合判定**: {'🟢 全部通过 (PASSED)' if summary['overall_status'] == 'PASSED' else '🔴 存在失败 (FAILED)'}\n")
        f.write(f"- **测试用例总计**: {summary['total_tests']} 项\n")
        f.write(f"- **成功通过**: {summary['total_passed']} 项，**失败**: {summary['total_failed']} 项\n\n")
        f.write("## 智能体测试套件执行明细\n\n")
        f.write("| 智能体领域 | 领域标识 | 通过 / 总计 | 执行状态 |\n")
        f.write("| :--- | :---: | :---: | :---: |\n")
        for key, s in summary["suites"].items():
            icon = "✅ 通过" if s["status"] == "PASSED" else "❌ 失败"
            f.write(f"| {s['name']} | `{key}` | {s['passed']} / {s['total']} | {icon} |\n")

    print("\n================================================================================")
    print(f" 🎉 全域自动化测试执行完成！")
    print(f" 状态: {summary['overall_status']} (通过: {summary['total_passed']}/{summary['total_tests']})")
    print(f" 综合报告已输出至:")
    print(f"   - {md_path}")
    print(f"   - {json_path}")
    print("================================================================================")

    sys.exit(0 if summary["overall_status"] == "PASSED" else 1)

if __name__ == "__main__":
    main()
