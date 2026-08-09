import { NextRequest, NextResponse } from 'next/server';
import { getAppBusinessProvider } from '@/lib/db/app-business-provider';

/**
 * GET /api/sessions
 * 查询指定用户的历史会话列表（支持关键词搜索、分页、按置顶与时间倒序）
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId') || undefined;
    const keyword = searchParams.get('keyword') || undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 50;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!, 10) : 0;

    const provider = getAppBusinessProvider();
    const [sessions, total] = await Promise.all([
      provider.getChatSessions({ userId, keyword, limit, offset }),
      provider.getChatSessionCount({ userId, keyword })
    ]);

    return NextResponse.json({
      code: 0,
      message: 'success',
      data: {
        total,
        sessions: sessions.map(s => ({
          sessionId: s.session_id,
          userId: s.user_id,
          userName: s.user_name,
          userRole: s.user_role,
          title: s.title,
          messageCount: s.message_count,
          isPinned: s.is_pinned === 1,
          lastGenerativeViewType: s.last_generative_view?.type || null,
          createdAt: s.created_at,
          updatedAt: s.updated_at
        }))
      }
    });
  } catch (error: any) {
    console.error('获取历史会话列表异常:', error);
    return NextResponse.json(
      { code: 500, message: error.message || '获取历史会话失败' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sessions
 * 创建新会话（支持携带初始消息与初始视图快照）
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      sessionId,
      userId,
      userName,
      userRole,
      title,
      lastGenerativeView,
      initialMessages
    } = body;

    if (!userId || !userName) {
      return NextResponse.json(
        { code: 400, message: '缺少必要的用户参数 (userId, userName)' },
        { status: 400 }
      );
    }

    const finalSessionId = sessionId || `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const finalTitle = title?.trim() || '新研判会话';

    const provider = getAppBusinessProvider();
    const created = await provider.createChatSession({
      session_id: finalSessionId,
      user_id: userId,
      user_name: userName,
      user_role: userRole || 'PUBLIC_VIEWER',
      title: finalTitle,
      last_generative_view: lastGenerativeView || null,
      is_pinned: 0,
      initialMessages: Array.isArray(initialMessages) ? initialMessages : undefined
    });

    return NextResponse.json({
      code: 0,
      message: '会话创建成功',
      data: {
        sessionId: created.session_id,
        userId: created.user_id,
        userName: created.user_name,
        userRole: created.user_role,
        title: created.title,
        messageCount: created.message_count,
        isPinned: created.is_pinned === 1,
        createdAt: created.created_at,
        updatedAt: created.updated_at
      }
    });
  } catch (error: any) {
    console.error('创建会话异常:', error);
    return NextResponse.json(
      { code: 500, message: error.message || '创建会话失败' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/sessions
 * 清空指定用户的所有会话历史
 */
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { code: 400, message: '请指定要清空会话的 userId' },
        { status: 400 }
      );
    }

    const provider = getAppBusinessProvider();
    const ok = await provider.clearUserChatSessions(userId);

    return NextResponse.json({
      code: 0,
      message: ok ? '用户会话已成功全部清空' : '未找到可清空的会话'
    });
  } catch (error: any) {
    console.error('清空用户会话异常:', error);
    return NextResponse.json(
      { code: 500, message: error.message || '清空用户会话失败' },
      { status: 500 }
    );
  }
}
