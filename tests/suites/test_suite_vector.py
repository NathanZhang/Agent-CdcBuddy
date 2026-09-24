#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
================================================================================
疾控病媒生物监测预警智能体 - 自动化测试套件 (Vector Surveillance Test Suite)
================================================================================
完整复用并接入已通过验证的 tests/automated_test_suite.py (覆盖序号 23 ~ 35)
================================================================================
"""

import os
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)

# 导入并执行已有的完整自动化测试套件
from automated_test_suite import VectorSurveillanceTestSuite

if __name__ == "__main__":
    suite = VectorSurveillanceTestSuite()
    success = suite.run_all()
    sys.exit(0 if success else 1)
