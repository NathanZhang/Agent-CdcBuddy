import { NextRequest, NextResponse } from 'next/server';
import { getSiliconFlowSkillTools } from '@/lib/skills/llm-router';
import { executeSkillServer } from '@/lib/skills/server-executor';
import { getSkillById } from '@/lib/skills/registry';
import { fallbackRuleMatch } from '@/lib/skills/dispatcher';
import { getRouterTimeoutMs } from '@/lib/config/llm-timeout';

// 数据统计分析工具
function calculateDatasetStats(data: any[]) {
  if (!Array.isArray(data) || data.length === 0) return null;
  
  let totalCapture = 0;
  let validCaptureCount = 0;
  let maxCapture = 0;
  let minCapture = Infinity;
  
  let totalTemp = 0;
  let validTempCount = 0;
  let maxTemp = -Infinity;
  let minTemp = Infinity;
  
  let totalHumidity = 0;
  let validHumidityCount = 0;

  for (const row of data) {
    // 捕获数量
    const capture = Number(row['捕获数量(只/台次)'] ?? row['capture_count'] ?? row['捕获数量'] ?? 0);
    if (!isNaN(capture)) {
      totalCapture += capture;
      validCaptureCount++;
      if (capture > maxCapture) maxCapture = capture;
      if (capture < minCapture) minCapture = capture;
    }
    // 气温
    const temp = Number(row['环境气温(℃)'] ?? row['weather_temp'] ?? row['气温'] ?? 0);
    if (!isNaN(temp) && temp !== 0) {
      totalTemp += temp;
      validTempCount++;
      if (temp > maxTemp) maxTemp = temp;
      if (temp < minTemp) minTemp = temp;
    }
    // 湿度
    const hum = Number(row['相对湿度(%)'] ?? row['weather_humidity'] ?? row['相对湿度'] ?? row['湿度'] ?? 0);
    if (!isNaN(hum) && hum !== 0) {
      totalHumidity += hum;
      validHumidityCount++;
    }
  }
  
  return {
    totalRecords: data.length,
    totalCaptureCount: totalCapture,
    avgCaptureCount: validCaptureCount > 0 ? Number((totalCapture / validCaptureCount).toFixed(2)) : 0,
    maxCaptureCount: maxCapture,
    minCaptureCount: minCapture === Infinity ? 0 : minCapture,
    avgTemp: validTempCount > 0 ? Number((totalTemp / validTempCount).toFixed(2)) : 0,
    maxTemp: maxTemp === -Infinity ? 0 : maxTemp,
    minTemp: minTemp === Infinity ? 0 : minTemp,
    avgHumidity: validHumidityCount > 0 ? Number((totalHumidity / validHumidityCount).toFixed(2)) : 0
  };
}

const SYSTEM_PROMPT_CDC = `你是由河南省疾病预防控制中心构建的 AI 协同研判智能体 (CdcBuddy Agent)。
你能够使用病媒生物研判工具集 (Tools) 精准识别和解决各种疾控、数据分析、消杀工单以及问答指令。
如果用户的问题能够通过工具集解决，你应该主动调用相关工具；并在工具执行返回数据后，对数据进行分析、统计 and 归纳，给出详实、准确且有洞察力的最终回复。`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { promptText, chatHistory = [], userRole, context } = body;

    if (!promptText || typeof promptText !== 'string' || !promptText.trim()) {
      return NextResponse.json({
        success: false,
        skillId: '',
        skillName: '',
        replyText: '请输入有效的病媒生物监测指令或研判问题。'
      });
    }

    const apiKey = process.env.SILICONFLOW_API_KEY || 'missing-siliconflow-api-key';
    const baseURL = process.env.SILICONFLOW_BASE_URL || 'https://api.siliconflow.cn/v1';
    const modelName = process.env.SILICONFLOW_MODEL || 'Qwen/Qwen3.6-27B';
    const timeoutMs = getRouterTimeoutMs();

    // 1. 构造多轮上下文 Messages (合并为一个 System Prompt，保证兼容性)
    let systemPromptContent = SYSTEM_PROMPT_CDC;

    // 💡 注入当前视图数据统计摘要，处理“指代消解”与多轮计算
    if (context?.currentView?.data?.length > 0) {
      const stats = calculateDatasetStats(context.currentView.data);
      if (stats) {
        const columns = Object.keys(context.currentView.data[0]);
        systemPromptContent += `\n\n【当前工作台已渲染的数据视图 (DATA_TABLE_VIEW) 统计摘要】：
- 数据标题: "${context.currentView.title || '数据表'}"
- 包含字段: ${columns.join(', ')}
- 样本记录数: ${stats.totalRecords} 条
- 指标统计结果:
  * 捕获数量 (只/台次): 平均值=${stats.avgCaptureCount}, 总和=${stats.totalCaptureCount}, 最大值=${stats.maxCaptureCount}, 最小值=${stats.minCaptureCount}
  * 环境气温 (℃): 平均值=${stats.avgTemp}℃, 最高温=${stats.maxTemp}℃, 最低温=${stats.minTemp}℃
  * 相对湿度 (%): 平均值=${stats.avgHumidity}%
注意：如果用户针对当前数据视图进行提问（如“计算上述数据的平均数”、“温度是多少”等），请直接基于此上下文进行逻辑计算和答复，不需要也绝对不能调用数据查询工具！`;
      }
    }

    const messages: any[] = [
      { role: 'system', content: systemPromptContent }
    ];

    // 追加历史记录
    const recentHistory = chatHistory.slice(-6);
    for (const item of recentHistory) {
      if (item.sender === 'user') {
        messages.push({ role: 'user', content: item.text });
      } else if (item.sender === 'assistant' || item.sender === 'bot') {
        messages.push({
          role: 'assistant',
          content: item.text
        });
      }
    }

    messages.push({ role: 'user', content: promptText.trim() });

    const tools = getSiliconFlowSkillTools(userRole);

    let finalReplyText = '';
    let finalGenerativeView: any = context?.currentView || null;
    let chosenSkillId = '';
    let chosenSkillName = '';
    let parsedArgs: any = {};
    let isExecSuccess = true;

    try {
      // 🚀 第一阶段：调用大模型进行意图路由与 Tool Use 判断 (独立 Abort Controller 1)
      const controller1 = new AbortController();
      const timeoutId1 = setTimeout(() => controller1.abort(), timeoutMs);
      
      let res;
      try {
        res = await fetch(`${baseURL}/chat/completions`, {
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
          signal: controller1.signal
        });
      } finally {
        clearTimeout(timeoutId1);
      }

      if (!res.ok) {
        const errText = await res.text();
        console.warn(`[BFF LLM API Error 1] status: ${res.status}, body: ${errText}`);
        throw new Error(`SiliconFlow status ${res.status}: ${errText}`);
      }

      const data = await res.json();
      const choice = data.choices?.[0]?.message;

      if (!choice) {
        throw new Error('LLM返回空数据');
      }

      // 2. 检查大模型是否需要调用 Tool
      if (choice.tool_calls && choice.tool_calls.length > 0) {
        const toolCall = choice.tool_calls[0];
        const skillId = toolCall.function.name;
        chosenSkillId = skillId;
        
        try {
          parsedArgs = JSON.parse(toolCall.function.arguments || '{}');
        } catch {
          parsedArgs = {};
        }

        const skill = getSkillById(skillId);
        chosenSkillName = skill?.name || skillId;

        // 🚀 服务端执行 Tool
        let toolExecutionResult: any = null;
        try {
          toolExecutionResult = await executeSkillServer(skillId, parsedArgs);
          finalGenerativeView = toolExecutionResult;
        } catch (execErr: any) {
          console.error(`[BFF Tool Loop] 执行技能 ${skillId} 失败:`, execErr);
          isExecSuccess = false;
          toolExecutionResult = { error: execErr.message || '技能执行异常' };
        }

        // 构建给大模型的 Tool 运行反馈摘要
        let toolSummaryContent = '';
        if (toolExecutionResult && Array.isArray(toolExecutionResult.data)) {
          const stats = calculateDatasetStats(toolExecutionResult.data);
          
          // 给表格视图附加 summaryStats 指标
          if (stats) {
            finalGenerativeView.summaryStats = stats;
          }

          toolSummaryContent = JSON.stringify({
            success: isExecSuccess,
            title: toolExecutionResult.title,
            summaryStats: stats,
            sampleData: toolExecutionResult.data.slice(0, 5) // 只传前 5 条作为样本，极省 token
          });
        } else {
          toolSummaryContent = JSON.stringify(toolExecutionResult);
        }

        // 将 tool_call 信息及 tool 返回信息加入消息链，进行第二轮 LLM 请求
        messages.push({
          role: 'assistant',
          content: choice.content || null,
          tool_calls: choice.tool_calls
        });
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: skillId,
          content: toolSummaryContent
        });

        // 🚀 第二阶段：再次请求大模型，生成融合了 Tool 结果的最终自然语言答复 (独立 Abort Controller 2)
        const controller2 = new AbortController();
        const timeoutId2 = setTimeout(() => controller2.abort(), timeoutMs);
        
        let finalRes;
        try {
          finalRes = await fetch(`${baseURL}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model: modelName,
              messages,
              temperature: 0.1
            }),
            signal: controller2.signal
          });
        } finally {
          clearTimeout(timeoutId2);
        }

        if (finalRes.ok) {
          const finalData = await finalRes.json();
          finalReplyText = finalData.choices?.[0]?.message?.content || '';
        } else {
          const errText = await finalRes.text();
          console.warn(`[BFF LLM API Error 2] status: ${finalRes.status}, body: ${errText}`);
          finalReplyText = `已成功执行 **【${chosenSkillName}】** 技能，明细已在主工作台渲染。`;
        }

      } else {
        // 大模型决定直接文本回复 (通常是知识库 QA 或 基于 currentView 统计直接答复)
        finalReplyText = choice.content || '';
        chosenSkillId = 'skill_vector_nlq';
        chosenSkillName = 'CDC 专家知识库与数据智能问答 (NLQ)';
        
        // 若没有活跃的 currentView，则显示问答卡片
        if (!finalGenerativeView) {
          finalGenerativeView = {
            type: 'NLQ_KNOWLEDGE_ANSWER',
            query: promptText,
            answer: finalReplyText,
            references: ['《病媒生物密度监测方法 蚊类》(GB/T 23797-2020)', '河南省疾控中心病媒监测标准规范']
          };
        }
      }

    } catch (llmErr: any) {
      console.error('[BFF Loop] LLM 智能体服务异常:', llmErr.message || llmErr);
      isExecSuccess = false;
      
      // 💡 如果在异常发生前，Tool（如 SQL 查询）已经执行成功并产生了视图，保留它！
      if (finalGenerativeView && !finalGenerativeView.error && finalGenerativeView.type !== 'NLQ_KNOWLEDGE_ANSWER') {
        finalReplyText = `⚠️ 技能 **【${chosenSkillName}】** 执行成功，但大模型总结超时或响应异常：${llmErr.message || '超时'}`;
      } else {
        finalReplyText = `⚠️ 智能体服务发生异常：${llmErr.message || '大模型请求超时或服务响应失败'}`;
        finalGenerativeView = context?.currentView ? {
          ...context.currentView,
          error: llmErr.message || '大模型连接异常'
        } : {
          type: 'NLQ_KNOWLEDGE_ANSWER',
          query: promptText,
          answer: `⚠️ 智能体服务发生异常：${llmErr.message || '网络请求超时'}\n\n请检查硅基流动 (SiliconFlow) API Key 配置或网络状况，并稍后重试。`,
          references: []
        };
      }
    }



    return NextResponse.json({
      success: isExecSuccess,
      skillId: chosenSkillId,
      skillName: chosenSkillName,
      source: 'llm_tool_calling',
      args: parsedArgs,
      replyText: finalReplyText,
      generativeView: finalGenerativeView
    });

  } catch (err: any) {
    console.error('[Dispatch API Fatal Error]', err);
    return NextResponse.json(
      { success: false, error: err.message || '调度服务处理失败' },
      { status: 500 }
    );
  }
}
