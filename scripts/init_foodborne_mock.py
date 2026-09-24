#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
================================================================================
河南省疾病预防控制中心 - 食源性疾病监测预警模拟数据集生成器
(Foodborne Disease Surveillance Mock Dataset Generator)
================================================================================
依据《人工智能-四智能体-功能清单》（序号 36 ~ 41）
生成涵盖：
1. 河南省 18 地市与 126 区县全时空食源性就诊病例事实表 (fact_foodborne_case)
2. 致病菌全基因组 cgMLST 分子分型与同源聚类事实表 (fact_pathogen_molecular)
3. 食品安全监督抽样检验事实表 (fact_food_sampling)
4. 历史聚集性暴发事件表 (fact_outbreak_event)
5. 维度字典表 (dim_food_category, dim_pathogen_type, dim_hospital, dim_location)
================================================================================
"""

import os
import sys
import sqlite3
import random
import json
from datetime import datetime, timedelta

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "foodborne_monitoring.db")
DATAMOCK_DIR = os.path.abspath(os.path.join(BASE_DIR, "../Agent-CdcBuddy-DataMock/data/foodborne"))
os.makedirs(DATAMOCK_DIR, exist_ok=True)
DATAMOCK_DB_PATH = os.path.join(DATAMOCK_DIR, "foodborne_monitoring.db")

HENAN_CITIES = [
    ("410100", "郑州市", ["金水区", "二七区", "中原区", "管城回族区", "惠济区", "中牟县", "巩义市", "新郑市", "新密市", "登封市", "荥阳市"]),
    ("410200", "开封市", ["鼓楼区", "龙亭区", "顺河回族区", "禹王台区", "祥符区", "杞县", "通许县", "尉氏县", "兰考县"]),
    ("410300", "洛阳市", ["洛龙区", "涧西区", "西工区", "老城区", "瀍河回族区", "偃师区", "孟津区", "新安县", "栾川县", "嵩县", "汝阳县", "宜阳县", "洛宁县", "伊川县"]),
    ("410400", "平顶山市", ["新华区", "卫东区", "石龙区", "湛河区", "汝州市", "舞钢市", "鲁山县", "宝丰县", "叶县", "郏县"]),
    ("410500", "安阳市", ["文峰区", "北关区", "殷都区", "龙安区", "林州市", "安阳县", "汤阴县", "滑县", "内黄县"]),
    ("410600", "鹤壁市", ["淇滨区", "山城区", "鹤山区", "浚县", "淇县"]),
    ("410700", "新乡市", ["卫滨区", "红旗区", "凤泉区", "牧野区", "卫辉市", "辉县市", "新乡县", "获嘉县", "原阳县", "延津县", "封丘县"]),
    ("410800", "焦作市", ["解放区", "中站区", "马村区", "山阳区", "沁阳市", "孟州市", "修武县", "博爱县", "武陟县", "温县"]),
    ("410900", "濮阳市", ["华龙区", "清丰县", "南乐县", "范县", "台前县", "濮阳县"]),
    ("411000", "许昌市", ["魏都区", "建安区", "禹州市", "长葛市", "鄢陵县", "襄城县"]),
    ("411100", "漯河市", ["源汇区", "郾城区", "召陵区", "舞阳县", "临颍县"]),
    ("411200", "三门峡市", ["湖滨区", "陕州区", "义马市", "灵宝市", "渑池县", "卢氏县"]),
    ("411300", "南阳市", ["宛城区", "卧龙区", "邓州市", "南召县", "方城县", "西峡县", "镇平县", "内乡县", "淅川县", "社旗县", "唐河县", "新野县", "桐柏县"]),
    ("411400", "商丘市", ["梁园区", "睢阳区", "永城市", "民权县", "睢县", "宁陵县", "柘城县", "虞城县", "夏邑县"]),
    ("411500", "信阳市", ["浉河区", "平桥区", "固始县", "罗山县", "光山县", "新县", "商城县", "潢川县", "淮滨县", "息县"]),
    ("411600", "周口市", ["川汇区", "淮阳区", "项城市", "扶沟县", "西华县", "商水县", "沈丘县", "郸城县", "太康县", "鹿邑县"]),
    ("411700", "驻马店市", ["驿城区", "新蔡县", "西平县", "上蔡县", "平舆县", "正阳县", "确山县", "泌阳县", "汝南县", "遂平县"]),
    ("419001", "济源市", ["济源产城融合示范区"])
]

FOOD_CATEGORIES = [
    ("FOOD_CAT_01", "水产动物及其制品", "生食海鲜、熟制水产、贝类、虾蟹", 0.28),
    ("FOOD_CAT_02", "肉与肉制品", "酱卤熟肉、烤肉、冷鲜肉、禽肉", 0.24),
    ("FOOD_CAT_03", "蛋与蛋制品", "溏心蛋、鲜鸡蛋、皮蛋", 0.12),
    ("FOOD_CAT_04", "现制现售餐饮与冷面凉菜", "凉拌黄瓜、凉皮米线、现拌色拉", 0.14),
    ("FOOD_CAT_05", "乳与乳制品", "巴氏杀菌乳、酸奶、奶酪", 0.06),
    ("FOOD_CAT_06", "糕点与面包", "现烤奶油蛋糕、提拉米苏、自制烘焙", 0.05),
    ("FOOD_CAT_07", "现制饮品与果汁", "现榨鲜果汁、奶茶、冰品", 0.05),
    ("FOOD_CAT_08", "家庭自制发酵制品", "自制酸汤子、臭豆腐、发酵豆豉", 0.04),
    ("FOOD_CAT_09", "野生菌与野生植物", "野生蘑菇、鲜黄花菜", 0.02)
]

PATHOGENS = [
    ("PATH_01", "副溶血性弧菌 (Vibrio parahaemolyticus)", "细菌", "主要污染水产海鲜，夏秋季高发，引发剧烈水样腹泻、腹痛", "水产类", ["O3:K6", "O4:K8", "O1:KUT"], ["ST3", "ST120", "ST88"]),
    ("PATH_02", "肠炎沙门氏菌 (Salmonella enterica)", "细菌", "主要污染禽肉、生鲜鸡蛋，引发发热、恶心、黏液便", "禽肉与蛋类", ["Enteritidis", "Typhimurium", "Derby"], ["ST11", "ST19", "ST40"]),
    ("PATH_03", "单核细胞增生李斯特菌 (Listeria monocytogenes)", "细菌", "耐低温致病菌，易在冷藏熟肉、乳制品滋生，对孕妇老幼高危", "冷藏即食食品", ["1/2a", "1/2b", "4b"], ["ST8", "ST87", "ST1"]),
    ("PATH_04", "诺如病毒 (Norovirus GII)", "病毒", "高传染性，冬春季学校、幼托机构聚集性呕吐腹泻首要致病因子", "贝类与现制凉菜", ["GII.4", "GII.2", "GII.17"], ["Sydney2012", "SnowMountain"]),
    ("PATH_05", "金黄色葡萄球菌 (Staphylococcus aureus)", "细菌", "产生耐热肠毒素，常污染奶油糕点与熟肉，潜伏期短(1~6h)急起剧烈呕吐", "糕点与熟肉", ["肠毒素A型", "肠毒素B型", "肠毒素C型"], ["ST398", "ST59"]),
    ("PATH_06", "蜡样芽胞杆菌 (Bacillus cereus)", "细菌", "米饭炒饭长时间常温存放产生呕吐毒素，常见于学校食堂炒饭", "米面制品", ["呕吐型", "腹泻型"], ["ST26", "ST144"]),
    ("PATH_07", "肉毒梭菌 (Clostridium botulinum)", "细菌", "产生强神经毒素，常见于自制发酵豆瓣、密封火腿，神经麻痹高致死", "自制发酵食品", ["A型", "B型", "E型"], ["ST1", "ST2"])
]

SENTINEL_HOSPITALS = [
    ("HOSP_01", "河南省人民医院", "郑州市", "金水区", "三甲综合"),
    ("HOSP_02", "郑州大学第一附属医院", "郑州市", "二七区", "三甲综合"),
    ("HOSP_03", "郑州市中心医院", "郑州市", "中原区", "三甲综合"),
    ("HOSP_04", "开封市中心医院", "开封市", "鼓楼区", "三甲综合"),
    ("HOSP_05", "河南科技大学第一附属医院", "洛阳市", "涧西区", "三甲综合"),
    ("HOSP_06", "平顶山市第一人民医院", "平顶山市", "卫东区", "三甲综合"),
    ("HOSP_07", "安阳市人民医院", "安阳市", "文峰区", "三甲综合"),
    ("HOSP_08", "新乡医学院第一附属医院", "新乡市", "卫辉市", "三甲综合"),
    ("HOSP_09", "南阳市中心医院", "南阳市", "宛城区", "三甲综合"),
    ("HOSP_10", "商丘市第一人民医院", "商丘市", "梁园区", "三甲综合"),
    ("HOSP_11", "信阳市中心医院", "信阳市", "浉河区", "三甲综合"),
    ("HOSP_12", "周口市中心医院", "周口市", "川汇区", "三甲综合"),
    ("HOSP_13", "驻马店市中心医院", "驻马店市", "驿城区", "三甲综合")
]

def init_db(db_path: str):
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    cur.executescript("""
    -- 1. 维度表：食品分类
    CREATE TABLE IF NOT EXISTS dim_food_category (
        category_id TEXT PRIMARY KEY,
        category_name TEXT NOT NULL,
        description TEXT,
        risk_weight REAL
    );

    -- 2. 维度表：致病菌字典
    CREATE TABLE IF NOT EXISTS dim_pathogen_type (
        pathogen_id TEXT PRIMARY KEY,
        pathogen_name TEXT NOT NULL,
        category TEXT NOT NULL,
        clinical_features TEXT,
        primary_vehicle TEXT
    );

    -- 3. 维度表：哨点医院
    CREATE TABLE IF NOT EXISTS dim_hospital (
        hospital_id TEXT PRIMARY KEY,
        hospital_name TEXT NOT NULL,
        city TEXT NOT NULL,
        district TEXT NOT NULL,
        grade TEXT
    );

    -- 4. 维度表：空间行政区划
    CREATE TABLE IF NOT EXISTS dim_location (
        city_code TEXT NOT NULL,
        city_name TEXT NOT NULL,
        district_name TEXT NOT NULL,
        PRIMARY KEY (city_name, district_name)
    );

    -- 5. 事实表：食源性病例监测事实表
    CREATE TABLE IF NOT EXISTS fact_foodborne_case (
        case_id TEXT PRIMARY KEY,
        patient_name TEXT,
        gender TEXT,
        age INTEGER,
        occupation TEXT,
        hospital_id TEXT,
        visit_date TEXT NOT NULL,
        symptom_onset_time TEXT NOT NULL,
        incubation_hours REAL,
        main_symptoms TEXT NOT NULL,
        stool_character TEXT,
        dining_place_type TEXT,
        suspected_food TEXT,
        food_category_id TEXT,
        pathogen_id TEXT,
        is_pathogen_positive INTEGER DEFAULT 0,
        city TEXT NOT NULL,
        district TEXT NOT NULL,
        cluster_id TEXT
    );

    -- 6. 事实表：致病菌分子分型事实表 (cgMLST / PFGE)
    CREATE TABLE IF NOT EXISTS fact_pathogen_molecular (
        isolate_id TEXT PRIMARY KEY,
        case_id TEXT,
        sampling_id TEXT,
        pathogen_id TEXT NOT NULL,
        pathogen_name TEXT NOT NULL,
        serotype TEXT,
        pfge_pattern TEXT,
        mlst_st TEXT,
        cgmlst_vector TEXT NOT NULL, -- 30个等位基因核心指纹
        isolation_source TEXT,
        isolation_date TEXT NOT NULL,
        city TEXT NOT NULL,
        district TEXT NOT NULL,
        is_outbreak_isolate INTEGER DEFAULT 0,
        cluster_id TEXT
    );

    -- 7. 事实表：食品安全监督抽样检验表
    CREATE TABLE IF NOT EXISTS fact_food_sampling (
        sample_id TEXT PRIMARY KEY,
        sample_name TEXT NOT NULL,
        food_category_id TEXT NOT NULL,
        sample_date TEXT NOT NULL,
        sampling_stage TEXT NOT NULL, -- 流通/餐饮/生产
        sampling_location TEXT NOT NULL,
        city TEXT NOT NULL,
        district TEXT NOT NULL,
        detected_pathogen_id TEXT,
        pathogen_count_cfu_g REAL,
        standard_limit TEXT,
        conclusion TEXT NOT NULL -- 合格 / 不合格
    );

    -- 8. 事实表：聚集性暴发事件表
    CREATE TABLE IF NOT EXISTS fact_outbreak_event (
        cluster_id TEXT PRIMARY KEY,
        event_title TEXT NOT NULL,
        city TEXT NOT NULL,
        district TEXT NOT NULL,
        venue_type TEXT NOT NULL,
        venue_name TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT,
        case_count INTEGER NOT NULL,
        hospitalized_count INTEGER DEFAULT 0,
        attack_rate REAL,
        confirmed_pathogen TEXT,
        suspected_food TEXT,
        cgmlst_similarity_rate REAL,
        trace_conclusion TEXT,
        disposal_status TEXT DEFAULT 'closed'
    );

    CREATE INDEX IF NOT EXISTS idx_case_date ON fact_foodborne_case(visit_date);
    CREATE INDEX IF NOT EXISTS idx_case_city ON fact_foodborne_case(city, district);
    CREATE INDEX IF NOT EXISTS idx_case_cluster ON fact_foodborne_case(cluster_id);
    CREATE INDEX IF NOT EXISTS idx_mol_pathogen ON fact_pathogen_molecular(pathogen_id);
    CREATE INDEX IF NOT EXISTS idx_mol_cluster ON fact_pathogen_molecular(cluster_id);
    """);

    # 填充维度表
    cur.executemany("INSERT OR REPLACE INTO dim_food_category VALUES (?,?,?,?)",
                    [(c[0], c[1], c[2], c[3]) for c in FOOD_CATEGORIES])

    cur.executemany("INSERT OR REPLACE INTO dim_pathogen_type VALUES (?,?,?,?,?)",
                    [(p[0], p[1], p[2], p[3], p[4]) for p in PATHOGENS])

    cur.executemany("INSERT OR REPLACE INTO dim_hospital VALUES (?,?,?,?,?)", SENTINEL_HOSPITALS)

    loc_rows = []
    for city_code, city_name, districts in HENAN_CITIES:
        for dist in districts:
            loc_rows.append((city_code, city_name, dist))
    cur.executemany("INSERT OR REPLACE INTO dim_location VALUES (?,?,?)", loc_rows)

    conn.commit()
    conn.close()

def generate_mock_data(db_path: str):
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    random.seed(42)

    # 1. 注入 4 起具有代表性的聚集性暴发事件
    outbreaks = [
        ("OUTBREAK-202608-01", "郑州市金水区某高校食堂副溶血性弧菌聚集性腹泻事件", "郑州市", "金水区", "学校食堂", "郑州金水大学第三学生餐厅", "2026-08-18 11:30:00", "2026-08-20 18:00:00", 38, 4, 14.8, "副溶血性弧菌", "凉拌海蜇丝与现制基围虾", 0.985, "凉菜间生熟案板交叉污染且冷藏温度超标", "closed"),
        ("OUTBREAK-202608-02", "洛阳市涧西区某大型酒楼沙门氏菌婚宴暴发事件", "洛阳市", "涧西区", "大型酒楼", "洛阳宴宾楼婚宴大厅", "2026-08-21 18:30:00", "2026-08-23 12:00:00", 26, 3, 22.4, "肠炎沙门氏菌", "现烤冷切乳鸽与溏心蛋沙拉", 0.992, "溏心蛋未充分熟化且环境带菌传播", "closed"),
        ("OUTBREAK-202607-03", "新乡市卫辉市某幼儿园诺如病毒暴发疫情", "新乡市", "卫辉市", "托幼机构", "卫辉市第一实验幼儿园", "2026-07-05 08:30:00", "2026-07-08 17:00:00", 19, 1, 18.2, "诺如病毒 (Norovirus GII)", "鲜切西瓜与现调乳饮料", 0.978, "食品从业隐性感染人员接触带毒导致食源暴发", "closed"),
        ("OUTBREAK-202608-04", "南阳市宛城区某冷链批发市场单增李斯特菌跨店污染", "南阳市", "宛城区", "冷链熟食零售", "宛城便民熟食集市", "2026-08-10 10:00:00", "2026-08-15 14:00:00", 9, 7, 31.0, "单核细胞增生李斯特菌", "真空包装冷切牛肉", 0.995, "同批次熟牛肉中心冷库切片环节持续污染", "in_progress")
    ]
    cur.executemany("INSERT OR REPLACE INTO fact_outbreak_event VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", outbreaks)

    # 2. 为暴发事件注入分子分型同源指纹 (cgMLST 基准向量 + 微小位点差异)
    molecular_rows = []
    case_rows = []

    # 基准等位基因指纹生成函数
    def make_cgmlst_vector(base_seed: int, mutation_count: int = 0):
        # 30 个核心等位基因位点 (cgMLST-01 ~ cgMLST-30)
        rng = random.Random(base_seed)
        vec = [rng.randint(100, 999) for _ in range(30)]
        # 变异微调
        if mutation_count > 0:
            mutate_indices = random.sample(range(30), min(mutation_count, 30))
            for idx in mutate_indices:
                vec[idx] += random.choice([-1, 1, 2])
        return json.dumps(vec)

    # 为 4 个暴发事件生成同源病例与分离株
    base_seeds = {
        "OUTBREAK-202608-01": (7701, "PATH_01", "副溶血性弧菌", "O3:K6", "ST3", "VP-PFGE-0818"),
        "OUTBREAK-202608-02": (8802, "PATH_02", "肠炎沙门氏菌", "Enteritidis", "ST11", "SE-PFGE-0821"),
        "OUTBREAK-202607-03": (9903, "PATH_04", "诺如病毒 (Norovirus GII)", "GII.4", "Sydney2012", "NV-RT-0705"),
        "OUTBREAK-202608-04": (6604, "PATH_03", "单核细胞增生李斯特菌", "1/2a", "ST8", "LM-PFGE-0810")
    }

    outbreak_isolate_idx = 1
    outbreak_case_idx = 1

    for ob in outbreaks:
        cluster_id = ob[0]
        city = ob[2]
        district = ob[3]
        case_count = ob[8]
        suspected_food = ob[12]
        seed, path_id, path_name, sero, st, pfge = base_seeds[cluster_id]

        start_dt = datetime.strptime(ob[6], "%Y-%m-%d %H:%M:%S")

        for i in range(case_count):
            c_id = f"CASE-OB-{cluster_id[-4:]}-{outbreak_case_idx:03d}"
            outbreak_case_idx += 1
            visit_dt = start_dt + timedelta(hours=random.uniform(2, 48))
            onset_dt = visit_dt - timedelta(hours=random.uniform(3, 18))
            incubation = round((visit_dt - onset_dt).total_seconds() / 3600.0, 1)

            main_sym = "腹痛、水样便腹泻、低热" if "副溶血" in path_name else ("剧烈恶心、喷射状呕吐、发热" if "诺如" in path_name else "发热、黏液脓血便、里急后重")

            case_rows.append((
                c_id, f"张*患者{outbreak_case_idx}", random.choice(["男", "女"]),
                random.randint(18, 55), "学生/教工" if "高校" in ob[1] else "宾客/市民",
                "HOSP_01" if city == "郑州市" else "HOSP_05",
                visit_dt.strftime("%Y-%m-%d"), onset_dt.strftime("%Y-%m-%d %H:%M:%S"),
                incubation, main_sym, "水样便" if "副溶血" in path_name else "稀糊便",
                ob[4], suspected_food, "FOOD_CAT_01" if "副溶血" in path_name else "FOOD_CAT_02",
                path_id, 1, city, district, cluster_id
            ))

            # 采集部分病例生成菌株分离 (有高度相似的 cgMLST)
            if i < 8:
                iso_id = f"ISO-2026-{outbreak_isolate_idx:04d}"
                outbreak_isolate_idx += 1
                # 变异位点差异 0 ~ 2 个，保证差异位点 Δ ≤ 3，属于同一克隆株暴发
                cg_vec = make_cgmlst_vector(seed, mutation_count=random.choice([0, 0, 1, 2]))
                molecular_rows.append((
                    iso_id, c_id, None, path_id, path_name, sero, pfge, st, cg_vec,
                    f"病例粪便标本-{i+1}", visit_dt.strftime("%Y-%m-%d"), city, district, 1, cluster_id
                ))

    # 3. 散发病例生成 (约 3,200 条覆盖全省 18 地市 2024~2026 年)
    occupations = ["职员", "工人", "农民", "学生", "退休人员", "个体商户", "学龄前儿童"]
    symptom_pool = [
        "急性水样腹泻、腹痛腹鸣", "恶心呕吐、发热乏力", "头晕剧痛、视物模糊、四肢无力",
        "腹泻稀水便伴脱水", "黏液便、里急后重", "发热38.5℃、食欲减退、上腹痛"
    ]
    dining_places = ["路边流动摊贩", "中小型餐馆", "单位职工食堂", "家庭聚餐", "农家乐外卖", "生鲜菜市场"]

    base_date = datetime(2024, 1, 1)
    end_date = datetime(2026, 8, 31)
    total_days = (end_date - base_date).days

    for case_no in range(1, 3201):
        c_id = f"CASE-SP-{case_no:05d}"
        city_code, city_name, districts = random.choice(HENAN_CITIES)
        district = random.choice(districts)

        # 随机日期
        day_offset = random.randint(0, total_days)
        visit_dt = base_date + timedelta(days=day_offset, hours=random.randint(8, 20))
        month = visit_dt.month

        # 夏秋季 (6~9月) 水产和沙门氏菌权重增大
        if month in [6, 7, 8, 9]:
            path_tuple = random.choices(PATHOGENS, weights=[0.40, 0.30, 0.05, 0.05, 0.10, 0.08, 0.02])[0]
        # 冬春季 (11~2月) 诺如病毒权重增大
        elif month in [11, 12, 1, 2]:
            path_tuple = random.choices(PATHOGENS, weights=[0.05, 0.15, 0.10, 0.45, 0.10, 0.12, 0.03])[0]
        else:
            path_tuple = random.choices(PATHOGENS, weights=[0.20, 0.30, 0.10, 0.15, 0.15, 0.08, 0.02])[0]

        path_id = path_tuple[0]
        path_name = path_tuple[1]
        food_cat = random.choice(FOOD_CATEGORIES)
        food_cat_id = food_cat[0]
        suspected_food_name = food_cat[1]

        onset_hours = random.uniform(2, 48)
        onset_dt = visit_dt - timedelta(hours=onset_hours)

        case_rows.append((
            c_id, f"患者_{case_no:04d}", random.choice(["男", "女"]),
            random.randint(2, 85), random.choice(occupations),
            random.choice(SENTINEL_HOSPITALS)[0],
            visit_dt.strftime("%Y-%m-%d"), onset_dt.strftime("%Y-%m-%d %H:%M:%S"),
            round(onset_hours, 1), random.choice(symptom_pool),
            random.choice(["水样便", "黄色稀便", "黏液血便", "正常成型便"]),
            random.choice(dining_places), suspected_food_name, food_cat_id,
            path_id, 1 if random.random() < 0.65 else 0, city_name, district, None
        ))

        # 每 8 个病例生成一个独立散发基因指纹
        if case_no % 8 == 0:
            iso_id = f"ISO-SP-{case_no:05d}"
            # 独立随机 seed，不具有同源聚类特征 (距离远)
            cg_vec = make_cgmlst_vector(random.randint(10000, 99999))
            molecular_rows.append((
                iso_id, c_id, None, path_id, path_name, random.choice(path_tuple[5]),
                f"PFGE-RAND-{case_no}", random.choice(path_tuple[6]), cg_vec,
                "门诊散发粪便样本", visit_dt.strftime("%Y-%m-%d"), city_name, district, 0, None
            ))

    # 4. 食品安全抽检采样事实 (约 1,200 条)
    sampling_rows = []
    for s_no in range(1, 1201):
        s_id = f"SMP-2026-{s_no:05d}"
        city_code, city_name, districts = random.choice(HENAN_CITIES)
        district = random.choice(districts)
        food_cat = random.choice(FOOD_CATEGORIES)
        s_date = (base_date + timedelta(days=random.randint(0, total_days))).strftime("%Y-%m-%d")
        stage = random.choice(["流通环节 (商超批发)", "餐饮服务环节 (餐馆食堂)", "生产加工环节 (食品企业)"])

        is_unqualified = random.random() < 0.08  # 8% 超标检出
        detected_p = None
        count_cfu = 0.0
        conclusion = "合格"
        std_limit = "不得检出"

        if is_unqualified:
            p_tuple = random.choice(PATHOGENS)
            detected_p = p_tuple[0]
            count_cfu = round(random.uniform(10, 1500), 1)
            conclusion = "不合格 (检出致病菌)"

        sampling_rows.append((
            s_id, f"{city_name}{district}_{food_cat[1]}抽查样",
            food_cat[0], s_date, stage, f"{district}某食品流通网点",
            city_name, district, detected_p, count_cfu, std_limit, conclusion
        ))

    # 批量入库
    cur.executemany("INSERT OR REPLACE INTO fact_foodborne_case VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", case_rows)
    cur.executemany("INSERT OR REPLACE INTO fact_pathogen_molecular VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", molecular_rows)
    cur.executemany("INSERT OR REPLACE INTO fact_food_sampling VALUES (?,?,?,?,?,?,?,?,?,?,?,?)", sampling_rows)

    conn.commit()
    conn.close()

    print(f"✅ 食源性监测数据集创建成功！")
    print(f"   - 数据库路径: {db_path}")
    print(f"   - 暴发事件数: {len(outbreaks)}")
    print(f"   - 病例事实数: {len(case_rows):,}")
    print(f"   - 分子图谱数: {len(molecular_rows):,}")
    print(f"   - 食品抽检数: {len(sampling_rows):,}")

if __name__ == "__main__":
    init_db(DB_PATH)
    generate_mock_data(DB_PATH)

    # 同步复制到底座 DataMock 目录
    if os.path.exists(DB_PATH):
        import shutil
        shutil.copy2(DB_PATH, DATAMOCK_DB_PATH)
        print(f"✅ 已同步至 DataMock 目录: {DATAMOCK_DB_PATH}")
