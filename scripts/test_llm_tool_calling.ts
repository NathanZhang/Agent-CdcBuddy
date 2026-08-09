import { routeSkillWithLLM } from '../src/lib/skills/llm-router';

// 加载环境变量
process.env.SILICONFLOW_API_KEY = process.env.SILICONFLOW_API_KEY || 'missing-siliconflow-api-key';
process.env.SILICONFLOW_BASE_URL = process.env.SILICONFLOW_BASE_URL || 'https://api.siliconflow.cn/v1';
process.env.SILICONFLOW_MODEL = process.env.SILICONFLOW_MODEL || 'Qwen/Qwen3.6-27B';

async function runTests() {
  console.log('================================================================');
  console.log('🤖 开始测试 Qwen3.6-27B (SiliconFlow) 大模型 Tool Calling 意图识别');
  console.log(`模型: ${process.env.SILICONFLOW_MODEL}`);
  console.log('================================================================\n');

  const testCases = [
    {
      name: '案例 1: 模糊数据查询 (曾被误判的案例)',
      prompt: '显示郑州市2024年8月病媒监测数据',
      expectedSkill: 'skill_monitoring_data_table'
    },
    {
      name: '案例 2: 完整数据表查询',
      prompt: '显示郑州市2024年8月全部病媒监测数据表',
      expectedSkill: 'skill_monitoring_data_table'
    },
    {
      name: '案例 3: 抗药性与用药研判',
      prompt: '评估全省淡色库蚊对氯氰菊酯的抗药性等级及用药建议',
      expectedSkill: 'skill_resistance_evaluation'
    },
    {
      name: '案例 4: 种群时序消长与未来趋势预测',
      prompt: '预测郑州市淡色库蚊未来一季度的密度趋势和峰值月份',
      expectedSkill: 'skill_population_dynamics'
    },
    {
      name: '案例 5: 国家标准规范知识理论问答',
      prompt: '国家标准中诱蚊灯法与双层叠帐法的操作规范区别是什么？',
      expectedSkill: 'skill_vector_nlq'
    }
  ];

  let passed = 0;

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    console.log(`\n▶️ [${i + 1}/${testCases.length}] 测试: ${tc.name}`);
    console.log(`💬 输入提问: "${tc.prompt}"`);
    console.log(`🎯 预期技能: ${tc.expectedSkill}`);

    const startTime = Date.now();
    try {
      const result = await routeSkillWithLLM(tc.prompt);
      const elapsed = Date.now() - startTime;

      console.log(`⚡ 识别来源: ${result.source}`);
      console.log(`🔧 命中技能: ${result.skillId} (${result.skillName})`);
      console.log(`📦 抽取参数:`, JSON.stringify(result.args, null, 2));
      console.log(`⏱️ 响应耗时: ${elapsed}ms`);

      if (result.skillId === tc.expectedSkill) {
        console.log(`✅ [PASS] 意图识别完全正确！`);
        passed++;
      } else {
        console.log(`⚠️ [WARN] 识别结果与预期不一致: 实际=${result.skillId}, 预期=${tc.expectedSkill}`);
      }
    } catch (err: any) {
      console.error(`❌ [FAIL] 调用异常:`, err.message || err);
    }
  }

  console.log('\n================================================================');
  console.log(`📊 测试完成: 通过 ${passed} / ${testCases.length} (${Math.round(passed / testCases.length * 100)}%)`);
  console.log('================================================================\n');
}

runTests();
