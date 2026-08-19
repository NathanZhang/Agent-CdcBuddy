/**
 * 大模型 Tool Calling XML / JSON 解析器与文本清洗工具
 * 处理 Qwen / DeepSeek / 开源大模型输出的 <tool_call> XML 标签及文本工具调用格式
 */

export interface ParsedToolCall {
  name: string;
  args: Record<string, any>;
}

/**
 * 从文本中解析 <tool_call> 标签内的工具名与参数
 * 支持 XML 格式与 JSON 格式
 */
export function parseToolCallFromText(text: string): ParsedToolCall | null {
  if (!text || !text.includes('<tool_call>')) return null;

  // 1. 匹配 <tool_call> ... </tool_call>（兼容未完全闭合的标签）
  const toolCallMatch = text.match(/<tool_call>([\s\S]*?)(?:<\/tool_call>|$)/i);
  if (!toolCallMatch) return null;

  const inner = toolCallMatch[1].trim();

  // 格式 A：<tool_call> 内嵌 JSON
  // 例如：{"name": "...", "arguments": {...}}
  try {
    const jsonMatch = inner.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const toolName = parsed.name || parsed.function?.name || parsed.function;
      if (toolName && typeof toolName === 'string') {
        return {
          name: toolName,
          args: parsed.arguments || parsed.parameters || parsed.args || {}
        };
      }
    }
  } catch {
    // 非 JSON，继续尝试 XML 格式
  }

  // 格式 B：<tool_call> 内嵌 XML 标签
  // 例如：<function=skill_monitoring_data_table> 或 <function name="skill_monitoring_data_table">
  const funcMatch = inner.match(/<function[=\s]+["']?([a-zA-Z0-9_\-]+)["']?>([\s\S]*?)(?:<\/function>|$)/i);
  if (funcMatch) {
    const funcName = funcMatch[1];
    const paramsContent = funcMatch[2];
    const args: Record<string, any> = {};

    // 匹配 <parameter=param_name>value</parameter> 或 <parameter name="param_name">value</parameter>
    const paramRegex = /<parameter[=\s]+["']?([a-zA-Z0-9_\-]+)["']?>([\s\S]*?)(?:<\/parameter>|$)/gi;
    let pMatch: RegExpExecArray | null;
    while ((pMatch = paramRegex.exec(paramsContent)) !== null) {
      const pName = pMatch[1];
      let pVal: any = pMatch[2].trim();

      // 智能转换数字与布尔类型
      if (/^\d+$/.test(pVal)) {
        pVal = parseInt(pVal, 10);
      } else if (/^\d+\.\d+$/.test(pVal)) {
        pVal = parseFloat(pVal);
      } else if (pVal.toLowerCase() === 'true') {
        pVal = true;
      } else if (pVal.toLowerCase() === 'false') {
        pVal = false;
      }

      args[pName] = pVal;
    }

    return {
      name: funcName,
      args
    };
  }

  return null;
}

/**
 * 清除文本中的 <tool_call> XML 标签及其关联的内部标签
 * 防止大模型生成的工具调用 XML 暴露给前端用户界面
 */
export function cleanXmlToolCalls(text: string): string {
  if (!text) return '';
  return text
    // 移除完整的 <tool_call>...</tool_call> 块
    .replace(/<tool_call>[\s\S]*?(?:<\/tool_call>|$)/gi, '')
    // 移除独立的 <function=...>...</function> 块
    .replace(/<function[=\s]+[^>]*>[\s\S]*?(?:<\/function>|$)/gi, '')
    // 移除独立的 <parameter=...>...</parameter> 块
    .replace(/<parameter[=\s]+[^>]*>[\s\S]*?(?:<\/parameter>|$)/gi, '')
    // 移除孤立的闭合或开放标签
    .replace(/<\/?(?:tool_call|function|parameter)[^>]*>/gi, '')
    // 清理连续多余的空行
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * 判断文本是否纯粹由 <tool_call> XML 组成（没有其他实质性回复）
 */
export function isOnlyToolCallXml(text: string): boolean {
  if (!text) return false;
  const cleaned = cleanXmlToolCalls(text);
  return cleaned.length === 0 && text.includes('<tool_call>');
}
