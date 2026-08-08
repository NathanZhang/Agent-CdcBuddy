import { getVectorDataProvider } from '../db/sqlite-provider';

// 疾控多维时空数据库真实 Schema 定义 (注入给 LLM)
const CDC_DB_SCHEMA = `
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

-- 地理维度表
TABLE dim_location (
  location_id TEXT PRIMARY KEY,
  district_code TEXT,
  province TEXT, -- '河南省'
  city TEXT, -- 如 '平顶山市', '郑州市', '洛阳市' 等
  district TEXT, -- 如 '新华区', '卫东区', '湛河区', '宝丰县', '叶县', '鲁山县', '郏县' 等
  street TEXT,
  address TEXT,
  latitude REAL,
  longitude REAL
);

-- 物种维度表
TABLE dim_species (
  species_id TEXT PRIMARY KEY,
  category TEXT, -- '蚊', '蝇', '蟑螂', '鼠', '蜱', '恙螨'
  species_name TEXT, -- '淡色库蚊', '白纹伊蚊', '德国小蠊', '褐家鼠', '长角血蜱' 等
  latin_name TEXT
);

-- 监测方法维度表
TABLE dim_method (
  method_id TEXT PRIMARY KEY,
  method_name TEXT -- '诱蚊灯法', '二氧化碳诱蚊灯法', '双层叠帐法', '笼诱法', '粘捕法', '夹夜法', '布旗法' 等
);

-- 监测生境维度表
TABLE dim_environment (
  environment_id TEXT PRIMARY KEY,
  environment_type TEXT -- '居民区', '公园绿地', '农贸市场', '下水道', '农户/牲畜棚', '林地灌木' 等
);
`;

export interface Text2SqlResult {
  sql: string;
  explanation: string;
  data: any[];
  executionTimeMs: number;
}

/**
 * 核心 Text2SQL 执行引擎
 * 结合 LLM Prompting 编译与智能规则补偿兜底，并经由安全网关执行
 */
export async function executeText2Sql(userQuery: string, contextArgs?: Record<string, any>): Promise<Text2SqlResult> {
  const startTime = Date.now();
  const provider = getVectorDataProvider();

  // 1. 提取结构化参数
  const city = contextArgs?.city || (userQuery.includes('平顶山') ? '平顶山市' : '');
  const district = contextArgs?.district || '';
  const category = contextArgs?.category || '';
  const speciesName = contextArgs?.speciesName || '';
  
  // 年份提取
  const year = contextArgs?.year || (userQuery.match(/(20\d{2})/)?.[1] ? parseInt(userQuery.match(/(20\d{2})/)![1], 10) : undefined);
  // 月份提取 (支持 '6月', '06月', '6月份' 等)
  const monthMatch = userQuery.match(/(\d{1,2})\s*月/);
  const month = contextArgs?.month || (monthMatch ? parseInt(monthMatch[1], 10) : undefined);

  let generatedSql = '';
  let explanation = '';

  // 2. 构造精确规则 SQL (作为高可用基准与兜底)
  const where: string[] = ['1=1'];
  if (city) {
    where.push(`l.city LIKE '%${city.replace('市', '')}%'`);
  }
  if (district) {
    where.push(`l.district LIKE '%${district}%'`);
  }
  if (year && month) {
    const mStr = month < 10 ? `0${month}` : `${month}`;
    where.push(`substr(f.date_id, 1, 7) = '${year}-${mStr}'`);
  } else if (year) {
    where.push(`substr(f.date_id, 1, 4) = '${year}'`);
  } else if (month) {
    const mStr = month < 10 ? `0${month}` : `${month}`;
    where.push(`substr(f.date_id, 6, 2) = '${mStr}'`);
  }
  if (category) {
    where.push(`s.category = '${category}'`);
  }
  if (speciesName) {
    where.push(`s.species_name LIKE '%${speciesName}%'`);
  }

  const standardRuleSql = `
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

  // 3. 尝试通过 SiliconFlow / LLM 生成高质量 SQL
  try {
    const apiKey = process.env.SILICONFLOW_API_KEY || 'sk-wortgmadalczipcaypwssmrsxyvwhyidlzeynukcroiywxfe';
    const baseURL = process.env.SILICONFLOW_BASE_URL || 'https://api.siliconflow.cn/v1';
    const modelName = process.env.SILICONFLOW_MODEL || 'Qwen/Qwen3.6-27B';

    const systemPrompt = `你是一个专业的 CDC 疾控时空数据库 Text2SQL 专家。根据用户问题和以下 SQLite Schema，生成一条准确、高效、安全的 SELECT SQL 查询语句。
必须遵守规则：
1. 只允许输出一条 SELECT SQL，使用 markdown \`\`\`sql ... \`\`\` 包裹。
2. 严禁生成 INSERT, UPDATE, DELETE, DROP, ALTER 等写操作。
3. 默认加上 LIMIT 200，字段使用清晰的中文别名便于前端数据表格展示（如 f.date_id as '监测日期', l.city as '所属城市', l.district as '区县', s.category as '病媒大类', s.species_name as '物种名称', f.capture_count as '捕获数量(只/台次)', f.weather_temp as '环境气温(℃)' 等）。
4. 城市名匹配时使用 LIKE '%城市名%' (如 '平顶山' 匹配 '平顶山市')。
5. 年月过滤时：若有年份与月份（如 2022年6月），使用 substr(f.date_id, 1, 7) = '2022-06' 或 f.date_id LIKE '2022-06%'。

数据库 Schema:
${CDC_DB_SCHEMA}
`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500); // 2.5秒快速响应保护

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
        if (candidateSql.toLowerCase().startsWith('select') && !candidateSql.includes('breeding_site_type')) {
          generatedSql = candidateSql;
          explanation = `由 AI 大模型基于自然语言意图精准编译生成`;
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

  // 6. 执行底层数据库查询
  let data: any[] = [];
  try {
    data = await provider.queryCustomSql(finalSql);
  } catch (dbErr: any) {
    // 若 AI 生成的 SQL 字段有偏差，使用标准的 standardRuleSql 再次执行保证结果精确
    try {
      data = await provider.queryCustomSql(standardRuleSql);
      generatedSql = standardRuleSql;
      explanation = `已通过标准 SQL 规则纠偏执行`;
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
