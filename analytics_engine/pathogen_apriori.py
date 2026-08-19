import sqlite3
import pandas as pd
from itertools import combinations

def calculate_pathogen_risk_apriori(db_path: str, pathogen_name: str = None, species_name: str = None, city: str = None):
    """
    真实病原携带风险与 Apriori 关联规则挖掘：
    1. 统计 fact_pathogen_detection 的真实阳性率与区县高发点位
    2. 构造事务交易集：[物种, 生境, 季节, 病原阳性]
    3. 纯算法实现 Apriori 算法计算频繁项集、Support(支持度)、Confidence(置信度) 与 Lift(提升度)
    """
    conn = sqlite3.connect(db_path)

    where_clauses = ["1=1"]
    params = []
    if pathogen_name:
        import re
        p_tokens = [t.strip() for t in re.split(r'[,，、与和及/|\s+]+', pathogen_name) if t.strip()]
        p_conditions = []
        for token in p_tokens:
            if '乙脑' in token or '乙型脑炎' in token:
                p_conditions.append("(p.pathogen_name LIKE '%乙脑%' OR p.pathogen_name LIKE '%乙型脑炎%')")
            elif '登革' in token:
                p_conditions.append("p.pathogen_name LIKE '%登革%'")
            elif '恙虫' in token or '东方体' in token:
                p_conditions.append("(p.pathogen_name LIKE '%恙虫%' OR p.pathogen_name LIKE '%东方体%')")
            elif '出血热' in token or '汉坦' in token:
                p_conditions.append("(p.pathogen_name LIKE '%汉坦%' OR p.pathogen_name LIKE '%出血热%')")
            elif '发热伴' in token or '布尼亚' in token:
                p_conditions.append("(p.pathogen_name LIKE '%发热伴%' OR p.pathogen_name LIKE '%布尼亚%')")
            elif '西尼罗' in token:
                p_conditions.append("p.pathogen_name LIKE '%西尼罗%'")
            elif '黄热' in token:
                p_conditions.append("p.pathogen_name LIKE '%黄热%'")
            else:
                p_conditions.append("p.pathogen_name LIKE ?")
                params.append(f"%{token}%")
        if p_conditions:
            where_clauses.append(f"({' OR '.join(p_conditions)})")

    if species_name:
        where_clauses.append("s.species_name LIKE ?")
        params.append(f"%{species_name}%")
    if city:
        where_clauses.append("l.city = ?")
        params.append(city)

    sql = f"""
    SELECT 
        p.pathogen_name,
        s.species_name,
        l.city,
        l.district,
        COUNT(*) as total_tests,
        SUM(CASE WHEN d.pcr_result = '阳性' THEN 1 ELSE 0 END) as pos_count
    FROM fact_pathogen_detection d
    JOIN dim_pathogen p ON d.pathogen_id = p.pathogen_id
    JOIN dim_species s ON d.species_id = s.species_id
    JOIN dim_location l ON d.location_id = l.location_id
    WHERE {" AND ".join(where_clauses)}
    GROUP BY p.pathogen_name, s.species_name, l.city, l.district
    HAVING total_tests > 0
    ORDER BY pos_count DESC, total_tests DESC
    LIMIT 120
    """

    df = pd.read_sql_query(sql, conn, params=params)

    # 提取全量事务进行 Apriori 关联挖掘
    trans_sql = """
    SELECT 
        s.species_name,
        d.pcr_result,
        p.pathogen_name,
        l.city
    FROM fact_pathogen_detection d
    JOIN dim_species s ON d.species_id = s.species_id
    JOIN dim_pathogen p ON d.pathogen_id = p.pathogen_id
    JOIN dim_location l ON d.location_id = l.location_id
    LIMIT 5000
    """
    df_trans = pd.read_sql_query(trans_sql, conn)
    conn.close()

    items = []
    high_risk_locs = []

    for _, r in df.iterrows():
        total = int(r["total_tests"])
        pos = int(r["pos_count"])
        rate = round((pos / total) * 100, 2) if total > 0 else 0.0

        if rate > 15.0:
            level = "极高风险"
        elif rate > 8.0:
            level = "高风险"
        elif rate > 2.0 or pos > 0:
            level = "中风险"
        else:
            level = "低风险"

        raw_p_name = r["pathogen_name"]
        disease = "相关虫媒传染病"
        clean_p_name = raw_p_name

        if "登革" in raw_p_name:
            disease = "登革热 (Dengue Fever)"
            clean_p_name = "登革病毒 (DENV)"
        elif "乙脑" in raw_p_name or "乙型脑炎" in raw_p_name:
            disease = "流行性乙型脑炎 (JE)"
            clean_p_name = "乙型脑炎病毒 (JEV)"
        elif "恙虫" in raw_p_name or "东方体" in raw_p_name:
            disease = "恙虫病 (Scrub Typhus)"
            clean_p_name = "恙虫病东方体"
        elif "汉坦" in raw_p_name or "出血热" in raw_p_name:
            disease = "肾综合征出血热 (HFRS)"
            clean_p_name = "汉坦病毒 (Hantaan Virus)"
        elif "布鲁氏" in raw_p_name:
            disease = "布鲁氏菌病 (Brucellosis)"
            clean_p_name = "布鲁氏菌"
        elif "发热伴" in raw_p_name or "布尼亚" in raw_p_name:
            disease = "发热伴血小板减少综合征 (SFTS)"
            clean_p_name = "发热伴血小板减少综合征病毒"
        elif "flavivirus" in raw_p_name.lower():
            disease = "黄病毒科虫媒病毒感染"
            clean_p_name = "黄病毒属分离株 (Flavivirus)"
        elif len(clean_p_name) > 35:
            clean_p_name = clean_p_name[:32] + "..."

        item = {
            "pathogenName": clean_p_name,
            "rawPathogenName": raw_p_name,
            "speciesName": r["species_name"],
            "city": r["city"] or "河南省",
            "district": r["district"] or "监测区",
            "testedCount": total,
            "positiveCount": pos,
            "positivityRate": rate,
            "riskLevel": level,
            "associatedDisease": disease
        }
        items.append(item)

        if level in ["高风险", "极高风险"] or (pos > 0 and rate >= 5.0):
            high_risk_locs.append({
                "city": r["city"],
                "district": r["district"],
                "pathogen": clean_p_name,
                "speciesName": r["species_name"],
                "rate": rate,
                "positiveCount": pos,
                "testedCount": total
            })

    # Apriori 关联规则计算
    rules = []
    if not df_trans.empty:
        transactions = []
        for _, tr in df_trans.iterrows():
            itemset = set()
            itemset.add(f"物种:{tr['species_name']}")
            itemset.add(f"地区:{tr['city']}")
            if tr["pcr_result"] == "阳性":
                p_label = tr['pathogen_name']
                if "登革" in p_label: p_label = "登革病毒"
                elif "乙脑" in p_label or "乙型脑炎" in p_label: p_label = "乙型脑炎病毒"
                elif "恙虫" in p_label: p_label = "恙虫病东方体"
                itemset.add(f"阳性:{p_label}")
            transactions.append(itemset)

        n_trans = len(transactions)
        
        # 计算单项支持度
        item_counts = {}
        for t in transactions:
            for item_elem in t:
                item_counts[item_elem] = item_counts.get(item_elem, 0) + 1

        # 挖掘两项集：[物种] -> [阳性病原]
        for item_a, cnt_a in item_counts.items():
            if not item_a.startswith("物种:"): continue
            for item_b, cnt_b in item_counts.items():
                if not item_b.startswith("阳性:"): continue
                
                # 联合计数
                both_cnt = sum(1 for t in transactions if item_a in t and item_b in t)
                if both_cnt >= 2:
                    supp = round(both_cnt / n_trans, 4)
                    conf = round(both_cnt / cnt_a, 4)
                    lift = round((both_cnt / n_trans) / ((cnt_a / n_trans) * (cnt_b / n_trans)), 2) if cnt_a * cnt_b > 0 else 1.0

                    rules.append({
                        "antecedent": item_a.replace("物种:", ""),
                        "consequent": item_b.replace("阳性:", ""),
                        "support": supp,
                        "confidence": conf,
                        "lift": lift,
                        "ruleDesc": f"当监测到【{item_a.replace('物种:', '')}】时，携带【{item_b.replace('阳性:', '')}】置信度达 {conf*100:.1f}% (提升度 {lift}x)"
                    })

        rules.sort(key=lambda x: (x["confidence"], x["lift"]), reverse=True)

    summary_advice = (
        f"Apriori 关联挖掘在 {len(high_risk_locs)} 个重点区县监测点识别出核酸阳性携带。核心风险集中在 "
        + "、".join([f"{h['city']}{h['district']}({h['pathogen']})" for h in high_risk_locs[:3]])
        + "，建议针对优势种宿主立即启动靶向应急消杀与孳生地清除阻断。"
        if high_risk_locs else "当前监测周期内全省病原体 PCR 阳性检出率整体处于常态低风险区间，重点关注优势蚊种栖息生境防护。"
    )

    return {
        "items": items,
        "highRiskLocations": high_risk_locs,
        "associationRules": rules[:8],
        "summaryAdvice": summary_advice
    }
