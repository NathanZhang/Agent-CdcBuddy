# CdcBuddy 生产环境 PostgreSQL 与人大金仓 (KingbaseES) 迁移指南

CdcBuddy 采用**数据库抽象层 (DAL / Repository Pattern)** 架构设计，业务代码与 Skills 均面向 `IVectorDataProvider` 接口编程。在开发与 Mock 阶段使用 SQLite (`vector_monitoring.db`)，在正式生产或国产信创部署时，可平滑迁移至 **PostgreSQL (14+)** 或 **人大金仓 (KingbaseES V8/V9)**。

---

## 一、 生产环境架构平滑切换原理

```
[Skills 技能层 / 业务控制层]
         │ (调用 IVectorDataProvider 标准接口)
         ▼
[数据库抽象层 / DAL Engine]
         │
    ┌────┴───────────────────────────┐
    ▼                                ▼
[开发环境: SQLiteProvider]    [生产/信创环境: KingbasePostgresProvider]
(vector_monitoring.db)       (PostgreSQL 14+ / 人大金仓 KingbaseES V8/V9)
```

只需在环境配置文件 `.env.production` 中配置连接串，无需修改任何上层业务逻辑代码。

---

## 二、 生产数据库 DDL 建表脚本 (人大金仓 / PostgreSQL 通用)

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

-- 7. 农药药剂维度表
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

-- 9. PCR 病原学筛查事实表
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

-- 高性能时空与多维索引
CREATE INDEX idx_monitoring_loc_date ON fact_monitoring(location_id, date_id);
CREATE INDEX idx_monitoring_species ON fact_monitoring(species_id);
CREATE INDEX idx_pathogen_loc_date ON fact_pathogen_detection(location_id, pathogen_id);
CREATE INDEX idx_resistance_species_pesticide ON fact_insecticide_resistance(species_id, pesticide_id);
```

---

## 三、 数据一键导入与迁移流程 (SQLite -> KingbaseES)

我们提供标准的 Python 迁移管道脚本（`scripts/migrate_sqlite_to_kingbase.py`）：

```python
import sqlite3
import psycopg2 # 人大金仓兼容 PostgreSQL psycopg2 / kingbase 官方驱动
import os

def migrate():
    # 1. 连接本地 SQLite
    sqlite_conn = sqlite3.connect('../Agent-CdcBuddy-DataMock/vector_monitoring.db')
    sqlite_cur = sqlite_conn.cursor()

    # 2. 连接人大金仓 / PostgreSQL
    kb_conn = psycopg2.connect(
        host=os.getenv("DB_HOST", "192.168.1.100"),
        port=int(os.getenv("DB_PORT", "54321")),
        dbname=os.getenv("DB_NAME", "vector_monitoring"),
        user=os.getenv("DB_USER", "system"),
        password=os.getenv("DB_PASSWORD", "manager")
    )
    kb_cur = kb_conn.cursor()

    tables = [
        "dim_location", "dim_species", "dim_date", "dim_method", 
        "dim_environment", "dim_pathogen", "dim_pesticide",
        "fact_monitoring", "fact_pathogen_detection", "fact_insecticide_resistance"
    ]

    for table in tables:
        print(f"正在迁移数据表: {table}...")
        sqlite_cur.execute(f"SELECT * FROM {table}")
        rows = sqlite_cur.fetchall()
        col_names = [d[0] for d in sqlite_cur.description]
        
        placeholders = ",".join(["%s"] * len(col_names))
        cols = ",".join(col_names)
        insert_sql = f"INSERT INTO {table} ({cols}) VALUES ({placeholders}) ON CONFLICT DO NOTHING"
        
        kb_cur.executemany(insert_sql, rows)
        kb_conn.commit()
        print(f"表 {table} 迁移完成，共 {len(rows)} 条记录。")

    sqlite_conn.close()
    kb_conn.close()
    print("全量数据已成功迁移至人大金仓 (KingbaseES)！")

if __name__ == "__main__":
    migrate()
```
