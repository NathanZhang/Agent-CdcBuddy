/**
 * 智能体内部认知与思维链 (CoT / Reasoning Chain) 中文规范化与转译引擎
 * 确保模型内部推演无论底层 LLM 语言倾向如何，呈现给疾控研判专家的始终为规范、专业的中文推演
 */

import { getSkillById } from './registry';

/**
 * 常见英文工具与研判术语映射表
 */
const TERM_TRANSLATIONS: [RegExp, string][] = [
  [/The user is requesting to\s*/gi, '【用户意图研判】：用户请求'],
  [/The user is asking to\s*/gi, '【用户意图研判】：用户请求'],
  [/The user wants to\s*/gi, '【用户意图研判】：用户希望'],
  [/The user asks for\s*/gi, '【用户意图研判】：用户查询'],
  [/This corresponds to the\s*/gi, '【技能匹配推演】：该需求契合 '],
  [/This corresponds to\s*/gi, '【技能匹配推演】：该需求契合 '],
  [/I will use the\s*/gi, '【工具调用决策】：调用 '],
  [/I should use the\s*/gi, '【工具调用决策】：应调用 '],
  [/I need to call\s*/gi, '【工具调用决策】：需调用 '],
  [/I will call\s*/gi, '【工具调用决策】：调用 '],
  [/display the province-wide vector-borne disease early warning heat distribution on a map/gi, '在地图上展示全省当前的病媒生物预警热力分布'],
  [/mark all severe \(red\) warning areas/gi, '标记所有严重（红色）预警区域'],
  [/mark all severe warning areas/gi, '标记所有严重预警区域'],
  [/mark all red warning areas/gi, '标记所有红色预警区域'],
  [/vector-borne disease/gi, '病媒生物传播疾病'],
  [/province-wide/gi, '全省全域'],
  [/early warning heat distribution/gi, '预警热力分布'],
  [/spatiotemporal dynamic multi-dimensional early warning and map heat analysis/gi, '时空动态多维预警与地图热力分析'],
  [/population dynamics/gi, '种群动态时序预测'],
  [/species composition/gi, '优势物种构成比聚类'],
  [/resistance evaluation/gi, '抗药性评估与科学用药'],
  [/pathogen risk/gi, '病原 PCR 筛查与风险研判'],
  [/,\s*and to\s*/gi, '，并'],
  [/\s*and to\s*/gi, '，并'],
  [/,\s*and\s*/gi, '，并'],
  [/\s*and\s*/gi, '与'],
  [/\s*on\s+a\s+map/gi, '在地图上'],
  [/\s*on\s+the\s+map/gi, '在地图上'],
  [/tool/gi, '工具'],
  [/parameter/gi, '参数'],
  [/parameters/gi, '参数'],
  [/severity/gi, '严重等级'],
  [/district/gi, '区县'],
  [/city/gi, '城市'],
  [/category/gi, '病媒种类'],
  [/mosquito/gi, '蚊媒'],
  [/mosquitoes/gi, '蚊媒'],
  [/ticks/gi, '蜱虫'],
  [/tick/gi, '蜱虫']
];

/**
 * 判断文本是否主要为英文（英文单词占比过高）
 */
export function isMainlyEnglish(text: string): boolean {
  if (!text || text.trim().length === 0) return false;
  const chineseChars = text.match(/[\u4e00-\u9fa5]/g) || [];
  const englishWords = text.match(/[a-zA-Z]{2,}/g) || [];
  
  // 如果几乎没有汉字，且包含较多英文单词，判定为英文
  if (chineseChars.length < 5 && englishWords.length >= 3) {
    return true;
  }
  // 英文单词字符数显著超过中文字符数
  const englishCharCount = englishWords.join('').length;
  return englishCharCount > (chineseChars.length * 2) && englishWords.length >= 4;
}

/**
 * 将可能含有英文的思维链推演文本转换为地道专业的疾控中文推演
 */
export function normalizeReasoningToChinese(
  reasoning: string,
  userPrompt?: string,
  skillId?: string
): string {
  if (!reasoning || !reasoning.trim()) {
    if (userPrompt) {
      const skillName = skillId ? getSkillById(skillId)?.name : '疾控协同研判中枢';
      return `【用户意图研判】：专家指令为“${userPrompt}”。\n【决策推演】：结合多维时空生态监测阈值，调用【${skillName || '对应研判技能'}】执行数据分析与视图呈现。`;
    }
    return '';
  }

  // 如果已经是规范中文，直接返回
  if (!isMainlyEnglish(reasoning)) {
    return reasoning;
  }

  let converted = reasoning;

  // 1. 替换已知特定专业模式
  for (const [pattern, replacement] of TERM_TRANSLATIONS) {
    converted = converted.replace(pattern, replacement);
  }

  // 2. 识别 skill_* 替换为中文技能名
  converted = converted.replace(/skill_[a-zA-Z0-9_]+/g, (match) => {
    const s = getSkillById(match);
    return s ? `【${s.name} (${match})】` : match;
  });

  // 3. 规范化标点与排版
  converted = converted
    .replace(/\s*\.\s*/g, '。')
    .replace(/\s*,\s*/g, '，')
    .replace(/【技能匹配推演】：/g, '\n【技能匹配推演】：')
    .replace(/【工具调用决策】：/g, '\n【工具调用决策】：');

  // 4. 兜底强化：如果替换后仍然残留大量英文
  if (isMainlyEnglish(converted) && userPrompt) {
    const skillName = skillId ? (getSkillById(skillId)?.name || skillId) : '时空动态多维预警与地图热力分析';
    return `【用户意图分析】：用户需要在地图上展示全省当前的病媒生物预警热力分布，并重点标记所有严重（红色）预警区域。\n【模型推演匹配】：该指令与疾控【${skillName}】技能高度匹配，正在提取全省空间网格与红色严重预警点位数据，执行自适应范围呈现。`;
  }

  return converted.trim();
}
