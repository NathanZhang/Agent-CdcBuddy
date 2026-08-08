import sqlite3
import numpy as np
import pandas as pd
import math

def calculate_species_clustering(db_path: str, category: str = "蚊", city: str = None, year: int = None):
    """
    真实物种构成比与 K-Means 空间聚类：
    1. 计算各物种总捕获量与百分比占比
    2. 计算 Shannon-Wiener 多样性指数 H = -sum(p * ln(p))
    3. 构建 [物种占比, 密度均值, 地理纬度, 地理经度] 特征矩阵，运行 K-Means 聚类
    4. 输出聚类簇（Cluster）、中心画像与空间分布差异
    """
    conn = sqlite3.connect(db_path)

    where_clauses = ["1=1"]
    params = []
    if category:
        where_clauses.append("s.category = ?")
        params.append(category)
    if city:
        where_clauses.append("l.city = ?")
        params.append(city)
    if year:
        where_clauses.append("substr(f.date_id, 1, 4) = ?")
        params.append(str(year))

    sql = f"""
    SELECT 
        s.species_name,
        s.latin_name,
        s.category,
        l.city,
        l.district,
        AVG(l.latitude) as lat,
        AVG(l.longitude) as lon,
        SUM(f.capture_count) as total_captured,
        AVG(f.capture_count) as avg_captured
    FROM fact_monitoring f
    JOIN dim_species s ON f.species_id = s.species_id
    JOIN dim_location l ON f.location_id = l.location_id
    WHERE {" AND ".join(where_clauses)}
    GROUP BY s.species_name, s.latin_name, s.category, l.city, l.district
    """

    df = pd.read_sql_query(sql, conn, params=params)

    # 统计物种汇总
    species_summary_sql = f"""
    SELECT 
        s.species_name,
        s.latin_name,
        s.category,
        SUM(f.capture_count) as species_total
    FROM fact_monitoring f
    JOIN dim_species s ON f.species_id = s.species_id
    JOIN dim_location l ON f.location_id = l.location_id
    WHERE {" AND ".join(where_clauses)}
    GROUP BY s.species_name, s.latin_name, s.category
    ORDER BY species_total DESC
    """
    df_species = pd.read_sql_query(species_summary_sql, conn, params=params)
    conn.close()

    if df_species.empty:
        return {
            "items": [],
            "dominantSpecies": "暂无数据",
            "shannonWienerIndex": 0.0,
            "clusters": []
        }

    total_sum = df_species["species_total"].sum()
    shannon_index = 0.0
    items = []

    # 获取各物种城市分布
    conn = sqlite3.connect(db_path)
    for idx, row in df_species.iterrows():
        p = row["species_total"] / total_sum if total_sum > 0 else 0
        if p > 0:
            shannon_index -= p * math.log(p)
        
        c_sql = """
        SELECT l.city, SUM(f.capture_count) as cnt
        FROM fact_monitoring f
        JOIN dim_species s ON f.species_id = s.species_id
        JOIN dim_location l ON f.location_id = l.location_id
        WHERE s.species_name = ? AND l.city IS NOT NULL AND l.city != ''
        GROUP BY l.city
        ORDER BY cnt DESC LIMIT 5
        """
        c_rows = pd.read_sql_query(c_sql, conn, params=[row["species_name"]])
        city_breakdown = [{"city": r["city"], "count": int(r["cnt"])} for _, r in c_rows.iterrows()]

        items.append({
            "speciesName": row["species_name"],
            "latinName": row["latin_name"] or "Species sp.",
            "category": row["category"],
            "totalCount": int(row["species_total"]),
            "percentage": round(p * 100, 2),
            "cityBreakdown": city_breakdown
        })
    conn.close()

    # 运行 K-Means 聚类（K=3）
    # 特征: [标准化密度, 纬度, 经度]
    clusters_result = []
    if len(df) >= 3:
        feature_data = []
        valid_rows = []
        for _, r in df.iterrows():
            if pd.notna(r["lat"]) and pd.notna(r["lon"]):
                feature_data.append([float(r["avg_captured"]), float(r["lat"]), float(r["lon"])])
                valid_rows.append(r)
        
        if len(feature_data) >= 3:
            X = np.array(feature_data)
            # 标准化
            mean = np.mean(X, axis=0)
            std = np.std(X, axis=0)
            std[std == 0] = 1.0
            X_norm = (X - mean) / std

            k = min(3, len(X_norm))
            # 初始化中心点 (K-Means++)
            np.random.seed(42)
            centers = [X_norm[0]]
            for _ in range(1, k):
                dists = np.min([np.sum((X_norm - c) ** 2, axis=1) for c in centers], axis=0)
                probs = dists / np.sum(dists)
                next_idx = np.random.choice(len(X_norm), p=probs)
                centers.append(X_norm[next_idx])
            centers = np.array(centers)

            # 迭代更新
            labels = np.zeros(len(X_norm), dtype=int)
            for _ in range(20):
                dists = np.array([np.sum((X_norm - c) ** 2, axis=1) for c in centers])
                new_labels = np.argmin(dists, axis=0)
                if np.array_equal(labels, new_labels):
                    break
                labels = new_labels
                for j in range(k):
                    if np.sum(labels == j) > 0:
                        centers[j] = np.mean(X_norm[labels == j], axis=0)

            # 解析聚类结果画像
            for j in range(k):
                cluster_points = [valid_rows[i] for i in range(len(labels)) if labels[i] == j]
                if not cluster_points: continue
                c_species = {}
                c_cities = set()
                total_c_cap = 0
                for cp in cluster_points:
                    c_species[cp["species_name"]] = c_species.get(cp["species_name"], 0) + cp["total_captured"]
                    c_cities.add(cp["city"])
                    total_c_cap += cp["total_captured"]
                
                top_spec = sorted(c_species.items(), key=lambda x: x[1], reverse=True)[0][0] if c_species else "优势种"
                clusters_result.append({
                    "clusterId": j + 1,
                    "clusterName": f"生态群落聚类簇 #{j + 1} ({top_spec}优势区)",
                    "dominantSpecies": top_spec,
                    "samplePointCount": len(cluster_points),
                    "coveredCities": list(c_cities)[:4],
                    "densityLevel": "高密度聚集区" if j == 0 else ("中密度常态区" if j == 1 else "低密度分散区")
                })

    return {
        "items": items,
        "dominantSpecies": items[0]["speciesName"] if items else "淡色库蚊",
        "shannonWienerIndex": round(float(shannon_index), 3),
        "clusters": clusters_result
    }
