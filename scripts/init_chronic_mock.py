#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
================================================================================
河南省疾控中心 - 死因、慢病及伤害综合监测预警智能体 (Chronic Surveillance Mock Dataset)
================================================================================
生成逼真且符合《人工智能-四智能体-功能清单》（序号 59 ~ 76）的监测数据库：
1. dim_districts: 河南省 18 个地市、126 个区县人口学与地理空间底座
2. fact_death_registry: 8,500 条死因医学证明书、死因链与 ICD-10 编码
3. fact_chronic_cases: 12,000 条重大慢性病（高血压/糖尿病/心脑血管/肿瘤）随访队列
4. fact_injury_surveillance: 5,000 条哨点医院伤害就诊监测明细
5. fact_chronic_alerts: 预警信号与处置闭环事件
================================================================================
"""

import os
import sqlite3
import random
from datetime import datetime, timedelta

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "chronic_monitoring.db")
DATAMOCK_DIR = os.path.join(BASE_DIR, "../Agent-CdcBuddy-DataMock/data/chronic")

# 河南省 18 地级市及重点区县基准数据
HENAN_CITIES = {
    "郑州市": {
        "coords": [34.7466, 113.6253],
        "districts": ["金水区", "二七区", "中原区", "管城回族区", "惠济区", "巩义市", "荥阳市", "新密市", "新郑市", "登封市", "中牟县"],
        "population": 12600000
    },
    "开封市": {
        "coords": [34.7972, 114.3076],
        "districts": ["鼓楼区", "龙亭区", "顺河回族区", "禹王台区", "祥符区", "杞县", "通许县", "尉氏县", "兰考县"],
        "population": 4820000
    },
    "洛阳市": {
        "coords": [34.6185, 112.4540],
        "districts": ["涧西区", "西工区", "老城区", "瀍河回族区", "洛龙区", "孟津区", "偃师区", "新安县", "栾川县", "嵩县", "汝阳县", "宜阳县", "洛宁县", "伊川县"],
        "population": 7050000
    },
    "平顶山市": {
        "coords": [33.7661, 113.1928],
        "districts": ["新华区", "卫东区", "湛河区", "石龙区", "汝州市", "舞钢市", "鲁山县", "宝丰县", "叶县", "郏县"],
        "population": 4980000
    },
    "安阳市": {
        "coords": [36.0975, 114.3924],
        "districts": ["文峰区", "北关区", "殷都区", "龙安区", "林州市", "安阳县", "汤阴县", "滑县", "内黄县"],
        "population": 5470000
    },
    "鹤壁市": {
        "coords": [35.7482, 114.2978],
        "districts": ["淇滨区", "山城区", "鹤山区", "浚县", "淇县"],
        "population": 1560000
    },
    "新乡市": {
        "coords": [35.3030, 113.9268],
        "districts": ["卫滨区", "红旗区", "牧野区", "凤泉区", "卫辉市", "辉县市", "新乡县", "获嘉县", "原阳县", "延津县", "封丘县"],
        "population": 6250000
    },
    "焦作市": {
        "coords": [35.2159, 113.2418],
        "districts": ["解放区", "山阳区", "中站区", "马村区", "沁阳市", "孟州市", "修武县", "博爱县", "武陟县", "温县"],
        "population": 3520000
    },
    "濮阳市": {
        "coords": [35.7619, 115.0292],
        "districts": ["华龙区", "清丰县", "南乐县", "范县", "台前县", "濮阳县"],
        "population": 3770000
    },
    "许昌市": {
        "coords": [34.0355, 113.8526],
        "districts": ["魏都区", "建安区", "禹州市", "长葛市", "鄢陵县", "襄城县"],
        "population": 4380000
    },
    "漯河市": {
        "coords": [33.5814, 114.0165],
        "districts": ["源汇区", "郾城区", "召陵区", "舞阳县", "临颍县"],
        "population": 2360000
    },
    "三门峡市": {
        "coords": [34.7732, 111.1948],
        "districts": ["湖滨区", "陕州区", "义马市", "灵宝市", "渑池县", "卢氏县"],
        "population": 2030000
    },
    "南阳市": {
        "coords": [32.9908, 112.5283],
        "districts": ["宛城区", "卧龙区", "邓州市", "南召县", "方城县", "西峡县", "镇平县", "内乡县", "淅川县", "社旗县", "唐河县", "新野县", "桐柏县"],
        "population": 9710000
    },
    "商丘市": {
        "coords": [34.4140, 115.6564],
        "districts": ["梁园区", "睢阳区", "永城市", "民权县", "睢县", "宁陵县", "柘城县", "虞城县", "夏邑县"],
        "population": 7810000
    },
    "信阳市": {
        "coords": [32.1233, 114.0750],
        "districts": ["浉河区", "平桥区", "固始县", "罗山县", "光山县", "新县", "商城县", "潢川县", "淮滨县", "息县"],
        "population": 6230000
    },
    "周口市": {
        "coords": [33.6262, 114.6497],
        "districts": ["川汇区", "淮阳区", "项城市", "扶沟县", "西华县", "商水县", "沈丘县", "郸城县", "太康县", "鹿邑县"],
        "population": 9020000
    },
    "驻马店市": {
        "coords": [32.9774, 114.0247],
        "districts": ["驿城区", "西平县", "上蔡县", "平舆县", "正阳县", "确山县", "泌阳县", "汝南县", "遂平县", "新蔡县"],
        "population": 7000000
    },
    "济源市": {
        "coords": [35.0904, 112.5900],
        "districts": ["济源市直辖"],
        "population": 730000
    }
}

# 根本死因与 ICD-10 知识图谱典型死因链
CAUSE_TEMPLATES = [
    {
        "underlying_cause": "急性下壁心肌梗死",
        "icd10": "I21.1",
        "category": "心脑血管疾病",
        "chain": ("心源性休克", "心室颤动", "急性下壁心肌梗死", "冠状动脉粥样硬化性心脏病"),
        "weight": 25,
        "is_4q70": 1
    },
    {
        "underlying_cause": "急性大面积脑梗死",
        "icd10": "I63.9",
        "category": "心脑血管疾病",
        "chain": ("中枢性呼吸循环衰竭", "脑疝形成", "大面积大脑中动脉脑梗死", "颈动脉重度狭窄伴高血压"),
        "weight": 22,
        "is_4q70": 1
    },
    {
        "underlying_cause": "原发性支气管肺癌 (腺癌)",
        "icd10": "C34.9",
        "category": "恶性肿瘤",
        "chain": ("癌性恶病质与多器官功能衰竭", "双肺弥漫性转移伴呼吸衰竭", "右肺下叶浸润型肺腺癌", ""),
        "weight": 20,
        "is_4q70": 1
    },
    {
        "underlying_cause": "食管中下段鳞状细胞癌",
        "icd10": "C15.9",
        "category": "恶性肿瘤",
        "chain": ("失血性休克", "食管癌肿瘤破裂大出血", "食管中段溃疡浸润型鳞癌", ""),
        "weight": 14,
        "is_4q70": 1
    },
    {
        "underlying_cause": "慢性阻塞性肺疾病急性加重伴肺源性心脏病",
        "icd10": "J44.1",
        "category": "慢性呼吸系统疾病",
        "chain": ("慢性呼吸衰竭", "肺性脑病", "慢性肺源性心脏病急性加重", "慢性阻塞性肺疾病 (COPD)"),
        "weight": 12,
        "is_4q70": 1
    },
    {
        "underlying_cause": "2型糖尿病性重度肾病终末期",
        "icd10": "E11.2",
        "category": "糖尿病",
        "chain": ("高钾血症致心脏骤停", "尿毒症与重度代谢性酸中毒", "糖尿病肾病 V 期", "2型糖尿病伴微血管病变"),
        "weight": 10,
        "is_4q70": 1
    },
    {
        "underlying_cause": "阿尔茨海默病 (中晚期)",
        "icd10": "G30.9",
        "category": "神经退行性疾病",
        "chain": ("重症吸入性肺炎", "进食呛咳伴营养衰竭", "重度阿尔茨海默病", ""),
        "weight": 6,
        "is_4q70": 0
    },
    {
        "underlying_cause": "老年性骨质疏松居家跌倒致硬膜下血肿",
        "icd10": "V01.1",
        "category": "伤害/意外",
        "chain": ("中枢性呼吸骤停", "急性重型颅内血肿伴脑疝", "湿滑地面滑倒头部撞击", "重度骨质疏松"),
        "weight": 8,
        "is_4q70": 0
    },
    {
        "underlying_cause": "散发型克雅氏病 (Creutzfeldt-Jakob Disease)",
        "icd10": "A81.0",
        "category": "罕见死因",
        "chain": ("进行性脑皮质萎缩中枢衰竭", "肌阵挛与无动性缄默", "散发型克雅氏病", ""),
        "weight": 1,
        "is_4q70": 0
    }
]

def init_chronic_database():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cur.execute("PRAGMA synchronous = OFF;")
    cur.execute("PRAGMA journal_mode = MEMORY;")

    # 1. 区域维度表
    cur.execute("""
    CREATE TABLE IF NOT EXISTS dim_districts (
        district_id INTEGER PRIMARY KEY AUTOINCREMENT,
        city VARCHAR(32) NOT NULL,
        district VARCHAR(32) NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        population INTEGER NOT NULL
    );
    """)

    # 2. 死亡医学证明书与死因登记主表
    cur.execute("""
    CREATE TABLE IF NOT EXISTS fact_death_registry (
        death_cert_id VARCHAR(64) PRIMARY KEY,
        patient_name VARCHAR(32) NOT NULL,
        gender VARCHAR(8) NOT NULL,
        age INTEGER NOT NULL,
        city VARCHAR(32) NOT NULL,
        district VARCHAR(32) NOT NULL,
        death_date DATE NOT NULL,
        cause_chain_a VARCHAR(128) NOT NULL, -- 直接导致死亡的疾病或情况
        cause_chain_b VARCHAR(128),         -- 引起 a 的疾病
        cause_chain_c VARCHAR(128),         -- 引起 b 的疾病
        cause_chain_d VARCHAR(128),         -- 引起 c 的疾病
        underlying_cause VARCHAR(128) NOT NULL, -- 根本死因
        icd10_code VARCHAR(16) NOT NULL,    -- ICD-10 编码
        icd10_category VARCHAR(64) NOT NULL, -- 死因大类
        ypll INTEGER NOT NULL,              -- 潜在减寿年数 (75 - age, >=0)
        is_premature_death_4q70 INTEGER NOT NULL, -- 30~70岁重大慢病早死标志 (1/0)
        qc_status VARCHAR(32) NOT NULL      -- VALID, LOGIC_CONFLICT, SUSPECTED_CLUSTER
    );
    """)

    # 3. 慢性病随访与高危队列事实表
    cur.execute("""
    CREATE TABLE IF NOT EXISTS fact_chronic_cases (
        case_id VARCHAR(64) PRIMARY KEY,
        patient_name VARCHAR(32) NOT NULL,
        gender VARCHAR(8) NOT NULL,
        age INTEGER NOT NULL,
        city VARCHAR(32) NOT NULL,
        district VARCHAR(32) NOT NULL,
        disease_name VARCHAR(64) NOT NULL,
        diagnosed_date DATE NOT NULL,
        blood_pressure_systolic INTEGER NOT NULL,
        blood_pressure_diastolic INTEGER NOT NULL,
        fasting_glucose REAL NOT NULL,
        bmi REAL NOT NULL,
        smoking_status VARCHAR(16) NOT NULL,
        family_history VARCHAR(64),
        complications VARCHAR(128),
        cardiovascular_10yr_risk REAL NOT NULL, -- 10年心脑血管发病风险 (0-1)
        screening_roi REAL NOT NULL            -- 筛查成本效果比 (ROI)
    );
    """)

    # 4. 伤害监测事实表
    cur.execute("""
    CREATE TABLE IF NOT EXISTS fact_injury_surveillance (
        injury_id VARCHAR(64) PRIMARY KEY,
        patient_name VARCHAR(32) NOT NULL,
        gender VARCHAR(8) NOT NULL,
        age INTEGER NOT NULL,
        city VARCHAR(32) NOT NULL,
        district VARCHAR(32) NOT NULL,
        injury_time DATETIME NOT NULL,
        injury_place VARCHAR(64) NOT NULL,
        injury_type VARCHAR(64) NOT NULL,
        injury_cause_factor VARCHAR(128) NOT NULL,
        injury_severity VARCHAR(16) NOT NULL, -- 轻度, 中度, 重度, 死亡
        is_cluster INTEGER NOT NULL           -- 1/0 聚集性伤害
    );
    """)

    # 5. 慢病死因综合预警事件表
    cur.execute("""
    CREATE TABLE IF NOT EXISTS fact_chronic_alerts (
        alert_id VARCHAR(64) PRIMARY KEY,
        title VARCHAR(256) NOT NULL,
        level VARCHAR(16) NOT NULL, -- yellow, orange, red
        category VARCHAR(64) NOT NULL,
        city VARCHAR(32) NOT NULL,
        district VARCHAR(32) NOT NULL,
        trigger_reason TEXT NOT NULL,
        metrics_value REAL NOT NULL,
        threshold REAL NOT NULL,
        status VARCHAR(16) NOT NULL, -- active, resolved
        created_at DATETIME NOT NULL
    );
    """)

    # 清空旧数据
    cur.execute("DELETE FROM dim_districts;")
    cur.execute("DELETE FROM fact_death_registry;")
    cur.execute("DELETE FROM fact_chronic_cases;")
    cur.execute("DELETE FROM fact_injury_surveillance;")
    cur.execute("DELETE FROM fact_chronic_alerts;")

    # 插入区县维度
    dist_records = []
    for city, info in HENAN_CITIES.items():
        base_lat, base_lon = info["coords"]
        d_pop = int(info["population"] / len(info["districts"]))
        for dist in info["districts"]:
            offset_lat = (random.random() - 0.5) * 0.4
            offset_lon = (random.random() - 0.5) * 0.4
            dist_records.append((
                city, dist, round(base_lat + offset_lat, 4), round(base_lon + offset_lon, 4), d_pop
            ))
    cur.executemany("INSERT INTO dim_districts (city, district, latitude, longitude, population) VALUES (?, ?, ?, ?, ?)", dist_records)

    # 构造姓名库
    SURNAMES = ["张", "王", "李", "赵", "刘", "陈", "杨", "黄", "吴", "周", "徐", "孙", "马", "朱", "胡", "郭", "何", "高", "林", "郑"]
    NAMES = ["伟", "芳", "娜", "秀英", "敏", "静", "丽", "强", "磊", "军", "洋", "勇", "艳", "杰", "娟", "涛", "明", "超", "建平", "建华"]

    # 1. 生成 8,500 条死因医学证明书数据
    print(">>> 正在生成 8,500 条死因医学证明书记录...")
    death_records = []
    start_date = datetime(2024, 1, 1)

    # 提取权重
    tpl_weights = [t["weight"] for t in CAUSE_TEMPLATES]

    # 特殊预设：郑州市金水区 3 例罕见病克雅氏病 (A81.0) 聚集事件
    for i in range(3):
        c_date = datetime(2026, 8, 15) + timedelta(days=i * 2)
        death_records.append((
            f"CERT-2026-RARE-{100 + i}",
            f"{random.choice(SURNAMES)}{random.choice(NAMES)}",
            "男" if i % 2 == 0 else "女",
            58 + i * 2,
            "郑州市",
            "金水区",
            c_date.strftime("%Y-%m-%d"),
            "进行性脑皮质萎缩中枢衰竭",
            "肌阵挛与无动性缄默",
            "散发型克雅氏病",
            "",
            "散发型克雅氏病 (Creutzfeldt-Jakob Disease)",
            "A81.0",
            "罕见死因",
            75 - (58 + i * 2),
            0,
            "SUSPECTED_CLUSTER"
        ))

    # 特殊预设：逻辑冲突记录 (检验 No. 59 数据质量校验检出率)
    # 冲突1: 男性 宫颈癌
    death_records.append((
        "CERT-2026-ERR-001", "张建国", "男", 56, "洛阳市", "涧西区", "2026-08-10",
        "癌性恶病质", "广泛性盆腔浸润转移", "宫颈浸润性鳞状细胞癌", "",
        "宫颈恶性肿瘤", "C53.9", "恶性肿瘤", 19, 1, "LOGIC_CONFLICT"
    ))
    # 冲突2: 5岁幼童 阿尔茨海默病
    death_records.append((
        "CERT-2026-ERR-002", "李小明", "男", 5, "新乡市", "原阳县", "2026-08-12",
        "吸入性肺炎", "吞咽障碍", "重度阿尔茨海默病老年痴呆", "",
        "阿尔茨海默病", "G30.9", "神经退行性疾病", 70, 0, "LOGIC_CONFLICT"
    ))

    for i in range(8500 - len(death_records)):
        tpl = random.choices(CAUSE_TEMPLATES, weights=tpl_weights, k=1)[0]
        # 年龄分布：慢病死因多在 45~88 岁之间
        age = int(random.gauss(71, 12))
        age = max(18, min(98, age))
        gender = "男" if random.random() < 0.54 else "女"
        
        city = random.choice(list(HENAN_CITIES.keys()))
        dist = random.choice(HENAN_CITIES[city]["districts"])
        delta_days = random.randint(0, 950)
        d_date = (start_date + timedelta(days=delta_days)).strftime("%Y-%m-%d")

        ypll = max(0, 75 - age)
        is_4q70 = 1 if (30 <= age < 70 and tpl["is_4q70"] == 1) else 0

        death_records.append((
            f"CERT-2026-{10000 + i}",
            f"{random.choice(SURNAMES)}{random.choice(NAMES)}",
            gender,
            age,
            city,
            dist,
            d_date,
            tpl["chain"][0],
            tpl["chain"][1],
            tpl["chain"][2],
            tpl["chain"][3],
            tpl["underlying_cause"],
            tpl["icd10"],
            tpl["category"],
            ypll,
            is_4q70,
            "VALID"
        ))

    cur.executemany("""
    INSERT INTO fact_death_registry (
        death_cert_id, patient_name, gender, age, city, district, death_date,
        cause_chain_a, cause_chain_b, cause_chain_c, cause_chain_d,
        underlying_cause, icd10_code, icd10_category, ypll, is_premature_death_4q70, qc_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, death_records)

    # 2. 生成 12,000 条慢性病随访队列记录
    print(">>> 正在生成 12,000 条慢性病随访与高危人群队列记录...")
    chronic_records = []
    DISEASES = [
        {"name": "原发性高血压 3级 (很高危)", "prob": 0.35, "comp": ["冠心病", "脑梗死", "高血压性心脏病"]},
        {"name": "2型糖尿病", "prob": 0.28, "comp": ["糖尿病视网膜病变", "糖尿病周围神经病变", "糖尿病肾病"]},
        {"name": "冠状动脉粥样硬化性心脏病", "prob": 0.20, "comp": ["心绞痛", "陈旧性心肌梗死", "慢性心功能不全"]},
        {"name": "脑卒中 (恢复期/后遗症期)", "prob": 0.12, "comp": ["偏瘫", "血管性认知障碍", "吞咽障碍"]},
        {"name": "原发性支气管肺癌 (高危随访)", "prob": 0.05, "comp": ["局部淋巴结肿大", "肺部感染"]}
    ]
    dis_weights = [d["prob"] for d in DISEASES]

    for i in range(12000):
        dis_info = random.choices(DISEASES, weights=dis_weights, k=1)[0]
        age = int(random.gauss(62, 10))
        age = max(30, min(86, age))
        gender = "男" if random.random() < 0.52 else "女"
        city = random.choice(list(HENAN_CITIES.keys()))
        dist = random.choice(HENAN_CITIES[city]["districts"])

        sbp = random.randint(118, 185)
        dbp = random.randint(72, 115)
        glu = round(random.uniform(4.8, 14.5), 1)
        bmi = round(random.uniform(19.5, 33.2), 1)
        smoke = random.choice(["吸烟 (≥20支/天)", "偶有吸烟", "已戒烟", "从不吸烟"])
        fam = random.choice(["直系亲属心梗早发史", "直系亲属高血压病史", "无明显家族遗传史", "直系亲属恶性肿瘤史"])
        
        # 10年心脑血管发病风险 (China-PAR 风险模型模拟)
        cvd_risk = round(min(0.65, max(0.03, (sbp - 110) * 0.003 + (bmi - 22) * 0.01 + (age - 40) * 0.006 + (0.08 if "≥20支" in smoke else 0))), 3)
        screening_roi = round(random.uniform(2.4, 6.8), 2)
        comp = random.choice(dis_info["comp"]) if random.random() < 0.45 else "暂无严重靶器官损害"

        diag_date = (start_date + timedelta(days=random.randint(0, 950))).strftime("%Y-%m-%d")

        chronic_records.append((
            f"CHR-2026-{100000 + i}",
            f"{random.choice(SURNAMES)}{random.choice(NAMES)}",
            gender,
            age,
            city,
            dist,
            dis_info["name"],
            diag_date,
            sbp,
            dbp,
            glu,
            bmi,
            smoke,
            fam,
            comp,
            cvd_risk,
            screening_roi
        ))

    cur.executemany("""
    INSERT INTO fact_chronic_cases (
        case_id, patient_name, gender, age, city, district, disease_name, diagnosed_date,
        blood_pressure_systolic, blood_pressure_diastolic, fasting_glucose, bmi,
        smoking_status, family_history, complications, cardiovascular_10yr_risk, screening_roi
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, chronic_records)

    # 3. 生成 5,000 条伤害监测事实记录
    print(">>> 正在生成 5,000 条门诊伤害哨点监测记录...")
    injury_records = []
    INJURY_PROFILES = [
        {
            "type": "老年人跌倒/跌落",
            "places": ["家庭卫生间/浴室", "小区步道绿化带", "农贸集市湿滑阶梯"],
            "factors": ["地面湿滑未铺防滑垫", "体位性低血压头晕", "视力障碍与光线昏暗", "未配置无障碍扶手"],
            "age_range": (65, 92),
            "severity": ["中度 (骨折)", "重度 (颅脑创伤)", "轻度 (软组织挫伤)"]
        },
        {
            "type": "道路交通伤害",
            "places": ["城乡结合部公路干道", "中小学校上下学路口", "非机动车道交叉口"],
            "factors": ["骑乘电动车未佩戴安全头盔", "超速抢行红绿灯", "大型货车盲区碰撞", "逆向行驶"],
            "age_range": (8, 62),
            "severity": ["重度 (多发创伤)", "中度 (下肢骨折)", "轻度 (擦伤挫伤)"]
        },
        {
            "type": "机械切割/冲压伤害",
            "places": ["农村农田收割作业区", "乡镇小型五金加工厂", "建筑工地木工作业间"],
            "factors": ["未按规范佩戴防护手套与面罩", "安全联锁防护装置私自拆除", "疲劳高负荷操作农机", "机械绞碾衣物卷入"],
            "age_range": (22, 60),
            "severity": ["重度 (断指/撕脱伤)", "中度 (深部裂伤)", "轻度 (皮下血肿)"]
        },
        {
            "type": "非职业性一氧化碳中毒",
            "places": ["农村密闭燃煤取暖平房", "老旧住宅燃气热水器浴室", "炭火餐饮包厢"],
            "factors": ["烟道堵塞排烟不畅", "未安装一氧化碳声光报警器", "门窗密闭通风严重不良"],
            "age_range": (12, 75),
            "severity": ["重度 (缺氧昏迷)", "中度 (头晕恶心)", "死亡"]
        }
    ]

    # 特殊预设：平顶山郏县某乡镇机械伤害短期聚集事件 (5起)
    for i in range(5):
        i_time = datetime(2026, 8, 18, 9, 30) + timedelta(hours=i * 3)
        injury_records.append((
            f"INJ-2026-CLUS-{200 + i}",
            f"{random.choice(SURNAMES)}{random.choice(NAMES)}",
            "男",
            46 + i,
            "平顶山市",
            "郏县",
            i_time.strftime("%Y-%m-%d %H:%M:%S"),
            "乡镇农机联合收割合作社",
            "机械切割/冲压伤害",
            "玉米收割机摘穗辊异物卡死未停机人工清理",
            "重度 (机械绞碾上肢撕脱伤)",
            1
        ))

    for i in range(5000 - len(injury_records)):
        prof = random.choice(INJURY_PROFILES)
        age = random.randint(prof["age_range"][0], prof["age_range"][1])
        gender = "男" if random.random() < 0.58 else "女"
        city = random.choice(list(HENAN_CITIES.keys()))
        dist = random.choice(HENAN_CITIES[city]["districts"])
        i_place = random.choice(prof["places"])
        i_factor = random.choice(prof["factors"])
        i_sev = random.choice(prof["severity"])
        
        i_time = start_date + timedelta(days=random.randint(0, 950), hours=random.randint(0, 23), minutes=random.randint(0, 59))
        injury_records.append((
            f"INJ-2026-{10000 + i}",
            f"{random.choice(SURNAMES)}{random.choice(NAMES)}",
            gender,
            age,
            city,
            dist,
            i_time.strftime("%Y-%m-%d %H:%M:%S"),
            i_place,
            prof["type"],
            i_factor,
            i_sev,
            0
        ))

    cur.executemany("""
    INSERT INTO fact_injury_surveillance (
        injury_id, patient_name, gender, age, city, district, injury_time,
        injury_place, injury_type, injury_cause_factor, injury_severity, is_cluster
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, injury_records)

    # 4. 生成慢病与死因预警闭环事件
    print(">>> 正在生成预警与处置闭环记录...")
    alerts = [
        (
            "ALERT-CHR-202608-01",
            "郑州市金水区 罕见死因散发型克雅氏病疑似聚集预警",
            "red",
            "罕见死因",
            "郑州市",
            "金水区",
            "金水区近两周内连续报告 3 例临床确诊散发型克雅氏病 (A81.0)，达到罕见死因聚集触发阈值 (≥3例)。",
            3.0,
            3.0,
            "active",
            "2026-08-19 14:00:00"
        ),
        (
            "ALERT-CHR-202608-02",
            "平顶山市郏县 农机联合收割作业重度机械伤害聚集预警",
            "orange",
            "伤害防制",
            "平顶山市",
            "郏县",
            "秋收作业期间连续发生 5 起玉米收割机摘穗辊绞碾重度创伤，诱因多为带电清理异物。",
            5.0,
            5.0,
            "active",
            "2026-08-20 18:30:00"
        ),
        (
            "ALERT-CHR-202608-03",
            "安阳市林州市 食管癌 30~70 岁重大慢病早死率超标预警",
            "yellow",
            "肿瘤防制",
            "安阳市",
            "林州市",
            "林州市 30~70 岁恶性肿瘤过早死亡概率达 18.6% (全省基线 13.8%)，需强化内镜早癌筛查下沉。",
            18.6,
            13.8,
            "resolved",
            "2026-08-12 10:00:00"
        )
    ]
    cur.executemany("""
    INSERT INTO fact_chronic_alerts (
        alert_id, title, level, category, city, district, trigger_reason,
        metrics_value, threshold, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, alerts)

    conn.commit()
    conn.close()

    # 同步只读镜像至 DataMock
    os.makedirs(DATAMOCK_DIR, exist_ok=True)
    mock_target = os.path.join(DATAMOCK_DIR, "chronic_monitoring.db")
    import shutil
    shutil.copyfile(DB_PATH, mock_target)
    print(f"✅ 成功初始化并写入 {DB_PATH}")
    print(f"✅ 成功同步至只读数据底座: {mock_target}")

if __name__ == "__main__":
    init_chronic_database()
