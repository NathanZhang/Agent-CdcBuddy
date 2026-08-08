# CdcBuddy 生产环境 PostgreSQL 与人大金仓 (KingbaseES) 迁移指南

CdcBuddy 采用**数据库抽象层 (DAL / Repository Pattern)** 架构设计，上层业务代码、Copilot 技能与算法引擎均面向统一的标准数据接口编程。在开发与演示阶段系统采用双 SQLite 引擎（`vector_monitoring.db` 与 `app_business.db`），在生产环境或国产信创化部署时，可平滑迁移至 **PostgreSQL (14+)** 或 **人大金仓 (KingbaseES V8/V9)** 等企业级关系型数据库。

---

## 一、 生产环境双数据库架构全景

```
                      [上层业务层 / 4 智能体 / Copilot 技能中心]
                                          │
                                          ▼
                      [数据库抽象层 DAL (IVectorDataProvider)]
                                          │
                 ┌────────────────────────┴────────────────────────┐
                 ▼                                                 ▼
      【时空监测事实库】 (只读分析)                       【业务持久化闭环库】 (读写业务)
  • 河南省 18 地市 5.6 万+ 监测事实记录              • 处置闭环工单 (biz_disposal_tickets)
  • PCR 病原学分子筛查结果                          • 分级预警事件 (biz_early_warning_events)
  • 常用农药抗药性生物测定与 LC50                   • 移动端现场审核流 (biz_mobile_submissions)
  • 地理、物种、时间、生境多维星型模型              • 国家标准规范库 (biz_kb_standards)
                                                    • 自动生成专报归档 (biz_generated_reports)
                                                    • 用户定制元技能 (biz_custom_skills)
```

---

## 二、 生产数据库 DDL 建表脚本 (人大金仓 / PostgreSQL 通用)

### 1. 时空监测事实库 DDL (Schema: `vector_monitoring`)

```sql
-- 1. 地理空间维度表
CREATE TABLE IF NOT EXISTS dim_location (
  location_id VARCHAR(64) PRIMARY KEY,
  district_code VARCHAR(32),
  province VARCHAR(64) NOT NULL DEFAULT '河南省',
  city VARCHAR(64) NOT NULL,
  district VARCHAR(64) NOT NULL,
  street VARCHAR(128),
  address TEXT,
  latitude NUMERIC(10, 6),
  longitude NUMERIC(10, 6)
);

-- 2. 物种分类维度表
CREATE TABLE IF NOT EXISTS dim_species (
  species_id VARCHAR(64) PRIMARY KEY,
  category VARCHAR(32) NOT NULL,
  species_name VARCHAR(64) NOT NULL,
  latin_name VARCHAR(128)
);

-- 3. 日期时序维度表
CREATE TABLE IF NOT EXISTS dim_date (
  date_id VARCHAR(32) PRIMARY KEY,
  year INT NOT NULL,
  month INT NOT NULL,
  day INT NOT NULL,
  season VARCHAR(16)
);

-- 4. 监测方法维度表
CREATE TABLE IF NOT EXISTS dim_method (
  method_id VARCHAR(64) PRIMARY KEY,
  method_name VARCHAR(64) NOT NULL
);

-- 5. 生境类型维度表
CREATE TABLE IF NOT EXISTS dim_environment (
  environment_id VARCHAR(64) PRIMARY KEY,
  environment_type VARCHAR(64) NOT NULL
);

-- 6. 病原体靶标维度表
CREATE TABLE IF NOT EXISTS dim_pathogen (
  pathogen_id VARCHAR(64) PRIMARY KEY,
  pathogen_name VARCHAR(64) NOT NULL
);

-- 7. 杀虫药剂维度表
CREATE TABLE IF NOT EXISTS dim_pesticide (
  pesticide_id VARCHAR(64) PRIMARY KEY,
  pesticide_name VARCHAR(64) NOT NULL,
  english_name VARCHAR(64)
);

-- 8. 核心生态监测事实表
CREATE TABLE IF NOT EXISTS fact_monitoring (
  monitoring_id VARCHAR(64) PRIMARY KEY,
  date_id VARCHAR(32) REFERENCES dim_date(date_id),
  location_id VARCHAR(64) REFERENCES dim_location(location_id),
  species_id VARCHAR(64) REFERENCES dim_species(species_id),
  method_id VARCHAR(64) REFERENCES dim_method(method_id),
  environment_id VARCHAR(64) REFERENCES dim_environment(environment_id),
  audit_id VARCHAR(64),
  capture_count INT NOT NULL DEFAULT 0,
  female_count INT,
  male_count INT,
  larvae_count INT,
  adult_count INT,
  weather_temp NUMERIC(5, 2),
  weather_humidity NUMERIC(5, 2),
  weather_wind VARCHAR(32),
  weather_condition VARCHAR(32),
  sampling_unit INT,
  remarks TEXT,
  source_file VARCHAR(255)
);

-- 9. PCR 病原学分子筛查事实表
CREATE TABLE IF NOT EXISTS fact_pathogen_detection (
  detection_id VARCHAR(64) PRIMARY KEY,
  monitoring_id VARCHAR(64),
  location_id VARCHAR(64) REFERENCES dim_location(location_id),
  date_id VARCHAR(32) REFERENCES dim_date(date_id),
  species_id VARCHAR(64) REFERENCES dim_species(species_id),
  pathogen_id VARCHAR(64) REFERENCES dim_pathogen(pathogen_id),
  pcr_result VARCHAR(16) NOT NULL,
  cq_value NUMERIC(6, 2),
  tested_count INT,
  positive_groups INT,
  total_groups INT,
  detection_method VARCHAR(64),
  source_file VARCHAR(255)
);

-- 10. 抗药性生物测定事实表
CREATE TABLE IF NOT EXISTS fact_insecticide_resistance (
  resistance_id VARCHAR(64) PRIMARY KEY,
  species_id VARCHAR(64) REFERENCES dim_species(species_id),
  pesticide_id VARCHAR(64) REFERENCES dim_pesticide(pesticide_id),
  location_id VARCHAR(64) REFERENCES dim_location(location_id),
  date_id VARCHAR(32) REFERENCES dim_date(date_id),
  lc50 NUMERIC(10, 4),
  lc50_ci VARCHAR(64),
  lc95 NUMERIC(10, 4),
  lc95_ci VARCHAR(64),
  slope_b NUMERIC(8, 4),
  control_mortality NUMERIC(5, 2),
  corrected_mortality NUMERIC(5, 2),
  resistance_level VARCHAR(32),
  test_temp NUMERIC(5, 2),
  test_humidity NUMERIC(5, 2),
  source_file VARCHAR(255)
);

-- 优化索引
CREATE INDEX IF NOT EXISTS idx_monitoring_loc_date ON fact_monitoring(location_id, date_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_species ON fact_monitoring(species_id);
CREATE INDEX IF NOT EXISTS idx_pathogen_loc_date ON fact_pathogen_detection(location_id, pathogen_id);
CREATE INDEX IF NOT EXISTS idx_resistance_species_pesticide ON fact_insecticide_resistance(species_id, pesticide_id);
```

---

### 2. 业务持久化闭环库 DDL (Schema: `app_business`)

```sql
-- 1. 处置工单表
CREATE TABLE IF NOT EXISTS biz_disposal_tickets (
    ticket_id VARCHAR(64) PRIMARY KEY,
    alert_id VARCHAR(64),
    target_city VARCHAR(64) NOT NULL,
    target_district VARCHAR(64) NOT NULL,
    target_street VARCHAR(128),
    vector_category VARCHAR(32) NOT NULL,
    species_name VARCHAR(64) NOT NULL,
    severity_level VARCHAR(32) NOT NULL,
    recommended_protocol TEXT NOT NULL,
    assigned_team VARCHAR(128) NOT NULL,
    contact_phone VARCHAR(32),
    disposal_status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    before_density NUMERIC(8, 2),
    after_bi_index NUMERIC(8, 2),
    disposal_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- 2. 预警事件与推送日志表
CREATE TABLE IF NOT EXISTS biz_early_warning_events (
    event_id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    level VARCHAR(32) NOT NULL,
    category VARCHAR(32) NOT NULL,
    city VARCHAR(64) NOT NULL,
    district VARCHAR(64) NOT NULL,
    street VARCHAR(128),
    latitude NUMERIC(10, 6),
    longitude NUMERIC(10, 6),
    trigger_reason TEXT NOT NULL,
    current_density NUMERIC(8, 2) NOT NULL,
    threshold NUMERIC(8, 2) NOT NULL,
    affected_population INT,
    recommended_action TEXT,
    push_channels VARCHAR(255),
    push_status VARCHAR(32) DEFAULT 'SENT',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. 移动端采集上报与审核流转表
CREATE TABLE IF NOT EXISTS biz_mobile_submissions (
    submission_id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    user_name VARCHAR(64) NOT NULL,
    city VARCHAR(64) NOT NULL,
    district VARCHAR(64) NOT NULL,
    street VARCHAR(128),
    latitude NUMERIC(10, 6),
    longitude NUMERIC(10, 6),
    image_url_base64 TEXT,
    recognized_species VARCHAR(64),
    ai_confidence NUMERIC(5, 2),
    category VARCHAR(32) NOT NULL,
    species_name VARCHAR(64) NOT NULL,
    capture_count INT NOT NULL,
    weather_temp NUMERIC(5, 2),
    weather_humidity NUMERIC(5, 2),
    habitat_type VARCHAR(64),
    method_name VARCHAR(64),
    audit_status VARCHAR(32) NOT NULL DEFAULT 'SUBMITTED',
    auditor_name VARCHAR(64),
    audit_comment TEXT,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    audited_at TIMESTAMP WITH TIME ZONE
);

-- 4. 国家标准与防治技术指南知识库表
CREATE TABLE IF NOT EXISTS biz_kb_standards (
    doc_id VARCHAR(64) PRIMARY KEY,
    standard_no VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(32) NOT NULL,
    chapter VARCHAR(128) NOT NULL,
    content TEXT NOT NULL,
    keywords TEXT NOT NULL,
    reference_url VARCHAR(512)
);

-- 5. 自动生成专题研判报告归档表
CREATE TABLE IF NOT EXISTS biz_generated_reports (
    report_id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    author VARCHAR(64) NOT NULL,
    city VARCHAR(64),
    district VARCHAR(64),
    report_type VARCHAR(64) NOT NULL,
    summary TEXT NOT NULL,
    content_markdown TEXT NOT NULL,
    metadata_json TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. 用户定制元技能元数据表
CREATE TABLE IF NOT EXISTS biz_custom_skills (
    skill_id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(64) NOT NULL,
    sql_query TEXT NOT NULL,
    chart_type VARCHAR(64) NOT NULL,
    recommended_prompts TEXT NOT NULL,
    created_by VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

---

## 三、 数据一键导入与迁移脚本 (SQLite -> KingbaseES / PostgreSQL)

在项目中使用 Python 脚本完成双库的一键全量数据迁移：

```python
import sqlite3
import psycopg2 # 人大金仓 KingbaseES / PostgreSQL 驱动通用
import os

def migrate_database():
    target_host = os.getenv("DB_HOST", "127.0.0.1")
    target_port = int(os.getenv("DB_PORT", "54321"))
    target_db = os.getenv("DB_NAME", "vector_cdc")
    target_user = os.getenv("DB_USER", "system")
    target_pwd = os.getenv("DB_PASSWORD", "manager")

    print(f"正在连接生产/信创数据库: {target_host}:{target_port}/{target_db}...")
    pg_conn = psycopg2.connect(
        host=target_host, port=target_port,
        dbname=target_db, user=target_user, password=target_pwd
    )
    pg_cur = pg_conn.cursor()

    # 1. 迁移监测事实库 (vector_monitoring.db)
    monitoring_sqlite = sqlite3.connect("vector_monitoring.db")
    mon_cur = monitoring_sqlite.cursor()

    mon_tables = [
        "dim_location", "dim_species", "dim_date", "dim_method",
        "dim_environment", "dim_pathogen", "dim_pesticide",
        "fact_monitoring", "fact_pathogen_detection", "fact_insecticide_resistance"
    ]

    for tbl in mon_tables:
        print(f"--> 迁移时空事实表: {tbl}...")
        mon_cur.execute(f"SELECT * FROM {tbl}")
        rows = mon_cur.fetchall()
        cols = [d[0] for d in mon_cur.description]
        placeholders = ",".join(["%s"] * len(cols))
        col_str = ",".join(cols)
        sql = f"INSERT INTO {tbl} ({col_str}) VALUES ({placeholders}) ON CONFLICT DO NOTHING"
        pg_cur.executemany(sql, rows)
        pg_conn.commit()
        print(f"    {tbl} 迁移完成，共写入 {len(rows)} 行。")

    # 2. 迁移业务持久化库 (app_business.db)
    biz_sqlite = sqlite3.connect("app_business.db")
    biz_cur = biz_sqlite.cursor()

    biz_tables = [
        "biz_disposal_tickets", "biz_early_warning_events",
        "biz_mobile_submissions", "biz_kb_standards",
        "biz_generated_reports", "biz_custom_skills"
    ]

    for tbl in biz_tables:
        print(f"--> 迁移业务持久化表: {tbl}...")
        biz_cur.execute(f"SELECT * FROM {tbl}")
        rows = biz_cur.fetchall()
        cols = [d[0] for d in biz_cur.description]
        placeholders = ",".join(["%s"] * len(cols))
        col_str = ",".join(cols)
        sql = f"INSERT INTO {tbl} ({col_str}) VALUES ({placeholders}) ON CONFLICT DO NOTHING"
        pg_cur.executemany(sql, rows)
        pg_conn.commit()
        print(f"    {tbl} 迁移完成，共写入 {len(rows)} 行。")

    monitoring_sqlite.close()
    biz_sqlite.close()
    pg_conn.close()
    print("✨ 双库全量数据迁移成功！")

if __name__ == "__main__":
    migrate_database()
```

---

## 四、 生产环境配置与信创认证说明

1. **环境配置 (`.env.production`)**：
   ```env
   DB_DRIVER=kingbase
   DB_HOST=192.168.10.50
   DB_PORT=54321
   DB_NAME=vector_cdc
   DB_USER=cdc_admin
   DB_PASSWORD=SecurePassword_2026!
   DB_POOL_MIN=5
   DB_POOL_MAX=20
   ```
2. **人大金仓 (KingbaseES) 兼容性说明**：
   - KingbaseES V8/V9 完全兼容 PostgreSQL 的 `libpq` 与 SQL 语法；
   - 空间 GIS 维度支持 PostGIS / KingbaseGIS 扩展函数（如 `ST_DWithin`, `ST_GeomFromText`）；
   - 在高并发 CDC 接入场景下，支持读写分离与主备集群模式。
