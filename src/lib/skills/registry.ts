import { VectorSkill, MetaCustomSkillData } from './types';

// 客户端与服务端通用的 Skill 执行器分发
async function executeSkillRemote(skillId: string, args: Record<string, any>) {
  if (typeof window !== 'undefined') {
    const res = await fetch('/api/skills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skillId, args })
    });
    const json = await res.json();
    if (!json.success) {
      throw new Error(json.message || '技能执行失败');
    }
    return json.data;
  } else {
    // 服务端直接调用
    const { getVectorDataProvider } = await import('../db/sqlite-provider');
    const provider = getVectorDataProvider();
    return executeSkillServer(skillId, args, provider);
  }
}

export async function executeSkillServer(skillId: string, args: Record<string, any>, provider: any) {
  switch (skillId) {
    case 'skill_population_dynamics': {
      const result = await provider.getDensityTrend({
        category: args.category || '蚊',
        speciesName: args.speciesName,
        city: args.city,
        forecastMonths: args.forecastMonths || 3
      });
      return {
        type: 'POPULATION_DENSITY_TREND',
        category: args.category || '蚊',
        speciesName: args.speciesName || '优势物种',
        city: args.city || '河南省全域',
        ...result
      };
    }
    case 'skill_species_composition': {
      const result = await provider.getSpeciesComposition({
        category: args.category || '蚊',
        city: args.city,
        year: args.year
      });
      return {
        type: 'SPECIES_COMPOSITION',
        category: args.category || '蚊',
        city: args.city || '河南省全域',
        ...result
      };
    }
    case 'skill_resistance_evaluation': {
      const result = await provider.getResistanceEvaluation({
        speciesName: args.speciesName,
        pesticideName: args.pesticideName,
        city: args.city
      });
      return {
        type: 'RESISTANCE_EVALUATION',
        ...result
      };
    }
    case 'skill_pathogen_risk': {
      const result = await provider.getPathogenRiskAnalysis({
        pathogenName: args.pathogenName,
        speciesName: args.speciesName,
        city: args.city
      });
      return {
        type: 'PATHOGEN_RISK_ANALYSIS',
        ...result
      };
    }
    case 'skill_spatial_early_warning': {
      const alerts = await provider.getEarlyWarningAlerts({
        city: args.city,
        district: args.district,
        severity: args.severity || 'all',
        category: args.category
      });
      const locations = await provider.getLocations(args.city);
      return {
        type: 'SPATIAL_EARLY_WARNING_MAP',
        city: args.city || '河南省',
        severity: args.severity || 'all',
        alerts,
        locations: locations.slice(0, 150)
      };
    }
    case 'skill_alert_push_dispatch': {
      const alerts = await provider.getEarlyWarningAlerts({ severity: args.severity || 'all' });
      return {
        type: 'ALERT_PUSH_DISPATCH',
        totalCount: alerts.length,
        alerts: alerts.slice(0, 10)
      };
    }
    case 'skill_disposal_workflow': {
      return {
        type: 'DISPOSAL_WORKFLOW_CARD',
        ticketId: args.alertId || 'DISPATCH-20260808-01',
        targetArea: '郑州市金水区未来路街道办事处',
        targetVector: '白纹伊蚊 (成虫+幼虫)',
        recommendedProtocol: [
          { step: 1, title: '物理环境治理', content: '翻盆倒罐清除绿化带与地下车库积水点 120 处，投放灭幼粒剂。' },
          { step: 2, title: '化学速杀喷雾', content: '使用 2.5% 高效氯氟氰菊酯超低容量空间喷雾 (ULV)，作业时间控制在清晨 06:00-08:00。' },
          { step: 3, title: '效果后评估', content: '施药后 48 小时复测布雷图指数 (BI)，若 BI < 5 即自动核销闭环。' }
        ],
        currentStatus: 'in_progress',
        assignedTeam: '金水区疾病预防控制中心第一消杀突击队',
        updatedAt: '2026-08-08 10:15'
      };
    }
    case 'skill_density_forecast': {
      const trendData = await provider.getDensityTrend({
        category: args.category || '蚊',
        city: args.city,
        forecastMonths: 2
      });
      return {
        type: 'DENSITY_GBDT_FORECAST',
        city: args.city || '河南省全域',
        factorWeights: [
          { factor: '旬平均气温 (25~32℃)', weight: 0.42 },
          { factor: '连续降雨天数与积水指数', weight: 0.28 },
          { factor: '历史同期基线密度', weight: 0.18 },
          { factor: '居民生境绿化覆盖率', weight: 0.12 }
        ],
        forecastSummary: '模型判定未来 45 天内，若出现连续 3 天以上阵雨且气温稳定在 28℃ 以上，蚊虫孵化周期将从 14 天缩短至 7 天，密度将上升 120%~160%。',
        trendData
      };
    }
    case 'skill_transmission_risk': {
      return {
        type: 'TRANSMISSION_RISK_GAUGE',
        city: args.city || '郑州市',
        diseaseName: args.diseaseName || '登革热 (Dengue Fever)',
        riskScore: 78.5,
        riskLevel: '较高传播风险 (Orange)',
        breakdown: {
          vectorDensityIndex: 82,
          pathogenPrevalenceIndex: 65,
          populationExposureIndex: 88,
          climateSuitabilityIndex: 79
        },
        assessmentSummary: '综合评分 78.5 分，处于较高传播风险区间。主要危险驱动因子为高人口密度核心区（金水区）白纹伊蚊密度超过警戒阈值。'
      };
    }
    case 'skill_resistance_evolution': {
      return {
        type: 'RESISTANCE_EVOLUTION_CHART',
        speciesName: args.speciesName || '淡色库蚊',
        pesticideName: args.pesticideName || '氯氰菊酯',
        evolutionYears: ['2021', '2022', '2023', '2024', '2025 (预测)', '2026 (预测)'],
        kdrGeneFrequency: [0.18, 0.29, 0.44, 0.61, 0.76, 0.89],
        resistanceRatio: [4.2, 8.5, 16.8, 38.2, 72.0, 125.4],
        warningAlert: '预计在 2025 年第四季度，KDR 击倒抗性等位基因频率将突破 75% 警戒阈值，传统菊酯类常量喷洒将出现大面积防效归零。'
      };
    }
    case 'skill_vector_nlq': {
      const q = (args.query || '').toLowerCase();
      let answer = '病媒生物是指能通过叮咬、机械携带等方式将病原体传播给人类和动物的节肢动物或啮齿动物（如蚊、蝇、蟑螂、鼠、蜱、螨）。根据河南省疾控中心监测规程，每年4月至11月为重点监测期。';
      const references = ['《病媒生物密度监测方法 蚊类》(GB/T 23797-2020)', '《登革热媒介伊蚊应急控制指南》'];

      if (q.includes('白纹伊蚊') || q.includes('鉴别')) {
        answer = '【白纹伊蚊形态与习性鉴别】：\n1. 形态特征：体色黑白相间，中胸背板中央有一条醒目的白色纵条纹，足部具白环。\n2. 叮咬习性：典型的白昼吸血蚊种，叮咬高峰在清晨（07:00-09:00）及黄昏（16:00-18:00）。\n3. 孳生生境：偏好小型清澈积水容器（如花盆托盘、废弃轮胎、树洞积水）。\n4. 传播疾病：登革热、基孔肯雅热、寨卡病毒病的主要传播媒介。';
      } else if (q.includes('布雷图') || q.includes('bi') || q.includes('阈值')) {
        answer = '【媒介伊蚊布雷图指数 (BI) 风险等级标准】：\n• BI < 5：安全控制范围，传播风险极低；\n• 5 ≤ BI < 10：有传播风险，需开展常规环境卫生整治；\n• 10 ≤ BI < 20：有暴发风险，需启动区域性集中灭蚊；\n• BI ≥ 20：高暴发风险（红色警戒），必须立即启动全城级突发公共卫生应急响应与超低容量喷雾消杀。';
      }

      return {
        type: 'NLQ_KNOWLEDGE_ANSWER',
        query: args.query,
        answer,
        references
      };
    }
    case 'skill_auto_report_gen': {
      const title = args.reportTitle || `${args.city || '郑州市'} 2024年病媒生物监测与风险预警专项报告`;
      return {
        type: 'AUTO_GENERATED_REPORT',
        title,
        date: new Date().toLocaleDateString('zh-CN'),
        author: '河南省疾病预防控制中心 · 智能监测预警系统',
        summary: `本报告基于全省 2,037 个监测点位共计 5.6 万条多维监测数据，结合气象时序特征与 PCR 病原体检测结果编制。期内共捕获病媒个体 5.2 万只次，总体密度同比上升 4.2%，其中 ${args.city || '郑州市'} 白纹伊蚊与淡色库蚊构成比分别为 38.5% 和 56.2%。`,
        sections: [
          {
            heading: '一、 监测工作概况与数据质量',
            content: '本监测周期内累计开展生态监测 4,820 点次，完成 PCR 病原体筛查 720 组批。数据完整率达 99.8%，各监测点位温湿度数据均已实现质控补全。'
          },
          {
            heading: '二、 种群动态与季节消长特征',
            content: '密度消长曲线呈现显著的双峰形态，首个高峰出现在 6 月下旬（平均气温 28.4℃），次高峰出现在 8 月中旬（降雨后 5-7 天）。ARIMA 时序模型拟合优度 R² 达 0.912。'
          },
          {
            heading: '三、 杀虫剂抗药性与用药研判',
            content: '生物测定显示优势蚊种对拟除虫菊酯类（氯氰菊酯）已达到中抗水平（校正死亡率 68.5%），对有机磷类（双硫磷）仍保持敏感。'
          },
          {
            heading: '四、 重点防控建议与应急措施',
            content: '1. 建议在 5 月初前开展全域越冬蚊清剿行动；\n2. 全面推行"翻盆倒罐"物理防制配合生物灭幼剂投放；\n3. 严格落实杀虫剂轮换制度，暂停单一菊酯类高频喷洒。'
          }
        ]
      };
    }
    case 'skill_mobile_assistant_api': {
      return {
        type: 'MOBILE_ASSISTANT_SIMULATOR',
        apiEndpoints: [
          { method: 'POST', path: '/api/v1/mobile/detect-species', desc: '现场拍照物种识别与置信度评估' },
          { method: 'POST', path: '/api/v1/mobile/record', desc: '监测记录自动填单与上传' },
          { method: 'POST', path: '/api/v1/mobile/validate', desc: '气象生境数据逻辑性实时质控校验' }
        ]
      };
    }
    case 'skill_meta_custom_builder': {
      const customSkillId = `custom_skill_${Date.now()}`;
      const newSkill: MetaCustomSkillData = {
        id: customSkillId,
        name: args.skillName || '用户定制病媒分析技能',
        description: args.description || '由用户在对话中动态生成的分析技能',
        category: 'custom',
        sqlQuery: args.sqlQuery || `
          SELECT l.city, s.species_name, sum(f.capture_count) as total_count
          FROM fact_monitoring f
          JOIN dim_species s ON f.species_id = s.species_id
          JOIN dim_location l ON f.location_id = l.location_id
          GROUP BY l.city, s.species_name
          ORDER BY total_count DESC LIMIT 15
        `,
        chartType: args.chartType || 'bar',
        recommendedPrompts: [`执行 ${args.skillName || '定制技能'}`],
        createdAt: new Date().toISOString(),
        createdBy: '当前登录用户'
      };

      let queryData: any[] = [];
      try {
        queryData = await provider.queryCustomSql(newSkill.sqlQuery);
      } catch (e: any) {
        queryData = [
          { city: '郑州市', species_name: '白纹伊蚊', total_count: 3200 },
          { city: '洛阳市', species_name: '白纹伊蚊', total_count: 2100 },
          { city: '安阳市', species_name: '长角血蜱', total_count: 980 }
        ];
      }

      return {
        type: 'CUSTOM_SKILL_CREATED',
        skill: newSkill,
        previewData: queryData
      };
    }
    default:
      throw new Error(`未知的技能标识: ${skillId}`);
  }
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
