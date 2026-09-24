import { EarlyWarningAlertItem } from '@/lib/db/data-provider';
import { ACTIVE_ALERTS_LIST } from '@/lib/data/active-alerts';

export type AgentDomainType = 'vector' | 'foodborne' | 'env' | 'chronic';

export interface PromptCategoryItem {
  title: string;
  color: string;
  iconName: string;
  iconColor: string;
  prompts: string[];
}

export interface MetricBarItem {
  id: string;
  label: string;
  value: string;
  unit: string;
  colorClass: string;
  pulse?: boolean;
  prompt: string;
  tooltip: string;
}

export interface AgentMetricsBar {
  items: MetricBarItem[];
  activeAlertsCount: number;
  activeAlertsTitle: string;
  latestDataPeriod: string;
}

export interface AgentProfile {
  domain: AgentDomainType;
  name: string;
  fullName: string;
  institute: string;
  badgeTitle: string;
  themeColor: 'teal' | 'orange' | 'cyan' | 'rose';
  defaultPort: number;
  routePrefix: string;
  datasetDbName: string;
  businessDbName: string;
  systemPrompt: string;
  categories: PromptCategoryItem[];
  initialGenerativeView: Record<string, any>;
  skillIds: string[];
  metricsBar: AgentMetricsBar;
  alerts: EarlyWarningAlertItem[];
}

export const AGENT_PROFILES: Record<AgentDomainType, AgentProfile> = {
  vector: {
    domain: 'vector',
    name: '病媒生物监测预警智能体',
    fullName: 'CdcBuddy · 疾控病媒生物监测预警智能体',
    institute: '河南省疾病预防控制中心 · 消毒与媒介生物控制所',
    badgeTitle: '病媒生物',
    themeColor: 'teal',
    defaultPort: 3001,
    routePrefix: '/vector',
    datasetDbName: 'vector_monitoring.db',
    businessDbName: 'app_business.db',
    systemPrompt: '你是河南省疾控中心消毒与媒介生物控制所的【病媒生物与宿主动物监测预警智能专家】。精通蚊、蝇、蟑螂、鼠、蜱、恙螨的种群消长预测(ARIMA/LSTM)、K-Means聚类、杀虫剂抗药性预测(Probit/ML)、Apriori病原携带风险挖掘、SaTScan时空扫描预警与应急消杀处置闭环。',
    categories: [
      {
        title: '时空态势与预警排查',
        color: 'bg-red-500/10 dark:bg-gradient-to-b dark:from-red-500/20 dark:to-orange-500/10 border-red-200 dark:border-red-500/30',
        iconName: 'MapPin',
        iconColor: 'text-red-600 dark:text-red-400',
        prompts: [
          '在地图上展示全省当前的病媒生物预警热力分布，标记所有严重（红色）预警区域。',
          '下钻查看郑州市金水区和管城区的蚊媒密度空间热力与超标监测点。',
          '针对全省当前的严重等级预警生成今日消杀调度派单清单与处置依据。'
        ]
      },
      {
        title: '种群消长与趋势预测',
        color: 'bg-sky-500/10 dark:bg-gradient-to-b dark:from-sky-500/20 dark:to-cyan-500/10 border-sky-200 dark:border-sky-500/30',
        iconName: 'TrendingUp',
        iconColor: 'text-sky-600 dark:text-sky-400',
        prompts: [
          '分析近几年全省蚊类密度随气温变化的季节消长规律，并预测未来3个月密度波动。',
          '分析郑州市蚊类优势种群构成比（白纹伊蚊与淡色库蚊比例）及多样性指数。',
          '结合未来高温多雨气象，通过 GBDT 模型预测下月成蚊暴发峰值。'
        ]
      },
      {
        title: '抗药性测定与科学消杀',
        color: 'bg-amber-500/10 dark:bg-gradient-to-b dark:from-amber-500/20 dark:to-yellow-500/10 border-amber-200 dark:border-amber-500/30',
        iconName: 'ShieldAlert',
        iconColor: 'text-amber-600 dark:text-amber-400',
        prompts: [
          '评估全省淡色库蚊对氯氰菊酯和残杀威的抗药性等级及用药调整建议。',
          '查询德国小蠊在郑州市对各类杀虫剂的 LC50 毒力测定结果与轮换方案。',
          '预测未来1年全省淡色库蚊对拟除虫菊酯类的 KDR 耐药基因频率演化。'
        ]
      },
      {
        title: '病原学筛查与专题报告',
        color: 'bg-purple-500/10 dark:bg-gradient-to-b dark:from-purple-500/20 dark:to-pink-500/10 border-purple-200 dark:border-purple-500/30',
        iconName: 'Activity',
        iconColor: 'text-purple-600 dark:text-purple-400',
        prompts: [
          '显示平顶山2022年6月全部病媒监测数据表',
          '排查全省蚊媒登革病毒与乙脑病毒的 PCR 阳性检出率及高风险区县。',
          '生成郑州市2024年夏季蚊媒监测与登革热风险评估专项报告并准备导出。'
        ]
      }
    ],
    initialGenerativeView: {
      type: 'SPATIAL_EARLY_WARNING_MAP',
      city: '河南省全域',
      severity: 'all',
      alerts: [
        {
          alertId: 'ALERT-202408-101',
          title: '郑州市金水区 白纹伊蚊密度超标预警',
          level: 'red',
          levelName: '严重预警 (一级)',
          category: '蚊',
          city: '郑州市',
          district: '金水区',
          street: '未来路街道办事处',
          latitude: 34.8003,
          longitude: 113.6627,
          triggerReason: '单次诱蚊灯捕获量达 86 只/台次（基线 30 只），具备暴发滋生条件。',
          currentDensity: 86,
          threshold: 30,
          affectedPopulationEstimate: 32000,
          recommendedAction: '立即启动突发虫媒应急消杀，实施 2.5% 高效氯氟氰菊酯超低容量喷雾。',
          disposalStatus: 'in_progress',
          triggerTime: '2026-08-08 08:30:00'
        },
        {
          alertId: 'ALERT-202408-102',
          title: '安阳市汤阴县 长角血蜱携病风险预警',
          level: 'orange',
          levelName: '较重预警 (二级)',
          category: '蜱',
          city: '安阳市',
          district: '汤阴县',
          street: '韩庄镇',
          latitude: 35.922,
          longitude: 114.358,
          triggerReason: '羊体寄生蜱指数达 12.4 只/羊，PCR 检测出发热伴血小板减少综合征病毒核酸阳性。',
          currentDensity: 52,
          threshold: 50,
          affectedPopulationEstimate: 14500,
          recommendedAction: '对羊舍与周边灌木实施敌百虫滞留喷洒，下发牧民个人防护指南。',
          disposalStatus: 'pending',
          triggerTime: '2026-08-08 09:15:00'
        }
      ]
    },
    skillIds: [
      'skill_population_dynamics',
      'skill_species_composition',
      'skill_resistance_evaluation',
      'skill_pathogen_risk',
      'skill_spatial_early_warning',
      'skill_alert_push_dispatch',
      'skill_disposal_workflow',
      'skill_density_forecast',
      'skill_transmission_risk',
      'skill_resistance_evolution',
      'skill_vector_nlq',
      'skill_auto_report_gen',
      'skill_mobile_assistant_api',
      'skill_satscan_spatial',
      'skill_lstm_predictor',
      'skill_satscan_kmeans_lstm',
      'skill_composable_workflow',
      'skill_daemon_surveillance',
      'skill_monitoring_data_table',
      'skill_meta_custom_builder'
    ],
    metricsBar: {
      items: [
        {
          id: 'rec_count',
          label: '治理监测记录',
          value: '48,530',
          unit: '条',
          colorClass: 'text-sky-600 dark:text-sky-400',
          pulse: true,
          prompt: '请汇总展示病媒生物治理监测记录（48,530条）的详细概览，按蚊、蝇、鼠、蟑、蜱、螨六大类群统计监测样本量与捕获总量，并结合气象温湿度补全情况进行多维分析。',
          tooltip: '点击通过 AI 交互查询 48,530 条病媒治理监测记录详情'
        },
        {
          id: 'pcr_count',
          label: 'PCR 病原检测',
          value: '7,336',
          unit: '组批',
          colorClass: 'text-rose-600 dark:text-rose-400',
          prompt: '请检索并分析全省 7,336 组批 PCR 病原检测数据详情，列出登革病毒、乙脑病毒、布尼亚病毒、立克次体等主要检出靶标分布及阳性率态势。',
          tooltip: '点击通过 AI 交互查询 7,336 组批 PCR 病原检测数据详情'
        },
        {
          id: 'resist_count',
          label: '抗药性毒力测定',
          value: '365',
          unit: '组',
          colorClass: 'text-amber-600 dark:text-amber-400',
          prompt: '请调取 365 组杀虫剂抗药性毒力测定实验数据，分析拟除虫菊酯、有机磷等主要药剂在各地市优势蚊蝇种群中的抗性倍数及抗性等级分布。',
          tooltip: '点击通过 AI 交互查询 365 组抗药性毒力测定数据详情'
        },
        {
          id: 'coverage',
          label: '覆盖全省行政区',
          value: '18 地市 / 126 区县',
          unit: '(2,037 点位)',
          colorClass: 'text-slate-900 dark:text-slate-100',
          prompt: '请展示全省 18 地市 126 区县共 2,037 个监测点位的地理空间覆盖分布与点位明细，按地市统计点位密度和重点监测生境。',
          tooltip: '点击通过 AI 交互查询全省 18 地市 / 126 区县 (2,037 点位) 空间覆盖详情'
        }
      ],
      activeAlertsCount: 15,
      activeAlertsTitle: '活跃预警: 15 起',
      latestDataPeriod: '2025-11-11'
    },
    alerts: ACTIVE_ALERTS_LIST
  },

  foodborne: {
    domain: 'foodborne',
    name: '食源性疾病监测预警智能体',
    fullName: 'CdcBuddy · 食源性疾病监测预警智能体',
    institute: '河南省疾病预防控制中心 · 食品安全与营养卫生所',
    badgeTitle: '食源性疾病',
    themeColor: 'orange',
    defaultPort: 3002,
    routePrefix: '/food',
    datasetDbName: 'foodborne_monitoring.db',
    businessDbName: 'app_business_food.db',
    systemPrompt: '你是河南省疾控中心食品安全与营养卫生所的【食源性疾病监测预警智能专家】。精通食源性病例聚集性识别(SaTScan/弹性时空扫描)、暴发风险时序预测(LSTM)、致病菌分子同源溯源(cgMLST/PFGE进化树)、高风险食品关联挖掘(Apriori)及突发公卫流调闭环处置。',
    categories: [
      {
        title: '聚集性疫情探测与预警',
        color: 'bg-red-500/10 dark:bg-gradient-to-b dark:from-red-500/20 dark:to-orange-500/10 border-red-200 dark:border-red-500/30',
        iconName: 'AlertTriangle',
        iconColor: 'text-red-600 dark:text-red-400',
        prompts: [
          '排查全省近7天哨点医院食源性病例异常激增，标记所有时空聚集性暴发事件。',
          '下钻分析郑州市某大学食堂疑似副溶血性弧菌聚集性腹泻事件的波及人数与时间曲线。',
          '针对洛阳市聚集性疑似肉毒中毒预警生成紧急流调提纲与样品采集封存指南。'
        ]
      },
      {
        title: '发病风险时序预测',
        color: 'bg-orange-500/10 dark:bg-gradient-to-b dark:from-orange-500/20 dark:to-amber-500/10 border-orange-200 dark:border-orange-500/30',
        iconName: 'TrendingUp',
        iconColor: 'text-orange-600 dark:text-orange-400',
        prompts: [
          '结合夏季气象与历史基线，利用 LSTM 模型预测未来 4 周全省沙门氏菌感染发病趋势。',
          '评估全省 18 地市不同季节食源性疾病高风险区域分布与脆弱人群扩散风险。',
          '预测夏秋交替期学校开学季诺如病毒聚集性暴发概率与峰值时窗。'
        ]
      },
      {
        title: '分子同源溯源与链条构建',
        color: 'bg-emerald-500/10 dark:bg-gradient-to-b dark:from-emerald-500/20 dark:to-teal-500/10 border-emerald-200 dark:border-emerald-500/30',
        iconName: 'GitBranch',
        iconColor: 'text-emerald-600 dark:text-emerald-400',
        prompts: [
          '对比郑州与开封两起病例分离出的单增李斯特菌 cgMLST 等位基因相似度，判定是否同源。',
          '基于知识图谱构建食源性病例、批发市场供应链与致病菌基因带型的传播链拓扑。',
          '利用 Apriori 挖掘急性胃肠炎就诊病例进食史与抽检阳性食品的高置信度关联规则。'
        ]
      },
      {
        title: '监测大屏与专题公报',
        color: 'bg-blue-500/10 dark:bg-gradient-to-b dark:from-blue-500/20 dark:to-indigo-500/10 border-blue-200 dark:border-blue-500/30',
        iconName: 'FileText',
        iconColor: 'text-blue-600 dark:text-blue-400',
        prompts: [
          '展示河南省当前食源性疾病动态监测大屏与高风险食品 TOP10 归因排行榜。',
          '自动汇总生成上月全省食源性疾病监测分析月度专题公报并准备导出。',
          '针对近期某海鲜酒楼食源性聚集事件一键生成突发流行病学调查简报。'
        ]
      }
    ],
    initialGenerativeView: {
      type: 'FOODBORNE_CLUSTER_RADAR',
      city: '河南省全域',
      activeOutbreaksCount: 4,
      totalCases7Days: 328,
      highRiskFoodTop: ['即食凉拌熟食', '冷冻生鲜海产品', '现制现售果汁', '自制发酵豆制品'],
      clusters: [
        {
          clusterId: 'OUTBREAK-202608-01',
          location: '郑州市金水区某高校食堂',
          pathogen: '副溶血性弧菌',
          caseCount: 23,
          riskLevel: 'red',
          suspectedFood: '现制水产海鲜便当',
          triggerTime: '2026-08-20 12:30:00'
        },
        {
          clusterId: 'OUTBREAK-202608-02',
          location: '洛阳市涧西区某连锁火锅店',
          pathogen: '肠炎沙门氏菌',
          caseCount: 12,
          riskLevel: 'orange',
          suspectedFood: '未经充分巴氏杀菌可生食鸡蛋',
          triggerTime: '2026-08-22 19:40:00'
        }
      ]
    },
    skillIds: [
      'skill_foodborne_cluster_detect',
      'skill_foodborne_risk_forecast',
      'skill_molecular_trace',
      'skill_food_attribution',
      'skill_outbreak_disposal_advice',
      'skill_foodborne_report_export',
      'skill_foodborne_case_table',
      'skill_foodborne_custom_builder'
    ],
    metricsBar: {
      items: [
        {
          id: 'case_count',
          label: '病例监测记录',
          value: '3,292',
          unit: '例',
          colorClass: 'text-orange-600 dark:text-orange-400',
          pulse: true,
          prompt: '请汇总展示全省食源性疾病病例监测台账（3,292例）的流行病学特征，按主要致病菌构成比、年龄组分布、可疑进食场所进行多维统计研判。',
          tooltip: '点击通过 AI 交互查询 3,292 例食源性疾病病例台账详情'
        },
        {
          id: 'cgmlst_count',
          label: '致病菌分子图谱',
          value: '432',
          unit: '份',
          colorClass: 'text-emerald-600 dark:text-emerald-400',
          prompt: '请检索全省 432 份致病菌核心基因组 cgMLST 分子分型数据，展示副溶血性弧菌、沙门氏菌、单增李斯特菌的分子同源进化拓扑及暴发聚类群。',
          tooltip: '点击通过 AI 交互查询 432 份 cgMLST 分子指纹图谱'
        },
        {
          id: 'sample_count',
          label: '食品安全监督抽检',
          value: '1,200',
          unit: '批次',
          colorClass: 'text-amber-600 dark:text-amber-400',
          prompt: '请调取全省 1,200 批次流通与餐饮食品微生物监督抽检记录，分析超标致病菌污染类别及高风险食品品类。',
          tooltip: '点击通过 AI 交互查询 1,200 批次食品抽检数据详情'
        },
        {
          id: 'coverage',
          label: '哨点监测网络',
          value: '18 地市 / 36 哨点医院',
          unit: '(覆盖 126 区县)',
          colorClass: 'text-slate-900 dark:text-slate-100',
          prompt: '请展示全省 18 地市 36 家食源性疾病哨点监测医院与直报网络空间覆盖分布。',
          tooltip: '点击通过 AI 交互查询全省食源性疾病哨点监测网络覆盖详情'
        }
      ],
      activeAlertsCount: 4,
      activeAlertsTitle: '暴发预警: 4 起',
      latestDataPeriod: '2026-08-31'
    },
    alerts: [
      {
        alertId: 'OUTBREAK-202608-01',
        title: '郑州市金水区 高校食堂副溶血性弧菌聚集性腹泻事件',
        level: 'red',
        levelName: '严重预警 (一级)',
        category: '副溶血性弧菌',
        city: '郑州市',
        district: '金水区',
        street: '郑州金水大学第三学生餐厅',
        latitude: 34.8003,
        longitude: 113.6627,
        triggerReason: '就诊病例达 38 例（住院 4 例），罹患率 14.8%，检出同源副溶血性弧菌(cgMLST Δ≤2)。',
        currentDensity: 38,
        threshold: 5,
        affectedPopulationEstimate: 2600,
        recommendedAction: '暂停涉事食堂供餐，封存水产品与凉菜原料，开展全链条环境涂抹与从业人员带菌排查。',
        disposalStatus: 'resolved',
        triggerTime: '2026-08-18 11:30:00'
      },
      {
        alertId: 'OUTBREAK-202608-02',
        title: '洛阳市涧西区 大型酒楼沙门氏菌婚宴暴发事件',
        level: 'red',
        levelName: '严重预警 (一级)',
        category: '肠炎沙门氏菌',
        city: '洛阳市',
        district: '涧西区',
        street: '洛阳宴宾楼婚宴大厅',
        latitude: 34.6540,
        longitude: 112.4080,
        triggerReason: '就餐宾客累计发病 26 例（住院 3 例），罹患率 22.4%，检出肠炎沙门氏菌 ST11 同源株。',
        currentDensity: 26,
        threshold: 5,
        affectedPopulationEstimate: 120,
        recommendedAction: '重点排查溏心蛋与冷切熟肉供应链，开展流行病学队列调查与环境样品涂抹采样。',
        disposalStatus: 'resolved',
        triggerTime: '2026-08-21 18:30:00'
      },
      {
        alertId: 'OUTBREAK-202607-03',
        title: '新乡市卫辉市 托幼机构诺如病毒暴发疫情',
        level: 'orange',
        levelName: '较重预警 (二级)',
        category: '诺如病毒',
        city: '新乡市',
        district: '卫辉市',
        street: '卫辉市第一实验幼儿园',
        latitude: 35.4010,
        longitude: 114.0650,
        triggerReason: '小班与中班累计 19 名幼儿急性呕吐腹泻，RT-PCR 检出诺如病毒 GII.4 型。',
        currentDensity: 19,
        threshold: 3,
        affectedPopulationEstimate: 350,
        recommendedAction: '班级实施隔离停课 72 小时，含氯消毒剂全面环境消杀，对从业隐性感染人员调离岗位。',
        disposalStatus: 'resolved',
        triggerTime: '2026-07-05 08:30:00'
      },
      {
        alertId: 'OUTBREAK-202608-04',
        title: '南阳市宛城区 冷链熟食集市单增李斯特菌跨店污染',
        level: 'orange',
        levelName: '较重预警 (二级)',
        category: '单核细胞增生李斯特菌',
        city: '南阳市',
        district: '宛城区',
        street: '宛城便民熟食集市',
        latitude: 32.9900,
        longitude: 112.5300,
        triggerReason: '散发病例与冷切牛肉环境采样连续检出单增李斯特菌 ST8 高同源菌株(Δ≤1)，波及 7 家零售网点。',
        currentDensity: 9,
        threshold: 2,
        affectedPopulationEstimate: 8500,
        recommendedAction: '全批次下架封存涉疫熟切牛肉，开展中心冷库深部清洁消毒，加强易感高危人群监测。',
        disposalStatus: 'in_progress',
        triggerTime: '2026-08-10 10:00:00'
      }
    ]
  },

  env: {
    domain: 'env',
    name: '环境健康风险监测预警智能体',
    fullName: 'CdcBuddy · 环境健康风险监测预警智能体',
    institute: '河南省疾病预防控制中心 · 环境与健康所',
    badgeTitle: '环境健康',
    themeColor: 'cyan',
    defaultPort: 3003,
    routePrefix: '/env',
    datasetDbName: 'env_monitoring.db',
    businessDbName: 'app_business_env.db',
    systemPrompt: '你是河南省疾控中心环境与健康所的【环境健康风险监测预警智能专家】。精通生活饮用水水质安全评估(GB 5749/随机森林/克里金空间插值)、污水管网病原监测与滞后关联溯源、公共场所卫生动态评级、空气质量与极端天气健康暴露模型(DLNM/GBDT热浪预警)、四河流域跨介质重金属污染链分析及政策情景推演。',
    categories: [
      {
        title: '饮用水全流程水质安全',
        color: 'bg-cyan-500/10 dark:bg-gradient-to-b dark:from-cyan-500/20 dark:to-blue-500/10 border-cyan-200 dark:border-cyan-500/30',
        iconName: 'Droplets',
        iconColor: 'text-cyan-600 dark:text-cyan-400',
        prompts: [
          '基于普通克里金插值在 GIS 上展示全省生活饮用水水质超标扩散热力图。',
          '采用随机森林模型评估郑州市管网末梢水重金属与消毒副产物的致癌与非致癌健康风险。',
          '通过 LSTM 模型预测未来1个月黄河流域沿线水厂出厂水浊度与耗氧量波动趋势。'
        ]
      },
      {
        title: '污水病原监测与管网溯源',
        color: 'bg-teal-500/10 dark:bg-gradient-to-b dark:from-teal-500/20 dark:to-emerald-500/10 border-teal-200 dark:border-teal-500/30',
        iconName: 'Activity',
        iconColor: 'text-teal-600 dark:text-teal-400',
        prompts: [
          '计算郑州市重点污水处理厂新冠/诺如病原浓度与哨点医院门诊量的滞后相关系数。',
          '结合城市排水分区与污水管网 GIS 拓扑，空间聚类反推病原异常排泄来源片区。',
          '评估汛期暴雨径流对城市排污管网溢流及病原扩散带来的次生暴露风险。'
        ]
      },
      {
        title: '空气质量与极端气候健康',
        color: 'bg-sky-500/10 dark:bg-gradient-to-b dark:from-sky-500/20 dark:to-indigo-500/10 border-sky-200 dark:border-sky-500/30',
        iconName: 'SunMedium',
        iconColor: 'text-sky-600 dark:text-sky-400',
        prompts: [
          '构建 DLNM 分布滞后非线性模型，评估重污染日 PM2.5 暴露对儿童呼吸系统门诊的滞后效应。',
          '提前 72 小时针对全省持续性高温热浪天气触发老幼与心脑血管脆弱人群分级健康防护预警。',
          '分析冬春季沙尘与重污染过程对重点慢病患者超额死亡的急性健康影响。'
        ]
      },
      {
        title: '流域污染链与情景推演',
        color: 'bg-indigo-500/10 dark:bg-gradient-to-b dark:from-indigo-500/20 dark:to-purple-500/10 border-indigo-200 dark:border-indigo-500/30',
        iconName: 'SlidersHorizontal',
        iconColor: 'text-indigo-600 dark:text-indigo-400',
        prompts: [
          '分析四河流域"水体铅镉-农田土壤-粮食作物"跨介质污染转移链与人群累积健康危害。',
          '进行情景推演：若某工业聚集区削减工业排污30%，预测区域 AQI 及慢病门诊量降幅。',
          '自动生成本月河南省环境相关风险因素综合监测预警研判专报。'
        ]
      }
    ],
    initialGenerativeView: {
      type: 'WATER_PIPELINE_GIS_MAP',
      city: '河南省全域',
      waterCoverageRate: 98.6,
      overallQualityIndex: '良好 (GB 5749-2022 达标率 96.2%)',
      monitoringPointsTotal: 3420,
      activeAlertsCount: 3,
      alerts: [
        {
          alertId: 'ENV-WATER-202608-01',
          title: '新乡市凤泉区 某水厂出厂水总大肠菌群轻度超标',
          level: 'yellow',
          levelName: '一般预警 (三级)',
          city: '新乡市',
          district: '凤泉区',
          indexName: '总大肠菌群',
          value: '4 CFU/100mL',
          threshold: '未检出',
          affectedEstimate: 21000,
          triggerTime: '2026-08-23 09:00:00'
        }
      ]
    },
    skillIds: [
      'skill_env_ocr_entry',
      'skill_water_safety_eval',
      'skill_sewage_pathogen_trace',
      'skill_air_climate_health_risk',
      'skill_river_basin_pollution_chain',
      'skill_env_scenario_simulation',
      'skill_env_monitoring_table',
      'skill_env_custom_builder'
    ],
    metricsBar: {
      items: [
        {
          id: 'env_rec_count',
          label: '水质/空气监测记录',
          value: '28,450',
          unit: '条',
          colorClass: 'text-cyan-600 dark:text-cyan-400',
          pulse: true,
          prompt: '请汇总分析全省 28,450 条生活饮用水与环境空气质量监测记录，分析达标率与主要超标因子。',
          tooltip: '点击通过 AI 交互查询环境健康综合监测记录详情'
        },
        {
          id: 'metal_count',
          label: '重金属理化检测',
          value: '5,620',
          unit: '批次',
          colorClass: 'text-blue-600 dark:text-blue-400',
          prompt: '请调取 5,620 批水质与土壤重金属理化检验数据，分析铅、镉、砷等指标健康风险。',
          tooltip: '点击通过 AI 交互查询重金属理化检验数据'
        },
        {
          id: 'climate_count',
          label: '极端气象暴露预警',
          value: '142',
          unit: '次',
          colorClass: 'text-amber-600 dark:text-amber-400',
          prompt: '请分析全省近 1 年 142 次高温热浪与寒潮重污染天气对心血管与呼吸系统健康门诊的滞后效应。',
          tooltip: '点击通过 AI 交互查询极端气候健康暴露预警'
        },
        {
          id: 'coverage',
          label: '覆盖全省监测网',
          value: '18 地市 / 126 区县',
          unit: '(1,580 点位)',
          colorClass: 'text-slate-900 dark:text-slate-100',
          prompt: '请展示全省环境健康监测网络 1,580 个点位空间覆盖详情。',
          tooltip: '点击通过 AI 交互查询全省环境健康监测网点位'
        }
      ],
      activeAlertsCount: 3,
      activeAlertsTitle: '风险预警: 3 起',
      latestDataPeriod: '2026-08-31'
    },
    alerts: [
      {
        alertId: 'ALERT-ENV-202608-01',
        title: '新乡市凤泉区 某水厂出厂水总大肠菌群轻度超标',
        level: 'yellow',
        levelName: '一般预警 (三级)',
        category: '饮用水水质',
        city: '新乡市',
        district: '凤泉区',
        street: '大运河路段出水管网',
        latitude: 35.3850,
        longitude: 113.9120,
        triggerReason: '出厂水采样检测总大肠菌群达 4 CFU/100mL（国标要求未检出）。',
        currentDensity: 4,
        threshold: 0,
        affectedPopulationEstimate: 21000,
        recommendedAction: '启用备用次氯酸钠投加管路，管网末梢全面实施冲洗消毒与加密复测。',
        disposalStatus: 'in_progress',
        triggerTime: '2026-08-23 09:00:00'
      },
      {
        alertId: 'ALERT-ENV-202608-02',
        title: '焦作市中站区 PM2.5与臭氧复合重污染健康预警',
        level: 'orange',
        levelName: '较重预警 (二级)',
        category: '大气暴露',
        city: '焦作市',
        district: '中站区',
        street: '工业集聚区空气监测站',
        latitude: 35.2580,
        longitude: 113.1620,
        triggerReason: 'AQI指数连续 48 小时超过 215，O3 8小时浓度达 210 μg/m³。',
        currentDensity: 215,
        threshold: 150,
        affectedPopulationEstimate: 85000,
        recommendedAction: '发布儿童及心脑血管慢病人群外出防护警示，建议学校暂停户外活动。',
        disposalStatus: 'pending',
        triggerTime: '2026-08-24 14:00:00'
      },
      {
        alertId: 'ALERT-ENV-202608-03',
        title: '洛阳市吉利区 黄河断面水体铅镉跨介质迁移风险',
        level: 'yellow',
        levelName: '一般预警 (三级)',
        category: '流域重金属',
        city: '洛阳市',
        district: '吉利区',
        street: '白河沿岸灌溉汇流口',
        latitude: 34.9120,
        longitude: 112.5850,
        triggerReason: '底泥沉淀物镉含量超本底值 1.8 倍，存在沿灌渠农田富集风险。',
        currentDensity: 1.8,
        threshold: 1.0,
        affectedPopulationEstimate: 12000,
        recommendedAction: '调取下游农作物土壤点位进行追踪复测，协同生态环境部门排查排污口。',
        disposalStatus: 'in_progress',
        triggerTime: '2026-08-22 16:30:00'
      }
    ]
  },

  chronic: {
    domain: 'chronic',
    name: '死因慢病伤害综合监测智能体',
    fullName: 'CdcBuddy · 死因、慢病及伤害综合监测预警智能体',
    institute: '河南省疾病预防控制中心 · 慢性非传染性疾病防制所',
    badgeTitle: '死因与慢病',
    themeColor: 'rose',
    defaultPort: 3004,
    routePrefix: '/death',
    datasetDbName: 'chronic_monitoring.db',
    businessDbName: 'app_business_chronic.db',
    systemPrompt: '你是河南省疾控中心慢性非传染性疾病防制所的【死因、慢病及伤害综合监测预警智能专家】。精通人口死亡医学证明书智能逻辑质控(≥98%)、死因链NLP根本死因推断与ICD-10智能编码(≥95%)、ARIMA死亡图谱与DBSCAN高风险聚类、罕见死因短期聚集识别、重大慢病发病预测与WHO简略寿命表早死概率(4q70)测算、伤害聚类与决策树归因分析。',
    categories: [
      {
        title: '死因证明书质控与推断',
        color: 'bg-rose-500/10 dark:bg-gradient-to-b dark:from-rose-500/20 dark:to-red-500/10 border-rose-200 dark:border-rose-500/30',
        iconName: 'ClipboardCheck',
        iconColor: 'text-rose-600 dark:text-rose-400',
        prompts: [
          '校验本周全省上传的死亡医学证明书，自动筛查死因链倒置与逻辑冲突记录。',
          '基于医学知识图谱对死因链复杂病例进行根本死因自动推导并匹配 ICD-10 编码。',
          '监测全省低频罕见死因，排查短期内是否存在≥3例同类罕见死因聚集事件。'
        ]
      },
      {
        title: '慢病发病预测与早死率',
        color: 'bg-pink-500/10 dark:bg-gradient-to-b dark:from-pink-500/20 dark:to-purple-500/10 border-pink-200 dark:border-pink-500/30',
        iconName: 'HeartPulse',
        iconColor: 'text-pink-600 dark:text-pink-400',
        prompts: [
          '构建简略寿命表，测算全省 30~70 岁四类重大慢病（心脑血管/恶性肿瘤等）过早死亡概率(4q70)。',
          '利用 GBDT 风险模型预测全省各区县未来 3 年恶性肿瘤与脑卒中发病率时空演变。',
          '通过关联规则挖掘高血压合并糖尿病患者发生急性心梗与脑出血的高危并发症规律。'
        ]
      },
      {
        title: '伤害特征聚类与因果归因',
        color: 'bg-amber-500/10 dark:bg-gradient-to-b dark:from-amber-500/20 dark:to-orange-500/10 border-amber-200 dark:border-amber-500/30',
        iconName: 'Activity',
        iconColor: 'text-amber-600 dark:text-amber-400',
        prompts: [
          '对全省哨点医院门诊伤害病例进行聚类分析，输出老年人居家跌倒与儿童意外伤害的时空特征。',
          '构建决策树模型分析农村地区农机操作伤害的主要风险因素归因比。',
          '排查某工业园区短期内出现的同类工伤与一氧化碳中毒聚集性事件并溯源。'
        ]
      },
      {
        title: '筛查清单与综合公报',
        color: 'bg-purple-500/10 dark:bg-gradient-to-b dark:from-purple-500/20 dark:to-indigo-500/10 border-purple-200 dark:border-purple-500/30',
        iconName: 'FileCheck2',
        iconColor: 'text-purple-600 dark:text-purple-400',
        prompts: [
          '基于各区县肿瘤高发数据与人口老龄化系数，生成高危人群早癌筛查推荐清单与卫生经济学收益。',
          '汇总全死因顺位、潜在减寿年数(YPLL)与伤害高发场所，自动生成全省综合监测年度公报。',
          '针对心脑血管疾病极高危区县，自动生成个性化公共卫生综合干预指南。'
        ]
      }
    ],
    initialGenerativeView: {
      type: 'LIFE_TABLE_GAUGE',
      city: '河南省全域',
      prematureMortalityRate4q70: 13.8,
      target2030Rate: 13.0,
      lifeExpectancyBaseline: 77.8,
      topCausesOfDeath: [
        { rank: 1, name: '脑血管疾病 (I60-I69)', mortalityRate: 158.4, ypllYears: 18450 },
        { rank: 2, name: '缺血性心脏病 (I20-I25)', mortalityRate: 142.1, ypllYears: 16200 },
        { rank: 3, name: '恶性肿瘤 (C00-C97)', mortalityRate: 135.6, ypllYears: 24100 },
        { rank: 4, name: '慢性下呼吸道疾病 (J40-J47)', mortalityRate: 46.2, ypllYears: 5300 },
        { rank: 5, name: '意外伤害 (V01-X59)', mortalityRate: 28.5, ypllYears: 12800 }
      ]
    },
    skillIds: [
      'skill_death_cert_qc',
      'skill_icd10_nlp_inference',
      'skill_mortality_cluster_rare',
      'skill_chronic_risk_forecast',
      'skill_injury_attribution_tree',
      'skill_chronic_screening_roi',
      'skill_chronic_death_report',
      'skill_chronic_monitoring_table',
      'skill_chronic_custom_builder'
    ],
    metricsBar: {
      items: [
        {
          id: 'chr_rec_count',
          label: '慢病监测与死因卡',
          value: '68,900',
          unit: '例',
          colorClass: 'text-rose-600 dark:text-rose-400',
          pulse: true,
          prompt: '请汇总全省 68,900 例全死因证明书与慢性病监测数据，展示三大慢病粗死亡率与标化死亡率。',
          tooltip: '点击通过 AI 交互查询全死因证明书与慢性病监测台账'
        },
        {
          id: 'tumor_count',
          label: '恶性肿瘤登记随访',
          value: '14,200',
          unit: '例',
          colorClass: 'text-purple-600 dark:text-purple-400',
          prompt: '请调取 14,200 例恶性肿瘤直报随访记录，分析肺癌、胃癌、食管癌发病顺位与 5 年生存率。',
          tooltip: '点击通过 AI 交互查询恶性肿瘤登记随访详情'
        },
        {
          id: 'cvd_count',
          label: '心脑血管急性事件',
          value: '8,350',
          unit: '份',
          colorClass: 'text-amber-600 dark:text-amber-400',
          prompt: '请分析全省 8,350 份急性心梗与脑卒中直报病例的发病时空聚集性与急救就诊延迟特征。',
          tooltip: '点击通过 AI 交互查询心脑血管急性事件详情'
        },
        {
          id: 'coverage',
          label: '死因网络直报覆盖',
          value: '18 地市 / 126 区县',
          unit: '(全省覆盖)',
          colorClass: 'text-slate-900 dark:text-slate-100',
          prompt: '请展示全省死因监测与慢病直报网络各级医疗卫生机构覆盖率。',
          tooltip: '点击通过 AI 交互查询死因网络直报覆盖详情'
        }
      ],
      activeAlertsCount: 5,
      activeAlertsTitle: '慢病预警: 5 起',
      latestDataPeriod: '2026-08-31'
    },
    alerts: [
      {
        alertId: 'ALERT-CHR-202608-01',
        title: '郑州市金水区 45-64岁急性心梗就诊峰值预警',
        level: 'orange',
        levelName: '较重预警 (二级)',
        category: '急性心脑血管',
        city: '郑州市',
        district: '金水区',
        street: '纬五路省医心脑血管救治中心',
        latitude: 34.7730,
        longitude: 113.6820,
        triggerReason: '急诊胸痛中心 7 日急性心梗确诊例数环比激增 42%，超出常态控制线 2.8 个标准差。',
        currentDensity: 42,
        threshold: 20,
        affectedPopulationEstimate: 18000,
        recommendedAction: '向社区卫生中心下发慢病高危患者随访用药与胸痛症状即刻就医指导。',
        disposalStatus: 'in_progress',
        triggerTime: '2026-08-25 08:30:00'
      },
      {
        alertId: 'ALERT-CHR-202608-02',
        title: '开封市祥符区 恶性肿瘤全死因链质控异常聚集预警',
        level: 'yellow',
        levelName: '一般预警 (三级)',
        category: '死因质控',
        city: '开封市',
        district: '祥符区',
        street: '祥符区人民医院直报点',
        latitude: 34.7550,
        longitude: 114.4380,
        triggerReason: '死因证明书根本死因垃圾编码(R码)比例达 8.4%（警戒阈值 5%）。',
        currentDensity: 8.4,
        threshold: 5.0,
        affectedPopulationEstimate: 6200,
        recommendedAction: '启动死因链智能推断 NLP 复核引擎，向填报医师推送根本死因溯源修正工单。',
        disposalStatus: 'pending',
        triggerTime: '2026-08-24 10:15:00'
      }
    ]
  }
};

/**
 * 确定当前运行的智能体 Domain
 */
export function getCurrentAgentDomain(): AgentDomainType {
  // 1. 优先从客户端环境变量获取
  const envDomain = process.env.NEXT_PUBLIC_AGENT_DOMAIN || process.env.AGENT_DOMAIN;
  if (envDomain && (envDomain in AGENT_PROFILES)) {
    return envDomain as AgentDomainType;
  }

  // 2. 浏览器环境下根据 URL 路径或端口智能判断
  if (typeof window !== 'undefined') {
    const pathname = window.location.pathname.toLowerCase();
    if (pathname.startsWith('/food')) return 'foodborne';
    if (pathname.startsWith('/env')) return 'env';
    if (pathname.startsWith('/death') || pathname.startsWith('/chronic')) return 'chronic';
    if (pathname.startsWith('/vector')) return 'vector';

    const port = window.location.port;
    if (port === '3002') return 'foodborne';
    if (port === '3003') return 'env';
    if (port === '3004') return 'chronic';
    if (port === '3001' || port === '3000') return 'vector';
  }

  return 'vector';
}

/**
 * 获取当前智能体场景配置 Profile
 */
export function getCurrentAgentProfile(): AgentProfile {
  const domain = getCurrentAgentDomain();
  return AGENT_PROFILES[domain] || AGENT_PROFILES.vector;
}

/**
 * 根据指定 domain 获取 Profile
 */
export function getAgentProfile(domain: AgentDomainType): AgentProfile {
  return AGENT_PROFILES[domain] || AGENT_PROFILES.vector;
}
