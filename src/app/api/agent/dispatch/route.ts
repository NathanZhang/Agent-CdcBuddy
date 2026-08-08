import { NextRequest, NextResponse } from 'next/server';
import { routeSkillWithLLM } from '@/lib/skills/llm-router';
import { executeSkillServer } from '@/lib/skills/server-executor';
import { getSkillById } from '@/lib/skills/registry';
import { fallbackRuleMatch } from '@/lib/skills/dispatcher';

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

    let routeResult: any = null;

    // 1. 尝试大模型 Tool Calling 路由
    try {
      routeResult = await routeSkillWithLLM(promptText.trim(), chatHistory, userRole);
    } catch (llmErr) {
      console.warn('[Dispatch API] LLM 意图识别超时或网络异常，平滑降级至规则匹配引擎');
      routeResult = fallbackRuleMatch(promptText.trim(), context);
    }

    if (!routeResult || !routeResult.skillId) {
      routeResult = fallbackRuleMatch(promptText.trim(), context);
    }

    const skill = getSkillById(routeResult.skillId);
    const skillName = skill?.name || routeResult.skillName || '未知技能';

    // 2. 执行目标技能
    let generativeViewData: any = null;
    let isExecSuccess = true;
    try {
      generativeViewData = await executeSkillServer(routeResult.skillId, routeResult.args || {});
    } catch (execErr: any) {
      console.error(`[Dispatch API] 执行技能 ${routeResult.skillId} 出错:`, execErr);
      isExecSuccess = false;
      generativeViewData = {
        error: execErr.message || '技能执行异常',
        query: promptText
      };
    }

    // 3. 构造回复话术
    let replyText = isExecSuccess
      ? `已根据您的指令调用 **【${skillName}】** 技能。相关分析图表与态势数据已在主工作区生成式渲染完成。`
      : `⚠️ 调用技能 **【${skillName}】** 执行异常: ${generativeViewData.error}`;
    if (routeResult.directAnswer && routeResult.skillId === 'skill_vector_nlq') {
      replyText = routeResult.directAnswer;
    }

    return NextResponse.json({
      success: isExecSuccess,
      skillId: routeResult.skillId,
      skillName: skillName,
      source: routeResult.source || 'llm_tool_calling',
      args: routeResult.args,
      replyText,
      generativeView: generativeViewData
    });
  } catch (err: any) {
    console.error('[Dispatch API Fatal Error]', err);
    return NextResponse.json(
      { success: false, error: err.message || '调度服务处理失败' },
      { status: 500 }
    );
  }
}
