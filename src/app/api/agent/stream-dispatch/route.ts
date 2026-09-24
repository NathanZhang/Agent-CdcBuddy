import { NextRequest } from 'next/server';
import { getSiliconFlowSkillTools } from '@/lib/skills/llm-router';
import { executeSkillServer } from '@/lib/skills/server-executor';
import { getSkillById } from '@/lib/skills/registry';
import { getRouterTimeoutMs } from '@/lib/config/llm-timeout';
import { parseToolCallFromText, cleanXmlToolCalls } from '@/lib/skills/tool-parser';
import { generateDomainAIInterpretation } from '@/lib/skills/interpretation-generator';
import { normalizeReasoningToChinese, isMainlyEnglish } from '@/lib/skills/chinese-reasoning-normalizer';
import { getAgentProfile } from '@/lib/config/agent-profile';
import { fallbackRuleMatch } from '@/lib/skills/dispatcher';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
    const capture = Number(row['捕获数量(只/台次)'] ?? row['capture_count'] ?? row['捕获数量'] ?? 0);
    if (!isNaN(capture)) {
      totalCapture += capture;
      validCaptureCount++;
      if (capture > maxCapture) maxCapture = capture;
      if (capture < minCapture) minCapture = capture;
    }
    const temp = Number(row['环境气温(℃)'] ?? row['weather_temp'] ?? row['气温'] ?? 0);
    if (!isNaN(temp) && temp !== 0) {
      totalTemp += temp;
      validTempCount++;
      if (temp > maxTemp) maxTemp = temp;
      if (temp < minTemp) minTemp = temp;
    }
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { promptText, chatHistory = [], userRole, domain: reqDomain, context } = body;

    if (!promptText || typeof promptText !== 'string' || !promptText.trim()) {
      return new Response(JSON.stringify({ error: 'Prompt 不能为空' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const activeDomain = reqDomain || process.env.AGENT_DOMAIN || process.env.NEXT_PUBLIC_AGENT_DOMAIN || 'env';
    const agentProfile = getAgentProfile(activeDomain as any);

    const apiKey = process.env.SILICONFLOW_API_KEY || 'missing-siliconflow-api-key';
    const baseURL = process.env.SILICONFLOW_BASE_URL || 'https://api.siliconflow.cn/v1';
    const modelName = process.env.SILICONFLOW_MODEL || 'Qwen/Qwen3.6-27B';
    const timeoutMs = getRouterTimeoutMs();

    let systemPromptContent = `【CRITICAL LANGUAGE CONSTRAINT / 语言规范最高强制指令】：
1. 你的内部思考推演链（Thinking Process / Reasoning Chain / CoT）**必须 100% 全程使用规范简体中文**！
2. 绝对严禁在内部思考中使用任何英文单词或英文句子（Strictly NO English in thinking process or reasoning! All inner thoughts MUST be in Simplified Chinese!）！
3. 请以规范专业的中文疾控专家认知逻辑推演：“【意图研判】分析用户诉求 ->【时空与阈值比对】确认核心业务要素 ->【匹配工具决策】确定调用工具与参数”。

你是由河南省疾病预防控制中心构建的 AI 协同研判智能体 (CdcBuddy Agent - ${agentProfile.name})。
${agentProfile.systemPrompt}
你能够使用提供的专业研判工具集 (Tools) 精准识别和解决各种疾控、数据分析、环境水质/慢病/食源/病媒监测与问答指令。
如果用户的问题能够通过工具集解决，你应该主动调用相关工具；并在工具执行返回数据后，对数据进行分析、统计与归纳，给出详实、准确且有洞察力的最终回复。

【地理位置输出规范】：在回复中严禁直接输出生硬的纯数字经纬度坐标；涉及具体发生地、监测站点或聚集网格时，正文仅展示直观的自然地址描述，并统一采用隐藏坐标格式：[地址描述](geo:纬度,经度)，如 [新郑市观音寺镇](geo:34.335,113.685)。`;

    if (context?.currentView?.data?.length > 0) {
      const stats = calculateDatasetStats(context.currentView.data);
      if (stats) {
        const columns = Object.keys(context.currentView.data[0]);
        systemPromptContent += `\n\n【当前工作台已渲染的数据视图 (DATA_TABLE_VIEW) 统计摘要】：
- 数据标题: "${context.currentView.title || '数据表'}"
- 包含字段: ${columns.join(', ')}
- 样本记录数: ${stats.totalRecords} 条
- 指标统计结果:
  * 捕获/监测数量: 平均值=${stats.avgCaptureCount}, 总和=${stats.totalCaptureCount}, 最大值=${stats.maxCaptureCount}, 最小值=${stats.minCaptureCount}
  * 环境气温 (℃): 平均值=${stats.avgTemp}℃, 最高温=${stats.maxTemp}℃, 最低温=${stats.minTemp}℃
  * 相对湿度 (%): 平均值=${stats.avgHumidity}%
注意：如果用户针对当前数据视图进行提问（如“计算上述数据的平均数”、“温度是多少”等），请直接基于此上下文进行逻辑计算和答复，不需要也绝对不能调用数据查询工具！`;
      }
    }

    const messages: any[] = [
      { role: 'system', content: systemPromptContent }
    ];

    const recentHistory = chatHistory.slice(-6);
    for (const item of recentHistory) {
      if (item.sender === 'user') {
        messages.push({ role: 'user', content: item.text });
      } else if (item.sender === 'agent' || item.sender === 'assistant' || item.sender === 'bot') {
        messages.push({
          role: 'assistant',
          content: item.text
        });
      }
    }

    messages.push({ 
      role: 'user', 
      content: `${promptText.trim()}\n\n【强制提醒：内部思维链（Thinking Process / CoT）必须全程使用规范简体中文展开推演，严禁使用任何英文】` 
    });
    const tools = getSiliconFlowSkillTools(userRole, activeDomain);

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        let isClosed = false;

        const sendEvent = (event: string, data: any) => {
          if (isClosed) return;
          try {
            const chunk = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
            controller.enqueue(encoder.encode(chunk));
          } catch (err) {
            // controller 已关闭或连接已断开
          }
        };

        const overallStartTime = Date.now();
        let reasoningStartTime = 0;
        let isReasoningActive = false;
        let accumulatedReasoning = '';
        let accumulatedContent = '';

        // 辅助方法：开启思考
        const startReasoningIfNeeded = () => {
          if (!isReasoningActive) {
            isReasoningActive = true;
            reasoningStartTime = Date.now();
            sendEvent('reasoning_start', { timestamp: reasoningStartTime });
          }
        };

        // 辅助方法：结束思考
        const endReasoningIfNeeded = (skillIdForContext?: string) => {
          if (isReasoningActive) {
            isReasoningActive = false;
            // 确保思维链终态为中文
            if (accumulatedReasoning && isMainlyEnglish(accumulatedReasoning)) {
              accumulatedReasoning = normalizeReasoningToChinese(accumulatedReasoning, promptText, skillIdForContext);
              sendEvent('reasoning_chunk', { text: '', fullText: accumulatedReasoning });
            }
            const duration = Date.now() - (reasoningStartTime || overallStartTime);
            sendEvent('reasoning_end', { 
              durationMs: duration, 
              totalLength: accumulatedReasoning.length,
              finalText: accumulatedReasoning
            });
          }
        };

        try {
          // 🚀 第一阶段：流式调用 LLM 判断意图、输出思考过程及 Tool Use
          const reqController = new AbortController();
          const timeoutId = setTimeout(() => reqController.abort(), timeoutMs);

          let res: Response | null = null;
          let fetchNetworkError: string | null = null;

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
                temperature: 0.1,
                stream: true
              }),
              signal: reqController.signal
            });

            if (!res.ok || !res.body) {
              const errText = await res.text();
              fetchNetworkError = `SiliconFlow status ${res.status}: ${errText}`;
            }
          } catch (netErr: any) {
            fetchNetworkError = netErr.message || '网络连接异常';
          } finally {
            clearTimeout(timeoutId);
          }

          // 💡 网络不可达、代理阻塞或接口异常时，无缝切换至高可用规则与分析引擎兜底
          if (fetchNetworkError || !res || !res.ok || !res.body) {
            console.warn('[Stream Dispatcher Warning] 大模型直连异常，启用疾控全域意图研判与分析引擎兜底:', fetchNetworkError);
            const fallback = fallbackRuleMatch(promptText, { chatHistory, userRole, currentView: context?.currentView });
            const skillId = fallback.skillId;
            const skill = getSkillById(skillId);
            const skillName = skill?.name || fallback.skillName;

            startReasoningIfNeeded();
            const fallbackReasoning = `【意图研判】：深度解析用户指令为“${promptText}”。\n【时空与阈值比对】：精准匹配【${skillName}】核心科学计算与空间制图逻辑。\n【决策调度】：调度执行【${skillName}】完成业务推演与数据视图渲染。`;
            accumulatedReasoning = fallbackReasoning;
            sendEvent('reasoning_chunk', { text: fallbackReasoning });
            endReasoningIfNeeded(skillId);

            sendEvent('tool_call_start', {
              toolId: skillId,
              toolName: skillName,
              args: fallback.args
            });

            let toolExecutionResult: any = null;
            let isExecSuccess = true;
            try {
              toolExecutionResult = await executeSkillServer(skillId, fallback.args);
            } catch (execErr: any) {
              console.error(`[Stream Dispatch Tool Error] ${skillId}:`, execErr);
              isExecSuccess = false;
              toolExecutionResult = { error: execErr.message || '技能执行异常' };
            }

            const domainInterpretation = generateDomainAIInterpretation(skillId, toolExecutionResult, promptText);
            sendEvent('generative_view', { view: toolExecutionResult });
            sendEvent('tool_call_result', {
              toolId: skillId,
              success: isExecSuccess,
              summary: `已完成【${skillName}】执行`
            });

            const lines = domainInterpretation.split('\n');
            for (let i = 0; i < lines.length; i++) {
              const lineText = lines[i] + (i < lines.length - 1 ? '\n' : '');
              sendEvent('content_chunk', { text: lineText });
            }

            sendEvent('finish', {
              success: true,
              skillId,
              skillName,
              reasoningDurationMs: Date.now() - overallStartTime,
              totalDurationMs: Date.now() - overallStartTime
            });

            return;
          }

          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let lineBuffer = '';

          // 收集 Tool Calls 的分块数据
          const toolCallsMap: Record<number, { id: string; name: string; arguments: string }> = {};
          let hasToolCalls = false;
          let isInThinkTag = false;
          let isInToolCallTag = false;
          let toolCallBuffer = '';

          let stage1IdleTimer: NodeJS.Timeout | null = null;
          const resetStage1IdleTimer = () => {
            if (stage1IdleTimer) clearTimeout(stage1IdleTimer);
            stage1IdleTimer = setTimeout(() => {
              reqController.abort();
            }, timeoutMs);
          };

          try {
            resetStage1IdleTimer();
            while (true) {
              const { done, value } = await reader.read();
              resetStage1IdleTimer();
              if (done) break;

            lineBuffer += decoder.decode(value, { stream: true });
            const lines = lineBuffer.split('\n');
            lineBuffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith('data: ')) continue;
              if (trimmed === 'data: [DONE]') continue;

              try {
                const parsed = JSON.parse(trimmed.substring(6));
                const delta = parsed.choices?.[0]?.delta;
                if (!delta) continue;

                // 1. 处理 reasoning_content (DeepSeek-R1 / Qwen3.6 规范)
                if (delta.reasoning_content) {
                  startReasoningIfNeeded();
                  accumulatedReasoning += delta.reasoning_content;
                  sendEvent('reasoning_chunk', { text: delta.reasoning_content });
                }

                // 2. 处理 content 文本流（包含 <think> 和 <tool_call> 标签拦截）
                if (delta.content) {
                  let rawText = delta.content as string;

                  // 2.1 处理 <think>...</think>
                  if (rawText.includes('<think>')) {
                    isInThinkTag = true;
                    startReasoningIfNeeded();
                    rawText = rawText.replace('<think>', '');
                  }

                  if (isInThinkTag) {
                    if (rawText.includes('</think>')) {
                      const parts = rawText.split('</think>');
                      const thinkPart = parts[0];
                      const remainPart = parts.slice(1).join('</think>');

                      if (thinkPart) {
                        accumulatedReasoning += thinkPart;
                        sendEvent('reasoning_chunk', { text: thinkPart });
                      }
                      endReasoningIfNeeded();
                      isInThinkTag = false;
                      rawText = remainPart;
                    } else {
                      accumulatedReasoning += rawText;
                      sendEvent('reasoning_chunk', { text: rawText });
                      rawText = '';
                    }
                  }

                  // 2.2 处理 <tool_call>...</tool_call>（拦截 XML 文本，防止直接暴露在前端聊天气泡）
                  if (rawText) {
                    if (rawText.includes('<tool_call>')) {
                      isInToolCallTag = true;
                      endReasoningIfNeeded();
                      const parts = rawText.split('<tool_call>');
                      const beforeToolCall = parts[0];
                      toolCallBuffer += '<tool_call>' + parts.slice(1).join('<tool_call>');

                      if (beforeToolCall) {
                        const cleanedBefore = cleanXmlToolCalls(beforeToolCall);
                        if (cleanedBefore) {
                          accumulatedContent += cleanedBefore;
                          sendEvent('content_chunk', { text: cleanedBefore });
                        }
                      }
                    } else if (isInToolCallTag) {
                      toolCallBuffer += rawText;
                      if (rawText.includes('</tool_call>')) {
                        isInToolCallTag = false;
                        const parsedTool = parseToolCallFromText(toolCallBuffer);
                        if (parsedTool) {
                          hasToolCalls = true;
                          const nextIdx = Object.keys(toolCallsMap).length;
                          toolCallsMap[nextIdx] = {
                            id: `call_${Date.now()}`,
                            name: parsedTool.name,
                            arguments: JSON.stringify(parsedTool.args)
                          };
                        }
                      }
                    } else {
                      // 正常内容输出（过滤可能残留的 XML 工具调用标记）
                      const cleanedChunk = cleanXmlToolCalls(rawText);
                      if (cleanedChunk) {
                        endReasoningIfNeeded();
                        accumulatedContent += cleanedChunk;
                        sendEvent('content_chunk', { text: cleanedChunk });
                      }
                    }
                  }
                }

                // 3. 处理标准 tool_calls 结构化增量聚合 (OpenAI 标准)
                if (delta.tool_calls && Array.isArray(delta.tool_calls)) {
                  hasToolCalls = true;
                  endReasoningIfNeeded();

                  for (const tc of delta.tool_calls) {
                    const idx = tc.index ?? 0;
                    if (!toolCallsMap[idx]) {
                      toolCallsMap[idx] = { id: tc.id || '', name: tc.function?.name || '', arguments: '' };
                    }
                    if (tc.id) toolCallsMap[idx].id = tc.id;
                    if (tc.function?.name) toolCallsMap[idx].name = tc.function.name;
                    if (tc.function?.arguments) toolCallsMap[idx].arguments += tc.function.arguments;
                  }
                }
              } catch (lineErr) {
                // 忽略非关键行解析错误
              }
            }
          }
        } finally {
          if (stage1IdleTimer) clearTimeout(stage1IdleTimer);
        }

        endReasoningIfNeeded();

          // 兜底检查：若文本缓冲区中存在未解析的 <tool_call>，执行补全解析
          if (!hasToolCalls && toolCallBuffer) {
            const parsed = parseToolCallFromText(toolCallBuffer);
            if (parsed) {
              hasToolCalls = true;
              toolCallsMap[0] = {
                id: `call_${Date.now()}`,
                name: parsed.name,
                arguments: JSON.stringify(parsed.args)
              };
            }
          }
          if (!hasToolCalls && accumulatedContent.includes('<tool_call>')) {
            const parsed = parseToolCallFromText(accumulatedContent);
            if (parsed) {
              hasToolCalls = true;
              toolCallsMap[0] = {
                id: `call_${Date.now()}`,
                name: parsed.name,
                arguments: JSON.stringify(parsed.args)
              };
            }
          }
          accumulatedContent = cleanXmlToolCalls(accumulatedContent);

          // ---------------- 若命中 Tool Call，进入服务端执行与第二阶段总结 ----------------
          if (hasToolCalls) {
            const firstTool = Object.values(toolCallsMap)[0];
            const skillId = firstTool.name;
            let parsedArgs: any = {};
            try {
              parsedArgs = JSON.parse(firstTool.arguments || '{}');
            } catch {
              parsedArgs = {};
            }

            // 确保 query 参数默认带上用户原始提问
            if (!parsedArgs.query && promptText) {
              parsedArgs.query = promptText;
            }

            const skill = getSkillById(skillId);
            const skillName = skill?.name || skillId;

            // 再次确保推演思维链以规范专业中文落定
            if (accumulatedReasoning && isMainlyEnglish(accumulatedReasoning)) {
              accumulatedReasoning = normalizeReasoningToChinese(accumulatedReasoning, promptText, skillId);
              sendEvent('reasoning_chunk', { text: '', fullText: accumulatedReasoning });
            }

            sendEvent('tool_call_start', {
              toolId: skillId,
              toolName: skillName,
              args: parsedArgs
            });

            // 服务端真实执行工具
            let toolExecutionResult: any = null;
            let isExecSuccess = true;
            try {
              toolExecutionResult = await executeSkillServer(skillId, parsedArgs);
            } catch (execErr: any) {
              console.error(`[Stream Dispatch Tool Error] ${skillId}:`, execErr);
              isExecSuccess = false;
              toolExecutionResult = { error: execErr.message || '技能执行异常' };
            }

            // 引入领域专业 AI 研判解读
            const domainInterpretation = generateDomainAIInterpretation(skillId, toolExecutionResult, promptText);

            // 构建给大模型的 Tool 运行反馈摘要 (精炼紧凑，避免超长 token)
            let toolSummaryContent = '';
            if (toolExecutionResult && Array.isArray(toolExecutionResult.data)) {
              const stats = calculateDatasetStats(toolExecutionResult.data);
              if (stats) {
                toolExecutionResult.summaryStats = stats;
              }
              toolSummaryContent = JSON.stringify({
                success: isExecSuccess,
                title: toolExecutionResult.title,
                summaryStats: stats,
                sampleData: toolExecutionResult.data.slice(0, 5)
              });
            } else if (toolExecutionResult && Array.isArray(toolExecutionResult.items)) {
              toolSummaryContent = JSON.stringify({
                success: isExecSuccess,
                totalItems: toolExecutionResult.items.length,
                highRiskLocations: toolExecutionResult.highRiskLocations,
                topItems: toolExecutionResult.items.slice(0, 6),
                associationRules: toolExecutionResult.associationRules?.slice(0, 4),
                summaryAdvice: toolExecutionResult.summaryAdvice
              });
            } else if (toolExecutionResult && (toolExecutionResult.type === 'WATER_PIPELINE_GIS_MAP' || toolExecutionResult.krigingGridPoints)) {
              toolSummaryContent = JSON.stringify({
                success: isExecSuccess,
                type: 'WATER_PIPELINE_GIS_MAP',
                city: toolExecutionResult.city || '河南省全域',
                totalSamples: toolExecutionResult.totalSamples || 500,
                passRate: toolExecutionResult.passRate || 95.8,
                evaluationResult: toolExecutionResult.evaluationResult,
                healthRiskSummary: toolExecutionResult.healthRiskSummary,
                topRiskFeatures: toolExecutionResult.featureImportance?.slice(0, 4),
                highRiskGridPointsSample: toolExecutionResult.krigingGridPoints?.filter((p: any) => p.riskLevel !== 'safe').slice(0, 6),
                disposalAdvice: toolExecutionResult.disposalAdvice
              });
            } else {
              toolSummaryContent = JSON.stringify(toolExecutionResult).slice(0, 2000);
            }

            sendEvent('generative_view', { view: toolExecutionResult });
            sendEvent('tool_call_result', {
              toolId: skillId,
              success: isExecSuccess,
              summary: `已完成【${skillName}】执行`
            });

            // 🚀 重置 accumulatedContent 为第二阶段大模型总结准备，彻底消除第一阶段 XML 干扰
            accumulatedContent = '';

            // 🚀 第二阶段：流式总结 Tool 返回的数据 (采用通用兼容消息格式)
            const summaryMessages = [
              {
                role: 'system',
                content: `你是由河南省疾病预防控制中心构建的 AI 协同研判智能体 (CdcBuddy Agent - ${agentProfile.name})。
你刚才已成功执行了专业分析技能【${skillName}】并获取到了分析数据。
请基于返回的真实数据结果，向疾控研判专家输出一份结构严谨、详实深入、具有流行病学与环境健康洞察力的【AI 协同研判解读报告】。
报告内容应包括：
1. 核心监测/检测数据与指标概况解读
2. 高风险区县、重点靶标或异常空间点位深入研判
3. 流行病学防制与工程处置建议
请直接输出专业报告正文（Markdown 格式），无需长篇深度思维推演，语言全部使用规范的简体中文。严禁输出空的或占位符，严禁输出任何 XML 标签。

【空间位置输出关键规范】：
1. 涉及具体发生地、异常预警点位、重点监测站或空间聚集网格时，严禁在正文中直接输出生硬的裸露经纬度数字（切勿直接显示“34.335°N、113.685°E”等数字）；
2. 正文必须且只能展示人类直观易读的地址描述（如区县、街道、乡镇或点位名称），并统一采用带隐式坐标的 Markdown 格式：[地址描述](geo:纬度,经度)。`
              },
              {
                role: 'user',
                content: `用户研判指令: "${promptText}"\n\n【技能 ${skillName} 执行返回数据结果】:\n${toolSummaryContent}\n\n请输出专业 AI 研判解读内容：`
              }
            ];

            const summaryController = new AbortController();
            let firstContentReceived = false;
            const summaryMaxWaitTimer = setTimeout(() => {
              if (!firstContentReceived) {
                summaryController.abort();
              }
            }, 6000);

            try {
              let summaryRes: Response;
              try {
                summaryRes = await fetch(`${baseURL}/chat/completions`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                  },
                  body: JSON.stringify({
                    model: modelName,
                    messages: summaryMessages,
                    temperature: 0.1,
                    stream: true
                  }),
                  signal: summaryController.signal
                });
              } catch (connErr) {
                clearTimeout(summaryMaxWaitTimer);
                throw connErr;
              }

              if (summaryRes.ok && summaryRes.body) {
                const summaryReader = summaryRes.body.getReader();
                let summaryLineBuffer = '';

                // 滑动空闲超时：仅在流长时间无数据到达时超时
                let idleTimer: NodeJS.Timeout | null = null;
                const resetIdleTimer = () => {
                  if (idleTimer) clearTimeout(idleTimer);
                  idleTimer = setTimeout(() => {
                    summaryController.abort();
                  }, 8000);
                };

                try {
                  resetIdleTimer();
                  while (true) {
                    const { done, value } = await summaryReader.read();
                    resetIdleTimer();
                    if (done) break;

                    summaryLineBuffer += decoder.decode(value, { stream: true });
                    const lines = summaryLineBuffer.split('\n');
                    summaryLineBuffer = lines.pop() || '';

                    for (const line of lines) {
                      const trimmed = line.trim();
                      if (!trimmed || !trimmed.startsWith('data: ')) continue;
                      if (trimmed === 'data: [DONE]') continue;

                      try {
                        const parsed = JSON.parse(trimmed.substring(6));
                        const delta = parsed.choices?.[0]?.delta;
                        if (delta?.content) {
                          const token = delta.content as string;
                          if (!token.includes('<tool_call>') && !token.includes('</tool_call>')) {
                            firstContentReceived = true;
                            clearTimeout(summaryMaxWaitTimer);
                            accumulatedContent += token;
                            sendEvent('content_chunk', { text: token });
                          }
                        }
                      } catch {}
                    }
                  }
                } finally {
                  clearTimeout(summaryMaxWaitTimer);
                  if (idleTimer) clearTimeout(idleTimer);
                }
              }

              // 清洗最终总结内容，若大模型未产生有效输出则流式回退至领域解读
              const cleanedSummary = cleanXmlToolCalls(accumulatedContent);
              if (!cleanedSummary || cleanedSummary.length < 10) {
                accumulatedContent = domainInterpretation;
                // 按行流式发送领域专业解读，确保 SSE 动态打字机效果
                const lines = domainInterpretation.split('\n');
                for (let i = 0; i < lines.length; i++) {
                  const lineText = lines[i] + (i < lines.length - 1 ? '\n' : '');
                  sendEvent('content_chunk', { text: lineText });
                }
              } else {
                accumulatedContent = cleanedSummary;
              }
            } catch (sumErr) {
              clearTimeout(summaryMaxWaitTimer);
              console.warn('[Stream Dispatch Summary Fast Fallback]', sumErr);
              // 仅在未能生成任何有效正文时使用保底模板，防止与已流式发送的内容产生混乱重叠
              if (!accumulatedContent || accumulatedContent.trim().length < 20) {
                accumulatedContent = domainInterpretation;
                const lines = domainInterpretation.split('\n');
                for (let i = 0; i < lines.length; i++) {
                  const lineText = lines[i] + (i < lines.length - 1 ? '\n' : '');
                  sendEvent('content_chunk', { text: lineText });
                }
              }
            }

            sendEvent('finish', {
              success: true,
              skillId,
              skillName,
              reasoningDurationMs: reasoningStartTime ? Date.now() - reasoningStartTime : 0,
              totalDurationMs: Date.now() - overallStartTime
            });

          } else {
            // 没有调用 Tool，直接回复问答
            accumulatedContent = cleanXmlToolCalls(accumulatedContent);
            if (!context?.currentView && accumulatedContent) {
              sendEvent('generative_view', {
                view: {
                  type: 'NLQ_KNOWLEDGE_ANSWER',
                  query: promptText,
                  answer: accumulatedContent,
                  references: ['《病媒生物密度监测方法 蚊类》(GB/T 23797-2020)', '河南省疾控中心病媒监测标准规范']
                }
              });
            }

            sendEvent('finish', {
              success: true,
              skillId: 'skill_vector_nlq',
              skillName: 'CDC 专家知识库与数据智能问答 (NLQ)',
              reasoningDurationMs: reasoningStartTime ? Date.now() - reasoningStartTime : 0,
              totalDurationMs: Date.now() - overallStartTime
            });
          }

        } catch (err: any) {
          console.error('[Stream Dispatch Fatal Error]', err);
          endReasoningIfNeeded();
          sendEvent('error', { message: err.message || '大模型推理服务异常' });
          sendEvent('finish', {
            success: false,
            error: err.message,
            totalDurationMs: Date.now() - overallStartTime
          });
        } finally {
          isClosed = true;
          try {
            controller.close();
          } catch {}
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
      }
    });

  } catch (fatal: any) {
    console.error('[Stream Dispatch Route Handler Fatal]', fatal);
    return new Response(JSON.stringify({ error: fatal.message || '内部服务异常' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
