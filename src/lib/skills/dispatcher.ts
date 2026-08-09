import { getSkillById } from '@/lib/skills/registry';
import { ACTIVE_ALERTS_LIST } from '@/lib/data/active-alerts';

export interface DispatchResult {
  success: boolean;
  skillId: string;
  skillName: string;
  replyText: string;
  generativeView?: any;
  error?: string;
  source?: 'llm_tool_calling' | 'llm_direct_answer' | 'rule_fallback';
  args?: Record<string, any>;
}

export interface DispatchContext {
  chatHistory?: Array<{ sender: string; text: string; skillUsed?: string }>;
  currentView?: any;
  userRole?: string;
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
    matchedSkillId = 'skill_meta_custom_builder';
    const rawDesc = promptText.replace(/^(帮我)?(创建|新建|定义|定制)(一个)?(新)?技能[:：]?\s*/i, '').trim();
    skillArgs.description = rawDesc || '用户对话动态创建的病媒分析技能';
    if (rawDesc.includes('安阳') && rawDesc.includes('蜱')) {
      skillArgs.skillName = '豫北蜱虫携带恙虫病东方体时空分布分析';
    } else if (rawDesc.length > 0) {
      skillArgs.skillName = rawDesc.slice(0, 20);
    } else {
      skillArgs.skillName = '用户定制病媒分析技能';
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
    // 监测数据明细查询 Text2SQL (规则增强版)
    matchedSkillId = 'skill_monitoring_data_table';
    skillArgs.query = promptText;
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
    matchedSkillId = 'skill_spatial_early_warning';
    if (q.includes('严重')) skillArgs.severity = 'red';
  } else {
    matchedSkillId = 'skill_vector_nlq';
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
 * 统一病媒生物意图识别与技能执行调度引擎
 * 优先调用服务端 SiliconFlow Qwen3.6-27B Tool Calling，异常时无缝降级走规则引擎
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

  // 1. 优先调用服务端的 Qwen3.6-27B Tool Calling 调度 API
  try {
    const url = typeof window !== 'undefined' ? '/api/agent/dispatch' : 'http://localhost:3000/api/agent/dispatch';
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        promptText: trimmed,
        chatHistory: context?.chatHistory || [],
        userRole: context?.userRole,
        context: {
          currentView: context?.currentView
        }
      })
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        return {
          success: true,
          skillId: data.skillId,
          skillName: data.skillName,
          replyText: data.replyText,
          generativeView: data.generativeView,
          source: data.source,
          args: data.args
        };
      }
    }
  } catch (netErr) {
    console.warn('[Dispatcher] 服务端 Agent API 请求失败，启用本地规则引擎降级:', netErr);
  }

  // 2. 本地平滑降级执行
  const fallback = fallbackRuleMatch(trimmed, context);
  const skill = getSkillById(fallback.skillId);
  if (!skill) {
    return {
      success: false,
      skillId: fallback.skillId,
      skillName: fallback.skillName,
      replyText: `未找到技能定义 [${fallback.skillId}]。`
    };
  }

  try {
    const result = await skill.execute(fallback.args);
    return {
      success: true,
      skillId: skill.id,
      skillName: skill.name,
      replyText: `已根据您的指令调用 **【${skill.name}】** 技能。相关分析图表与态势数据已在主工作区生成式渲染完成。`,
      generativeView: result,
      source: 'rule_fallback',
      args: fallback.args
    };
  } catch (err: any) {
    console.error('Skill execution failed:', err);
    return {
      success: false,
      skillId: skill.id,
      skillName: skill.name,
      replyText: `⚠️ 执行技能【${skill.name}】时出现异常: ${err.message || '系统错误'}`,
      error: err.message
    };
  }
}
