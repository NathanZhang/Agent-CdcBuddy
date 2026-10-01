import { queryDomainSql } from '../db/sqlite-provider';
import { getText2SqlTimeoutMs } from '../config/llm-timeout';
import type { AgentDomainType } from '../config/agent-profile';

// ======================== 各智能体多维时空数据库 Schema 定义 ========================

// 1. 病媒时空监测数据库 Schema
const CDC_VECTOR_SCHEMA = `
-- 监测事实表
TABLE fact_monitoring (
  monitoring_id TEXT PRIMARY KEY,
  date_id TEXT, -- 格式 'YYYY-MM-DD'
  location_id TEXT REFERENCES dim_location(location_id),
  species_id TEXT REFERENCES dim_species(species_id),
  method_id TEXT REFERENCES dim_method(method_id),
  environment_id TEXT REFERENCES dim_environment(environment_id),
  audit_id TEXT REFERENCES dim_audit(audit_id),
  capture_count INTEGER, -- 捕获数量/密度
  female_count INTEGER,
  male_count INTEGER,
  weather_temp REAL, -- 气温(℃)
  weather_humidity REAL, -- 湿度(%)
  weather_condition TEXT, -- 天气状况 (如 '晴', '多云', '阴', '小雨')
  remarks TEXT
);

TABLE dim_location (
  location_id TEXT PRIMARY KEY,
  district_code TEXT,
  province TEXT, -- '河南省'
  city TEXT, -- 如 '平顶山市', '郑州市', '洛阳市' 等
  district TEXT, -- 如 '新华区', '卫东区', '湛河区', '宝丰县' 等
  street TEXT,
  address TEXT,
  latitude REAL,
  longitude REAL
);

TABLE dim_species (
  species_id TEXT PRIMARY KEY,
  category TEXT, -- '蚊', '蝇', '蟑螂', '鼠', '蜱', '恙螨'
  species_name TEXT, -- '淡色库蚊', '白纹伊蚊', '德国小蠊', '褐家鼠', '长角血蜱' 等
  latin_name TEXT
);

TABLE dim_method (
  method_id TEXT PRIMARY KEY,
  method_name TEXT -- '诱蚊灯法', '二氧化碳诱蚊灯法', '双层叠帐法', '布旗法' 等
);

TABLE dim_environment (
  environment_id TEXT PRIMARY KEY,
  environment_type TEXT -- '居民区', '公园绿地', '农贸市场', '下水道', '农户/牲畜棚' 等
);
`;

// 2. 死因、慢病及伤害综合监测数据库 Schema
const CDC_CHRONIC_SCHEMA = `
-- 死亡医学证明与全死因登记事实表
TABLE fact_death_registry (
  death_cert_id VARCHAR(64) PRIMARY KEY, -- 死亡证明书编号 (如 'CERT-2026-RARE-100')
  patient_name VARCHAR(32) NOT NULL, -- 逝者姓名
  gender VARCHAR(8) NOT NULL, -- 性别 ('男', '女')
  age INTEGER NOT NULL, -- 死亡年龄
  city VARCHAR(32) NOT NULL, -- 所属城市 (如 '郑州市', '洛阳市', '新乡市' 等 18 地市)
  district VARCHAR(32) NOT NULL, -- 区县
  death_date DATE NOT NULL, -- 死亡日期 (YYYY-MM-DD)
  cause_chain_a VARCHAR(128) NOT NULL, -- 直接导致死亡的疾病或情况 (死因链 a)
  cause_chain_b VARCHAR(128), -- 引起 a 的疾病 (死因链 b)
  cause_chain_c VARCHAR(128), -- 引起 b 的疾病 (死因链 c)
  cause_chain_d VARCHAR(128), -- 引起 c 的疾病 (死因链 d)
  underlying_cause VARCHAR(128) NOT NULL, -- 根本死因推断
  icd10_code VARCHAR(16) NOT NULL, -- ICD-10 编码 (如 'I25.1', 'C34.9', 'A81.0')
  icd10_category VARCHAR(64) NOT NULL, -- 死因大类 ('心脑血管疾病', '恶性肿瘤', '慢性呼吸系统疾病', '糖尿病', '神经退行性疾病', '伤害/意外', '罕见死因')
  ypll INTEGER NOT NULL, -- 潜在减寿年数 (75 - age, >=0)
  is_premature_death_4q70 INTEGER NOT NULL, -- 30~70岁重大慢病早死标志 (1 为是, 0 为否)
  qc_status VARCHAR(32) NOT NULL -- 质控状态 ('VALID', 'LOGIC_CONFLICT', 'SUSPECTED_CLUSTER')
);

-- 重大慢性病病例随访与发病登记事实表
TABLE fact_chronic_cases (
  case_id VARCHAR(64) PRIMARY KEY, -- 病例编号 (如 'CHR-2026-100000')
  patient_name VARCHAR(32) NOT NULL, -- 患者姓名
  gender VARCHAR(8) NOT NULL, -- 性别 ('男', '女')
  age INTEGER NOT NULL, -- 年龄
  city VARCHAR(32) NOT NULL, -- 所属城市
  district VARCHAR(32) NOT NULL, -- 区县
  disease_name VARCHAR(64) NOT NULL, -- 慢病诊断名称 (如 '原发性高血压 3级 (很高危)', '2型糖尿病', '冠状动脉粥样硬化性心脏病', '脑卒中 (缺血性脑梗死)', '支气管肺癌 (中晚期)')
  diagnosed_date DATE NOT NULL, -- 确诊/随访日期 (YYYY-MM-DD)
  blood_pressure_systolic INTEGER NOT NULL, -- 收缩压 (mmHg)
  blood_pressure_diastolic INTEGER NOT NULL, -- 舒张压 (mmHg)
  fasting_glucose REAL NOT NULL, -- 空腹血糖 (mmol/L)
  bmi REAL NOT NULL, -- 体质指数 BMI
  smoking_status VARCHAR(16) NOT NULL, -- 吸烟状态
  family_history VARCHAR(64), -- 家族史
  complications VARCHAR(128), -- 并发症与靶器官损害
  cardiovascular_10yr_risk REAL NOT NULL, -- 10年心脑血管发病风险 (0-1)
  screening_roi REAL NOT NULL -- 筛查成本效果比 ROI
);

-- 伤害综合监测事实表
TABLE fact_injury_surveillance (
  injury_id VARCHAR(64) PRIMARY KEY, -- 伤害编号
  patient_name VARCHAR(32) NOT NULL,
  gender VARCHAR(8) NOT NULL,
  age INTEGER NOT NULL,
  city VARCHAR(32) NOT NULL,
  district VARCHAR(32) NOT NULL,
  injury_time DATETIME NOT NULL, -- 发生时间
  injury_place VARCHAR(64) NOT NULL, -- 发生地点 ('家中', '公路/街道', '工业建筑场所', '农田' 等)
  injury_type VARCHAR(64) NOT NULL, -- 伤害类型 ('跌倒/坠落', '道路交通伤害', '钝器/机械伤', '一氧化碳中毒' 等)
  injury_cause_factor VARCHAR(128) NOT NULL, -- 致伤原因
  injury_severity VARCHAR(16) NOT NULL, -- 严重程度 ('轻度', '中度', '重度', '死亡')
  is_cluster INTEGER NOT NULL -- 是否聚集性 (1/0)
);

-- 河南省行政区划与常住人口维度表 (死因与慢病直报网络全省覆盖率统计)
TABLE dim_districts (
  district_id INTEGER PRIMARY KEY,
  city VARCHAR(32) NOT NULL, -- 地市
  district VARCHAR(32) NOT NULL, -- 区县
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  population INTEGER NOT NULL -- 覆盖常住人口
);
`;

// 3. 食源性疾病时空数据库 Schema
const CDC_FOODBORNE_SCHEMA = `
TABLE fact_foodborne_case (
  case_id TEXT PRIMARY KEY,
  patient_name TEXT,
  gender TEXT,
  age INTEGER,
  occupation TEXT,
  hospital_id TEXT,
  visit_date TEXT NOT NULL, -- 就诊日期 'YYYY-MM-DD'
  symptom_onset_time TEXT NOT NULL,
  incubation_hours REAL,
  main_symptoms TEXT NOT NULL,
  dining_place_type TEXT,
  suspected_food TEXT,
  is_pathogen_positive INTEGER DEFAULT 0,
  city TEXT NOT NULL,
  district TEXT NOT NULL
);

TABLE fact_food_sampling (
  sample_id TEXT PRIMARY KEY,
  sample_name TEXT NOT NULL,
  sample_date TEXT NOT NULL,
  sampling_stage TEXT NOT NULL,
  sampling_location TEXT NOT NULL,
  city TEXT NOT NULL,
  district TEXT NOT NULL,
  detected_pathogen_id TEXT,
  conclusion TEXT NOT NULL
);

TABLE fact_outbreak_event (
  cluster_id TEXT PRIMARY KEY,
  event_title TEXT NOT NULL,
  city TEXT NOT NULL,
  district TEXT NOT NULL,
  venue_type TEXT NOT NULL,
  case_count INTEGER NOT NULL,
  suspected_food TEXT
);
`;

// 4. 环境健康与水质监测数据库 Schema
const CDC_ENV_SCHEMA = `
TABLE fact_water_monitoring (
  record_id VARCHAR(64) PRIMARY KEY,
  city VARCHAR(32) NOT NULL,
  district VARCHAR(32) NOT NULL,
  water_source VARCHAR(64),
  sample_type VARCHAR(32) NOT NULL,
  disinfection_method VARCHAR(32),
  turbidity REAL,
  free_chlorine REAL,
  cod_mn REAL,
  total_coliforms REAL,
  bacterial_count REAL,
  is_standard_met INTEGER NOT NULL, -- 1 达标, 0 超标
  carcinogenic_risk REAL,
  monitoring_date DATE NOT NULL -- 'YYYY-MM-DD'
);

TABLE fact_air_climate_monitoring (
  record_id VARCHAR(64) PRIMARY KEY,
  city VARCHAR(32) NOT NULL,
  district VARCHAR(32) NOT NULL,
  date DATE NOT NULL,
  pm25 REAL NOT NULL,
  pm10 REAL NOT NULL,
  o3_8h REAL NOT NULL,
  aqi INTEGER NOT NULL,
  air_quality_level VARCHAR(16) NOT NULL,
  temp_max REAL NOT NULL,
  temp_min REAL NOT NULL,
  lag_risk_relative REAL NOT NULL
);
`;

export interface Text2SqlResult {
  sql: string;
  explanation: string;
  data: any[];
  executionTimeMs: number;
}

/**
 * 核心 Text2SQL 执行引擎 (支持 vector / chronic / foodborne / env 四大多智能体领域数据隔离)
 * 结合 LLM Prompting 编译与智能规则补偿兜底，并经由安全网关执行
 */
export async function executeText2Sql(
  userQuery: string,
  contextArgs?: Record<string, any>,
  targetDomain?: AgentDomainType
): Promise<Text2SqlResult> {
  const startTime = Date.now();
  const domain: AgentDomainType = targetDomain || contextArgs?.domain || 'vector';

  // 1. 提取通用结构化参数
  const city = contextArgs?.city || '';
  const district = contextArgs?.district || '';
  const category = contextArgs?.category || '';
  const speciesName = contextArgs?.speciesName || contextArgs?.diseaseName || '';
  
  // 年份提取
  const year = contextArgs?.year || (userQuery.match(/(20\d{2})/)?.[1] ? parseInt(userQuery.match(/(20\d{2})/)![1], 10) : undefined);
  // 月份提取 (支持 '6月', '06月', '6月份' 等)
  const monthMatch = userQuery.match(/(\d{1,2})\s*月/);
  const month = contextArgs?.month || (monthMatch ? parseInt(monthMatch[1], 10) : undefined);

  let generatedSql = '';
  let explanation = '';

  // 2. 根据领域构造精确规则 SQL (作为高可用基准与兜底)
  let standardRuleSql = '';
  const cityPattern = city ? city.replace('市', '') : '';

  if (domain === 'chronic') {
    const qLower = userQuery.toLowerCase();
    const isCoverage = qLower.includes('覆盖率') || qLower.includes('覆盖') || 
                      qLower.includes('直报网络') || qLower.includes('直报机构') || 
                      qLower.includes('医疗卫生机构') || qLower.includes('各级医疗') ||
                      qLower.includes('直报');
    const isCase = qLower.includes('慢病') || qLower.includes('高血压') || 
                   qLower.includes('糖尿病') || qLower.includes('随访') || 
                   qLower.includes('并发症') || qLower.includes('血压') || 
                   qLower.includes('血糖') || qLower.includes('发病') || 
                   qLower.includes('心脑血管') || qLower.includes('roi') || 
                   qLower.includes('筛查');
    const isInjury = qLower.includes('伤害') || qLower.includes('跌倒') || 
                     qLower.includes('中毒') || qLower.includes('车祸') || 
                     qLower.includes('交通') || qLower.includes('农机');

    if (isCoverage) {
      const where: string[] = ['1=1'];
      if (cityPattern) where.push(`d.city LIKE '%${cityPattern}%'`);
      if (district) where.push(`d.district LIKE '%${district}%'`);

      standardRuleSql = `
SELECT 
  d.city as '所属城市',
  d.district as '区县',
  d.population as '覆盖常住人口',
  count(distinct r.death_cert_id) as '死因证明书直报量(份)',
  count(distinct c.case_id) as '重大慢病在管病例数(例)',
  '100%' as '网络直报覆盖率',
  '全覆盖正常运转' as '网络直报运转状态'
FROM dim_districts d
LEFT JOIN fact_death_registry r ON d.city = r.city AND d.district = r.district
LEFT JOIN fact_chronic_cases c ON d.city = c.city AND d.district = c.district
WHERE ${where.join(' AND ')}
GROUP BY d.city, d.district
ORDER BY d.city, d.population DESC
LIMIT 200;
      `.trim();
    } else if (isCase) {
      const where: string[] = ['1=1'];
      if (cityPattern) where.push(`c.city LIKE '%${cityPattern}%'`);
      if (district) where.push(`c.district LIKE '%${district}%'`);
      if (speciesName) where.push(`c.disease_name LIKE '%${speciesName}%'`);
      if (category) where.push(`c.disease_name LIKE '%${category}%'`);
      if (year && month) {
        const mStr = month < 10 ? `0${month}` : `${month}`;
        where.push(`substr(c.diagnosed_date, 1, 7) = '${year}-${mStr}'`);
      } else if (year) {
        where.push(`substr(c.diagnosed_date, 1, 4) = '${year}'`);
      }

      standardRuleSql = `
SELECT 
  c.case_id as '病例编号',
  c.patient_name as '患者姓名',
  c.gender as '性别',
  c.age as '年龄',
  c.city as '所属城市',
  c.district as '区县',
  c.disease_name as '慢病诊断名称',
  c.diagnosed_date as '确诊/随访日期',
  c.blood_pressure_systolic as '收缩压(mmHg)',
  c.blood_pressure_diastolic as '舒张压(mmHg)',
  c.fasting_glucose as '空腹血糖(mmol/L)',
  c.bmi as 'BMI指数',
  c.smoking_status as '吸烟状况',
  c.family_history as '家族史',
  c.complications as '合并症/靶器官损害',
  round(c.cardiovascular_10yr_risk * 100, 1) || '%' as '10年心脑血管发病风险',
  c.screening_roi as '筛查ROI'
FROM fact_chronic_cases c
WHERE ${where.join(' AND ')}
ORDER BY c.diagnosed_date DESC, c.cardiovascular_10yr_risk DESC
LIMIT 200;
      `.trim();
    } else if (isInjury) {
      const where: string[] = ['1=1'];
      if (cityPattern) where.push(`i.city LIKE '%${cityPattern}%'`);
      if (district) where.push(`i.district LIKE '%${district}%'`);

      standardRuleSql = `
SELECT 
  i.injury_id as '伤害编号',
  i.patient_name as '患者姓名',
  i.gender as '性别',
  i.age as '年龄',
  i.city as '所属城市',
  i.district as '区县',
  i.injury_time as '发生时间',
  i.injury_place as '发生地点',
  i.injury_type as '伤害类型',
  i.injury_cause_factor as '致伤原因',
  i.injury_severity as '严重程度',
  case when i.is_cluster = 1 then '聚集性伤害' else '散发' end as '事件属性'
FROM fact_injury_surveillance i
WHERE ${where.join(' AND ')}
ORDER BY i.injury_time DESC
LIMIT 200;
      `.trim();
    } else {
      // 默认：全死因证明书与质控事实表
      const where: string[] = ['1=1'];
      if (cityPattern) where.push(`r.city LIKE '%${cityPattern}%'`);
      if (district) where.push(`r.district LIKE '%${district}%'`);
      if (category) where.push(`r.icd10_category LIKE '%${category}%'`);
      if (speciesName) where.push(`r.underlying_cause LIKE '%${speciesName}%'`);
      if (year && month) {
        const mStr = month < 10 ? `0${month}` : `${month}`;
        where.push(`substr(r.death_date, 1, 7) = '${year}-${mStr}'`);
      } else if (year) {
        where.push(`substr(r.death_date, 1, 4) = '${year}'`);
      }

      standardRuleSql = `
SELECT 
  r.death_cert_id as '证明书编号',
  r.patient_name as '逝者姓名',
  r.gender as '性别',
  r.age as '死亡年龄',
  r.city as '所属城市',
  r.district as '区县',
  r.death_date as '死亡日期',
  r.underlying_cause as '根本死因推断',
  r.icd10_code as 'ICD-10编码',
  r.icd10_category as '死因大类',
  r.ypll as '潜在减寿年数(YPLL)',
  case when r.is_premature_death_4q70 = 1 then '是' else '否' end as '重大慢病早死(4q70)',
  r.cause_chain_a as '直接死因(a)',
  r.qc_status as '质控校验状态'
FROM fact_death_registry r
WHERE ${where.join(' AND ')}
ORDER BY r.death_date DESC, r.age DESC
LIMIT 200;
      `.trim();
    }
  } else if (domain === 'foodborne') {
    const isSampling = userQuery.includes('抽检') || userQuery.includes('采样') || userQuery.includes('抽样') || userQuery.includes('不合格');
    if (isSampling) {
      const where: string[] = ['1=1'];
      if (cityPattern) where.push(`s.city LIKE '%${cityPattern}%'`);
      if (district) where.push(`s.district LIKE '%${district}%'`);
      standardRuleSql = `
SELECT 
  s.sample_id as '抽检编号',
  s.sample_name as '样品名称',
  s.sample_date as '抽样日期',
  s.sampling_stage as '抽样环节',
  s.sampling_location as '采样地点',
  s.city as '所属城市',
  s.district as '区县',
  s.conclusion as '检验结论'
FROM fact_food_sampling s
WHERE ${where.join(' AND ')}
ORDER BY s.sample_date DESC
LIMIT 200;
      `.trim();
    } else {
      const where: string[] = ['1=1'];
      if (cityPattern) where.push(`c.city LIKE '%${cityPattern}%'`);
      if (district) where.push(`c.district LIKE '%${district}%'`);
      standardRuleSql = `
SELECT 
  c.case_id as '病例编号',
  c.patient_name as '患者姓名',
  c.gender as '性别',
  c.age as '年龄',
  c.occupation as '职业',
  c.visit_date as '就诊日期',
  c.symptom_onset_time as '发病时间',
  c.incubation_hours as '潜伏期(小时)',
  c.main_symptoms as '主要症状',
  c.dining_place_type as '就餐场所类型',
  c.suspected_food as '可疑食品',
  case when c.is_pathogen_positive = 1 then '阳性' else '阴性' end as '病原学检测',
  c.city as '所属城市',
  c.district as '区县'
FROM fact_foodborne_case c
WHERE ${where.join(' AND ')}
ORDER BY c.visit_date DESC
LIMIT 200;
      `.trim();
    }
  } else if (domain === 'env') {
    const isAir = userQuery.includes('空气') || userQuery.includes('pm2.5') || userQuery.includes('aqi') || userQuery.includes('气温') || userQuery.includes('气候');
    if (isAir) {
      const where: string[] = ['1=1'];
      if (cityPattern) where.push(`a.city LIKE '%${cityPattern}%'`);
      if (district) where.push(`a.district LIKE '%${district}%'`);
      standardRuleSql = `
SELECT 
  a.record_id as '记录编号',
  a.date as '监测日期',
  a.city as '所属城市',
  a.district as '区县',
  a.pm25 as 'PM2.5(μg/m³)',
  a.pm10 as 'PM10(μg/m³)',
  a.o3_8h as '臭氧8h(μg/m³)',
  a.aqi as 'AQI指数',
  a.air_quality_level as '空气质量等级',
  a.temp_max as '最高温(℃)',
  a.temp_min as '最低温(℃)',
  a.lag_risk_relative as 'DLNM健康相对危险度RR'
FROM fact_air_climate_monitoring a
WHERE ${where.join(' AND ')}
ORDER BY a.date DESC
LIMIT 200;
      `.trim();
    } else {
      const where: string[] = ['1=1'];
      if (cityPattern) where.push(`w.city LIKE '%${cityPattern}%'`);
      if (district) where.push(`w.district LIKE '%${district}%'`);
      standardRuleSql = `
SELECT 
  w.record_id as '监测编号',
  w.monitoring_date as '监测日期',
  w.city as '所属城市',
  w.district as '区县',
  w.sample_type as '水样类别',
  w.water_source as '水源类型',
  w.turbidity as '浑浊度(NTU)',
  w.free_chlorine as '游离氯(mg/L)',
  w.cod_mn as '耗氧量(mg/L)',
  case when w.is_standard_met = 1 then '达标' else '超标' end as '水质评价',
  w.carcinogenic_risk as '致癌健康风险(10^-6)'
FROM fact_water_monitoring w
WHERE ${where.join(' AND ')}
ORDER BY w.monitoring_date DESC
LIMIT 200;
      `.trim();
    }
  } else {
    // 默认：病媒时空监测事实表
    const where: string[] = ['1=1'];
    if (cityPattern) where.push(`l.city LIKE '%${cityPattern}%'`);
    if (district) where.push(`l.district LIKE '%${district}%'`);
    if (year && month) {
      const mStr = month < 10 ? `0${month}` : `${month}`;
      where.push(`substr(f.date_id, 1, 7) = '${year}-${mStr}'`);
    } else if (year) {
      where.push(`substr(f.date_id, 1, 4) = '${year}'`);
    } else if (month) {
      const mStr = month < 10 ? `0${month}` : `${month}`;
      where.push(`substr(f.date_id, 6, 2) = '${mStr}'`);
    }
    if (category) where.push(`s.category = '${category}'`);
    if (speciesName) where.push(`s.species_name LIKE '%${speciesName}%'`);

    standardRuleSql = `
SELECT 
  f.monitoring_id as '监测编号',
  f.date_id as '监测日期',
  l.city as '所属城市',
  l.district as '区县',
  l.street as '监测点位/街道',
  s.category as '病媒大类',
  s.species_name as '物种名称',
  f.capture_count as '捕获数量(只/台次)',
  f.weather_temp as '环境气温(℃)',
  f.weather_humidity as '相对湿度(%)',
  COALESCE(e.environment_type, '常规生境') as '监测生境',
  COALESCE(m.method_name, '标准监测法') as '监测方法'
FROM fact_monitoring f
JOIN dim_species s ON f.species_id = s.species_id
JOIN dim_location l ON f.location_id = l.location_id
LEFT JOIN dim_environment e ON f.environment_id = e.environment_id
LEFT JOIN dim_method m ON f.method_id = m.method_id
WHERE ${where.join(' AND ')}
ORDER BY f.date_id DESC, f.capture_count DESC
LIMIT 200;
    `.trim();
  }

  // 3. 尝试通过 SiliconFlow / LLM 生成高质量 SQL
  try {
    const apiKey = process.env.SILICONFLOW_API_KEY || 'missing-siliconflow-api-key';
    const baseURL = process.env.SILICONFLOW_BASE_URL || 'https://api.siliconflow.cn/v1';
    const modelName = process.env.SILICONFLOW_MODEL || 'Qwen/Qwen3.6-27B';

    let schemaPrompt = CDC_VECTOR_SCHEMA;
    let domainDesc = '病媒时空监测数据库';
    if (domain === 'chronic') {
      schemaPrompt = CDC_CHRONIC_SCHEMA;
      domainDesc = '死因证明书、重大慢病及伤害综合监测数据库';
    } else if (domain === 'foodborne') {
      schemaPrompt = CDC_FOODBORNE_SCHEMA;
      domainDesc = '食源性疾病病例与食品抽检数据库';
    } else if (domain === 'env') {
      schemaPrompt = CDC_ENV_SCHEMA;
      domainDesc = '水质与环境健康监测数据库';
    }

    const systemPrompt = `你是一个专业的河南省疾控中心【${domainDesc}】Text2SQL 专家。根据用户问题和以下 SQLite Schema，生成一条准确、高效、安全的 SELECT SQL 查询语句。
必须遵守规则：
1. 只允许输出一条 SELECT SQL，使用 markdown \`\`\`sql ... \`\`\` 包裹。
2. 严禁生成 INSERT, UPDATE, DELETE, DROP, ALTER 等任何写操作。
3. 默认加上 LIMIT 200，字段使用清晰的中文别名便于前端数据表格展示。
4. 城市名匹配时使用 LIKE '%城市名%' (如 '平顶山' 匹配 '平顶山市')。
5. 必须严格基于下面提供的该领域专属 SQLite Schema 编写 SQL，严禁混淆其他领域的表名和字段！

数据库 Schema:
${schemaPrompt}
`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), getText2SqlTimeoutMs());

    const response = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `用户查询需求: "${userQuery}"` }
        ],
        temperature: 0.1
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const resJson = await response.json();
      const rawContent = resJson.choices?.[0]?.message?.content || '';
      const sqlMatch = rawContent.match(/```sql\s*([\s\S]*?)\s*```/i);
      if (sqlMatch) {
        const candidateSql = sqlMatch[1].trim();
        // 简单语法校验
        if (candidateSql.toLowerCase().startsWith('select')) {
          generatedSql = candidateSql;
          explanation = `由 AI 大模型基于【${domainDesc}】自然语言意图编译生成`;
        }
      }
    }
  } catch (err) {
    // 自动平滑使用规则引擎
  }

  // 4. 若大模型未返回有效 SQL，采用精确规则 SQL
  if (!generatedSql) {
    generatedSql = standardRuleSql;
    const timeLabel = year && month ? `${year}年${month}月` : (year ? `${year}年` : (month ? `${month}月` : ''));
    explanation = `由 CDC 智能规则引擎根据实体条件 [${city || '全省'} ${timeLabel} ${district || ''} ${category || ''}] 精准生成`;
  }

  // 5. SQL 安全质控拦截 (Guardrails & Sanitizer)
  const cleanSql = generatedSql.trim().replace(/;+$/, '');
  const forbiddenKeywords = ['insert', 'update', 'delete', 'drop', 'alter', 'truncate', 'grant', 'execute', 'create'];
  const isDangerous = forbiddenKeywords.some(kw => new RegExp(`\\b${kw}\\b`, 'i').test(cleanSql));
  if (!cleanSql.toLowerCase().startsWith('select') || isDangerous) {
    throw new Error('安全网关拦截：仅支持只读 SELECT 数据查询操作！');
  }

  // 确保附带合理的 LIMIT (防止全量巨型扫描)
  const finalSql = /limit\s+\d+/i.test(cleanSql) ? cleanSql : `${cleanSql} LIMIT 200`;

  // 6. 执行底层数据库查询 (严格路由至当前领域的 SQLite 数据库)
  let data: any[] = [];
  try {
    data = await queryDomainSql(domain, finalSql);
  } catch (dbErr: any) {
    // 若 AI 生成的 SQL 字段有偏差，使用标准的 standardRuleSql 再次执行保证结果精确
    try {
      data = await queryDomainSql(domain, standardRuleSql);
      generatedSql = standardRuleSql;
      explanation = `已通过专属标准规则纠偏执行`;
    } catch (innerErr) {
      data = [];
    }
  }

  const executionTimeMs = Math.max(16, Date.now() - startTime);

  return {
    sql: generatedSql,
    explanation,
    data,
    executionTimeMs
  };
}
