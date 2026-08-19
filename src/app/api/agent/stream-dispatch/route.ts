import { NextRequest } from 'next/server';
import { getSiliconFlowSkillTools } from '@/lib/skills/llm-router';
import { executeSkillServer } from '@/lib/skills/server-executor';
import { getSkillById } from '@/lib/skills/registry';
import { getRouterTimeoutMs } from '@/lib/config/llm-timeout';
import { parseToolCallFromText, cleanXmlToolCalls } from '@/lib/skills/tool-parser';

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

const SYSTEM_PROMPT_CDC = `你是由河南省疾病预防控制中心构建的 AI 协同研判智能体 (CdcBuddy Agent)。
你能够使用病媒生物研判工具集 (Tools) 精准识别和解决各种疾控、数据分析、消杀工单以及问答指令。
如果用户的问题能够通过工具集解决，你应该主动调用相关工具；并在工具执行返回数据后，对数据进行分析、统计与归纳，给出详实、准确且有洞察力的最终回复。
在思考过程中，请展示你的专业研判逻辑（包括数据筛选、阈值比对、病媒生态关联与防控策略评估）。`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { promptText, chatHistory = [], userRole, context } = body;

    if (!promptText || typeof promptText !== 'string' || !promptText.trim()) {
      return new Response(JSON.stringify({ error: 'Prompt 不能为空' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const apiKey = process.env.SILICONFLOW_API_KEY || 'missing-siliconflow-api-key';
    const baseURL = process.env.SILICONFLOW_BASE_URL || 'https://api.siliconflow.cn/v1';
    const modelName = process.env.SILICONFLOW_MODEL || 'Qwen/Qwen3.6-27B';
    const timeoutMs = getRouterTimeoutMs();

    let systemPromptContent = SYSTEM_PROMPT_CDC;

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

    messages.push({ role: 'user', content: promptText.trim() });
    const tools = getSiliconFlowSkillTools(userRole);

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
        const endReasoningIfNeeded = () => {
          if (isReasoningActive) {
            isReasoningActive = false;
            const duration = Date.now() - (reasoningStartTime || overallStartTime);
            sendEvent('reasoning_end', { 
              durationMs: duration, 
              totalLength: accumulatedReasoning.length 
            });
          }
        };

        try {
          // 🚀 第一阶段：流式调用 LLM 判断意图、输出思考过程及 Tool Use
          const reqController = new AbortController();
          const timeoutId = setTimeout(() => reqController.abort(), timeoutMs);

          let res: Response;
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
          } finally {
            clearTimeout(timeoutId);
          }

          if (!res.ok || !res.body) {
            const errText = await res.text();
            throw new Error(`SiliconFlow status ${res.status}: ${errText}`);
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

          while (true) {
            const { done, value } = await reader.read();
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

            // 发送 AG-UI 视图与 Tool 结果
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
            } else {
              toolSummaryContent = JSON.stringify(toolExecutionResult);
            }

            sendEvent('generative_view', { view: toolExecutionResult });
            sendEvent('tool_call_result', {
              toolId: skillId,
              success: isExecSuccess,
              summary: `已完成【${skillName}】执行`
            });

            // 🚀 重置 accumulatedContent 为第二阶段大模型总结准备，彻底消除第一阶段 XML 干扰
            accumulatedContent = '';

            // 🚀 第二阶段：流式总结 Tool 返回的数据
            messages.push({
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: firstTool.id || `call_${Date.now()}`,
                  type: 'function',
                  function: {
                    name: skillId,
                    arguments: JSON.stringify(parsedArgs)
                  }
                }
              ]
            });

            messages.push({
              role: 'tool',
              tool_call_id: firstTool.id || `call_${Date.now()}`,
              name: skillId,
              content: toolSummaryContent
            });

            const summaryController = new AbortController();
            const summaryTimeoutId = setTimeout(() => summaryController.abort(), timeoutMs);

            try {
              const summaryRes = await fetch(`${baseURL}/chat/completions`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                  model: modelName,
                  messages,
                  temperature: 0.1,
                  stream: true
                }),
                signal: summaryController.signal
              });

              if (summaryRes.ok && summaryRes.body) {
                const summaryReader = summaryRes.body.getReader();
                let summaryLineBuffer = '';

                while (true) {
                  const { done, value } = await summaryReader.read();
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
                        const cleaned = cleanXmlToolCalls(delta.content);
                        if (cleaned) {
                          accumulatedContent += cleaned;
                          sendEvent('content_chunk', { text: cleaned });
                        }
                      }
                    } catch {}
                  }
                }
              }

              // 若第二阶段总结内容为空，自动提供规范的研判成功反馈
              if (!accumulatedContent.trim()) {
                const fallbackReply = `已为您检索并成功加载 **【${skillName}】** 数据，相关研判图表与明细数据已在主工作台渲染。`;
                accumulatedContent = fallbackReply;
                sendEvent('content_chunk', { text: fallbackReply });
              }
            } catch (sumErr) {
              console.warn('[Stream Dispatch Summary Warning]', sumErr);
              const fallbackReply = `已成功执行 **【${skillName}】** 技能，研判数据已更新。`;
              accumulatedContent = fallbackReply;
              sendEvent('content_chunk', { text: fallbackReply });
            } finally {
              clearTimeout(summaryTimeoutId);
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
