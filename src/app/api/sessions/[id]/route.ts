import { NextRequest, NextResponse } from 'next/server';
import { getAppBusinessProvider } from '@/lib/db/app-business-provider';

/**
 * GET /api/sessions/[id]
 * 获取单条会话详情（包含全部消息流与最新视图快照，用于重新加载）
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await context.params;
    if (!sessionId) {
      return NextResponse.json({ code: 400, message: '缺少 sessionId' }, { status: 400 });
    }

    const provider = getAppBusinessProvider();
    const session = await provider.getChatSessionById(sessionId);
    if (!session) {
      return NextResponse.json({ code: 404, message: '未找到指定会话' }, { status: 404 });
    }

    const rawMessages = await provider.getChatMessages(sessionId);
    const messages = rawMessages.map(m => ({
      id: m.message_id,
      sender: m.sender,
      text: m.text,
      skillUsed: m.skill_used || undefined,
      generativeViewSnapshot: m.generative_view_snapshot || undefined,
      timestamp: m.timestamp,
      createdAt: m.created_at
    }));

    return NextResponse.json({
      code: 0,
      message: 'success',
      data: {
        sessionId: session.session_id,
        userId: session.user_id,
        userName: session.user_name,
        userRole: session.user_role,
        title: session.title,
        lastGenerativeView: session.last_generative_view || null,
        messageCount: session.message_count,
        isPinned: session.is_pinned === 1,
        createdAt: session.created_at,
        updatedAt: session.updated_at,
        messages
      }
    });
  } catch (error: any) {
    console.error('获取会话详情异常:', error);
    return NextResponse.json(
      { code: 500, message: error.message || '获取会话详情失败' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sessions/[id]
 * 向指定会话批量/单条追加新消息，并更新最后工作台视图与会话活跃时间
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await context.params;
    if (!sessionId) {
      return NextResponse.json({ code: 400, message: '缺少 sessionId' }, { status: 400 });
    }

    const body = await req.json();
    const { messages, lastGenerativeView, suggestedTitle } = body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ code: 400, message: '请提供有效的 messages 数组' }, { status: 400 });
    }

    const provider = getAppBusinessProvider();
    const session = await provider.getChatSessionById(sessionId);
    if (!session) {
      return NextResponse.json({ code: 404, message: '未找到指定会话' }, { status: 404 });
    }

    const formattedMessages = messages.map((m: any) => ({
      message_id: m.id || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      session_id: sessionId,
      sender: m.sender as ('user' | 'agent' | 'system'),
      text: m.text,
      skill_used: m.skillUsed || m.skill_used || undefined,
      generative_view_snapshot: m.generativeViewSnapshot || m.generative_view_snapshot || undefined,
      timestamp: m.timestamp || new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    }));

    await provider.batchAppendChatMessages(sessionId, formattedMessages, lastGenerativeView, suggestedTitle);

    return NextResponse.json({
      code: 0,
      message: '消息追加成功'
    });
  } catch (error: any) {
    console.error('追加会话消息异常:', error);
    return NextResponse.json(
      { code: 500, message: error.message || '追加会话消息失败' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/sessions/[id]
 * 更新会话元数据（修改标题、修改置顶状态、更新最后视图）
 */
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await context.params;
    if (!sessionId) {
      return NextResponse.json({ code: 400, message: '缺少 sessionId' }, { status: 400 });
    }

    const body = await req.json();
    const { title, isPinned, lastGenerativeView } = body;

    const provider = getAppBusinessProvider();
    const ok = await provider.updateChatSession(sessionId, {
      title: title !== undefined ? String(title).trim() : undefined,
      is_pinned: isPinned !== undefined ? (isPinned ? 1 : 0) : undefined,
      last_generative_view: lastGenerativeView !== undefined ? lastGenerativeView : undefined
    });

    if (!ok) {
      return NextResponse.json({ code: 404, message: '会话不存在或未发生更新' }, { status: 404 });
    }

    return NextResponse.json({
      code: 0,
      message: '会话更新成功'
    });
  } catch (error: any) {
    console.error('更新会话异常:', error);
    return NextResponse.json(
      { code: 500, message: error.message || '更新会话失败' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/sessions/[id]
 * 删除指定历史会话（级联删除所有关联消息）
 */
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await context.params;
    if (!sessionId) {
      return NextResponse.json({ code: 400, message: '缺少 sessionId' }, { status: 400 });
    }

    const provider = getAppBusinessProvider();
    const ok = await provider.deleteChatSession(sessionId);

    return NextResponse.json({
      code: 0,
      message: ok ? '会话已成功删除' : '未找到指定会话'
    });
  } catch (error: any) {
    console.error('删除会话异常:', error);
    return NextResponse.json(
      { code: 500, message: error.message || '删除会话失败' },
      { status: 500 }
    );
  }
}
