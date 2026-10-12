export interface RecommendedPrompt {
  title: string;
  prompt: string;
}

// Cards send only natural-language requirements. The Agent selects skills and
// generates query and visualization arguments; data audit fixtures live in tests.
export const VECTOR_PROMPTS = {
  monitoringMap: {"title": "2024年全省蚊媒监测点位图", "prompt": "展示河南省2024年诱蚊灯法蚊类监测点位地图，以圆点大小表示平均捕获量（只/记录），附点位、监测次数和日期范围明细，最多展示200个点位。"},
  cityMap: {"title": "郑州市蚊媒监测点位图", "prompt": "展示河南省郑州市2024年诱蚊灯法蚊类监测点位地图和明细表，包含区县、坐标、平均捕获量（只/记录）及监测次数。"},
  districtComparison: {"title": "郑州市各区县蚊媒监测对比", "prompt": "对比河南省郑州市2024年各区县诱蚊灯法蚊类平均捕获量（只/记录），展示柱状图及监测次数、捕获总数表。"},
  population: {"title": "蚊媒历史趋势与三个月预测", "prompt": "分析河南省诱蚊灯法蚊类月均捕获量，以2024年12月底为截止点、前60个月为训练窗口，预测2025年1—3月，分别展示历史与预测折线图及明细。"},
  composition: {"title": "2024年全省蚊类物种构成", "prompt": "分析河南省2024年诱蚊灯法蚊类物种构成，展示捕获数量构成图、物种及地市对比表，简述优势种与多样性。"},
  forecast: {"title": "GBDT蚊媒三个月回顾性预测", "prompt": "以河南省诱蚊灯法蚊类记录开展GBDT回顾性预测：用截至2024年12月底的前60个月数据预测2025年1—3月，展示历史和预测折线图、明细及特征权重。"},
  resistance: {"title": "家蝇抗药性生测记录", "prompt": "查询河南省2020年7月9日至2025年11月5日家蝇抗药性生测记录，表格展示药剂、地市、日期、LC50、校正死亡率与登记抗性分类，保留缺失值。"},
  cockroach: {"title": "德国小蠊抗性记录明细", "prompt": "查询河南省2020年7月9日至2025年11月5日德国小蠊抗性生测记录，以表格展示药剂、地市、日期、校正死亡率及登记抗性分类。"},
  pesticides: {"title": "家蝇药剂生测样本分布", "prompt": "统计河南省2020年7月9日至2025年11月5日家蝇各药剂生测记录数，展示柱状图，附有LC50结果的记录数表。"},
  historicalTable: {"title": "平顶山2022年6月监测明细", "prompt": "查询河南省平顶山市2022年6月病媒监测明细，表格展示日期、区县、物种、采样方法、捕获量与登记投入，最多200条。"},
  pcr: {"title": "2024年蚊媒登革病毒PCR统计", "prompt": "分析河南省2024年登革病毒PCR检测记录，展示检测数量、记录阳性比例、物种分布及关联规则表，注明比例口径。"},
  summerTrend: {"title": "郑州2024年夏季蚊媒趋势", "prompt": "按月展示河南省郑州市2024年6—8月诱蚊灯法蚊类平均捕获量（只/记录）折线图，附监测次数与捕获总数表。"},
} satisfies Record<string, RecommendedPrompt>;

export const FOODBORNE_PROMPTS = {
  monthly: {"title": "食源性病例月度就诊趋势", "prompt": "使用模拟数据示例，按就诊月汇总河南省2024年1月至2026年8月食源性病例数，展示月度折线图及明细表。"},
  cities: {"title": "2026年各地市食源性病例", "prompt": "使用模拟数据示例，对比河南省2026年1—8月各地市食源性就诊病例数，展示柱状图及阳性病例数表。"},
  pathogens: {"title": "2026年食源性病原检出构成", "prompt": "使用模拟数据示例，统计河南省2026年1—8月食源性病原阳性病例，按病原展示数量柱状图和构成表。"},
  events: {"title": "2026年夏季已登记聚集事件", "prompt": "使用模拟数据示例，以表格展示河南省2026年7—8月已登记食源性聚集事件的地区、起止时间、病例数、病原与处置状态。"},
  campus: {"title": "郑州高校食堂事件发病曲线", "prompt": "使用模拟数据示例，展示郑州市金水区2026年8月18日高校食堂聚集事件的每日发病病例曲线及明细表。"},
  molecular: {"title": "高校食堂事件菌株分型对比", "prompt": "使用模拟数据示例，分析郑州市金水区2026年8月18日高校食堂事件的副溶血性弧菌分型，比较最多30株菌株的cgMLST距离，以阈值5展示候选簇及菌株明细表，注明探索性限制。"},
  foods: {"title": "2026年报告食品病例TOP10", "prompt": "使用模拟数据示例，统计河南省2026年1—8月食源性病例报告的食品，表格展示病例数前10项及阳性病例数，注明报告食品仅为关联线索。"},
  sampling: {"title": "食品抽检月度样本量", "prompt": "使用模拟数据示例，按月展示河南省2026年1—8月食品抽检批次数折线图，附各月样本量与登记病原检出数表。"},
  foodCategories: {"title": "食品抽检类别分布", "prompt": "使用模拟数据示例，统计河南省2026年1—8月各食品类别抽检批次数，展示柱状图和样本量表。"},
  ages: {"title": "食源性病例年龄组分布", "prompt": "使用模拟数据示例，统计河南省2026年1—8月食源性就诊病例的0—14岁、15—64岁和65岁及以上年龄组数量，展示柱状图与表格。"},
  venues: {"title": "食源性病例进食场所分布", "prompt": "使用模拟数据示例，统计河南省2026年1—8月食源性病例登记的进食场所类型，展示病例数柱状图与表格。"},
  cases: {"title": "郑州2026年8月病例明细", "prompt": "使用模拟数据示例，查询郑州市2026年8月食源性就诊病例，以表格展示病例编号、年龄、性别、发病和就诊时间、进食场所、病原检出状态，最多200条。"},
} satisfies Record<string, RecommendedPrompt>;

export const ENV_PROMPTS = {
  waterMap: {"title": "2026年饮用水监测站点地图", "prompt": "使用模拟数据示例，展示河南省2026年1—8月饮用水监测站点地图，以圆点大小表示样本数，附站点、地区、坐标及平均浊度表，最多200个站点。"},
  waterTypes: {"title": "郑州不同水样浊度对比", "prompt": "使用模拟数据示例，对比郑州市2026年1—8月不同水样类型的平均浊度（NTU），展示柱状图与样本量表。"},
  waterTrend: {"title": "郑州出厂水浊度月度趋势", "prompt": "使用模拟数据示例，按月展示郑州市2024年1月至2026年8月出厂水平均浊度（NTU）折线图及样本量表。"},
  sewageLag: {"title": "郑州诺如病毒与门诊滞后分析", "prompt": "使用模拟数据示例，分析郑州市2026年7—8月污水诺如病毒浓度与对应门诊数量的0—14天滞后相关性，按厂站展示相关系数、配对天数及最佳滞后窗口表，注明探索性限制。"},
  sewageTrend: {"title": "郑州污水诺如病毒日变化", "prompt": "使用模拟数据示例，按日展示郑州市2026年8月污水诺如病毒浓度算术均值（拷贝/L）折线图及样本量表。"},
  sewagePlants: {"title": "郑州污水处理厂监测对比", "prompt": "使用模拟数据示例，对比郑州市2026年7—8月各污水处理厂诺如病毒平均浓度（拷贝/L），展示柱状图及监测次数表。"},
  airTrend: {"title": "郑州2026年8月PM2.5趋势", "prompt": "使用模拟数据示例，展示郑州市2026年8月日均PM2.5（μg/m³）折线图，附每日儿童呼吸系统门诊登记数量表。"},
  heat: {"title": "2026年夏季各地市高温对比", "prompt": "使用模拟数据示例，对比河南省2026年6—8月各地市最高气温（℃），展示柱状图及观测天数表。"},
  airCities: {"title": "2026年8月各地市空气质量", "prompt": "使用模拟数据示例，对比河南省2026年8月各地市平均AQI，展示柱状图，附PM2.5均值及观测天数表。"},
  river: {"title": "四河流域水体镉监测对比", "prompt": "使用模拟数据示例，对比河南省2026年7月20日黄河、淮河、海河与长江水系水体镉均值，展示柱状图，附铅均值及断面样本量表，说明源数据单位。"},
  venues: {"title": "公共场所卫生检查分布", "prompt": "使用模拟数据示例，统计河南省2026年8月15日公共场所卫生检查，按场所类型展示检查数量柱状图及登记大肠菌群检出数表。"},
  waterRecords: {"title": "新乡2026年饮用水监测明细", "prompt": "使用模拟数据示例，查询新乡市2026年1—8月饮用水监测，表格展示日期、区县、水样类型、浊度、余氯、大肠菌群及登记达标状态，最多200条。"},
} satisfies Record<string, RecommendedPrompt>;

export const CHRONIC_PROMPTS = {
  qcSummary: {"title": "2026年死亡证明书质控分布", "prompt": "使用模拟数据示例，统计河南省2026年1月1日至8月19日死亡登记，按质控状态展示证明书数量柱状图与表格。"},
  qc: {"title": "2026年死亡证明书规则复核", "prompt": "使用模拟数据示例，复核河南省2026年1月1日至8月19日死亡记录的死因链，表格展示记录编号、触发规则及人工复核建议。"},
  causes: {"title": "2026年死因类别顺位", "prompt": "使用模拟数据示例，统计河南省2026年1月1日至8月19日死亡记录，按死因类别展示数量顺位柱状图与表格。"},
  chronicTypes: {"title": "2026年慢病登记疾病谱", "prompt": "使用模拟数据示例，统计河南省2026年1月1日至8月8日诊断的慢病记录，按疾病名称展示记录数柱状图和明细表。"},
  diabetes: {"title": "糖尿病登记月度趋势", "prompt": "使用模拟数据示例，按诊断月展示河南省2024年1月至2026年8月8日2型糖尿病记录数折线图及表格，注明最后一个月不完整。"},
  complications: {"title": "高血压记录并发症分布", "prompt": "使用模拟数据示例，统计河南省2026年1月1日至8月8日诊断为原发性高血压3级（很高危）的记录，展示登记并发症数量柱状图与表格。"},
  injuries: {"title": "2026年伤害类型与记录病因", "prompt": "使用模拟数据示例，分析河南省2026年1月1日至8月18日伤害记录，展示伤害类型、登记原因和24小时候选聚集表，简述复核限制。"},
  falls: {"title": "老年跌倒发生场所分布", "prompt": "使用模拟数据示例，统计河南省2026年1月1日至8月18日65岁及以上老年人跌倒/跌落记录，按发生场所展示病例数柱状图和表格。"},
  injuryTrend: {"title": "2026年伤害月度登记趋势", "prompt": "使用模拟数据示例，按月展示河南省2026年1月1日至8月18日伤害记录数折线图和表格，注明8月为部分月份。"},
  deathMap: {"title": "2026年死亡记录区县分布图", "prompt": "使用模拟数据示例，展示河南省2026年1月1日至8月19日死亡登记区县分布地图及数量表，以区县中心点定位，注明地理粒度。"},
  deathTrend: {"title": "2024—2026年死亡登记趋势", "prompt": "使用模拟数据示例，按月展示河南省2024年1月至2026年8月19日死亡记录数折线图及表格，注明最后一个月不完整。"},
  deathRecords: {"title": "郑州2026年死亡登记明细", "prompt": "使用模拟数据示例，查询郑州市2026年1月1日至8月19日死亡登记，表格展示证明书编号、区县、年龄、性别、死亡日期、根本死因、ICD编码和质控状态，最多200条。"},
} satisfies Record<string, RecommendedPrompt>;

// Only backed, read-only capabilities have one-click data examples.
// Planned capabilities and actions requiring uploads/approvals intentionally have none.
export const SKILL_RECOMMENDATIONS: Record<string, RecommendedPrompt[]> = {
  'skill_monitoring_data_table': [VECTOR_PROMPTS.monitoringMap, VECTOR_PROMPTS.cityMap, VECTOR_PROMPTS.districtComparison, VECTOR_PROMPTS.pesticides, VECTOR_PROMPTS.historicalTable, VECTOR_PROMPTS.summerTrend],
  'skill_population_dynamics': [VECTOR_PROMPTS.population],
  'skill_species_composition': [VECTOR_PROMPTS.composition],
  'skill_density_forecast': [VECTOR_PROMPTS.forecast],
  'skill_resistance_evaluation': [VECTOR_PROMPTS.resistance, VECTOR_PROMPTS.cockroach],
  'skill_pathogen_risk': [VECTOR_PROMPTS.pcr],
  'skill_foodborne_case_table': [FOODBORNE_PROMPTS.monthly, FOODBORNE_PROMPTS.cities, FOODBORNE_PROMPTS.pathogens, FOODBORNE_PROMPTS.events, FOODBORNE_PROMPTS.campus, FOODBORNE_PROMPTS.sampling, FOODBORNE_PROMPTS.foodCategories, FOODBORNE_PROMPTS.ages, FOODBORNE_PROMPTS.venues, FOODBORNE_PROMPTS.cases],
  'skill_molecular_trace': [FOODBORNE_PROMPTS.molecular],
  'skill_food_attribution': [FOODBORNE_PROMPTS.foods],
  'skill_env_monitoring_table': [ENV_PROMPTS.waterMap, ENV_PROMPTS.waterTypes, ENV_PROMPTS.waterTrend, ENV_PROMPTS.sewageTrend, ENV_PROMPTS.sewagePlants, ENV_PROMPTS.airTrend, ENV_PROMPTS.heat, ENV_PROMPTS.airCities, ENV_PROMPTS.river, ENV_PROMPTS.venues, ENV_PROMPTS.waterRecords],
  'skill_sewage_pathogen_trace': [ENV_PROMPTS.sewageLag],
  'skill_chronic_monitoring_table': [CHRONIC_PROMPTS.qcSummary, CHRONIC_PROMPTS.causes, CHRONIC_PROMPTS.chronicTypes, CHRONIC_PROMPTS.diabetes, CHRONIC_PROMPTS.complications, CHRONIC_PROMPTS.falls, CHRONIC_PROMPTS.injuryTrend, CHRONIC_PROMPTS.deathMap, CHRONIC_PROMPTS.deathTrend, CHRONIC_PROMPTS.deathRecords],
  'skill_death_cert_qc': [CHRONIC_PROMPTS.qc],
  'skill_injury_attribution_tree': [CHRONIC_PROMPTS.injuries],
};
