import { VectorSkill, MetaCustomSkillData } from './types';

// 统一的客户端 Skill 执行器，调用 Next.js BFF API
async function executeSkillRemote(skillId: string, args: Record<string, any>) {
  const res = await fetch('/api/skills', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ skillId, args })
  });
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error || json.message || '技能执行失败');
  }
  return json.data;
}

// 1. 种群动态模型 (No. 23)
const skillPopulationDynamics: VectorSkill = {
  id: 'skill_population_dynamics',
  name: '种群动态与密度预测模型',
  category: 'population',
  categoryName: '种群动态分析',
  requirementNo: 'No. 23',
  description: '采用 ARIMA 与季节消长模型分析病媒生物密度季节变化趋势，关联气温/湿度，生成未来 3 个月预测曲线 (误差率≤10%)。',
  iconName: 'TrendingUp',
  badgeColor: 'sky',
  recommendedPrompts: [
    '分析近几年全省蚊类密度随气温变化的季节消长规律，并预测未来3个月密度波动。',
    '预测郑州市淡色库蚊未来一季度的密度趋势和峰值月份。',
    '查看德国小蠊在各季度的消长曲线及温湿度关联分析。'
  ],
  requiredRoles: ['PROVINCIAL_ADMIN', 'CITY_EXPERT', 'DISTRICT_SURVEILLANCE'],
  parametersSchema: {
    type: 'object',
    properties: {
      category: { type: 'string', description: '病媒大类: 蚊, 蝇, 蟑螂, 鼠, 蜱, 恙螨', enum: ['蚊', '蝇', '蟑螂', '鼠', '蜱', '恙螨'] },
      speciesName: { type: 'string', description: '物种中文名称，如 淡色库蚊, 白纹伊蚊, 褐家鼠' },
      city: { type: 'string', description: '限定地级市名称，如 郑州市, 洛阳市' },
      forecastMonths: { type: 'number', description: '预测未来月份数 (1~6)', default: 3 }
    }
  },
  execute: async (args) => executeSkillRemote('skill_population_dynamics', args)
};

// 2. 种群识别模型 (No. 24)
const skillSpeciesComposition: VectorSkill = {
  id: 'skill_species_composition',
  name: '优势种群聚类与构成比分析',
  category: 'population',
  categoryName: '种群动态分析',
  requirementNo: 'No. 24',
  description: '采用 K-Means 聚类与物种构成比算法，自动识别优势种群（如白纹伊蚊 vs 淡色库蚊构成比）及空间分布差异。',
  iconName: 'PieChart',
  badgeColor: 'indigo',
  recommendedPrompts: [
    '分析郑州市蚊类优势种群构成比（白纹伊蚊与淡色库蚊比例）。',
    '全省不同地市的鼠类优势种群构成及物种多样性指数分析。',
    '查看全省蜱虫种群分类构成及长角血蜱的空间分布。'
  ],
  requiredRoles: ['PROVINCIAL_ADMIN', 'CITY_EXPERT'],
  parametersSchema: {
    type: 'object',
    properties: {
      category: { type: 'string', description: '病媒大类: 蚊, 蝇, 蟑螂, 鼠, 蜱, 恙螨', enum: ['蚊', '蝇', '蟑螂', '鼠', '蜱', '恙螨'] },
      city: { type: 'string', description: '地级市名称' },
      year: { type: 'number', description: '监测年份' }
    }
  },
  execute: async (args) => executeSkillRemote('skill_species_composition', args)
};

// 3. 抗药性评估与用药推荐 (No. 25)
const skillResistanceEvaluation: VectorSkill = {
  id: 'skill_resistance_evaluation',
  name: '杀虫剂抗药性预测与科学用药推荐',
  category: 'resistance',
  categoryName: '抗药性评估',
  requirementNo: 'No. 25',
  description: '输入杀虫剂类型、监测点地理信息与生物测定数据，评估耐药等级（敏感/低抗/中抗/高抗），推荐科学消杀与轮换方案。',
  iconName: 'ShieldAlert',
  badgeColor: 'amber',
  recommendedPrompts: [
    '评估全省淡色库蚊对氯氰菊酯和残杀威的抗药性等级及用药调整建议。',
    '查询德国小蠊在郑州市对各类杀虫剂的 LC50 毒力测定结果与轮换方案。',
    '哪些地区对拟除虫菊酯类已达到高抗水平？'
  ],
  requiredRoles: ['PROVINCIAL_ADMIN', 'CITY_EXPERT'],
  parametersSchema: {
    type: 'object',
    properties: {
      speciesName: { type: 'string', description: '病媒生物名称' },
      pesticideName: { type: 'string', description: '杀虫剂名称' },
      city: { type: 'string', description: '监测城市' }
    }
  },
  execute: async (args) => executeSkillRemote('skill_resistance_evaluation', args)
};

// 4. 病原携带风险评估 (No. 26)
const skillPathogenRisk: VectorSkill = {
  id: 'skill_pathogen_risk',
  name: '病原携带风险与宿主关联评估',
  category: 'pathogen',
  categoryName: '病原携带风险',
  requirementNo: 'No. 26',
  description: '整合病媒病原 PCR 检测结果与宿主分布，基于关联规则挖掘识别高风险组合（登革热、乙脑、恙虫病、出血热等）。',
  iconName: 'Activity',
  badgeColor: 'rose',
  recommendedPrompts: [
    '排查全省蚊媒登革病毒与乙脑病毒的 PCR 阳性检出率及高风险区县。',
    '分析豫南地区（信阳/南阳）蜱虫携带发热伴血小板减少综合征病毒与恙虫病风险。',
    '查看鼠类携带汉坦病毒的阳性批次及宿主关联度。'
  ],
  requiredRoles: ['PROVINCIAL_ADMIN', 'CITY_EXPERT'],
  parametersSchema: {
    type: 'object',
    properties: {
      pathogenName: { type: 'string', description: '病原体名称，如 登革病毒, 乙型脑炎病毒, 恙虫病东方体' },
      speciesName: { type: 'string', description: '媒介物种名称' },
      city: { type: 'string', description: '城市' }
    }
  },
  execute: async (args) => executeSkillRemote('skill_pathogen_risk', args)
};

// 5. 动态空间预警分析 (No. 27)
const skillSpatialEarlyWarning: VectorSkill = {
  id: 'skill_spatial_early_warning',
  name: '时空动态多维预警与地图热力分析',
  category: 'warning',
  categoryName: '动态预警响应',
  requirementNo: 'No. 27',
  description: '基于多维度阈值与极端天气触发空间预警，空间插值绘制全省风险热力图，支持下钻至地市、区县与街道级。',
  iconName: 'MapPin',
  badgeColor: 'red',
  recommendedPrompts: [
    '在地图上展示全省当前的病媒生物预警热力分布，标记所有严重（红色）预警区域。',
    '下钻查看郑州市金水区和管城区的蚊媒密度空间热力与超标监测点。',
    '筛选全省处于高风险状态的重点区县并定位坐标。'
  ],
  requiredRoles: ['PROVINCIAL_ADMIN', 'CITY_EXPERT', 'DISTRICT_SURVEILLANCE', 'PUBLIC_VIEWER'],
  parametersSchema: {
    type: 'object',
    properties: {
      city: { type: 'string', description: '城市名称' },
      district: { type: 'string', description: '区县名称' },
      severity: { type: 'string', enum: ['all', 'yellow', 'orange', 'red'], description: '预警等级过滤' },
      category: { type: 'string', description: '病媒种类' }
    }
  },
  execute: async (args) => executeSkillRemote('skill_spatial_early_warning', args)
};

// 6. 预警推送与依据分发 (No. 28)
const skillAlertPushDispatch: VectorSkill = {
  id: 'skill_alert_push_dispatch',
  name: '分级预警依据与多渠道推送',
  category: 'warning',
  categoryName: '动态预警响应',
  requirementNo: 'No. 28',
  description: '按照风险等级（一般/较重/严重）自动分类预警，生成标准化通知卡片与推送到对应层级单位的依据。',
  iconName: 'BellRing',
  badgeColor: 'orange',
  recommendedPrompts: [
    '生成今日需要向各市级疾控下发的预警推送清单及依据。',
    '查看当前未解除的严重等级预警通知详情。'
  ],
  requiredRoles: ['PROVINCIAL_ADMIN', 'CITY_EXPERT', 'DISTRICT_SURVEILLANCE'],
  parametersSchema: {
    type: 'object',
    properties: {
      severity: { type: 'string', enum: ['yellow', 'orange', 'red', 'all'] }
    }
  },
  execute: async (args) => executeSkillRemote('skill_alert_push_dispatch', args)
};

// 7. 处置闭环与消杀工单 (No. 29)
const skillDisposalWorkflow: VectorSkill = {
  id: 'skill_disposal_workflow',
  name: '消杀处置闭环与工单流转管理',
  category: 'warning',
  categoryName: '动态预警响应',
  requirementNo: 'No. 29',
  description: '针对预警智能生成标准化处置建议与操作指南（如"翻盆倒罐+空间喷雾"），跟踪消杀进度并自动核销预警。',
  iconName: 'CheckCircle2',
  badgeColor: 'emerald',
  recommendedPrompts: [
    '针对郑州市金水区的蚊媒高风险预警生成消杀处置工单与操作指引。',
    '查看全省当前的消杀处置进度，核销已完成治理的预警点位。'
  ],
  requiredRoles: ['PROVINCIAL_ADMIN', 'CITY_EXPERT', 'DISTRICT_SURVEILLANCE'],
  parametersSchema: {
    type: 'object',
    properties: {
      alertId: { type: 'string', description: '预警事件ID' },
      actionType: { type: 'string', description: '处置措施类型' }
    }
  },
  execute: async (args) => executeSkillRemote('skill_disposal_workflow', args)
};

// 8. 密度预测模型 (No. 30)
const skillDensityForecast: VectorSkill = {
  id: 'skill_density_forecast',
  name: '中长期气象融合密度预测模型',
  category: 'forecast',
  categoryName: '风险预测评估',
  requirementNo: 'No. 30',
  description: '融合气象预测、地理生境与历史监测，通过 GBDT 回归模型预测未来 1-2 个月病媒密度等级。',
  iconName: 'Sparkles',
  badgeColor: 'cyan',
  recommendedPrompts: [
    '基于未来30天高温多雨气象预报，预测全省蚊幼及成蚊密度增长风险。',
    '预测夏秋之交洛阳市的蝇类密度峰值。'
  ],
  requiredRoles: ['PROVINCIAL_ADMIN', 'CITY_EXPERT'],
  parametersSchema: {
    type: 'object',
    properties: {
      city: { type: 'string' },
      category: { type: 'string' }
    }
  },
  execute: async (args) => executeSkillRemote('skill_density_forecast', args)
};

// 9. 传播风险综合评估模型 (No. 31)
const skillTransmissionRisk: VectorSkill = {
  id: 'skill_transmission_risk',
  name: '传染病传播风险综合评估模型',
  category: 'forecast',
  categoryName: '风险预测评估',
  requirementNo: 'No. 31',
  description: '构建"病媒密度 × 病原携带率 × 人群暴露指数"关联数学模型，量化评估虫媒传染病本地暴发风险指数 (0-100)。',
  iconName: 'Gauge',
  badgeColor: 'fuchsia',
  recommendedPrompts: [
    '评估郑州市登革热综合传播风险指数（病媒密度 × 病毒阳性率 × 人口密度）。',
    '分析全省各市乙脑与发热伴的输入及本地传播风险等级排序。'
  ],
  requiredRoles: ['PROVINCIAL_ADMIN', 'CITY_EXPERT'],
  parametersSchema: {
    type: 'object',
    properties: {
      city: { type: 'string' },
      diseaseName: { type: 'string', description: '疾病名称，如 登革热, 乙脑, 恙虫病' }
    }
  },
  execute: async (args) => executeSkillRemote('skill_transmission_risk', args)
};

// 10. 抗药性演化预测 (No. 32)
const skillResistanceEvolution: VectorSkill = {
  id: 'skill_resistance_evolution',
  name: '抗药性基因演化与耐药暴发预测',
  category: 'resistance',
  categoryName: '抗药性评估',
  requirementNo: 'No. 32',
  description: '基于历史抗药性数据与杀虫剂年使用频次，通过贝叶斯网络模型预测未来 1 年内耐药基因频率演化，提前预警抗性暴发。',
  iconName: 'Dna',
  badgeColor: 'purple',
  recommendedPrompts: [
    '预测未来1年全省淡色库蚊对拟除虫菊酯类的耐药性演化趋势。',
    '若维持当前用药频次，德国小蠊的抗性突变暴发概率评估。'
  ],
  requiredRoles: ['PROVINCIAL_ADMIN', 'CITY_EXPERT'],
  parametersSchema: {
    type: 'object',
    properties: {
      speciesName: { type: 'string' },
      pesticideName: { type: 'string' }
    }
  },
  execute: async (args) => executeSkillRemote('skill_resistance_evolution', args)
};

// 11. 自然语言问答 (NLQ) (No. 33)
const skillVectorNlq: VectorSkill = {
  id: 'skill_vector_nlq',
  name: 'CDC 专家知识库与数据智能问答 (NLQ)',
  category: 'nlq',
  categoryName: '智能问答',
  requirementNo: 'No. 33',
  description: '整合国家病媒生物监测规范 (GB/T)、病媒物种鉴别要点与数据库 Text2SQL，实现自然语言精准解答。',
  iconName: 'Bot',
  badgeColor: 'teal',
  recommendedPrompts: [
    '白纹伊蚊与淡色库蚊的形态学鉴别要点和主要叮咬高峰时间是什么？',
    '按照国家标准，登革热媒介伊蚊布雷图指数 (BI) 达到多少时需要启动应急消杀？',
    '诱蚊灯法与二氧化碳诱蚊灯法在操作标准上有何区别？'
  ],
  requiredRoles: ['PROVINCIAL_ADMIN', 'CITY_EXPERT', 'DISTRICT_SURVEILLANCE', 'PUBLIC_VIEWER'],
  parametersSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: '用户问答文本' }
    }
  },
  execute: async (args) => executeSkillRemote('skill_vector_nlq', args)
};

// 12. 专题监测报告一键生成 (No. 34)
const skillAutoReportGen: VectorSkill = {
  id: 'skill_auto_report_gen',
  name: '病媒监测与风险专题报告生成器',
  category: 'report',
  categoryName: '专题报告',
  requirementNo: 'No. 34',
  description: '自动提取时空监测数据、生成多维图表与专家分析综述，支持一键导出 PDF / Markdown / Word 格式。',
  iconName: 'FileText',
  badgeColor: 'blue',
  recommendedPrompts: [
    '生成郑州市2024年夏季蚊媒监测与登革热风险评估专项报告。',
    '一键汇总全省近三年抗药性监测分析月度公报并准备导出。',
    '生成信阳市蜱虫与恙虫病监测专题简报。'
  ],
  requiredRoles: ['PROVINCIAL_ADMIN', 'CITY_EXPERT'],
  parametersSchema: {
    type: 'object',
    properties: {
      reportTitle: { type: 'string' },
      city: { type: 'string' },
      period: { type: 'string' },
      category: { type: 'string' }
    }
  },
  execute: async (args) => executeSkillRemote('skill_auto_report_gen', args)
};

// 13. 移动端智能辅助与质控 API (No. 35)
const skillMobileAssistantApi: VectorSkill = {
  id: 'skill_mobile_assistant_api',
  name: '移动端现场采集识别与智能质控 API',
  category: 'mobile',
  categoryName: '移动端接口',
  requirementNo: 'No. 35',
  description: '提供移动端 REST API：现场拍照物种识别模拟、自动填单、气温与生境数据合理性实时校验。',
  iconName: 'Smartphone',
  badgeColor: 'violet',
  recommendedPrompts: [
    '启动移动端现场录入仿真器，模拟拍照识别白纹伊蚊并提交监测记录。',
    '测试移动端数据质控 API（校验气温与捕获数量逻辑性）。',
    '查看移动端 API 开发文档与 cURL 调用示例。'
  ],
  requiredRoles: ['PROVINCIAL_ADMIN', 'CITY_EXPERT', 'DISTRICT_SURVEILLANCE'],
  parametersSchema: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['simulate_capture', 'validate_form', 'api_docs'] }
    }
  },
  execute: async (args) => executeSkillRemote('skill_mobile_assistant_api', args)
};

// 14. 对话式动态创建技能构建器 (Meta-Skill Builder)
const skillMetaCustomBuilder: VectorSkill = {
  id: 'skill_meta_custom_builder',
  name: '对话式自定义技能构建器 (Meta-Skill Builder)',
  category: 'custom',
  categoryName: '自定义技能',
  description: '根据用户自然语言分析需求，动态构建专属 SQL 分析逻辑与 AG-UI 可视化卡片，注册至技能库中即刻可用。',
  iconName: 'PlusCircle',
  badgeColor: 'pink',
  recommendedPrompts: [
    '帮我创建一个新技能：专门统计近三年安阳市蜱虫携带恙虫病东方体的月度分布并在地图上标出高危村镇。',
    '创建一个自定义技能：对比郑州与洛阳两地德国小蠊的抗药性差异。'
  ],
  requiredRoles: ['PROVINCIAL_ADMIN', 'CITY_EXPERT'],
  parametersSchema: {
    type: 'object',
    properties: {
      skillName: { type: 'string', description: '自定义技能名称' },
      description: { type: 'string', description: '技能功能描述' },
      sqlQuery: { type: 'string', description: 'SQL 聚合分析语句' },
      chartType: { type: 'string', enum: ['trend', 'bar', 'pie', 'map', 'table'] }
    },
    required: ['skillName', 'description']
  },
  execute: async (args) => executeSkillRemote('skill_meta_custom_builder', args)
};

export const STANDARD_SKILLS: VectorSkill[] = [
  skillPopulationDynamics,
  skillSpeciesComposition,
  skillResistanceEvaluation,
  skillPathogenRisk,
  skillSpatialEarlyWarning,
  skillAlertPushDispatch,
  skillDisposalWorkflow,
  skillDensityForecast,
  skillTransmissionRisk,
  skillResistanceEvolution,
  skillVectorNlq,
  skillAutoReportGen,
  skillMobileAssistantApi,
  skillMetaCustomBuilder
];

export function getSkillById(skillId: string): VectorSkill | undefined {
  return STANDARD_SKILLS.find(s => s.id === skillId);
}
