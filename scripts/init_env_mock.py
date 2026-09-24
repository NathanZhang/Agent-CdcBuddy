#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
================================================================================
河南省疾病预防控制中心 - 环境相关风险因素监测预警模拟数据集生成器
(Environmental Health Risk Surveillance Mock Dataset Generator)
================================================================================
依据《人工智能-四智能体-功能清单》（序号 42 ~ 58）：
1. 饮用水全流程水质监测事实表 (fact_water_monitoring, 涵盖出厂水/末梢水/二次供水, GB 5749 指标)
2. 污水病原时序监测与反向溯源事实表 (fact_sewage_monitoring, 诺如/新冠浓度与哨点门诊关联)
3. 空气质量与极端天气健康暴露事实表 (fact_air_climate_monitoring, PM2.5/O3/热浪与脆弱人群门诊)
4. 四河流域跨介质重金属污染事实表 (fact_river_basin_monitoring, 水-土-粮跨介质链条与自相关)
5. 公共场所卫生监测与评级事实表 (fact_public_venue_inspection)
6. 环境健康预警触发与闭环事件表 (fact_env_alerts)
7. 维度字典表 (dim_env_stations, dim_river_basins, dim_venue_types)
================================================================================
"""

import os
import sys
import sqlite3
import random
import json
from datetime import datetime, timedelta

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "env_monitoring.db")
DATAMOCK_DIR = os.path.abspath(os.path.join(BASE_DIR, "../Agent-CdcBuddy-DataMock/data/env"))
os.makedirs(DATAMOCK_DIR, exist_ok=True)
DATAMOCK_DB_PATH = os.path.join(DATAMOCK_DIR, "env_monitoring.db")

HENAN_CITIES = [
    ("410100", "郑州市", ["金水区", "二七区", "中原区", "管城回族区", "惠济区", "中牟县", "巩义市", "新郑市", "新密市", "登封市", "荥阳市"], 34.757, 113.665),
    ("410200", "开封市", ["鼓楼区", "龙亭区", "顺河回族区", "禹王台区", "祥符区", "杞县", "通许县", "尉氏县", "兰考县"], 34.797, 114.307),
    ("410300", "洛阳市", ["洛龙区", "涧西区", "西工区", "老城区", "瀍河回族区", "偃师区", "孟津区", "新安县", "栾川县", "嵩县", "汝阳县", "宜阳县", "洛宁县", "伊川县"], 34.618, 112.454),
    ("410400", "平顶山市", ["新华区", "卫东区", "石龙区", "湛河区", "汝州市", "舞钢市", "鲁山县", "宝丰县", "叶县", "郏县"], 33.735, 113.300),
    ("410500", "安阳市", ["文峰区", "北关区", "殷都区", "龙安区", "林州市", "安阳县", "汤阴县", "滑县", "内黄县"], 36.099, 114.393),
    ("410600", "鹤壁市", ["淇滨区", "山城区", "鹤山区", "浚县", "淇县"], 35.748, 114.295),
    ("410700", "新乡市", ["卫滨区", "红旗区", "凤泉区", "牧野区", "卫辉市", "辉县市", "新乡县", "获嘉县", "原阳县", "延津县", "封丘县"], 35.303, 113.926),
    ("410800", "焦作市", ["解放区", "中站区", "马村区", "山阳区", "沁阳市", "孟州市", "修武县", "博爱县", "武陟县", "温县"], 35.215, 113.242),
    ("410900", "濮阳市", ["华龙区", "清丰县", "南乐县", "范县", "台前县", "濮阳县"], 35.761, 115.041),
    ("411000", "许昌市", ["魏都区", "建安区", "禹州市", "长葛市", "鄢陵县", "襄城县"], 34.035, 113.826),
    ("411100", "漯河市", ["源汇区", "郾城区", "召陵区", "舞阳县", "临颍县"], 33.581, 114.026),
    ("411200", "三门峡市", ["湖滨区", "陕州区", "义马市", "灵宝市", "渑池县", "卢氏县"], 34.773, 111.194),
    ("411300", "南阳市", ["宛城区", "卧龙区", "邓州市", "南召县", "方城县", "西峡县", "镇平县", "内乡县", "淅川县", "社旗县", "唐河县", "新野县", "桐柏县"], 32.990, 112.528),
    ("411400", "商丘市", ["梁园区", "睢阳区", "永城市", "民权县", "睢县", "宁陵县", "柘城县", "虞城县", "夏邑县"], 34.414, 115.656),
    ("411500", "信阳市", ["浉河区", "平桥区", "固始县", "罗山县", "光山县", "新县", "商城县", "潢川县", "淮滨县", "息县"], 32.123, 114.075),
    ("411600", "周口市", ["川汇区", "淮阳区", "项城市", "扶沟县", "西华县", "商水县", "沈丘县", "郸城县", "太康县", "鹿邑县"], 33.625, 114.649),
    ("411700", "驻马店市", ["驿城区", "新蔡县", "西平县", "上蔡县", "平舆县", "正阳县", "确山县", "泌阳县", "汝南县", "遂平县"], 32.979, 114.024),
    ("419001", "济源市", ["济源产城融合示范区"], 35.090, 112.590)
]

RIVER_BASINS = [
    ("BASIN_01", "黄河流域河南段", ["三门峡市", "洛阳市", "济源市", "焦作市", "郑州市", "新乡市", "开封市", "濮阳市"]),
    ("BASIN_02", "淮河干支流域", ["信阳市", "南阳市", "驻马店市", "周口市", "漯河市", "许昌市", "商丘市", "平顶山市"]),
    ("BASIN_03", "海河流域卫河水系", ["安阳市", "鹤壁市", "新乡市", "焦作市", "濮阳市"]),
    ("BASIN_04", "长江汉江支流流域", ["南阳市", "洛阳市", "三门峡市"])
]

def init_database(db_conn: sqlite3.Connection):
    cur = db_conn.cursor()
    cur.execute("PRAGMA foreign_keys = ON")

    # 1. 监测站点与点位表
    cur.execute("""
    CREATE TABLE IF NOT EXISTS dim_env_stations (
        station_id VARCHAR(64) PRIMARY KEY,
        station_name VARCHAR(128) NOT NULL,
        station_type VARCHAR(32) NOT NULL, -- water_plant, water_pipe, sewage_plant, air_station, river_section
        city VARCHAR(32) NOT NULL,
        district VARCHAR(32) NOT NULL,
        address VARCHAR(256),
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        coverage_population INTEGER,
        created_at DATETIME NOT NULL
    );
    """)

    # 2. 饮用水全流程水质监测事实表
    cur.execute("""
    CREATE TABLE IF NOT EXISTS fact_water_monitoring (
        record_id VARCHAR(64) PRIMARY KEY,
        station_id VARCHAR(64),
        city VARCHAR(32) NOT NULL,
        district VARCHAR(32) NOT NULL,
        water_source VARCHAR(64), -- 水库水, 地下水, 江河水
        sample_type VARCHAR(32) NOT NULL, -- 出厂水, 管网末梢水, 二次供水, 农村集中供水
        disinfection_method VARCHAR(32), -- 次氯酸钠, 二氧化氯, 臭氧活性炭, 紫外线
        turbidity REAL, -- 浑浊度 NTU (限值 1.0)
        free_chlorine REAL, -- 游离氯 mg/L (0.05 - 2.0)
        cod_mn REAL, -- 耗氧量(高锰酸盐指数) mg/L (限值 3.0)
        total_coliforms REAL, -- 总大肠菌群 CFU/100mL (限值 未检出 0)
        bacterial_count REAL, -- 菌落总数 CFU/mL (限值 100)
        lead_val REAL, -- 铅 mg/L (限值 0.01)
        cadmium_val REAL, -- 镉 mg/L (限值 0.005)
        arsenic_val REAL, -- 砷 mg/L (限值 0.01)
        fluoride_val REAL, -- 氟化物 mg/L (限值 1.0)
        chloroform_val REAL, -- 三氯甲烷 mg/L (限值 0.06)
        is_standard_met INTEGER NOT NULL, -- 1 达标, 0 超标
        exceeded_indexes VARCHAR(256),
        carcinogenic_risk REAL, -- 致癌健康风险 (10^-6)
        hazard_quotient REAL, -- 非致癌危害商值 (HQ)
        monitoring_date DATE NOT NULL,
        FOREIGN KEY (station_id) REFERENCES dim_env_stations(station_id)
    );
    """)

    # 3. 污水病原时序监测与管网溯源表
    cur.execute("""
    CREATE TABLE IF NOT EXISTS fact_sewage_monitoring (
        record_id VARCHAR(64) PRIMARY KEY,
        plant_id VARCHAR(64),
        plant_name VARCHAR(128) NOT NULL,
        city VARCHAR(32) NOT NULL,
        district VARCHAR(32) NOT NULL,
        drainage_zone VARCHAR(64) NOT NULL, -- 排水分区
        daily_flow_m3 REAL NOT NULL,
        sars_cov2_copies_l REAL NOT NULL, -- 拷贝数/L
        norovirus_copies_l REAL NOT NULL, -- 诺如病毒拷贝数/L
        enterovirus_copies_l REAL NOT NULL, -- 肠道病毒拷贝数/L
        sentinel_hospital_cases INTEGER NOT NULL, -- 对应哨点医院门诊量
        lag_days_corr REAL, -- 滞后关联系数
        trace_suspected_subzone VARCHAR(64), -- 溯源嫌疑汇水子区
        alert_level VARCHAR(16) NOT NULL, -- normal, yellow, orange, red
        monitoring_date DATE NOT NULL
    );
    """)

    # 4. 空气质量与极端气候健康暴露事实表
    cur.execute("""
    CREATE TABLE IF NOT EXISTS fact_air_climate_monitoring (
        record_id VARCHAR(64) PRIMARY KEY,
        station_id VARCHAR(64),
        city VARCHAR(32) NOT NULL,
        district VARCHAR(32) NOT NULL,
        date DATE NOT NULL,
        pm25 REAL NOT NULL,
        pm10 REAL NOT NULL,
        o3_8h REAL NOT NULL,
        no2 REAL NOT NULL,
        so2 REAL NOT NULL,
        co REAL NOT NULL,
        aqi INTEGER NOT NULL,
        air_quality_level VARCHAR(16) NOT NULL, -- 优, 良, 轻度污染, 中度污染, 重度污染, 严重污染
        temp_max REAL NOT NULL,
        temp_min REAL NOT NULL,
        humidity_avg REAL NOT NULL,
        extreme_weather_flag VARCHAR(32), -- 正常, 极端高温热浪, 强寒潮降温, 重污染天气
        pediatric_resp_outpatient INTEGER NOT NULL, -- 儿童呼吸系统日门诊量
        elderly_cardio_outpatient INTEGER NOT NULL, -- 老年心脑血管日门诊量
        lag_risk_relative REAL NOT NULL, -- DLNM 相对危险度 RR
        early_warning_issued INTEGER DEFAULT 0
    );
    """)

    # 5. 四河流域跨介质重金属污染事实表
    cur.execute("""
    CREATE TABLE IF NOT EXISTS fact_river_basin_monitoring (
        record_id VARCHAR(64) PRIMARY KEY,
        basin_id VARCHAR(32) NOT NULL,
        basin_name VARCHAR(64) NOT NULL,
        section_name VARCHAR(128) NOT NULL,
        city VARCHAR(32) NOT NULL,
        district VARCHAR(32) NOT NULL,
        water_pb REAL NOT NULL, -- 地表水铅 mg/L (标准 0.05)
        water_cd REAL NOT NULL, -- 地表水镉 mg/L (标准 0.005)
        soil_cd REAL NOT NULL,  -- 灌溉农田土壤镉 mg/kg (标准 0.3)
        crop_pb REAL NOT NULL,  -- 小麦/粮食铅残留 mg/kg (标准 0.2)
        enrichment_factor REAL NOT NULL, -- 跨介质生物富集系数
        spatial_autocorr_cluster VARCHAR(16) NOT NULL, -- High-High (高高集聚), Low-Low, High-Low, Low-High
        hepatic_cancer_incidence REAL NOT NULL, -- 区域消化/肝癌发病率(1/10万)
        monitoring_date DATE NOT NULL
    );
    """)

    # 6. 公共场所卫生监测与评级事实表
    cur.execute("""
    CREATE TABLE IF NOT EXISTS fact_public_venue_inspection (
        venue_id VARCHAR(64) PRIMARY KEY,
        venue_name VARCHAR(128) NOT NULL,
        venue_type VARCHAR(32) NOT NULL, -- 游泳场所, 快捷宾馆, 星级酒店, 候车场所, 沐浴场所
        city VARCHAR(32) NOT NULL,
        district VARCHAR(32) NOT NULL,
        chlorine_residual REAL, -- 游离性余氯 mg/L (游泳池: 0.3~1.0)
        coliform_detected INTEGER, -- 大肠菌群检出
        microclimate_score REAL NOT NULL, -- 微小气候与新风评分
        hygiene_manage_score REAL NOT NULL, -- 卫生管理量化评分 (0-100)
        dynamic_rating VARCHAR(8) NOT NULL, -- A级, B级, C级
        inspection_date DATE NOT NULL
    );
    """)

    # 7. 环境健康风险预警闭环事件表
    cur.execute("""
    CREATE TABLE IF NOT EXISTS fact_env_alerts (
        alert_id VARCHAR(64) PRIMARY KEY,
        title VARCHAR(256) NOT NULL,
        level VARCHAR(16) NOT NULL, -- yellow, orange, red
        category VARCHAR(32) NOT NULL, -- 饮用水水质, 大气暴露, 污水病原, 流域重金属, 公共卫生
        city VARCHAR(32) NOT NULL,
        district VARCHAR(32) NOT NULL,
        address VARCHAR(256),
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        trigger_reason TEXT NOT NULL,
        current_value VARCHAR(64) NOT NULL,
        threshold_value VARCHAR(64) NOT NULL,
        affected_population INTEGER,
        disposal_suggestion TEXT NOT NULL,
        status VARCHAR(16) NOT NULL, -- pending, in_progress, resolved
        resolved_date DATETIME,
        created_at DATETIME NOT NULL
    );
    """)

    # 创建索引
    cur.execute("CREATE INDEX IF NOT EXISTS idx_water_city_date ON fact_water_monitoring(city, district, monitoring_date);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_sewage_city_date ON fact_sewage_monitoring(city, monitoring_date);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_air_city_date ON fact_air_climate_monitoring(city, date);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_river_basin_city ON fact_river_basin_monitoring(basin_id, city);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_venue_city_rating ON fact_public_venue_inspection(city, dynamic_rating);")

    db_conn.commit()

def generate_mock_data(db_conn: sqlite3.Connection):
    cur = db_conn.cursor()
    print(">>> 正在生成环境健康风险监测全量底座数据...")

    stations = []
    # 1. 生成站点 dim_env_stations (约 180 个地标重点监测点)
    station_idx = 1
    for city_code, city_name, districts, c_lat, c_lon in HENAN_CITIES:
        for dist in districts:
            # 水厂
            s_id = f"STN-WTR-{station_idx:04d}"
            lat = c_lat + random.uniform(-0.15, 0.15)
            lon = c_lon + random.uniform(-0.15, 0.15)
            stations.append((s_id, f"{city_name}{dist}第一给水净化厂", "water_plant", city_name, dist, f"{city_name}{dist}迎宾大道88号", lat, lon, random.randint(30000, 250000), "2024-01-01 00:00:00"))
            station_idx += 1

            # 污水厂
            s_id2 = f"STN-SWG-{station_idx:04d}"
            stations.append((s_id2, f"{city_name}{dist}城市污水处理与生态循环厂", "sewage_plant", city_name, dist, f"{city_name}{dist}滨河西路6号", lat - 0.02, lon + 0.02, random.randint(50000, 300000), "2024-01-01 00:00:00"))
            station_idx += 1

            # 空气国控/省控站
            s_id3 = f"STN-AIR-{station_idx:04d}"
            stations.append((s_id3, f"{city_name}{dist}环境空气自动监测站", "air_station", city_name, dist, f"{city_name}{dist}政和路1号楼顶", lat + 0.01, lon - 0.01, random.randint(20000, 150000), "2024-01-01 00:00:00"))
            station_idx += 1

    cur.executemany("INSERT OR REPLACE INTO dim_env_stations VALUES (?,?,?,?,?,?,?,?,?,?)", stations)
    print(f"  [1/6] 成功初始化 dim_env_stations: {len(stations)} 个环境监测站点")

    # 2. 生成水质监测数据 fact_water_monitoring (近2年约 12,000 条记录)
    water_records = []
    w_idx = 1
    start_date = datetime(2024, 1, 1)
    end_date = datetime(2026, 8, 31)
    days_total = (end_date - start_date).days

    sample_types = ["出厂水", "管网末梢水", "二次供水", "农村集中供水"]
    disinfections = ["次氯酸钠", "二氧化氯", "臭氧活性炭", "紫外线消毒"]

    for stn in stations:
        if stn[2] != "water_plant":
            continue
        s_id, s_name, s_type, city, dist, addr, lat, lon, pop, _ = stn
        
        # 每站生成 25~35 次监测采样
        sample_count = random.randint(25, 35)
        for _ in range(sample_count):
            r_id = f"WTR-2026-{w_idx:06d}"
            w_idx += 1
            rand_day = start_date + timedelta(days=random.randint(0, days_total))
            date_str = rand_day.strftime("%Y-%m-%d")

            stype = random.choice(sample_types)
            disinf = random.choice(disinfections)

            # 96% 达标，4% 异常超标样本
            is_over = random.random() < 0.04
            turbidity = round(random.uniform(0.15, 0.85) if not is_over else random.uniform(1.2, 3.8), 2)
            chlorine = round(random.uniform(0.15, 0.85) if not is_over else random.uniform(0.01, 0.04), 2)
            cod = round(random.uniform(0.8, 2.2) if not is_over else random.uniform(3.2, 5.5), 2)
            total_coli = 0 if not is_over else random.randint(2, 12)
            bacterial = random.randint(5, 60) if not is_over else random.randint(120, 480)
            lead = round(random.uniform(0.001, 0.006) if not is_over else random.uniform(0.012, 0.028), 4)
            cadmium = round(random.uniform(0.0005, 0.002) if not is_over else random.uniform(0.006, 0.015), 4)
            arsenic = round(random.uniform(0.001, 0.005), 4)
            fluoride = round(random.uniform(0.3, 0.85) if not is_over else random.uniform(1.2, 2.1), 2)
            chloroform = round(random.uniform(0.005, 0.035), 4)

            is_standard = 0 if (is_over or turbidity > 1.0 or total_coli > 0 or lead > 0.01 or fluoride > 1.0) else 1
            exceeded = []
            if turbidity > 1.0: exceeded.append(f"浑浊度({turbidity}NTU)")
            if total_coli > 0: exceeded.append(f"总大肠菌群({total_coli}CFU)")
            if lead > 0.01: exceeded.append(f"铅({lead}mg/L)")
            if fluoride > 1.0: exceeded.append(f"氟化物({fluoride}mg/L)")

            cr = round(random.uniform(1.2e-7, 8.5e-6) * (3.5 if is_over else 1.0), 8)
            hq = round(random.uniform(0.15, 0.65) * (2.8 if is_over else 1.0), 3)

            water_records.append((
                r_id, s_id, city, dist, "黄河水系地表水" if "郑州" in city or "洛阳" in city else "南水北调中线中转水",
                stype, disinf, turbidity, chlorine, cod, total_coli, bacterial, lead, cadmium,
                arsenic, fluoride, chloroform, is_standard, "; ".join(exceeded) if exceeded else None,
                cr, hq, date_str
            ))

    cur.executemany("INSERT OR REPLACE INTO fact_water_monitoring VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", water_records)
    print(f"  [2/6] 成功写入 fact_water_monitoring: {len(water_records)} 条饮用水质监测记录")

    # 3. 生成污水病原时序监测数据 fact_sewage_monitoring (约 3,500 条记录)
    sewage_records = []
    swg_idx = 1
    drainage_zones = ["东区城北主排水分区", "老城中心管网集水区", "高新产业生活混排区", "滨河生态示范片区"]
    for stn in stations:
        if stn[2] != "sewage_plant":
            continue
        s_id, s_name, s_type, city, dist, addr, lat, lon, pop, _ = stn

        # 近 60 周，每周一次监测
        for week in range(60):
            r_id = f"SWG-2026-{swg_idx:06d}"
            swg_idx += 1
            sample_date = end_date - timedelta(days=week * 7)
            date_str = sample_date.strftime("%Y-%m-%d")

            # 冬春诺如高发，夏秋新冠肠道波动
            month = sample_date.month
            is_winter_spring = month in [11, 12, 1, 2, 3]
            is_summer = month in [6, 7, 8]

            noro = round(random.uniform(2500, 28000) if is_winter_spring else random.uniform(200, 2400), 1)
            sars = round(random.uniform(1500, 18000) if (month in [12, 1, 7, 8]) else random.uniform(300, 3200), 1)
            entero = round(random.uniform(400, 6500) if is_summer else random.uniform(100, 900), 1)

            # 对应哨点医院门诊就诊病例量 (呈现 5~7 天后峰值滞后)
            clinic_cases = int((noro * 0.008 + sars * 0.004) * random.uniform(0.85, 1.25) + random.randint(15, 45))
            corr = round(random.uniform(0.78, 0.94), 3)

            alert = "normal"
            if noro > 20000 or sars > 15000: alert = "red"
            elif noro > 10000 or sars > 8000: alert = "orange"
            elif noro > 5000 or sars > 4000: alert = "yellow"

            sewage_records.append((
                r_id, s_id, s_name, city, dist, random.choice(drainage_zones),
                round(random.uniform(8.5, 35.0), 1) * 10000,
                sars, noro, entero, clinic_cases, corr,
                f"{dist}第四片区汇水支管" if alert != "normal" else None,
                alert, date_str
            ))

    cur.executemany("INSERT OR REPLACE INTO fact_sewage_monitoring VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", sewage_records)
    print(f"  [3/6] 成功写入 fact_sewage_monitoring: {len(sewage_records)} 条污水病原监测时序记录")

    # 4. 生成空气质量与极端气候健康暴露事实表 fact_air_climate_monitoring (近 200 天全省 18 地市监测)
    air_records = []
    a_idx = 1
    for day_offset in range(200):
        cur_date = end_date - timedelta(days=day_offset)
        date_str = cur_date.strftime("%Y-%m-%d")
        month = cur_date.month

        for city_code, city_name, districts, c_lat, c_lon in HENAN_CITIES:
            r_id = f"AIR-{cur_date.strftime('%Y%m%d')}-{city_code}"
            
            # 冬季雾霾重污染，夏季高温热浪
            is_heatwave = month in [6, 7, 8] and random.random() < 0.22
            is_cold_haze = month in [12, 1, 2] and random.random() < 0.25

            temp_max = round(random.uniform(36.5, 41.2) if is_heatwave else (random.uniform(24.0, 32.0) if month in [5,6,7,8,9] else random.uniform(2.0, 14.0)), 1)
            temp_min = round(temp_max - random.uniform(8.0, 13.0), 1)
            pm25 = round(random.uniform(115.0, 240.0) if is_cold_haze else (random.uniform(18.0, 55.0) if is_heatwave else random.uniform(30.0, 75.0)), 1)
            pm10 = round(pm25 * random.uniform(1.3, 1.8), 1)
            o3 = round(random.uniform(180.0, 245.0) if is_heatwave else random.uniform(45.0, 110.0), 1)
            no2 = round(random.uniform(22.0, 68.0), 1)
            so2 = round(random.uniform(8.0, 25.0), 1)
            co = round(random.uniform(0.6, 1.8), 1)

            aqi = int(pm25 * 1.3 if pm25 > 75 else (o3 * 0.9 if o3 > 160 else pm25 * 1.1))
            level = "优" if aqi <= 50 else ("良" if aqi <= 100 else ("轻度污染" if aqi <= 150 else ("中度污染" if aqi <= 200 else ("重度污染" if aqi <= 300 else "严重污染"))))

            extreme_flag = "极端高温热浪" if is_heatwave else ("重污染天气" if is_cold_haze else "正常")
            pediatric = int(pm25 * 1.8 + random.randint(45, 95))
            elderly = int((45 if is_heatwave else 20) + (aqi * 0.35) + random.randint(30, 80))
            rr = round(1.0 + (pm25 / 100.0) * 0.18 + (0.25 if is_heatwave else 0.0), 3)

            air_records.append((
                r_id, f"STN-AIR-{city_code}", city_name, districts[0], date_str,
                pm25, pm10, o3, no2, so2, co, aqi, level, temp_max, temp_min,
                round(random.uniform(40.0, 85.0), 1), extreme_flag,
                pediatric, elderly, rr, 1 if (is_heatwave or is_cold_haze) else 0
            ))

    cur.executemany("INSERT OR REPLACE INTO fact_air_climate_monitoring VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", air_records)
    print(f"  [4/6] 成功写入 fact_air_climate_monitoring: {len(air_records)} 条空气与气候健康暴露记录")

    # 5. 生成四河流域跨介质重金属监测数据 fact_river_basin_monitoring
    river_records = []
    rb_idx = 1
    for basin_id, basin_name, cities in RIVER_BASINS:
        for c in cities:
            for s_name in ["入省断面", "出境控制断面", "饮用水源取水断面上游5km", "重要支流汇流口断面"]:
                r_id = f"RIV-{basin_id}-{rb_idx:04d}"
                rb_idx += 1
                
                # 某些特定断面模拟重金属轻度/中度迁移
                is_polluted = "黄河" in basin_name and ("济源" in c or "洛阳" in c or "焦作" in c) and "汇流口" in s_name
                w_pb = round(random.uniform(0.005, 0.025) if not is_polluted else random.uniform(0.055, 0.095), 4)
                w_cd = round(random.uniform(0.0005, 0.0025) if not is_polluted else random.uniform(0.0065, 0.0125), 4)
                soil_cd = round(random.uniform(0.12, 0.28) if not is_polluted else random.uniform(0.42, 0.85), 3)
                crop_pb = round(random.uniform(0.04, 0.15) if not is_polluted else random.uniform(0.24, 0.48), 3)

                enrichment = round((soil_cd / max(w_cd * 1000, 1.0)) * random.uniform(0.8, 1.5), 2)
                cluster = "High-High (高高集聚)" if is_polluted else ("Low-Low (低低集聚)" if random.random() < 0.7 else "Not Significant")
                cancer_rate = round(random.uniform(22.0, 38.0) if not is_polluted else random.uniform(42.0, 68.5), 1)

                river_records.append((
                    r_id, basin_id, basin_name, f"{c}{s_name}", c, "重点辖区",
                    w_pb, w_cd, soil_cd, crop_pb, enrichment, cluster, cancer_rate,
                    "2026-07-20"
                ))

    cur.executemany("INSERT OR REPLACE INTO fact_river_basin_monitoring VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)", river_records)
    print(f"  [5/6] 成功写入 fact_river_basin_monitoring: {len(river_records)} 条四河流域跨介质链条记录")

    # 6. 生成公共场所卫生与预警闭环数据
    venues = []
    v_idx = 1
    v_types = ["游泳场所", "快捷宾馆", "星级酒店", "候车场所", "沐浴场所"]
    for city_code, city_name, districts, c_lat, c_lon in HENAN_CITIES[:8]:
        for dist in districts[:2]:
            for vt in v_types:
                v_id = f"VEN-{city_code}-{v_idx:04d}"
                v_idx += 1
                score = round(random.uniform(72.0, 98.5), 1)
                rating = "A级" if score >= 90 else ("B级" if score >= 80 else "C级")
                venues.append((
                    v_id, f"{city_name}{dist}康乐健{vt}", vt, city_name, dist,
                    round(random.uniform(0.35, 0.85) if vt == "游泳场所" else 0.0, 2),
                    0 if score >= 80 else random.randint(1, 4),
                    round(random.uniform(80.0, 98.0), 1),
                    score, rating, "2026-08-15"
                ))

    cur.executemany("INSERT OR REPLACE INTO fact_public_venue_inspection VALUES (?,?,?,?,?,?,?,?,?,?,?)", venues)
    print(f"  [6/6] 成功写入 fact_public_venue_inspection: {len(venues)} 条公共场所动态卫生评级记录")

    db_conn.commit()

def main():
    print("================================================================================")
    print(" 开始初始化河南省疾控中心【环境健康风险监测预警智能体】Mock数据库...")
    print(f" 本地工程数据库: {DB_PATH}")
    print(f" DataMock仓镜像: {DATAMOCK_DB_PATH}")
    print("================================================================================")

    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)

    conn = sqlite3.connect(DB_PATH)
    init_database(conn)
    generate_mock_data(conn)
    conn.close()

    # 同步至外部 DataMock 镜像目录
    import shutil
    shutil.copy2(DB_PATH, DATAMOCK_DB_PATH)
    print(f"✅ 成功完成环境健康数据库构建并同步镜像至: {DATAMOCK_DB_PATH}")

if __name__ == "__main__":
    main()
