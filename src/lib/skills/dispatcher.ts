import { getSkillById } from '@/lib/skills/registry';
import { ACTIVE_ALERTS_LIST } from '@/lib/data/active-alerts';
import { cleanXmlToolCalls } from '@/lib/skills/tool-parser';
import { generateDomainAIInterpretation } from '@/lib/skills/interpretation-generator';
import { normalizeReasoningToChinese } from '@/lib/skills/chinese-reasoning-normalizer';
import { getCurrentAgentProfile, getCurrentAgentDomain } from '@/lib/config/agent-profile';

export interface DispatchResult {
  success: boolean;
  skillId: string;
  skillName: string;
  replyText: string;
  reasoningText?: string;
  reasoningDuration?: number;
  generativeView?: any;
  error?: string;
  source?: 'llm_tool_calling' | 'llm_direct_answer' | 'rule_fallback';
  args?: Record<string, any>;
}

export interface DispatchContext {
  chatHistory?: Array<{ sender: string; text: string; skillUsed?: string }>;
  currentView?: any;
  userRole?: string;
  signal?: AbortSignal;
  onReasoningStart?: () => void;
  onReasoningChunk?: (chunk: string, fullReasoning: string) => void;
  onReasoningEnd?: (durationMs: number) => void;
  onContentChunk?: (chunk: string, fullContent: string) => void;
  onToolCallStart?: (info: { toolId: string; toolName: string; args: any }) => void;
  onToolCallResult?: (info: { toolId: string; success: boolean; summary: string }) => void;
  onGenerativeView?: (view: any) => void;
}

export interface RuleMatchResult {
  skillId: string;
  skillName: string;
  args: Record<string, any>;
  source: 'rule_fallback';
}

/**
 * 规则与实体抽取兜底匹配引擎 (Fallback Rule Matcher)
 */
export function fallbackRuleMatch(promptText: string, context?: DispatchContext): RuleMatchResult {
  const trimmed = promptText.trim();
  const q = trimmed.toLowerCase();
  let matchedSkillId = 'skill_spatial_early_warning';
  const skillArgs: any = {};

  // 1. 提取预警编号 (如 ALERT-202408-101, ALERT-202408-114)
  const alertIdMatch = promptText.match(/ALERT-\d+(?:-\d+)?/i);
  if (alertIdMatch) {
    skillArgs.alertId = alertIdMatch[0].toUpperCase();
  } else if (
    (q.includes('该预警') || q.includes('此预警') || q.includes('这个预警') || q.includes('上述预警') || q.includes('工单') || q.includes('处置')) &&
    context?.chatHistory
  ) {
    for (let i = context.chatHistory.length - 1; i >= 0; i--) {
      const histText = context.chatHistory[i].text || '';
      const histMatch = histText.match(/ALERT-\d+(?:-\d+)?/i);
      if (histMatch) {
        skillArgs.alertId = histMatch[0].toUpperCase();
        break;
      }
    }
  }

  const matchedAlertItem = skillArgs.alertId 
    ? ACTIVE_ALERTS_LIST.find(a => a.alertId.toUpperCase() === skillArgs.alertId.toUpperCase()) 
    : null;
  if (matchedAlertItem) {
    skillArgs.city = matchedAlertItem.city;
    skillArgs.district = matchedAlertItem.district;
    skillArgs.category = matchedAlertItem.category;
    skillArgs.severity = matchedAlertItem.level;
    skillArgs.targetAlert = matchedAlertItem;
  }

  // 2. 动态提取地理范围（河南省 18 地市）
  if (!skillArgs.city) {
    const cities = [
      '郑州市', '洛阳市', '开封市', '南阳市', '安阳市', 
      '信阳市', '新乡市', '商丘市', '许昌市', '焦作市', 
      '平顶山市', '周口市', '驻马店市', '漯河市', '濮阳市', 
      '三门峡市', '鹤壁市', '济源市'
    ];
    for (const c of cities) {
      const shortName = c.replace('市', '');
      if (q.includes(c) || q.includes(shortName)) {
        skillArgs.city = c;
        break;
      }
    }
    if (!skillArgs.city && context?.chatHistory) {
      for (let i = context.chatHistory.length - 1; i >= 0; i--) {
        const histText = context.chatHistory[i].text || '';
        for (const c of cities) {
          const shortName = c.replace('市', '');
          if (histText.includes(c) || histText.includes(shortName)) {
            skillArgs.city = c;
            break;
          }
        }
        if (skillArgs.city) break;
      }
    }
  }

  // 3. 动态提取区县
  if (!skillArgs.district) {
    const knownDistricts = [
      '源汇区', '郾城区', '召陵区', '舞阳县', '临颍县',
      '金水区', '二七区', '中原区', '管城回族区', '管城区', '惠济区', '上街区', '巩义市', '荥阳市', '新密市', '新郑市', '登封市', '中牟县', '郑东新区', '高新区', '经开区',
      '汤阴县', '文峰区', '北关区', '殷都区', '龙安区', '安阳县', '滑县', '内黄县', '林州市',
      '浉河区', '平桥区', '罗山县', '光山县', '新县', '商城县', '固始县', '潢川县', '淮滨县', '息县',
      '涧西区', '西工区', '老城区', '瀍河回族区', '洛龙区', '孟津区', '偃师区', '新安县', '栾川县', '嵩县', '汝阳县', '宜阳县', '洛宁县', '伊川县',
      '红旗区', '卫滨区', '凤泉区', '牧野区', '卫辉市', '辉县市', '新乡县', '获嘉县', '原阳县', '延津县', '封丘县', '长垣市',
      '山阳区', '解放区', '中站区', '马村区', '沁阳市', '孟州市', '修武县', '博爱县', '武陟县', '温县',
      '宛城区', '卧龙区', '邓州市', '南召县', '方城县', '西峡县', '镇平县', '内乡县', '淅川县', '社旗县', '唐河县', '新野县', '桐柏县',
      '龙亭区', '鼓楼区', '禹王台区', '顺河回族区', '祥符区', '杞县', '通许县', '尉氏县', '兰考县',
      '驿城区', '西平县', '上蔡县', '平舆县', '正阳县', '确山县', '泌阳县', '汝南县', '遂平县', '新蔡县',
      '魏都区', '建安区', '禹州市', '长葛市', '鄢陵县', '襄城县',
      '睢阳区', '梁园区', '永城市', '民权县', '宁陵县', '柘城县', '虞城县', '夏邑县', '睢县',
      '新华区', '卫东区', '湛河区', '石龙区', '舞钢市', '汝州市', '宝丰县', '叶县', '鲁山县', '郏县',
      '川汇区', '淮阳区', '项城市', '扶沟县', '西华县', '商水县', '沈丘县', '郸城县', '太康县', '鹿邑县',
      '华龙区', '清丰县', '南乐县', '范县', '台前县', '濮阳县',
      '湖滨区', '陕州区', '义马市', '灵宝市', '渑池县', '卢氏县',
      '淇滨区', '山城区', '鹤山区', '浚县', '淇县',
      '济源市'
    ];
    const matchedDistricts: string[] = [];
    for (const d of knownDistricts) {
      const normD = d === '管城区' ? '管城回族区' : d;
      const cleanName = d.replace('回族区', '').replace('区', '').replace('县', '');
      if (q.includes(d) || promptText.includes(d) || (cleanName.length >= 2 && (q.includes(cleanName) || promptText.includes(cleanName)))) {
        if (!matchedDistricts.includes(normD)) {
          matchedDistricts.push(normD);
        }
      }
    }
    if (matchedDistricts.length > 0) {
      skillArgs.district = matchedDistricts.join(',');
    }
  }

  // 4. 动态提取病媒大类
  if (!skillArgs.category) {
    if (q.includes('蝇')) skillArgs.category = '蝇';
    else if (q.includes('蟑螂') || q.includes('蜚蠊') || q.includes('蟑')) skillArgs.category = '蟑螂';
    else if (q.includes('鼠')) skillArgs.category = '鼠';
    else if (q.includes('蜱')) skillArgs.category = '蜱';
    else if (q.includes('恙螨') || q.includes('螨')) skillArgs.category = '恙螨';
    else if (q.includes('蚊')) skillArgs.category = '蚊';
  }

  // 5. 动态提取预警级别
  if (!skillArgs.severity) {
    if (q.includes('严重') || q.includes('一级') || q.includes('红警')) skillArgs.severity = 'red';
    else if (q.includes('较重') || q.includes('二级') || q.includes('橙警')) skillArgs.severity = 'orange';
    else if (q.includes('一般') || q.includes('三级') || q.includes('黄警')) skillArgs.severity = 'yellow';
    else skillArgs.severity = 'all';
  }

  // 6. 动态提取年份
  const yearMatch = promptText.match(/(20\d{2})/);
  if (yearMatch) {
    skillArgs.year = parseInt(yearMatch[1], 10);
  }

  // 7. 动态提取月份
  const monthMatch = promptText.match(/(\d{1,2})\s*月/);
  if (monthMatch) {
    skillArgs.month = parseInt(monthMatch[1], 10);
  }

  // 8. 动态提取特定物种
  if (q.includes('淡色库蚊')) skillArgs.speciesName = '淡色库蚊';
  else if (q.includes('白纹伊蚊')) skillArgs.speciesName = '白纹伊蚊';
  else if (q.includes('致倦库蚊')) skillArgs.speciesName = '致倦库蚊';
  else if (q.includes('中华按蚊')) skillArgs.speciesName = '中华按蚊';
  else if (q.includes('德国小蠊')) skillArgs.speciesName = '德国小蠊';
  else if (q.includes('褐家鼠')) skillArgs.speciesName = '褐家鼠';
  else if (q.includes('长角血蜱')) skillArgs.speciesName = '长角血蜱';

  // 9. 规则匹配路由
  const isDataQueryVerb = q.includes('显示') || q.includes('查询') || q.includes('查看') || q.includes('调出') || q.includes('列出') || q.includes('统计');
  const isDataNoun = q.includes('数据') || q.includes('记录') || q.includes('台账') || q.includes('监测') || q.includes('明细');

  if (
    q.includes('创建新技能') || q.includes('新建技能') || 
    q.includes('自定义技能') || q.includes('定制技能') ||
    q.includes('帮我创建') || q.includes('创建技能')
  ) {
    const currentDomain = getCurrentAgentProfile().domain || 'vector';
    if (currentDomain === 'foodborne') {
      matchedSkillId = 'skill_foodborne_custom_builder';
    } else if (currentDomain === 'env') {
      matchedSkillId = 'skill_env_custom_builder';
    } else if (currentDomain === 'chronic') {
      matchedSkillId = 'skill_chronic_custom_builder';
    } else {
      matchedSkillId = 'skill_meta_custom_builder';
    }
    const rawDesc = promptText.replace(/^(帮我)?(创建|新建|定义|定制)(一个)?(新)?技能[:：]?\s*/i, '').trim();
    skillArgs.description = rawDesc || `用户对话动态创建的专属分析技能`;
    if (rawDesc.includes('安阳') && rawDesc.includes('蜱')) {
      skillArgs.skillName = '豫北蜱虫携带恙虫病东方体时空分布分析';
    } else if (rawDesc.length > 0) {
      skillArgs.skillName = rawDesc.slice(0, 20);
    } else {
      skillArgs.skillName = '用户定制专属分析技能';
    }
    skillArgs.chartType = rawDesc.includes('地图') || rawDesc.includes('村镇') ? 'map' : 'bar';
  } else if (
    (q.includes('satscan') && (q.includes('lstm') || q.includes('导入') || q.includes('预测下一周') || q.includes('多步'))) ||
    q.includes('satscan → k-means → lstm') ||
    q.includes('satscan ➔ kmeans ➔ lstm')
  ) {
    matchedSkillId = 'skill_satscan_kmeans_lstm';
    if (!skillArgs.year) skillArgs.year = 2022;
    if (!skillArgs.month) skillArgs.month = 3;
    if (!skillArgs.category) skillArgs.category = '蚊';
    skillArgs.forecastDays = 7;
  } else if (
    q.includes('satscan') || 
    q.includes('泊松扫描') || 
    q.includes('空间聚集扫描')
  ) {
    matchedSkillId = 'skill_satscan_spatial';
    if (!skillArgs.year) skillArgs.year = 2022;
    if (!skillArgs.month) skillArgs.month = 6;
    if (!skillArgs.category) skillArgs.category = '蚊';
    skillArgs.maxRadiusKm = 120.0;
  } else if (
    q.includes('lstm') || 
    q.includes('长短期记忆')
  ) {
    matchedSkillId = 'skill_lstm_predictor';
    if (!skillArgs.city) skillArgs.city = '郑州市';
    if (!skillArgs.category) skillArgs.category = '蚊';
    skillArgs.forecastDays = 7;
  } else if (
    q.includes('后台智能体') || 
    q.includes('后台运行') || 
    q.includes('多智能体场景') || 
    q.includes('持续更新并分析数据') || 
    q.includes('推送到队列') || 
    q.includes('巡检策略')
  ) {
    matchedSkillId = 'skill_daemon_surveillance';
    skillArgs.promptPolicy = promptText;
    skillArgs.triggerSource = 'manual_invoke';
  } else if (
    // 食源性疾病：cgMLST 同源进化树与分子溯源
    q.includes('同源') || q.includes('cgmlst') || q.includes('进化树') || 
    q.includes('分子溯源') || q.includes('基因带型') || q.includes('pfge') || q.includes('克隆株')
  ) {
    matchedSkillId = 'skill_molecular_trace';
    const obMatch = promptText.match(/OUTBREAK-\d+(?:-\d+)?/i);
    if (obMatch) skillArgs.clusterId = obMatch[0].toUpperCase();
  } else if (
    // 食源性疾病：嫌疑食品归因与比值比 TOP10
    (q.includes('食品') || q.includes('进食') || q.includes('食物')) && 
    (q.includes('归因') || q.includes('比值比') || q.includes('排行') || q.includes('top') || q.includes('抽检'))
  ) {
    matchedSkillId = 'skill_food_attribution';
  } else if (
    // 食源性疾病：聚集性暴发事件、流调处置与预测
    q.includes('食源') || q.includes('暴发') || q.includes('聚集性') || 
    q.includes('副溶血') || q.includes('沙门氏') || q.includes('诺如') || 
    q.includes('李斯特') || q.includes('食物中毒')
  ) {
    if (q.includes('处置') || q.includes('工单') || q.includes('提纲') || q.includes('协同')) {
      matchedSkillId = 'skill_outbreak_disposal_advice';
    } else if (q.includes('预测') || q.includes('未来') || q.includes('趋势') || q.includes('外推')) {
      matchedSkillId = 'skill_foodborne_risk_forecast';
    } else if (q.includes('报告') || q.includes('简报') || q.includes('公报')) {
      matchedSkillId = 'skill_foodborne_report_export';
    } else {
      matchedSkillId = 'skill_foodborne_cluster_detect';
    }
  } else if (
    q.includes('工单') || q.includes('处置') || q.includes('消杀') || 
    q.includes('派工') || q.includes('核销') || q.includes('闭环') ||
    q.includes('施药') || q.includes('超低容量') || q.includes('喷洒')
  ) {
    matchedSkillId = 'skill_disposal_workflow';
  } else if (
    q.includes('报告') || q.includes('专项') || q.includes('导出') || 
    q.includes('公报') || q.includes('简报') || q.includes('周报') || q.includes('月报')
  ) {
    matchedSkillId = 'skill_auto_report_gen';
    const cleanTitle = promptText
      .replace(/^(请)?(帮我)?(生成|导出|输出|一键生成|一键汇总)/i, '')
      .replace(/(并准备导出|并导出|且准备导出|。|！)+$/g, '')
      .trim();
    if (cleanTitle) {
      skillArgs.reportTitle = cleanTitle.includes('报告') || cleanTitle.includes('简报') || cleanTitle.includes('公报')
        ? cleanTitle
        : `${cleanTitle}专项报告`;
    }
  } else if (
    q.includes('移动端') || q.includes('拍照') || q.includes('录入') || 
    q.includes('仿真') || q.includes('质控') || q.includes('现场采集')
  ) {
    matchedSkillId = 'skill_mobile_assistant_api';
  } else if (
    q.includes('演化') || q.includes('基因') || q.includes('kdr') || 
    q.includes('突变') || q.includes('贝叶斯')
  ) {
    matchedSkillId = 'skill_resistance_evolution';
  } else if (
    q.includes('抗药性') || q.includes('药剂') || q.includes('菊酯') || 
    q.includes('lc50') || q.includes('轮换') || q.includes('毒力') || q.includes('抗性')
  ) {
    matchedSkillId = 'skill_resistance_evaluation';
    if (q.includes('氯氰菊酯')) skillArgs.pesticideName = '氯氰菊酯';
  } else if (
    q.includes('病原') || q.includes('pcr') || q.includes('阳性') || 
    q.includes('登革') || q.includes('乙脑') || q.includes('恙虫病') || 
    q.includes('出血热') || q.includes('发热伴')
  ) {
    matchedSkillId = 'skill_pathogen_risk';
    if (q.includes('登革')) skillArgs.pathogenName = '登革病毒';
    if (q.includes('乙脑')) skillArgs.pathogenName = '乙型脑炎病毒';
    if (q.includes('恙虫病')) skillArgs.pathogenName = '恙虫病东方体';
  } else if (
    q.includes('传播风险') || q.includes('暴发风险') || q.includes('传播指数') || 
    q.includes('仪表盘') || q.includes('风险指数')
  ) {
    matchedSkillId = 'skill_transmission_risk';
    if (q.includes('登革热')) skillArgs.diseaseName = '登革热 (Dengue Fever)';
  } else if (
    q.includes('gbdt') || q.includes('气象') || q.includes('暴发预测') || 
    (q.includes('预测') && (q.includes('下月') || q.includes('峰值') || q.includes('气温') || q.includes('降水')))
  ) {
    matchedSkillId = 'skill_density_forecast';
    if (!skillArgs.category) skillArgs.category = '蚊';
  } else if (
    q.includes('消长') || q.includes('arima') || q.includes('时间序列') || 
    q.includes('动态分析') || q.includes('预测曲线') || (q.includes('动态') && !q.includes('地图')) || q.includes('趋势')
  ) {
    matchedSkillId = 'skill_population_dynamics';
    if (!skillArgs.category) skillArgs.category = '蚊';
  } else if (
    q.includes('优势种') || q.includes('构成比') || q.includes('聚类') || 
    q.includes('构成比例') || q.includes('种群结构')
  ) {
    matchedSkillId = 'skill_species_composition';
    if (!skillArgs.category) skillArgs.category = '蚊';
  } else if (
    q.includes('数据表') || q.includes('明细表') || q.includes('监测表') || 
    q.includes('原始数据') || q.includes('表格') || q.includes('记录表') || 
    q.includes('查询表') || q.includes('text2sql') || q.includes('sql') || 
    q.includes('全部数据') || (q.includes('数据') && q.includes('表')) ||
    (isDataQueryVerb && isDataNoun) || (skillArgs.city && isDataNoun)
  ) {
    const currentDomain = getCurrentAgentProfile().domain || 'vector';
    if (currentDomain === 'foodborne') {
      matchedSkillId = 'skill_foodborne_case_table';
    } else if (currentDomain === 'env') {
      matchedSkillId = 'skill_env_monitoring_table';
    } else if (currentDomain === 'chronic') {
      matchedSkillId = 'skill_chronic_monitoring_table';
    } else {
      matchedSkillId = 'skill_monitoring_data_table';
    }
    skillArgs.query = promptText;
  } else if (
    q.includes('克里金') || q.includes('饮用水') || q.includes('水质') || 
    q.includes('末梢水') || q.includes('出厂水') || q.includes('管网水') ||
    q.includes('供水管网') || q.includes('三氯甲烷') || q.includes('致癌危害商值') ||
    q.includes('非致癌健康风险')
  ) {
    matchedSkillId = 'skill_water_safety_eval';
  } else if (
    q.includes('污水') || q.includes('管网溯源') || q.includes('反向溯源') || 
    q.includes('滞后相关') || q.includes('滞后关联') || q.includes('排水管网')
  ) {
    matchedSkillId = 'skill_sewage_pathogen_trace';
    if (q.includes('新冠')) skillArgs.pathogen = '新冠病毒';
    else if (q.includes('诺如')) skillArgs.pathogen = '诺如病毒';
  } else if (
    q.includes('空气质量') || q.includes('极端天气') || q.includes('热浪') || 
    q.includes('dlnm') || q.includes('臭氧') || q.includes('pm2.5') || q.includes('气候健康')
  ) {
    matchedSkillId = 'skill_air_climate_health_risk';
  } else if (
    q.includes('流域') || q.includes('跨介质') || q.includes('污染链') || 
    q.includes('黄河流域') || q.includes('淮河流域') || q.includes('海河流域') || q.includes('长江流域')
  ) {
    matchedSkillId = 'skill_river_basin_pollution_chain';
  } else if (
    q.includes('情景模拟') || q.includes('政策推演') || q.includes('控排') || q.includes('减排')
  ) {
    matchedSkillId = 'skill_env_scenario_simulation';
  } else if (
    // 慢病与死因：死因医学证明书智能逻辑质控与冲突校验 (No. 59)
    q.includes('死因证明') || q.includes('死亡医学证明') || (q.includes('质控') && q.includes('死因')) ||
    q.includes('死因链倒置') || q.includes('逻辑冲突') || q.includes('完整率')
  ) {
    matchedSkillId = 'skill_death_cert_qc';
  } else if (
    // 慢病与死因：死因链医学知识图谱根本死因推断与 ICD-10 编码 (No. 60/61)
    q.includes('根本死因') || q.includes('icd10') || q.includes('icd-10') || 
    q.includes('死因推导') || q.includes('医学知识图谱') || q.includes('编码')
  ) {
    matchedSkillId = 'skill_icd10_nlp_inference';
  } else if (
    // 慢病与死因：全死因时序动态图谱与罕见死因短期聚集识别 (No. 62/63)
    q.includes('罕见死因') || (q.includes('死因') && (q.includes('聚集') || q.includes('激增'))) ||
    q.includes('循环系统疾病') || q.includes('心脑血管死亡')
  ) {
    matchedSkillId = 'skill_mortality_cluster_rare';
  } else if (
    // 慢病与死因：三大重大慢病发病预测与并发症关联挖掘 (No. 64/66)
    q.includes('慢病预测') || q.includes('恶性肿瘤') || q.includes('脑卒中') || 
    q.includes('三高共管') || q.includes('并发症') || q.includes('发病率时空演变') ||
    (q.includes('慢病') && (q.includes('预测') || q.includes('发病')))
  ) {
    matchedSkillId = 'skill_chronic_risk_forecast';
  } else if (
    // 慢病与死因：伤害特征聚类与因果决策树归因分析 (No. 67/69)
    q.includes('伤害') || q.includes('跌倒') || q.includes('农机') || 
    q.includes('一氧化碳中毒') || q.includes('意外伤害')
  ) {
    matchedSkillId = 'skill_injury_attribution_tree';
  } else if (
    // 慢病与死因：早癌与心脑血管筛查卫生经济学收益与人群清单 (No. 70/71)
    q.includes('早癌筛查') || (q.includes('筛查') && (q.includes('收益') || q.includes('经济学') || q.includes('清单') || q.includes('cea')))
  ) {
    matchedSkillId = 'skill_chronic_screening_roi';
  } else if (
    // 慢病与死因：死因顺位、YPLL 与早死概率 4q70 综合公报生成 (No. 72/73)
    q.includes('早死概率') || q.includes('4q70') || q.includes('ypll') || 
    q.includes('减寿年数') || q.includes('死因顺位') || q.includes('综合公报') ||
    q.includes('简略寿命表')
  ) {
    matchedSkillId = 'skill_chronic_death_report';
  } else if (
    // 食源性疾病：聚集性病例与暴发识别
    q.includes('食源') && (q.includes('聚集') || q.includes('暴发') || q.includes('就餐') || q.includes('雷达'))
  ) {
    matchedSkillId = 'skill_foodborne_cluster_detect';
  } else if (
    // 食源性疾病：传播与扩散模拟
    q.includes('传播模拟') || q.includes('扩散模拟') || (q.includes('食源') && q.includes('模拟'))
  ) {
    matchedSkillId = 'skill_foodborne_spread_sim';
  } else if (
    q.includes('调度') || q.includes('派单') || q.includes('推送') || 
    q.includes('预警清单') || q.includes('预警依据') || q.includes('分级预警')
  ) {
    matchedSkillId = 'skill_alert_push_dispatch';
  } else if (
    q.includes('地图') || q.includes('热力') || q.includes('时空') || 
    q.includes('空间分布') || q.includes('分布图') || q.includes('点位') || 
    q.includes('超标') || q.includes('预警')
  ) {
    const currentDomain = getCurrentAgentProfile().domain || 'vector';
    if (currentDomain === 'chronic') {
      matchedSkillId = 'skill_mortality_cluster_rare';
    } else if (currentDomain === 'env') {
      matchedSkillId = 'skill_water_safety_eval';
    } else if (currentDomain === 'foodborne') {
      matchedSkillId = 'skill_foodborne_cluster_detect';
    } else {
      matchedSkillId = 'skill_spatial_early_warning';
      if (q.includes('严重')) skillArgs.severity = 'red';
    }
  } else {
    const currentDomain = getCurrentAgentProfile().domain || 'vector';
    if (currentDomain === 'foodborne') {
      matchedSkillId = 'skill_foodborne_case_table';
    } else if (currentDomain === 'env') {
      matchedSkillId = 'skill_env_monitoring_table';
    } else if (currentDomain === 'chronic') {
      matchedSkillId = 'skill_chronic_monitoring_table';
    } else {
      matchedSkillId = 'skill_vector_nlq';
    }
    skillArgs.query = promptText;
  }

  const skill = getSkillById(matchedSkillId);
  return {
    skillId: matchedSkillId,
    skillName: skill?.name || matchedSkillId,
    args: skillArgs,
    source: 'rule_fallback'
  };
}

/**
 * 统一病媒生物意图识别与技能执行调度引擎 (流式版 SSE)
 * 优先连接 /api/agent/stream-dispatch 实时接收思维链与正文，网络异常时降级至非流式或规则匹配
 */
export async function dispatchSkillPromptStream(
  promptText: string,
  context?: DispatchContext
): Promise<DispatchResult> {
  const trimmed = promptText.trim();
  if (!trimmed) {
    return {
      success: false,
      skillId: '',
      skillName: '',
      replyText: '请输入有效的病媒生物监测指令或问题。'
    };
  }

  try {
    const url = typeof window !== 'undefined' ? '/api/agent/stream-dispatch' : 'http://localhost:3000/api/agent/stream-dispatch';
    const res = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream'
      },
      signal: context?.signal,
      body: JSON.stringify({
        promptText: trimmed,
        chatHistory: context?.chatHistory || [],
        userRole: context?.userRole,
        domain: (typeof window !== 'undefined' ? (window as any).__AGENT_DOMAIN__ : null) || getCurrentAgentDomain(),
        context: {
          currentView: context?.currentView
        }
      })
    });

    if (!res.ok || !res.body) {
      console.warn(`[Stream Dispatcher] 流式接口响应状态异常 (HTTP ${res.status})，降级为常规接口`);
      return await dispatchSkillPrompt(promptText, context);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let lineBuffer = '';

    let accumulatedReasoning = '';
    let accumulatedContent = '';
    let chosenSkillId = '';
    let chosenSkillName = '';
    let finalGenerativeView: any = context?.currentView || null;
    let reasoningDuration = 0;
    let isSuccess = true;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      lineBuffer += decoder.decode(value, { stream: true });
      const lines = lineBuffer.split('\n');
      lineBuffer = lines.pop() || '';

      let currentEvent = 'message';

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        if (trimmedLine.startsWith('event: ')) {
          currentEvent = trimmedLine.substring(7).trim();
          continue;
        }

        if (trimmedLine.startsWith('data: ')) {
          const rawData = trimmedLine.substring(6).trim();
          if (rawData === '[DONE]') continue;

          try {
            const data = JSON.parse(rawData);

            switch (currentEvent) {
              case 'reasoning_start':
                context?.onReasoningStart?.();
                break;

              case 'reasoning_chunk':
                if (data.fullText) {
                  accumulatedReasoning = data.fullText;
                  context?.onReasoningChunk?.(data.fullText, accumulatedReasoning);
                } else if (data.text) {
                  accumulatedReasoning += data.text;
                  context?.onReasoningChunk?.(data.text, accumulatedReasoning);
                }
                break;

              case 'reasoning_end':
                reasoningDuration = data.durationMs || 0;
                if (data.finalText) {
                  accumulatedReasoning = data.finalText;
                }
                context?.onReasoningEnd?.(reasoningDuration);
                break;

              case 'tool_call_start':
                chosenSkillId = data.toolId || chosenSkillId;
                chosenSkillName = data.toolName || chosenSkillName;
                context?.onToolCallStart?.(data);
                break;

              case 'tool_call_result':
                context?.onToolCallResult?.(data);
                break;

              case 'generative_view':
                if (data.view) {
                  finalGenerativeView = data.view;
                  context?.onGenerativeView?.(data.view);
                }
                break;

              case 'content_chunk':
                if (data.text) {
                  accumulatedContent += data.text;
                  context?.onContentChunk?.(data.text, accumulatedContent);
                }
                break;

              case 'finish':
                isSuccess = data.success !== false;
                if (data.skillId) chosenSkillId = data.skillId;
                if (data.skillName) chosenSkillName = data.skillName;
                if (data.reasoningDurationMs) reasoningDuration = data.reasoningDurationMs;
                break;

              case 'error':
                isSuccess = false;
                console.error('[Stream Dispatcher Event Error]', data.message);
                break;
            }
          } catch (jsonErr) {
            // 忽略非 JSON 数据行
          }
        }
      }
    }

    const finalCleanReply = cleanXmlToolCalls(accumulatedContent).trim();
    const finalView = finalGenerativeView || context?.currentView;
    const fallbackInterpretation = generateDomainAIInterpretation(chosenSkillId, finalView, promptText);

    return {
      success: isSuccess,
      skillId: chosenSkillId || 'skill_vector_nlq',
      skillName: chosenSkillName || '病媒生物协同研判',
      replyText: finalCleanReply || fallbackInterpretation,
      reasoningText: normalizeReasoningToChinese(accumulatedReasoning, promptText, chosenSkillId) || undefined,
      reasoningDuration: reasoningDuration > 0 ? reasoningDuration : undefined,
      generativeView: finalView,
      source: 'llm_tool_calling'
    };

  } catch (err: any) {
    if (err.name === 'AbortError' || context?.signal?.aborted) {
      throw err;
    }
    console.warn('[Stream Dispatcher Error] 流式请求异常，尝试降级:', err);
    return await dispatchSkillPrompt(promptText, context);
  }
}

/**
 * 统一病媒生物意图识别与技能执行调度引擎 (常规非流式兜底)
 */
export async function dispatchSkillPrompt(promptText: string, context?: DispatchContext): Promise<DispatchResult> {
  const trimmed = promptText.trim();
  if (!trimmed) {
    return {
      success: false,
      skillId: '',
      skillName: '',
      replyText: '请输入有效的病媒生物监测指令或问题。'
    };
  }

  try {
    const url = typeof window !== 'undefined' ? '/api/agent/dispatch' : 'http://localhost:3000/api/agent/dispatch';
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: context?.signal,
      body: JSON.stringify({
        promptText: trimmed,
        chatHistory: context?.chatHistory || [],
        userRole: context?.userRole,
        domain: (typeof window !== 'undefined' ? (window as any).__AGENT_DOMAIN__ : null) || getCurrentAgentDomain(),
        context: {
          currentView: context?.currentView
        }
      })
    });

    if (res.ok) {
      const data = await res.json();
      return {
        success: data.success,
        skillId: data.skillId || '',
        skillName: data.skillName || '',
        replyText: data.replyText,
        generativeView: data.generativeView,
        source: data.source,
        args: data.args
      };
    } else {
      const errText = await res.text();
      return {
        success: false,
        skillId: 'skill_vector_nlq',
        skillName: '服务连接异常',
        replyText: `⚠️ 智能体调度接口异常 (HTTP ${res.status}): ${errText || '未知错误'}`
      };
    }
  } catch (netErr: any) {
    if (netErr.name === 'AbortError' || context?.signal?.aborted) {
      throw netErr;
    }
    console.error('[Dispatcher] 服务端 Agent API 请求异常:', netErr);
    return {
      success: false,
      skillId: 'skill_vector_nlq',
      skillName: '服务连接异常',
      replyText: `⚠️ 无法连接到智能体服务，网络或服务响应异常: ${netErr.message || '连接失败'}`
    };
  }
}

