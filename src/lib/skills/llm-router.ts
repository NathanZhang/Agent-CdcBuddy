import { STANDARD_SKILLS, getSkillById } from './registry';
import { UserRole } from '../rbac/types';
import { getRouterTimeoutMs } from '../config/llm-timeout';
import { parseToolCallFromText, cleanXmlToolCalls } from './tool-parser';

export interface LLMRouteResult {
  source: 'llm_tool_calling' | 'llm_direct_answer' | 'rule_fallback';
  skillId: string;
  skillName: string;
  args: Record<string, any>;
  reasoning?: string;
  directAnswer?: string;
}

export interface RouterChatHistoryItem {
  sender: string;
  text: string;
  skillUsed?: string;
}

/**
 * 将项目内的 VectorSkill 转换为符合 OpenAI / SiliconFlow 规范的 Function Tools 定义
 */
export function getSiliconFlowSkillTools(userRole?: UserRole) {
  const availableSkills = userRole
    ? STANDARD_SKILLS.filter(s => !s.requiredRoles || s.requiredRoles.includes(userRole))
    : STANDARD_SKILLS;

  return availableSkills.map(skill => ({
    type: 'function',
    function: {
      name: skill.id,
      description: `【${skill.name}】(${skill.categoryName})：${skill.description}`,
      parameters: {
        type: 'object',
        properties: skill.parametersSchema?.properties || {},
        required: skill.parametersSchema?.required || []
      }
    }
  }));
}

const CDC_ROUTER_SYSTEM_PROMPT = `你是由河南省疾病预防控制中心构建的 AI 协同研判中枢意图调度器 (CdcBuddy Router)。
你的职责是精准理解用户的自然语言需求，结合多轮对话上下文，从提供的工具集 (Tools) 中挑选最契合的病媒生物研判技能并抽取出结构化参数。

【语言与思考强制规范】：
内部深度思考（Thinking Process / Reasoning Chain / CoT）与参数提取必须**全程使用中文（简体中文）**，严禁使用英文推演！

### 核心分流准则（按优先级从高到低）：
0. **【顶级优先】创建自定义分析技能 / 对话式新技能构建** -> 必须调用 \`skill_meta_custom_builder\`：
   - 凡是用户明确提出“创建新技能”、“新建技能”、“定义新技能”、“帮我创建一个新技能”、“添加自定义技能”、“定制技能”等意图，**无论后文描述了什么具体病媒对象（如蜱虫、恙虫病、白纹伊蚊、抗药性等），一律最高优先级调用 \`skill_meta_custom_builder\`**！绝对不能直接调用被提及的业务技能。
   - 提取参数：\`skillName\` (如"安阳市蜱虫携带恙虫病东方体时空分布分析"), \`description\` (用户指定的具体需求描述), \`chartType\` ("map" | "trend" | "bar" | "table")。
1. **数据明细与历史台账查询** -> 调用 \`skill_monitoring_data_table\` (Text2SQL)：
   - 凡是用户希望“显示/查看/查询/调出/列出”具体的病媒监测数据、明细记录、原始表格、历史台账、捕获统计（如“显示郑州市2024年8月病媒监测数据”、“查看金水区近两年蚊幼数据”），一律调用此技能。
   - 提取参数如：\`city\` (地级市名称，如"郑州市"), \`district\` (区县名称), \`year\` (数字年份如 2024), \`month\` (数字月份 1-12), \`category\` (病媒种类: "蚊","蝇","蟑螂","鼠","蜱","恙螨"), \`query\` (用户原始查询)。
2. **时序消长与未来趋势预测** -> 调用 \`skill_population_dynamics\` (ARIMA 季节消长模型)。
3. **优势种结构与聚类** -> 调用 \`skill_species_composition\` (K-Means 物种构成比)。
4. **杀虫剂耐药与科学用药** -> 调用 \`skill_resistance_evaluation\` (抗药性评估与轮换方案)。
5. **病原筛查与 PCR 阳性率** -> 调用 \`skill_pathogen_risk\` (登革热/乙脑/发热伴等病原风险)。
6. **时空预警与全省热力地图** -> 调用 \`skill_spatial_early_warning\`。
7. **预警分发推送** -> 调用 \`skill_alert_push_dispatch\`。
8. **处置消杀工单与闭环核销** -> 调用 \`skill_disposal_workflow\`。
9. **气象融合中长期密度预测** -> 调用 \`skill_density_forecast\` (GBDT 模型)。
10. **传染病传播暴发风险指数** -> 调用 \`skill_transmission_risk\`。
11. **抗药性基因演化预测** -> 调用 \`skill_resistance_evolution\`。
12. **国家标准、GB/T 规范、操作指南理论问答** -> 调用 \`skill_vector_nlq\`。
13. **专题报告生成与导出** -> 调用 \`skill_auto_report_gen\`。
14. **移动端采集仿真与质控** -> 调用 \`skill_mobile_assistant_api\`。
15. **SaTScan ➔ K-Means ➔ LSTM 多步科学计算流水线** -> 必须调用 \`skill_satscan_kmeans_lstm\`：
   - 凡是用户提到“SaTScan”、“空间扫描”、“时空扫描”、“SatScan 分析”、“并将高风险区域导入 LSTM”、“SaTScan ➔ K-Means ➔ LSTM”、“多步操作/分析流水线”等意图，必须调用 \`skill_satscan_kmeans_lstm\`。
   - 提取参数如：\`year\` (数字年份如 2022), \`month\` (数字月份 1-12 如 3), \`category\` ("蚊" | "蝇" | "蟑螂" | "鼠"), \`forecastDays\` (预测天数默认 7)。
16. **后台常驻数据分析智能体与预警推送** -> 必须调用 \`skill_daemon_surveillance\`：
   - 凡是提到“后台智能体”、“系统启动后后台运行”、“持续更新并分析数据”、“自动生成预警信息并推送到队列”、“后台数据分析智能体”、“巡检策略”等意图，必须调用 \`skill_daemon_surveillance\`。
   - 提取参数如：\`promptPolicy\` (专家配置的巡检提示词或策略需求), \`triggerSource\` ("timer_scheduled" | "manual_invoke")。

### 参数提取规范：
- 城市地名需规范化为标准地级市名（如输入"郑州"应提取为"郑州市"，"洛阳"应为"洛阳市"）。
- 若用户提问未明确指定年份但提及"今年/当前"，默认为 2024；若未指定月份但查询月度数据，可结合上下文推断或留空。
- 若用户的输入纯属打招呼或与疾控业务完全无关，无需调用工具，直接礼貌回复。
`;

/**
 * 使用 SiliconFlow 部署的 Qwen3.6-27B 模型执行 Tool Calling 意图路由
 */
export async function routeSkillWithLLM(
  promptText: string,
  chatHistory: RouterChatHistoryItem[] = [],
  userRole?: UserRole
): Promise<LLMRouteResult> {
  const trimmed = promptText.trim();
  const lower = trimmed.toLowerCase();

  // 完全使用大模型 Tool Use 机制，移除所有硬编码静态前置拦截规则
  
  const apiKey = process.env.SILICONFLOW_API_KEY || 'missing-siliconflow-api-key';
  const baseURL = process.env.SILICONFLOW_BASE_URL || 'https://api.siliconflow.cn/v1';
  const modelName = process.env.SILICONFLOW_MODEL || 'Qwen/Qwen3.6-27B';

  const tools = getSiliconFlowSkillTools(userRole);

  // 组装多轮对话 Messages (最多保留最近 6 条历史，避免上下文爆炸)
  const messages: any[] = [
    { role: 'system', content: CDC_ROUTER_SYSTEM_PROMPT }
  ];

  const recentHistory = chatHistory.slice(-6);
  for (const item of recentHistory) {
    if (item.sender === 'user') {
      messages.push({ role: 'user', content: item.text });
    } else if (item.sender === 'assistant' || item.sender === 'bot') {
      messages.push({
        role: 'assistant',
        content: item.text + (item.skillUsed ? ` [执行技能: ${item.skillUsed}]` : '')
      });
    }
  }

  messages.push({ role: 'user', content: promptText });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), getRouterTimeoutMs());

  try {
    const res = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: modelName,
        messages,
        tools,
        tool_choice: 'auto',
        temperature: 0.1
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[LLM Router] SiliconFlow API 请求异常 (${res.status}): ${errText}`);
      throw new Error(`SiliconFlow API status ${res.status}`);
    }

    const data = await res.json();
    const choice = data.choices?.[0]?.message;

    if (!choice) {
      throw new Error('LLM 返回内容为空');
    }

    // 1. 检查是否触发 Tool Calls (包含标准 tool_calls 与 XML 格式 <tool_call>)
    let toolCallFromXml = null;
    if (!choice.tool_calls || choice.tool_calls.length === 0) {
      toolCallFromXml = parseToolCallFromText(choice.content || '');
    }

    if ((choice.tool_calls && choice.tool_calls.length > 0) || toolCallFromXml) {
      let skillId = '';
      let parsedArgs: Record<string, any> = {};

      if (choice.tool_calls && choice.tool_calls.length > 0) {
        const firstToolCall = choice.tool_calls[0];
        skillId = firstToolCall.function.name;
        try {
          parsedArgs = JSON.parse(firstToolCall.function.arguments || '{}');
        } catch (e) {
          console.warn(`[LLM Router] Tool arguments 解析 JSON 失败:`, firstToolCall.function.arguments);
        }
      } else if (toolCallFromXml) {
        skillId = toolCallFromXml.name;
        parsedArgs = toolCallFromXml.args;
      }

      // 如果 query 参数未提取，默认附带原始提问
      if (!parsedArgs.query) {
        parsedArgs.query = promptText;
      }

      const skill = getSkillById(skillId);
      return {
        source: 'llm_tool_calling',
        skillId,
        skillName: skill?.name || skillId,
        args: parsedArgs,
        reasoning: choice.content ? cleanXmlToolCalls(choice.content) : undefined
      };
    }

    // 2. 未调用 Tool，直接文本回答
    return {
      source: 'llm_direct_answer',
      skillId: 'skill_vector_nlq',
      skillName: 'CDC 专家知识库与数据智能问答 (NLQ)',
      args: { query: promptText },
      directAnswer: cleanXmlToolCalls(choice.content || '')
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.warn(`[LLM Router Error - 触发降级]`, err.message || err);
    throw err;
  }
}
