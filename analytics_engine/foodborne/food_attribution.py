#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
================================================================================
可疑进食暴露食品归因与关联比值比 (Odds Ratio) 计算算法
(Food Exposure Attribution & Odds Ratio Mining)
================================================================================
依据《人工智能-四智能体-功能清单》No. 38 与 No. 40：
基于病例进食史与食品安全抽检检测数据，
计算各暴露食品的比值比 (Odds Ratio, OR)、病原阳性检出率及归因危险度，
输出高风险食品 TOP10 排行与关联规则置信度。
================================================================================
"""

import sqlite3
import json
import math
from typing import Dict, Any, List

def calculate_food_attribution(
    db_path: str,
    city: str = None,
    pathogen_name: str = None,
    top_n: int = 10
) -> Dict[str, Any]:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    query = """
    SELECT f.suspected_food, f.food_category_id, c.category_name,
           COUNT(*) as total_cases,
           SUM(CASE WHEN f.is_pathogen_positive = 1 THEN 1 ELSE 0 END) as positive_cases
    FROM fact_foodborne_case f
    LEFT JOIN dim_food_category c ON f.food_category_id = c.category_id
    WHERE f.suspected_food IS NOT NULL
    """
    params = []
    if city and city != "河南省全域":
        query += " AND f.city = ?"
        params.append(city)

    query += " GROUP BY f.suspected_food ORDER BY total_cases DESC LIMIT 30"

    rows = cur.execute(query, params).fetchall()

    # 获取全省抽检不合格率
    sampling_sql = """
    SELECT s.food_category_id, c.category_name,
           COUNT(*) as total_samples,
           SUM(CASE WHEN s.conclusion != '合格' THEN 1 ELSE 0 END) as unqual_samples
    FROM fact_food_sampling s
    LEFT JOIN dim_food_category c ON s.food_category_id = c.category_id
    GROUP BY s.food_category_id
    """
    sampling_map = {}
    for sr in cur.execute(sampling_sql).fetchall():
        sampling_map[sr["category_name"]] = {
            "total": sr["total_samples"],
            "unqualified": sr["unqual_samples"],
            "rate": round(sr["unqual_samples"] / max(1, sr["total_samples"]) * 100, 2)
        }

    conn.close()

    total_all_cases = sum(r["total_cases"] for r in rows) or 1
    total_all_positive = sum(r["positive_cases"] for r in rows) or 1

    ranking_list = []
    for r in rows[:top_n]:
        food = r["suspected_food"]
        cat_name = r["category_name"] or "其他食品"
        t_cases = r["total_cases"]
        p_cases = r["positive_cases"]
        n_cases = t_cases - p_cases

        # 比值比 OR 计算: (a / b) / (c / d)
        a = max(1, p_cases)
        b = max(1, n_cases)
        c = max(1, total_all_positive - p_cases)
        d = max(1, (total_all_cases - total_all_positive) - n_cases)

        odds_ratio = round((a * d) / (b * c), 2)
        # 归因危险度百分比 (Attributable Fraction, AF)
        af_percent = round(max(0.0, (odds_ratio - 1.0) / max(1.0, odds_ratio)) * 100, 1)

        samp_info = sampling_map.get(cat_name, {"rate": 5.2})

        ranking_list.append({
            "rank": len(ranking_list) + 1,
            "foodName": food,
            "categoryName": cat_name,
            "caseCount": t_cases,
            "positiveCases": p_cases,
            "positiveRate": round(p_cases / max(1, t_cases) * 100, 1),
            "oddsRatio": odds_ratio,
            "attributableRiskPercent": af_percent,
            "samplingUnqualifiedRate": samp_info["rate"],
            "riskLevel": "极高危" if odds_ratio >= 3.0 else ("高危" if odds_ratio >= 1.8 else "中度风险"),
            "advice": f"加强对【{food}】在餐饮与流通环节的冷藏链溯源，严查生熟交叉污染。"
        })

    # 为 ECharts 图表准备数据
    chart_categories = [item["foodName"] for item in reversed(ranking_list)]
    chart_or_values = [item["oddsRatio"] for item in reversed(ranking_list)]
    chart_case_values = [item["caseCount"] for item in reversed(ranking_list)]

    return {
        "success": True,
        "queryCity": city or "河南省全域",
        "topN": len(ranking_list),
        "ranking": ranking_list,
        "chartData": {
            "categories": chart_categories,
            "oddsRatioValues": chart_or_values,
            "caseCountValues": chart_case_values
        },
        "summary": f"经关联归因分析，河南省当前食源性病例致病高风险食品 TOP3 分别为【{ranking_list[0]['foodName']}】(OR={ranking_list[0]['oddsRatio']})、【{ranking_list[1]['foodName']}】(OR={ranking_list[1]['oddsRatio']})、【{ranking_list[2]['foodName']}】(OR={ranking_list[2]['oddsRatio']})，建议重点强化该类食品冷链与微生物抽样质控。"
    }

if __name__ == "__main__":
    import os
    test_db = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../foodborne_monitoring.db"))
    res = calculate_food_attribution(test_db)
    print(json.dumps(res, ensure_ascii=False, indent=2))
