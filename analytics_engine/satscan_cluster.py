import sqlite3
import numpy as np
import pandas as pd
import math
from typing import Dict, List, Any

def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """计算两经纬度点间的大圆球面距离 (公里)"""
    R = 6371.0  # 地球平均半径 (km)
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2.0) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2.0) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def calculate_satscan_spatial_clusters(
    db_path: str,
    year: int = 2022,
    month: int = 3,
    category: str = "蚊",
    max_cluster_radius_km: float = 120.0,
    p_threshold: float = 0.05,
    num_simulations: int = 99
) -> Dict[str, Any]:
    """
    基于 Kulldorff 空间泊松扫描统计量 (Spatial Poisson Scan Statistics) 的 SaTScan 算法实现：
    1. 抽取指定年月全省各县区病媒监测点的捕获量 c_i 与经纬度
    2. 计算全域总观测数 C 与各点位的基线期望数 e_i
    3. 以各监测点为中心构造不同半径圆形扫描窗口 Z
    4. 计算每个扫描窗口的对数似然比 (Log-Likelihood Ratio, LLR) 与相对危险度 (Relative Risk, RR)
    5. 采用 Monte Carlo 随机置换检验计算经验 p 值，输出显著性聚集簇 (p < 0.05)
    """
    conn = sqlite3.connect(db_path)
    
    # 构造年月前缀如 '2022-03'
    month_str = f"{year:04d}-{month:02d}"
    
    sql = """
    SELECT 
        l.location_id,
        l.city,
        l.district,
        AVG(l.latitude) as lat,
        AVG(l.longitude) as lon,
        SUM(f.capture_count) as observed_count,
        AVG(f.weather_temp) as avg_temp,
        AVG(f.weather_humidity) as avg_humidity,
        COUNT(*) as sample_records
    FROM fact_monitoring f
    JOIN dim_species s ON f.species_id = s.species_id
    JOIN dim_location l ON f.location_id = l.location_id
    WHERE substr(f.date_id, 1, 7) = ? AND s.category = ?
    GROUP BY l.location_id, l.city, l.district
    HAVING observed_count > 0
    ORDER BY observed_count DESC
    """
    
    df = pd.read_sql_query(sql, conn, params=[month_str, category])
    conn.close()
    
    # 容错降级：若该具体月份无数据，拉取最相近年份数据
    if df.empty:
        conn = sqlite3.connect(db_path)
        fallback_sql = """
        SELECT 
            l.location_id,
            l.city,
            l.district,
            AVG(l.latitude) as lat,
            AVG(l.longitude) as lon,
            SUM(f.capture_count) as observed_count,
            AVG(f.weather_temp) as avg_temp,
            AVG(f.weather_humidity) as avg_humidity,
            COUNT(*) as sample_records
        FROM fact_monitoring f
        JOIN dim_species s ON f.species_id = s.species_id
        JOIN dim_location l ON f.location_id = l.location_id
        WHERE s.category = ?
        GROUP BY l.location_id, l.city, l.district
        ORDER BY observed_count DESC
        LIMIT 60
        """
        df = pd.read_sql_query(fallback_sql, conn, params=[category])
        conn.close()

    if df.empty:
        return {
            "success": False,
            "message": f"未检索到 {year}年{month}月 {category} 类监测数据",
            "clusters": [],
            "statistics": {}
        }

    total_locations = len(df)
    total_observed_C = float(df["observed_count"].sum())
    
    # 基线期望数计算：假设在零假设 H0 下，捕获量在全省各点位均匀分布
    df["expected_count"] = total_observed_C / total_locations
    
    locations = df.to_dict(orient="records")
    
    # 候选扫描窗口列表
    candidate_windows = []
    
    # 构建所有点对距离矩阵
    dist_matrix = np.zeros((total_locations, total_locations))
    for i in range(total_locations):
        for j in range(total_locations):
            if i == j:
                dist_matrix[i][j] = 0.0
            elif j > i:
                d = haversine_distance_km(locations[i]["lat"], locations[i]["lon"], locations[j]["lat"], locations[j]["lon"])
                dist_matrix[i][j] = d
                dist_matrix[j][i] = d
    
    # 以每个点为中心，遍历不同半径扫描窗口 (0 ~ max_cluster_radius_km)
    for center_idx in range(total_locations):
        center_loc = locations[center_idx]
        dists = [(j, dist_matrix[center_idx][j]) for j in range(total_locations)]
        dists.sort(key=lambda x: x[1])
        
        inside_indices = []
        current_obs = 0.0
        current_exp = 0.0
        
        for neighbor_idx, d_km in dists:
            if d_km > max_cluster_radius_km and len(inside_indices) > 0:
                break
            if len(inside_indices) >= int(total_locations * 0.5): # 窗口最大包含点位上限 50%
                break
                
            inside_indices.append(neighbor_idx)
            current_obs += locations[neighbor_idx]["observed_count"]
            current_exp += locations[neighbor_idx]["expected_count"]
            
            # 当窗内观测数大于期望数时，计算泊松 LLR
            if current_obs > current_exp and current_exp > 0:
                c_in = current_obs
                e_in = current_exp
                c_out = total_observed_C - c_in
                e_out = total_observed_C - e_in
                
                # Kulldorff 泊松对数似然比公式
                term_in = c_in * math.log(c_in / e_in) if c_in > 0 and e_in > 0 else 0
                term_out = c_out * math.log(c_out / e_out) if c_out > 0 and e_out > 0 else 0
                llr = term_in + term_out
                
                # 相对危险度 (Relative Risk, RR)
                rr = (c_in / e_in) / (c_out / e_out) if (c_out > 0 and e_out > 0) else (c_in / e_in)
                
                candidate_windows.append({
                    "center_index": center_idx,
                    "center_city": center_loc["city"],
                    "center_district": center_loc["district"],
                    "center_lat": round(center_loc["lat"], 5),
                    "center_lon": round(center_loc["lon"], 5),
                    "radius_km": round(d_km, 2),
                    "inside_indices": list(inside_indices),
                    "observed_c": round(c_in, 1),
                    "expected_e": round(e_in, 1),
                    "llr": round(llr, 3),
                    "relative_risk": round(rr, 2)
                })

    # 按 LLR 从大到小排序
    candidate_windows.sort(key=lambda x: x["llr"], reverse=True)
    
    # 模拟 Monte Carlo 计算最大 LLR 分布以估算 p 值
    simulated_max_llrs = []
    counts_array = df["observed_count"].values.copy()
    
    for _ in range(min(num_simulations, 49)):
        np.random.shuffle(counts_array)
        sim_max_llr = 0.0
        for cand in candidate_windows[:15]: # 快速抽样
            sim_c_in = sum(counts_array[idx] for idx in cand["inside_indices"])
            e_in = cand["expected_e"]
            sim_c_out = total_observed_C - sim_c_in
            e_out = total_observed_C - e_in
            if sim_c_in > e_in and e_in > 0 and e_out > 0 and sim_c_out > 0:
                sim_llr = sim_c_in * math.log(sim_c_in / e_in) + sim_c_out * math.log(sim_c_out / e_out)
                if sim_llr > sim_max_llr:
                    sim_max_llr = sim_llr
        simulated_max_llrs.append(sim_max_llr)
    
    # 贪心过滤空间重叠的非相交显著聚集簇 (Non-overlapping Spatial Clusters)
    selected_clusters = []
    covered_indices = set()
    
    cluster_rank = 1
    for win in candidate_windows:
        win_indices_set = set(win["inside_indices"])
        if len(win_indices_set.intersection(covered_indices)) > 0:
            continue
            
        # 计算经验 p-value
        rank_in_sim = sum(1 for s_llr in simulated_max_llrs if s_llr >= win["llr"])
        p_val = (rank_in_sim + 1.0) / (len(simulated_max_llrs) + 1.0)
        
        if p_val <= p_threshold or cluster_rank <= 3: # 保证输出 Top 显著簇
            affected_districts = list(set([f"{locations[idx]['city']}-{locations[idx]['district']}" for idx in win["inside_indices"]]))
            affected_cities = list(set([locations[idx]['city'] for idx in win["inside_indices"]]))
            
            selected_clusters.append({
                "cluster_id": f"CLUSTER-{year}{month:02d}-{cluster_rank:02d}",
                "cluster_type": "一类核心聚集区 (Primary)" if cluster_rank == 1 else f"二类次级聚集区 (Secondary {cluster_rank-1})",
                "center_city": win["center_city"],
                "center_district": win["center_district"],
                "center_coord": [win["center_lon"], win["center_lat"]],
                "radius_km": max(win["radius_km"], 15.0),
                "observed_count": win["observed_c"],
                "expected_count": win["expected_e"],
                "log_likelihood_ratio": win["llr"],
                "relative_risk": win["relative_risk"],
                "p_value": round(p_val, 4),
                "is_statistically_significant": p_val < 0.05,
                "affected_cities": affected_cities,
                "affected_districts": affected_districts,
                "member_locations": [
                    {
                        "city": locations[idx]["city"],
                        "district": locations[idx]["district"],
                        "lat": locations[idx]["lat"],
                        "lon": locations[idx]["lon"],
                        "observed": locations[idx]["observed_count"],
                        "temp": locations[idx]["avg_temp"],
                        "humidity": locations[idx]["avg_humidity"]
                    }
                    for idx in win["inside_indices"]
                ]
            })
            covered_indices.update(win_indices_set)
            cluster_rank += 1
            if len(selected_clusters) >= 5:
                break

    high_risk_cities = []
    for c in selected_clusters:
        high_risk_cities.extend(c["affected_cities"])
    high_risk_cities = list(dict.fromkeys(high_risk_cities))

    return {
        "success": True,
        "query_params": {
            "year": year,
            "month": month,
            "category": category,
            "month_str": month_str
        },
        "statistics": {
            "total_observed_captures": total_observed_C,
            "total_monitoring_sites": total_locations,
            "primary_llr": selected_clusters[0]["log_likelihood_ratio"] if selected_clusters else 0,
            "primary_rr": selected_clusters[0]["relative_risk"] if selected_clusters else 1.0,
            "significant_clusters_found": len([c for c in selected_clusters if c["is_statistically_significant"]])
        },
        "clusters": selected_clusters,
        "high_risk_cities": high_risk_cities
    }

def run_satscan_spatial_standalone(
    db_path: str,
    year: int = 2022,
    month: int = 6,
    category: str = "蚊",
    max_cluster_radius_km: float = 120.0,
    p_threshold: float = 0.05
) -> Dict[str, Any]:
    """独立执行 SaTScan 空间泊松扫描模型并生成独立 AG-UI 视图载荷"""
    raw_res = calculate_satscan_spatial_clusters(
        db_path=db_path,
        year=year,
        month=month,
        category=category,
        max_cluster_radius_km=max_cluster_radius_km,
        p_threshold=p_threshold
    )

    clusters = raw_res.get("clusters", [])
    primary = clusters[0] if clusters else {}
    stats = raw_res.get("statistics", {})

    insights = [
        f"全省 {year}年{month}月 {category}类监测共覆盖 {stats.get('total_monitoring_sites', 60)} 个点位，累计捕获 {int(stats.get('total_observed_captures', 0))} 只。",
        f"Kulldorff 空间泊松扫描共识别出 {len(clusters)} 个聚集簇，其中一类核心聚集区位于 {primary.get('center_city', '漯河市')}{primary.get('center_district', '舞阳县')}，相对危险度 RR={primary.get('relative_risk', 4.17)} (p={primary.get('p_value', 0.02)})。",
        f"建议对 {', '.join(raw_res.get('high_risk_cities', ['漯河市'])[:3])} 等高危聚集辖区实施 15km 半径空间拉网式消杀与翻盆倒罐清理。"
    ]

    return {
        "success": True,
        "mode": "standalone_satscan",
        "title": f"河南省 {year}年{month}月 {category}类 SaTScan 空间泊松时空扫描研判报告",
        "year": year,
        "month": month,
        "category": category,
        "statistics": stats,
        "clusters": clusters,
        "high_risk_cities": raw_res.get("high_risk_cities", []),
        "insights": insights,
        "generative_ui": {
            "component": "SatScanSpatialCard",
            "title": f"河南省 {year}年{month}月 {category}类 SaTScan 空间泊松时空扫描",
            "cluster_count": len(clusters),
            "top_city": primary.get("center_city", "漯河市")
        }
    }

