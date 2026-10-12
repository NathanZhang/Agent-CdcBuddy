import { SKILL_RECOMMENDATIONS } from '@/lib/config/recommended-prompts';
import {authHeaders} from '@/infrastructure/auth/client';
import requirementIds from '../../../config/skill-requirements.json';
import { VectorSkill, MetaCustomSkillData } from './types';

// 统一的客户端 Skill 执行器，调用 Next.js BFF API
async function executeSkillRemote(skillId: string, args: Record<string, any>) {
  try {
    if (typeof window === 'undefined') throw new Error('Remote UI execution requires browser context');
    const url = '/api/skills';
    const res = await fetch(url, {
      method: 'POST',
      headers: {...await authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ skillId, args })
    });
    if (!res.ok) {
      const text = await res.text();
      try {
        const json = JSON.parse(text);
        throw new Error(json.error || json.message || `请求失败 (${res.status})`);
      } catch {
        throw new Error(`服务响应异常 (${res.status})`);
      }
    }
    const json = await res.json();
    if (!json.success) {
      throw new Error(json.error || json.message || '技能执行失败');
    }
    return json.data;
  } catch (err: any) {
    console.error(`[Skill Execution Error: ${skillId}]`, err);
    throw err;
  }
}

// 1. 种群动态模型 (No. 23)
const skillPopulationDynamics: VectorSkill = {
  id: 'skill_population_dynamics',
  name: '种群动态与密度预测模型',
  category: 'population',
  categoryName: '种群动态分析',
  domain: 'vector',
  description: '采用 ARIMA 与季节消长模型分析病媒生物密度季节变化趋势，关联气温/湿度，生成未来 3 个月预测曲线 (误差率≤10%)。',
  iconName: 'TrendingUp',
  badgeColor: 'sky',
  recommendedPrompts: SKILL_RECOMMENDATIONS['skill_population_dynamics'] ?? [],
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
  domain: 'vector',
  description: '采用 K-Means 聚类与物种构成比算法，自动识别优势种群（如白纹伊蚊 vs 淡色库蚊构成比）及空间分布差异。',
  iconName: 'PieChart',
  badgeColor: 'indigo',
  recommendedPrompts: SKILL_RECOMMENDATIONS['skill_species_composition'] ?? [],
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
  domain: 'vector',
  description: '输入杀虫剂类型、监测点地理信息与生物测定数据，评估耐药等级（敏感/低抗/中抗/高抗），推荐科学消杀与轮换方案。',
  iconName: 'ShieldAlert',
  badgeColor: 'amber',
  recommendedPrompts: SKILL_RECOMMENDATIONS['skill_resistance_evaluation'] ?? [],
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
  domain: 'vector',
  description: '整合病媒病原 PCR 检测结果与宿主分布，基于关联规则挖掘识别高风险组合（登革热、乙脑、恙虫病、出血热等）。',
  iconName: 'Activity',
  badgeColor: 'rose',
  recommendedPrompts: SKILL_RECOMMENDATIONS['skill_pathogen_risk'] ?? [],
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
  name: '全域时空动态多维预警与地图热力分析',
  category: 'warning',
  categoryName: '动态预警响应',
  domain: 'common',
  description: '基于多维度阈值与极端天气触发空间预警，空间插值绘制全省风险热力图，支持病媒、食源、环境、慢病等全领域预警点位空间定位与区县街道下钻。',
  iconName: 'MapPin',
  badgeColor: 'red',
  recommendedPrompts: SKILL_RECOMMENDATIONS['skill_spatial_early_warning'] ?? [],
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
  domain: 'vector',
  description: '按照风险等级（一般/较重/严重）自动分类预警，生成标准化通知卡片与推送到对应层级单位的依据。',
  iconName: 'BellRing',
  badgeColor: 'orange',
  recommendedPrompts: SKILL_RECOMMENDATIONS['skill_alert_push_dispatch'] ?? [],
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
  domain: 'vector',
  description: '针对预警智能生成标准化处置建议与操作指南（如"翻盆倒罐+空间喷雾"），跟踪消杀进度并自动核销预警。',
  iconName: 'CheckCircle2',
  badgeColor: 'emerald',
  recommendedPrompts: SKILL_RECOMMENDATIONS['skill_disposal_workflow'] ?? [],
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
  domain: 'vector',
  description: '融合气象预测、地理生境与历史监测，通过 GBDT 回归模型预测未来 1-2 个月病媒密度等级。',
  iconName: 'Sparkles',
  badgeColor: 'cyan',
  recommendedPrompts: SKILL_RECOMMENDATIONS['skill_density_forecast'] ?? [],
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
  domain: 'vector',
  description: '构建"病媒密度 × 病原携带率 × 人群暴露指数"关联数学模型，量化评估虫媒传染病本地暴发风险指数 (0-100)。',
  iconName: 'Gauge',
  badgeColor: 'fuchsia',
  recommendedPrompts: SKILL_RECOMMENDATIONS['skill_transmission_risk'] ?? [],
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
  domain: 'vector',
  description: '基于历史抗药性数据与杀虫剂年使用频次，通过贝叶斯网络模型预测未来 1 年内耐药基因频率演化，提前预警抗性暴发。',
  iconName: 'Dna',
  badgeColor: 'purple',
  recommendedPrompts: SKILL_RECOMMENDATIONS['skill_resistance_evolution'] ?? [],
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
  domain: 'vector',
  description: '整合国家病媒生物监测规范 (GB/T)、病媒物种鉴别要点与数据库 Text2SQL，实现自然语言精准解答。',
  iconName: 'Bot',
  badgeColor: 'teal',
  recommendedPrompts: SKILL_RECOMMENDATIONS['skill_vector_nlq'] ?? [],
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
  name: '全域监测与风险专题报告生成器',
  category: 'report',
  categoryName: '专题报告',
  domain: 'common',
  description: '自动提取全域时空监测数据、异常预警指标、生成多维图表与专家分析综述，支持病媒生物、环境健康等领域的专题公报与月度专报导出。',
  iconName: 'FileText',
  badgeColor: 'blue',
  recommendedPrompts: SKILL_RECOMMENDATIONS['skill_auto_report_gen'] ?? [],
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
  domain: 'vector',
  description: '提供移动端 REST API：现场拍照物种识别模拟、自动填单、气温与生境数据合理性实时校验。',
  iconName: 'Smartphone',
  badgeColor: 'violet',
  recommendedPrompts: SKILL_RECOMMENDATIONS['skill_mobile_assistant_api'] ?? [],
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
  name: '病媒对话式自定义技能构建器 (Meta-Skill Builder)',
  category: 'custom',
  categoryName: '自定义技能',
  domain: 'vector',
  description: '根据病媒生物监测与消杀分析需求，动态构建专属 SQL 分析逻辑与 AG-UI 可视化卡片，注册至病媒技能库中即刻可用。',
  iconName: 'PlusCircle',
  badgeColor: 'pink',
  recommendedPrompts: SKILL_RECOMMENDATIONS['skill_meta_custom_builder'] ?? [],
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

// 15. 病媒监测明细数据表查询 (Text2SQL)
const skillMonitoringDataTable: VectorSkill = {
  id: 'skill_monitoring_data_table',
  name: '病媒监测明细数据表查询 (Text2SQL)',
  category: 'nlq',
  categoryName: '数据表格',
  domain: 'vector',
  description: '支持按地市、区县、年份、病媒大类多维度检索病媒监测原始数据库并基于 Text2SQL 以交互式表格展示。',
  iconName: 'Table',
  badgeColor: 'sky',
  recommendedPrompts: SKILL_RECOMMENDATIONS['skill_monitoring_data_table'] ?? [],
  requiredRoles: ['PROVINCIAL_ADMIN', 'CITY_EXPERT', 'DISTRICT_SURVEILLANCE', 'PUBLIC_VIEWER'],
  parametersSchema: {
    type: 'object',
    properties: {
      city: { type: 'string', description: '地级市名称' },
      district: { type: 'string', description: '区县名称' },
      year: { type: 'number', description: '年份 (如 2022, 2023, 2024)' },
      category: { type: 'string', description: '病媒种类' },
      query: { type: 'string', description: '自然语言查询语句' }
    }
  },
  execute: async (args) => executeSkillRemote('skill_monitoring_data_table', args)
};

// 16. SaTScan 空间泊松时空扫描模型 (独立原子技能)
const skillSatScanSpatial: VectorSkill = {
  domain: 'vector',
  id: 'skill_satscan_spatial',
  name: 'SaTScan 空间泊松时空扫描模型',
  category: 'warning',
  categoryName: '空间聚集扫描',
  description: '采用 Kulldorff 空间泊松扫描统计量对全省县区病媒监测数据进行动态扫描，计算对数似然比 LLR、相对危险度 RR 与 Monte Carlo 显著性检验 (p<0.05)，并在 GIS 地图上可视化扫描半径与高危聚集簇。',
  iconName: 'MapPin',
  badgeColor: 'rose',
  recommendedPrompts: SKILL_RECOMMENDATIONS['skill_satscan_spatial'] ?? [],
  requiredRoles: ['PROVINCIAL_ADMIN', 'CITY_EXPERT', 'DISTRICT_SURVEILLANCE'],
  parametersSchema: {
    type: 'object',
    properties: {
      year: { type: 'number', description: '分析目标年份 (如 2022, 2023)', default: 2022 },
      month: { type: 'number', description: '分析目标月份 (1~12)', default: 6 },
      category: { type: 'string', description: '病媒种类 (蚊, 蝇, 蟑螂, 鼠)', default: '蚊' },
      maxRadiusKm: { type: 'number', description: '最大扫描半径 (km)', default: 120.0 },
      pThreshold: { type: 'number', description: '显著性检验阈值', default: 0.05 }
    }
  },
  execute: async (args) => executeSkillRemote('skill_satscan_spatial', args)
};

// 17. LSTM 深度时序预测模型 (独立原子技能)
const skillLSTMPredictor: VectorSkill = {
  domain: 'vector',
  id: 'skill_lstm_predictor',
  name: 'LSTM 深度时序外推预测模型',
  category: 'forecast',
  categoryName: '深度时序预测',
  description: '采用 4 门控递归神经网络 (LSTM) 结合历史监测序列与温湿度特征，滚动预测重点地市未来 7~14 天日级密度走势与 95% 带状置信区间扩散范围，自动识别暴发峰值并提示红线预警。',
  iconName: 'TrendingUp',
  badgeColor: 'indigo',
  recommendedPrompts: SKILL_RECOMMENDATIONS['skill_lstm_predictor'] ?? [],
  requiredRoles: ['PROVINCIAL_ADMIN', 'CITY_EXPERT'],
  parametersSchema: {
    type: 'object',
    properties: {
      city: { type: 'string', description: '目标地市名称 (如 郑州市, 信阳市)' },
      targetCities: { type: 'array', description: '多地市列表' },
      category: { type: 'string', description: '病媒种类 (蚊, 蝇, 蟑螂, 鼠)', default: '蚊' },
      forecastDays: { type: 'number', description: '预测天数 (7~14 天)', default: 7 },
      startDateStr: { type: 'string', description: '预测起始日期 (YYYY-MM-DD)' }
    }
  },
  execute: async (args) => executeSkillRemote('skill_lstm_predictor', args)
};

// 18. SaTScan ➔ K-Means ➔ LSTM 多步科学计算流水线 (LangGraph Workflow)
const skillSatScanKMeansLSTM: VectorSkill = {
  domain: 'vector',
  id: 'skill_satscan_kmeans_lstm',
  name: 'SaTScan ➔ K-Means ➔ LSTM 多步科学计算流水线',
  category: 'forecast',
  categoryName: '多步科学计算',
  description: '采用 LangGraph 状态图执行级联计算：调用 SaTScan 泊松时空扫描识别聚集簇，经 K-Means 生态特征亚群画像后，将高危区域导入 LSTM 进行未来 7 天时序趋势与置信区间外推预测。',
  iconName: 'Workflow',
  badgeColor: 'purple',
  recommendedPrompts: SKILL_RECOMMENDATIONS['skill_satscan_kmeans_lstm'] ?? [],
  requiredRoles: ['PROVINCIAL_ADMIN', 'CITY_EXPERT'],
  parametersSchema: {
    type: 'object',
    properties: {
      year: { type: 'number', description: '分析目标年份 (默认 2022)', default: 2022 },
      month: { type: 'number', description: '分析目标月份 (1~12，默认 3)', default: 3 },
      category: { type: 'string', description: '病媒种类 (蚊, 蝇, 蟑螂, 鼠)', default: '蚊' },
      forecastDays: { type: 'number', description: 'LSTM 预测天数 (默认 7 天)', default: 7 },
      pThreshold: { type: 'number', description: 'SaTScan 显著性 p 阈值 (默认 0.05)', default: 0.05 }
    }
  },
  execute: async (args) => executeSkillRemote('skill_satscan_kmeans_lstm', args)
};

// 19. 通用多技能可编排工作流 (LangGraph Composable Workflow)
const skillComposableWorkflow: VectorSkill = {
  domain: 'vector',
  id: 'skill_composable_workflow',
  name: '通用多技能动态协同工作流 (LangGraph Composable)',
  category: 'forecast',
  categoryName: '通用工作流',
  description: '支持将系统内任意多项 Skill（如 SaTScan 扫描、病原 PCR 关联、抗药性演化、消杀派单、专题公报）通过 LangGraph 动态编排为链式协同流水线，实现上下文无缝传递与联合研判。',
  iconName: 'Layers',
  badgeColor: 'amber',
  recommendedPrompts: SKILL_RECOMMENDATIONS['skill_composable_workflow'] ?? [],
  requiredRoles: ['PROVINCIAL_ADMIN', 'CITY_EXPERT'],
  parametersSchema: {
    type: 'object',
    properties: {
      workflowName: { type: 'string', description: '工作流名称' },
      steps: { type: 'array', description: '步骤定义列表' },
      initialContext: { type: 'object', description: '初始上下文参数' }
    }
  },
  execute: async (args) => executeSkillRemote('skill_composable_workflow', args)
};

// 20. 后台常驻数据分析智能体管理与即时巡检 (Surveillance Daemon Agent)
const skillDaemonSurveillance: VectorSkill = {
  domain: 'vector',
  id: 'skill_daemon_surveillance',
  name: '后台常驻数据分析智能体 (Daemon Agent)',
  category: 'warning',
  categoryName: '智能体守护',
  description: '管理与触发后台常驻巡检智能体，支持专家提示词策略注入，自动扫描多维时空异常、生成分级预警并推送到消息队列。',
  iconName: 'ShieldAlert',
  badgeColor: 'rose',
  recommendedPrompts: SKILL_RECOMMENDATIONS['skill_daemon_surveillance'] ?? [],
  requiredRoles: ['PROVINCIAL_ADMIN', 'CITY_EXPERT'],
  parametersSchema: {
    type: 'object',
    properties: {
      promptPolicy: { type: 'string', description: '专家自然语言巡检策略或提示词' },
      triggerSource: { type: 'string', description: '触发源 (timer_scheduled | event_driven | manual_invoke)', default: 'manual_invoke' }
    }
  },
  execute: async (args) => executeSkillRemote('skill_daemon_surveillance', args)
};

// ==============================================================================
// 食源性疾病监测预警智能应用专属技能 (No. 36 ~ 41)
// ==============================================================================

// 1. 聚集性病例识别模型 (No. 36)
const skillFoodborneClusterDetect: VectorSkill = {
  id: 'skill_foodborne_cluster_detect',
  name: '食源性聚集性病例时空扫描与暴发识别',
  category: 'warning',
  categoryName: '聚集性识别',
  domain: 'foodborne',
  description: '基于时空聚类算法（SaTScan 多维圆柱扫描），自动识别短期内同一区域、相似症状或共同饮食暴露史的聚集性病例，动态调整预警阈值。',
  iconName: 'AlertTriangle',
  badgeColor: 'rose',
  recommendedPrompts: SKILL_RECOMMENDATIONS['skill_foodborne_cluster_detect'] ?? [],
  requiredRoles: ['PROVINCIAL_ADMIN', 'CITY_EXPERT', 'DISTRICT_SURVEILLANCE'],
  parametersSchema: {
    type: 'object',
    properties: {
      city: { type: 'string', description: '地级市名称，如 郑州市' },
      district: { type: 'string', description: '区县名称，如 金水区' }
    }
  },
  execute: async (args) => executeSkillRemote('skill_foodborne_cluster_detect', args)
};

// 2. 食源性风险时序预测模型 (No. 37)
const skillFoodborneRiskForecast: VectorSkill = {
  id: 'skill_foodborne_risk_forecast',
  name: '食源性风险预测与时序外推模型',
  category: 'forecast',
  categoryName: '风险预测',
  domain: 'foodborne',
  description: '融合历史病例、气象温度与季节因素，构建 LSTM 时间序列模型，预测未来 4 周高风险区域、病原体类型及扩散风险。',
  iconName: 'TrendingUp',
  badgeColor: 'amber',
  recommendedPrompts: SKILL_RECOMMENDATIONS['skill_foodborne_risk_forecast'] ?? [],
  requiredRoles: ['PROVINCIAL_ADMIN', 'CITY_EXPERT'],
  parametersSchema: {
    type: 'object',
    properties: {
      city: { type: 'string', description: '地级市名称' },
      pathogenType: { type: 'string', description: '致病菌/病毒名称' }
    }
  },
  execute: async (args) => executeSkillRemote('skill_foodborne_risk_forecast', args)
};

// 3. 致病菌全基因组 cgMLST 同源溯源分析 (No. 38)
const skillMolecularTrace: VectorSkill = {
  id: 'skill_molecular_trace',
  name: '致病菌全基因组 cgMLST 同源分子溯源',
  category: 'pathogen',
  categoryName: '病原溯源',
  domain: 'foodborne',
  description: '对比致病菌基因序列相似度，构建核心基因组 cgMLST 等位基因进化树与最小生成树，基于 Δ ≤ 5 阈值快速锁定同源暴发源头。',
  iconName: 'GitBranch',
  badgeColor: 'emerald',
  recommendedPrompts: SKILL_RECOMMENDATIONS['skill_molecular_trace'] ?? [],
  requiredRoles: ['PROVINCIAL_ADMIN', 'CITY_EXPERT'],
  parametersSchema: {
    type: 'object',
    properties: {
      clusterId: { type: 'string', description: '暴发事件编号，如 OUTBREAK-202608-01' },
      pathogenId: { type: 'string', description: '致病菌编号' },
      threshold: { type: 'number', description: '同源判定最大位点差异阈值 (默认 5)', default: 5 }
    }
  },
  execute: async (args) => executeSkillRemote('skill_molecular_trace', args)
};

// 4. 可疑暴露食品归因与比值比挖掘 (No. 38辅助 / No. 40)
const skillFoodAttribution: VectorSkill = {
  id: 'skill_food_attribution',
  name: '可疑进食暴露食品归因与比值比分析',
  category: 'pathogen',
  categoryName: '食品归因',
  domain: 'foodborne',
  description: '融合病例进食史与食品抽检检测数据，计算暴露比值比 (Odds Ratio, OR) 与归因危险度，输出高风险食品 TOP10 排行。',
  iconName: 'FileText',
  badgeColor: 'indigo',
  recommendedPrompts: SKILL_RECOMMENDATIONS['skill_food_attribution'] ?? [],
  requiredRoles: ['PROVINCIAL_ADMIN', 'CITY_EXPERT', 'DISTRICT_SURVEILLANCE'],
  parametersSchema: {
    type: 'object',
    properties: {
      city: { type: 'string', description: '地级市名称' },
      topN: { type: 'number', description: '返回排行数量 (默认 10)', default: 10 }
    }
  },
  execute: async (args) => executeSkillRemote('skill_food_attribution', args)
};

// 5. 食源性突发事件标准化处置建议 (No. 39)
const skillOutbreakDisposalAdvice: VectorSkill = {
  id: 'skill_outbreak_disposal_advice',
  name: '食源性暴发事件标准化处置建议与协同工单',
  category: 'disposal',
  categoryName: '处置闭环',
  domain: 'foodborne',
  description: '针对聚集性暴发事件，推送标准化流调处置流程，智能匹配历史相似处置案例，生成流行病学调查协同指引卡。',
  iconName: 'ClipboardCheck',
  badgeColor: 'sky',
  recommendedPrompts: SKILL_RECOMMENDATIONS['skill_outbreak_disposal_advice'] ?? [],
  requiredRoles: ['PROVINCIAL_ADMIN', 'CITY_EXPERT', 'DISTRICT_SURVEILLANCE'],
  parametersSchema: {
    type: 'object',
    properties: {
      clusterId: { type: 'string', description: '暴发事件编号' },
      pathogenName: { type: 'string', description: '致病菌种' }
    }
  },
  execute: async (args) => executeSkillRemote('skill_outbreak_disposal_advice', args)
};

// 6. 食源性疾病专题公报与流调简报导出 (No. 41)
const skillFoodborneReportExport: VectorSkill = {
  id: 'skill_foodborne_report_export',
  name: '食源性疾病暴发调查专题公报与简报生成',
  category: 'report',
  categoryName: '专题报告',
  domain: 'foodborne',
  description: '自动提取暴发事件关键信息、病例时空消长、致病菌同源溯源图谱与嫌疑食品归因，一键生成图文流调专题公报并支持导出。',
  iconName: 'FileCheck2',
  badgeColor: 'purple',
  recommendedPrompts: SKILL_RECOMMENDATIONS['skill_foodborne_report_export'] ?? [],
  requiredRoles: ['PROVINCIAL_ADMIN', 'CITY_EXPERT'],
  parametersSchema: {
    type: 'object',
    properties: {
      clusterId: { type: 'string', description: '暴发事件编号' },
      reportType: { type: 'string', description: '报告类型 (brief | monthly | outbreak)', default: 'outbreak' }
    }
  },
  execute: async (args) => executeSkillRemote('skill_foodborne_report_export', args)
};

// 7. 食源性病例与食品抽检明细查询 (Text2SQL) - 食源性专属
const skillFoodborneCaseTable: VectorSkill = {
  id: 'skill_foodborne_case_table',
  name: '食源性病例与抽检台账查询 (Text2SQL)',
  category: 'nlq',
  categoryName: '数据表格',
  domain: 'foodborne',
  description: '支持按地市、区县、监测年份、致病菌种及嫌疑食品多维度检索食源性病例与食品安全抽检原始数据库，并基于 Text2SQL 以交互式表格展示。',
  iconName: 'Table',
  badgeColor: 'orange',
  recommendedPrompts: SKILL_RECOMMENDATIONS['skill_foodborne_case_table'] ?? [],
  requiredRoles: ['PROVINCIAL_ADMIN', 'CITY_EXPERT', 'DISTRICT_SURVEILLANCE', 'PUBLIC_VIEWER'],
  parametersSchema: {
    type: 'object',
    properties: {
      city: { type: 'string', description: '地级市名称' },
      district: { type: 'string', description: '区县名称' },
      pathogen: { type: 'string', description: '致病菌种类' },
      query: { type: 'string', description: '自然语言查询语句' }
    }
  },
  execute: async (args) => executeSkillRemote('skill_foodborne_case_table', args)
};

// 8. 食源性专属自定义技能构建器 (Meta-Skill Builder) - 食源性专属
const skillFoodborneCustomBuilder: VectorSkill = {
  id: 'skill_foodborne_custom_builder',
  name: '食源性专属自定义技能构建器 (Meta-Skill Builder)',
  category: 'custom',
  categoryName: '自定义技能',
  domain: 'foodborne',
  description: '根据食源性疾病流行病学分析需求，动态构建专属 SQL 分析逻辑与 AG-UI 可视化卡片，注册至食源技能库中即刻可用。',
  iconName: 'PlusCircle',
  badgeColor: 'pink',
  recommendedPrompts: SKILL_RECOMMENDATIONS['skill_foodborne_custom_builder'] ?? [],
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
  execute: async (args) => executeSkillRemote('skill_foodborne_custom_builder', args)
};

// ==============================================================================
// 环境相关风险因素监测预警智能应用专属技能 (No. 42 ~ 58)
// ==============================================================================

const skillEnvOcrEntry: VectorSkill = {
  id: 'skill_env_ocr_entry',
  name: '水质与环境单据 OCR 智能录入引擎',
  category: 'mobile',
  categoryName: '数据录入',
  domain: 'env',
  description: '支持水质化验单、空气监测报表与污染源台账的拍照/PDF 智能 OCR 结构化提取与自动校验。',
  iconName: 'FileText',
  badgeColor: 'cyan',
  recommendedPrompts: SKILL_RECOMMENDATIONS['skill_env_ocr_entry'] ?? [],
  requiredRoles: ['PROVINCIAL_ADMIN', 'CITY_EXPERT', 'DISTRICT_SURVEILLANCE'],
  execute: async (args) => executeSkillRemote('skill_env_ocr_entry', args)
};

const skillWaterSafetyEval: VectorSkill = {
  id: 'skill_water_safety_eval',
  name: '饮用水全流程健康风险评估与时序预测',
  category: 'warning',
  categoryName: '水质安全',
  domain: 'env',
  description: '基于随机森林模型自动计算致癌/非致癌健康风险，结合克里金空间插值输出管网水质风险热力图。',
  iconName: 'Droplets',
  badgeColor: 'blue',
  recommendedPrompts: SKILL_RECOMMENDATIONS['skill_water_safety_eval'] ?? [],
  requiredRoles: ['PROVINCIAL_ADMIN', 'CITY_EXPERT'],
  execute: async (args) => executeSkillRemote('skill_water_safety_eval', args)
};

const skillSewagePathogenTrace: VectorSkill = {
  id: 'skill_sewage_pathogen_trace',
  name: '污水管网病原时序滞后关联与拓扑反向溯源',
  category: 'pathogen',
  categoryName: '污水监测',
  domain: 'env',
  description: '分析污水病原浓度与哨点医院门诊量的时间滞后相关性，结合管网 GIS 空间拓扑聚类反推污染源。',
  iconName: 'Activity',
  badgeColor: 'teal',
  recommendedPrompts: SKILL_RECOMMENDATIONS['skill_sewage_pathogen_trace'] ?? [],
  requiredRoles: ['PROVINCIAL_ADMIN', 'CITY_EXPERT'],
  execute: async (args) => executeSkillRemote('skill_sewage_pathogen_trace', args)
};

const skillAirClimateHealthRisk: VectorSkill = {
  id: 'skill_air_climate_health_risk',
  name: '空气污染暴露评估与 72h 极端气候健康预警',
  category: 'forecast',
  categoryName: '气候暴露',
  domain: 'env',
  description: '采用 DLNM 分布滞后非线性模型与 GBDT，提前 72 小时针对高温热浪与寒潮重污染触发脆弱人群防护预警。',
  iconName: 'SunMedium',
  badgeColor: 'amber',
  recommendedPrompts: SKILL_RECOMMENDATIONS['skill_air_climate_health_risk'] ?? [],
  requiredRoles: ['PROVINCIAL_ADMIN', 'CITY_EXPERT'],
  execute: async (args) => executeSkillRemote('skill_air_climate_health_risk', args)
};

const skillRiverBasinPollutionChain: VectorSkill = {
  id: 'skill_river_basin_pollution_chain',
  name: '四河流域跨介质重金属污染链与健康效应评估',
  category: 'warning',
  categoryName: '流域评估',
  domain: 'env',
  description: '分析四河流域"水体铅镉-农田土壤-粮食作物"跨介质污染传递链，通过空间自相关定位健康高风险区。',
  iconName: 'GitBranch',
  badgeColor: 'indigo',
  recommendedPrompts: SKILL_RECOMMENDATIONS['skill_river_basin_pollution_chain'] ?? [],
  requiredRoles: ['PROVINCIAL_ADMIN', 'CITY_EXPERT'],
  execute: async (args) => executeSkillRemote('skill_river_basin_pollution_chain', args)
};

const skillEnvScenarioSimulation: VectorSkill = {
  id: 'skill_env_scenario_simulation',
  name: '环境干预政策健康效益量化情景推演',
  category: 'forecast',
  categoryName: '情景推演',
  domain: 'env',
  description: '模拟工业排污削减、应急减排或水源切换方案下的健康效益与疾病负担降幅量化推演。',
  iconName: 'SlidersHorizontal',
  badgeColor: 'purple',
  recommendedPrompts: SKILL_RECOMMENDATIONS['skill_env_scenario_simulation'] ?? [],
  requiredRoles: ['PROVINCIAL_ADMIN', 'CITY_EXPERT'],
  execute: async (args) => executeSkillRemote('skill_env_scenario_simulation', args)
};

const skillEnvMonitoringTable: VectorSkill = {
  id: 'skill_env_monitoring_table',
  name: '环境水质与空气监测数据表查询 (Text2SQL)',
  category: 'nlq',
  categoryName: '数据表格',
  domain: 'env',
  description: '支持按地市、区县、水厂监测点及空气监测站点检索环境健康原始数据库，并基于 Text2SQL 以交互式表格展示。',
  iconName: 'Table',
  badgeColor: 'cyan',
  recommendedPrompts: SKILL_RECOMMENDATIONS['skill_env_monitoring_table'] ?? [],
  requiredRoles: ['PROVINCIAL_ADMIN', 'CITY_EXPERT', 'DISTRICT_SURVEILLANCE', 'PUBLIC_VIEWER'],
  execute: async (args) => executeSkillRemote('skill_env_monitoring_table', args)
};

const skillEnvCustomBuilder: VectorSkill = {
  id: 'skill_env_custom_builder',
  name: '环境健康专属自定义技能构建器 (Meta-Skill Builder)',
  category: 'custom',
  categoryName: '自定义技能',
  domain: 'env',
  description: '根据环境健康风险研判需求，动态构建专属水质/空气分析逻辑与 AG-UI 可视化卡片，注册至环境健康技能库中。',
  iconName: 'PlusCircle',
  badgeColor: 'teal',
  recommendedPrompts: SKILL_RECOMMENDATIONS['skill_env_custom_builder'] ?? [],
  requiredRoles: ['PROVINCIAL_ADMIN', 'CITY_EXPERT'],
  execute: async (args) => executeSkillRemote('skill_env_custom_builder', args)
};

// 环境健康：突发超标预警空间溯源与应急处置闭环 (No. 54/55)
const skillEnvEarlyWarningDisposal: VectorSkill = {
  id: 'skill_env_early_warning_disposal',
  name: '环境健康超标预警空间溯源与应急处置闭环',
  category: 'warning',
  categoryName: '环境处置',
  domain: 'env',
  description: '针对管网末梢水超标、空气重污染持续或流域断面污染等突发环境预警事件，进行空间溯源与危害研判，生成供水管网冲洗排查、污染源排查与易感人群防护处置工单。',
  iconName: 'AlertTriangle',
  badgeColor: 'amber',
  recommendedPrompts: SKILL_RECOMMENDATIONS['skill_env_early_warning_disposal'] ?? [],
  requiredRoles: ['PROVINCIAL_ADMIN', 'CITY_EXPERT', 'DISTRICT_SURVEILLANCE'],
  parametersSchema: {
    type: 'object',
    properties: {
      alertId: { type: 'string', description: '预警事件编号，如 ALERT-ENV-202608-01' },
      city: { type: 'string', description: '地级市名称，如 郑州市' },
      district: { type: 'string', description: '区县名称，如 高新区' },
      action: { type: 'string', enum: ['dispatch', 'resolve', 'reopen'], description: '工单操作类型' }
    }
  },
  execute: async (args) => executeSkillRemote('skill_env_early_warning_disposal', args)
};

// ==============================================================================
// 死因、慢病及伤害综合监测智能应用专属技能 (No. 59 ~ 73)
// ==============================================================================

const skillDeathCertQc: VectorSkill = {
  id: 'skill_death_cert_qc',
  name: '人口死亡医学证明书智能逻辑质控与冲突校验',
  category: 'warning',
  categoryName: '死因质控',
  domain: 'chronic',
  description: '基于规则引擎与 NLP 校验死亡医学证明书死因链逻辑顺应性、年龄性别冲突与根本死因缺失。',
  iconName: 'ClipboardCheck',
  badgeColor: 'rose',
  recommendedPrompts: SKILL_RECOMMENDATIONS['skill_death_cert_qc'] ?? [],
  requiredRoles: ['PROVINCIAL_ADMIN', 'CITY_EXPERT', 'DISTRICT_SURVEILLANCE'],
  execute: async (args) => executeSkillRemote('skill_death_cert_qc', args)
};

const skillIcd10NlpInference: VectorSkill = {
  id: 'skill_icd10_nlp_inference',
  name: '死因链医学知识图谱根本死因推断与 ICD-10 编码',
  category: 'pathogen',
  categoryName: '根本死因',
  domain: 'chronic',
  description: '基于医学知识图谱对复杂死因链自动进行根本死因因果推导，精准匹配 ICD-10 国家标准编码。',
  iconName: 'GitBranch',
  badgeColor: 'purple',
  recommendedPrompts: SKILL_RECOMMENDATIONS['skill_icd10_nlp_inference'] ?? [],
  requiredRoles: ['PROVINCIAL_ADMIN', 'CITY_EXPERT'],
  execute: async (args) => executeSkillRemote('skill_icd10_nlp_inference', args)
};

const skillMortalityClusterRare: VectorSkill = {
  id: 'skill_mortality_cluster_rare',
  name: '全死因时序动态图谱与罕见死因短期聚集识别',
  category: 'warning',
  categoryName: '罕见聚集',
  domain: 'chronic',
  description: '构建 ARIMA 死亡时序基线，采用 DBSCAN 探测全死因时空高危聚集与低频罕见死因异常激增。',
  iconName: 'AlertTriangle',
  badgeColor: 'amber',
  recommendedPrompts: SKILL_RECOMMENDATIONS['skill_mortality_cluster_rare'] ?? [],
  requiredRoles: ['PROVINCIAL_ADMIN', 'CITY_EXPERT'],
  execute: async (args) => executeSkillRemote('skill_mortality_cluster_rare', args)
};

const skillChronicRiskForecast: VectorSkill = {
  id: 'skill_chronic_risk_forecast',
  name: '三大重大慢病发病预测与并发症关联挖掘',
  category: 'forecast',
  categoryName: '慢病预测',
  domain: 'chronic',
  description: '基于 GBDT 与生存分析预测心脑血管与恶性肿瘤发病趋势，通过关联规则挖掘高危并发症链条。',
  iconName: 'TrendingUp',
  badgeColor: 'rose',
  recommendedPrompts: SKILL_RECOMMENDATIONS['skill_chronic_risk_forecast'] ?? [],
  requiredRoles: ['PROVINCIAL_ADMIN', 'CITY_EXPERT'],
  execute: async (args) => executeSkillRemote('skill_chronic_risk_forecast', args)
};

const skillInjuryAttributionTree: VectorSkill = {
  id: 'skill_injury_attribution_tree',
  name: '伤害特征聚类与因果决策树归因分析',
  category: 'warning',
  categoryName: '伤害归因',
  domain: 'chronic',
  description: '对全省门诊伤害病例聚类，构建决策树量化农机操作、跌倒或一氧化碳中毒的诱因归因比。',
  iconName: 'Activity',
  badgeColor: 'orange',
  recommendedPrompts: SKILL_RECOMMENDATIONS['skill_injury_attribution_tree'] ?? [],
  requiredRoles: ['PROVINCIAL_ADMIN', 'CITY_EXPERT'],
  execute: async (args) => executeSkillRemote('skill_injury_attribution_tree', args)
};

const skillChronicScreeningRoi: VectorSkill = {
  id: 'skill_chronic_screening_roi',
  name: '早癌与心脑血管筛查卫生经济学收益与人群清单',
  category: 'report',
  categoryName: '筛查收益',
  domain: 'chronic',
  description: '综合区县老龄化与高发疾病谱，智能生成早癌筛查推荐清单及卫生经济学成本效果(CEA)测算。',
  iconName: 'FileCheck2',
  badgeColor: 'blue',
  recommendedPrompts: SKILL_RECOMMENDATIONS['skill_chronic_screening_roi'] ?? [],
  requiredRoles: ['PROVINCIAL_ADMIN', 'CITY_EXPERT'],
  execute: async (args) => executeSkillRemote('skill_chronic_screening_roi', args)
};

const skillChronicDeathReport: VectorSkill = {
  id: 'skill_chronic_death_report',
  name: '死因顺位、YPLL 与早死概率 4q70 综合公报生成',
  category: 'report',
  categoryName: '综合公报',
  domain: 'chronic',
  description: '测算 30~70 岁四类重大慢病过早死亡概率(4q70)、潜在减寿年数(YPLL)，一键生成综合监测年度公报。',
  iconName: 'FileText',
  badgeColor: 'purple',
  recommendedPrompts: SKILL_RECOMMENDATIONS['skill_chronic_death_report'] ?? [],
  requiredRoles: ['PROVINCIAL_ADMIN', 'CITY_EXPERT'],
  execute: async (args) => executeSkillRemote('skill_chronic_death_report', args)
};

const skillChronicMonitoringTable: VectorSkill = {
  id: 'skill_chronic_monitoring_table',
  name: '死因证明书与慢病随访明细查询 (Text2SQL)',
  category: 'nlq',
  categoryName: '数据表格',
  domain: 'chronic',
  description: '支持按地市、区县、死因大类、ICD-10 编码及慢病随访类型检索全死因监测数据库，并基于 Text2SQL 以交互式表格展示。',
  iconName: 'Table',
  badgeColor: 'rose',
  recommendedPrompts: SKILL_RECOMMENDATIONS['skill_chronic_monitoring_table'] ?? [],
  requiredRoles: ['PROVINCIAL_ADMIN', 'CITY_EXPERT', 'DISTRICT_SURVEILLANCE', 'PUBLIC_VIEWER'],
  execute: async (args) => executeSkillRemote('skill_chronic_monitoring_table', args)
};

const skillChronicCustomBuilder: VectorSkill = {
  id: 'skill_chronic_custom_builder',
  name: '慢病死因专属自定义技能构建器 (Meta-Skill Builder)',
  category: 'custom',
  categoryName: '自定义技能',
  domain: 'chronic',
  description: '根据慢病防制与死因谱研判需求，动态构建专属 SQL 分析逻辑与 AG-UI 可视化卡片，注册至慢病技能库中。',
  iconName: 'PlusCircle',
  badgeColor: 'pink',
  recommendedPrompts: SKILL_RECOMMENDATIONS['skill_chronic_custom_builder'] ?? [],
  requiredRoles: ['PROVINCIAL_ADMIN', 'CITY_EXPERT'],
  execute: async (args) => executeSkillRemote('skill_chronic_custom_builder', args)
};

// 慢病与死因：突发就诊峰值预警深度研判与应急处置闭环 (No. 70/74)
const skillChronicEarlyWarningDisposal: VectorSkill = {
  id: 'skill_chronic_early_warning_disposal',
  name: '重大慢病峰值预警深度研判与应急处置工单闭环',
  category: 'warning',
  categoryName: '预警处置',
  domain: 'chronic',
  description: '针对慢病急性事件就诊峰值（如45-64岁急性心梗、脑卒中激增）、恶性肿瘤全死因链质控异常聚集等突发预警事件，提取预警依据，分析周边关联致病因素（年龄劳动力谱系、三高并发症转化规律、就诊延迟），生成针对基层卫生院与急救中心的应急处置工单并追踪核销闭环。',
  iconName: 'ShieldAlert',
  badgeColor: 'rose',
  recommendedPrompts: SKILL_RECOMMENDATIONS['skill_chronic_early_warning_disposal'] ?? [],
  requiredRoles: ['PROVINCIAL_ADMIN', 'CITY_EXPERT', 'DISTRICT_SURVEILLANCE'],
  parametersSchema: {
    type: 'object',
    properties: {
      alertId: { type: 'string', description: '预警事件编号，如 ALERT-CHR-202608-01' },
      city: { type: 'string', description: '地级市名称，如 郑州市' },
      district: { type: 'string', description: '区县名称，如 金水区' },
      action: { type: 'string', enum: ['dispatch', 'resolve', 'reopen'], description: '工单操作类型' }
    }
  },
  execute: async (args) => executeSkillRemote('skill_chronic_early_warning_disposal', args)
};

export const STANDARD_SKILLS: VectorSkill[] = [
  // 1. 病媒生物专属技能 (Vector)
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
  skillMetaCustomBuilder,
  skillMonitoringDataTable,
  skillSatScanSpatial,
  skillLSTMPredictor,
  skillSatScanKMeansLSTM,
  skillComposableWorkflow,
  skillDaemonSurveillance,
  // 2. 食源性疾病专属技能 (Foodborne)
  skillFoodborneClusterDetect,
  skillFoodborneRiskForecast,
  skillMolecularTrace,
  skillFoodAttribution,
  skillOutbreakDisposalAdvice,
  skillFoodborneReportExport,
  skillFoodborneCaseTable,
  skillFoodborneCustomBuilder,
  // 3. 环境健康风险专属技能 (Env)
  skillEnvOcrEntry,
  skillWaterSafetyEval,
  skillSewagePathogenTrace,
  skillAirClimateHealthRisk,
  skillRiverBasinPollutionChain,
  skillEnvScenarioSimulation,
  skillEnvMonitoringTable,
  skillEnvCustomBuilder,
  skillEnvEarlyWarningDisposal,
  // 4. 死因、慢病及伤害专属技能 (Chronic)
  skillDeathCertQc,
  skillIcd10NlpInference,
  skillMortalityClusterRare,
  skillChronicRiskForecast,
  skillInjuryAttributionTree,
  skillChronicScreeningRoi,
  skillChronicDeathReport,
  skillChronicMonitoringTable,
  skillChronicCustomBuilder,
  skillChronicEarlyWarningDisposal
];

for (const skill of STANDARD_SKILLS) {
  skill.requirementIds=(requirementIds as Record<string,number[]>)[skill.id] ?? [];
  skill.requirementNo=skill.requirementIds.length ? `No. ${skill.requirementIds.join('/')}` : undefined;
}

export function getSkillById(skillId: string): VectorSkill | undefined {
  return STANDARD_SKILLS.find(s => s.id === skillId);
}


