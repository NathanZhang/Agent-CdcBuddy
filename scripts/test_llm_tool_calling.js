const apiKey = process.env.SILICONFLOW_API_KEY || 'sk-wortgmadalczipcaypwssmrsxyvwhyidlzeynukcroiywxfe';
const baseURL = process.env.SILICONFLOW_BASE_URL || 'https://api.siliconflow.cn/v1';
const modelName = process.env.SILICONFLOW_MODEL || 'Qwen/Qwen3.6-27B';

const tools = [
  {
    type: 'function',
    function: {
      name: 'skill_monitoring_data_table',
      description: '【病媒监测明细数据表查询 (Text2SQL)】(数据表格)：按地市、区县、年份、月份、病媒大类多维度检索病媒监测原始数据库并基于 Text2SQL 以交互式表格展示。凡是用户要显示/查看/查询数据明细、原始记录、表格、统计数据均调用此技能。',
      parameters: {
        type: 'object',
        properties: {
          city: { type: 'string', description: '地级市名称 (如 郑州市, 洛阳市)' },
          district: { type: 'string', description: '区县名称' },
          year: { type: 'number', description: '年份 (如 2022, 2023, 2024)' },
          month: { type: 'number', description: '月份 (1-12)' },
          category: { type: 'string', description: '病媒种类 (蚊/蝇/蟑螂/鼠/蜱/恙螨)' },
          query: { type: 'string', description: '自然语言查询语句' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'skill_population_dynamics',
      description: '【种群动态与密度预测模型】(种群动态分析)：采用 ARIMA 与季节消长模型分析病媒生物密度季节变化趋势，关联气温/湿度，生成未来 3 个月预测曲线。',
      parameters: {
        type: 'object',
        properties: {
          category: { type: 'string', enum: ['蚊', '蝇', '蟑螂', '鼠', '蜱', '恙螨'] },
          speciesName: { type: 'string', description: '物种中文名称，如 淡色库蚊' },
          city: { type: 'string', description: '地级市名称' },
          forecastMonths: { type: 'number', default: 3 }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'skill_resistance_evaluation',
      description: '【杀虫剂抗药性预测与科学用药推荐】(抗药性评估)：输入杀虫剂类型与生物测定数据，评估耐药等级（敏感/低抗/中抗/高抗），推荐科学消杀与轮换方案。',
      parameters: {
        type: 'object',
        properties: {
          speciesName: { type: 'string', description: '病媒生物名称' },
          pesticideName: { type: 'string', description: '杀虫剂名称' },
          city: { type: 'string', description: '监测城市' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'skill_vector_nlq',
      description: '【CDC 专家知识库与数据智能问答 (NLQ)】(智能问答)：国家病媒生物监测规范 (GB/T)、病媒物种鉴别要点、操作标准等理论规范问答。',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '用户问答文本' }
        }
      }
    }
  }
];

const systemPrompt = `你是由河南省疾病预防控制中心构建的 AI 协同研判中枢意图调度器 (CdcBuddy Router)。
请根据用户自然语言需求，从提供的工具集 (Tools) 中挑选最契合的病媒生物研判技能并抽取出结构化参数。
重要准则：
- 凡是用户希望“显示/查看/查询/调出/列出”具体的病媒监测数据、明细记录、原始表格、历史台账（如“显示郑州市2024年8月病媒监测数据”），调用 skill_monitoring_data_table。
- 理论规范/国标标准问答，调用 skill_vector_nlq。
- 抗药性用药评估，调用 skill_resistance_evaluation。
- 密度消长趋势预测，调用 skill_population_dynamics。
`;

async function testPrompt(promptText) {
  const res = await fetch(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: modelName,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: promptText }
      ],
      tools,
      tool_choice: 'auto',
      temperature: 0.1
    })
  });

  const data = await res.json();
  return data;
}

async function run() {
  console.log('================================================================');
  console.log(`🤖 开始测试 Qwen3.6-27B (SiliconFlow) 大模型 Tool Calling 意图识别`);
  console.log(`模型名: ${modelName}`);
  console.log('================================================================\n');

  const testCases = [
    {
      title: '🎯 用例 1 (原误判案例): "显示郑州市2024年8月病媒监测数据"',
      prompt: '显示郑州市2024年8月病媒监测数据',
      expected: 'skill_monitoring_data_table'
    },
    {
      title: '🎯 用例 2 (显式表字案例): "显示郑州市2024年8月全部病媒监测数据表"',
      prompt: '显示郑州市2024年8月全部病媒监测数据表',
      expected: 'skill_monitoring_data_table'
    },
    {
      title: '🎯 用例 3 (抗药性研判): "评估淡色库蚊对氯氰菊酯的抗药性"',
      prompt: '评估淡色库蚊对氯氰菊酯的抗药性',
      expected: 'skill_resistance_evaluation'
    },
    {
      title: '🎯 用例 4 (标准规范问答): "按照国标，登革热布雷图指数达到多少需要应急消杀？"',
      prompt: '按照国标，登革热布雷图指数达到多少需要应急消杀？',
      expected: 'skill_vector_nlq'
    }
  ];

  let passed = 0;
  for (const tc of testCases) {
    console.log(`\n----------------------------------------------------------------`);
    console.log(tc.title);
    const start = Date.now();
    try {
      const data = await testPrompt(tc.prompt);
      const cost = Date.now() - start;
      const choice = data.choices?.[0]?.message;
      if (!choice) {
        console.error('返回异常:', JSON.stringify(data));
        continue;
      }
      if (choice.tool_calls && choice.tool_calls.length > 0) {
        const call = choice.tool_calls[0];
        console.log(`⚡ 识别调用工具: ${call.function.name}`);
        console.log(`📦 提取结构化参数: ${call.function.arguments}`);
        console.log(`⏱️ 推理耗时: ${cost}ms`);
        if (call.function.name === tc.expected) {
          console.log(`✅ [PASS] 准确识别并命中预期技能！`);
          passed++;
        } else {
          console.log(`❌ [FAIL] 实际: ${call.function.name}, 预期: ${tc.expected}`);
        }
      } else {
        console.log(`💬 直接回复: ${choice.content}`);
        if (tc.expected === 'skill_vector_nlq') {
          console.log(`✅ [PASS] 知识问答直接输出有效解答！`);
          passed++;
        }
      }
    } catch (e) {
      console.error(`💥 调用失败:`, e.message || e);
    }
  }

  console.log('\n================================================================');
  console.log(`📊 测试汇总: 通过 ${passed} / ${testCases.length} (${Math.round(passed / testCases.length * 100)}%)`);
  console.log('================================================================\n');
}

run();
