'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  History, 
  X, 
  Search, 
  Pin, 
  PinOff, 
  Trash2, 
  Edit3, 
  Check, 
  Plus, 
  MessageSquare, 
  Clock, 
  Activity, 
  AlertCircle,
  RefreshCw,
  Sparkles
} from 'lucide-react';

export interface ChatSessionItem {
  sessionId: string;
  userId: string;
  userName: string;
  userRole: string;
  title: string;
  messageCount: number;
  isPinned: boolean;
  lastGenerativeViewType?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SessionHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  currentSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onNewSession: () => void;
}

export const SessionHistoryDrawer: React.FC<SessionHistoryDrawerProps> = ({
  isOpen,
  onClose,
  userId,
  userName,
  currentSessionId,
  onSelectSession,
  onNewSession
}) => {
  const [sessions, setSessions] = useState<ChatSessionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitleInput, setEditTitleInput] = useState('');
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  // 获取该用户的真实历史会话列表
  const fetchSessions = useCallback(async (keyword?: string) => {
    if (!userId) return;
    setLoading(true);
    try {
      let url = `/api/sessions?userId=${encodeURIComponent(userId)}&limit=100`;
      if (keyword && keyword.trim()) {
        url += `&keyword=${encodeURIComponent(keyword.trim())}`;
      }
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        if (json.data?.sessions) {
          setSessions(json.data.sessions);
        }
      }
    } catch (err) {
      console.error('获取历史会话失败:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (isOpen && userId) {
      fetchSessions(searchKeyword);
    }
  }, [isOpen, userId, fetchSessions, searchKeyword]);

  // 置顶 / 取消置顶
  const handleTogglePin = async (e: React.MouseEvent, session: ChatSessionItem) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/sessions/${session.sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPinned: !session.isPinned })
      });
      if (res.ok) {
        fetchSessions(searchKeyword);
      }
    } catch (err) {
      console.error('更新置顶状态失败:', err);
    }
  };

  // 提交重命名
  const handleSaveRename = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    if (!editTitleInput.trim()) {
      setEditingSessionId(null);
      return;
    }
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitleInput.trim() })
      });
      if (res.ok) {
        setEditingSessionId(null);
        fetchSessions(searchKeyword);
      }
    } catch (err) {
      console.error('重命名会话失败:', err);
    }
  };

  // 删除单条会话
  const handleDeleteSession = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    if (!confirm('确定要删除此条历史研判会话吗？删除后不可恢复。')) return;

    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        if (currentSessionId === sessionId) {
          onNewSession();
        }
        fetchSessions(searchKeyword);
      }
    } catch (err) {
      console.error('删除会话失败:', err);
    }
  };

  // 清空该用户全部历史会话
  const handleClearAllUserSessions = async () => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/sessions?userId=${encodeURIComponent(userId)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setConfirmClearAll(false);
        onNewSession();
        fetchSessions();
      }
    } catch (err) {
      console.error('清空历史会话失败:', err);
    }
  };

  if (!isOpen) return null;

  // 时间分段工具
  const groupSessionsByTime = (items: ChatSessionItem[]) => {
    const pinned: ChatSessionItem[] = [];
    const today: ChatSessionItem[] = [];
    const yesterday: ChatSessionItem[] = [];
    const last7Days: ChatSessionItem[] = [];
    const older: ChatSessionItem[] = [];

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 86400000;
    const sevenDaysStart = todayStart - 6 * 86400000;

    for (const item of items) {
      if (item.isPinned) {
        pinned.push(item);
        continue;
      }
      const itemTime = new Date(item.updatedAt.replace(' ', 'T')).getTime();
      if (itemTime >= todayStart) {
        today.push(item);
      } else if (itemTime >= yesterdayStart) {
        yesterday.push(item);
      } else if (itemTime >= sevenDaysStart) {
        last7Days.push(item);
      } else {
        older.push(item);
      }
    }

    return [
      { title: '📌 置顶研判会话', list: pinned },
      { title: '📅 今天', list: today },
      { title: '📅 昨天', list: yesterday },
      { title: '📅 近 7 天', list: last7Days },
      { title: '📁 更早记录', list: older }
    ].filter(g => g.list.length > 0);
  };

  const grouped = groupSessionsByTime(sessions);

  return (
    <div className="fixed inset-0 z-50 flex bg-slate-900/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      {/* 遮罩背景点击关闭 */}
      <div className="flex-1" onClick={onClose} />

      {/* 侧边滑出抽屉 */}
      <div className="w-full max-w-md bg-white dark:bg-slate-900 h-full shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">
        {/* 顶部 Header */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-600/10 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400 flex items-center justify-center">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <span>历史研判会话</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono">
                  {sessions.length}
                </span>
              </h2>
              <p className="text-[11px] text-slate-500">
                所属人员：<span className="font-medium text-slate-700 dark:text-slate-300">{userName}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                onNewSession();
                onClose();
              }}
              title="新建研判会话"
              className="p-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-1 shadow-xs transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span className="text-[11px] hidden sm:inline">新会话</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 检索过滤条 */}
        <div className="p-3 bg-slate-50/50 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-800/80 shrink-0">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="搜索历史会话标题或研判内容..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              className="w-full pl-8 pr-8 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-sky-500 transition-colors"
            />
            {searchKeyword && (
              <button
                onClick={() => setSearchKeyword('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* 历史会话列表区 */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-xs text-slate-500 gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-sky-500" />
              <span>正在从数据库拉取历史会话...</span>
            </div>
          ) : grouped.length === 0 ? (
            <div className="py-16 text-center text-slate-400 space-y-2">
              <MessageSquare className="w-8 h-8 mx-auto stroke-1 opacity-40" />
              <p className="text-xs">
                {searchKeyword ? '未找到匹配的历史会话' : '暂无历史研判会话记录'}
              </p>
              <button
                onClick={() => {
                  onNewSession();
                  onClose();
                }}
                className="text-xs text-sky-600 dark:text-sky-400 hover:underline inline-block mt-1 font-medium cursor-pointer"
              >
                立即发起首次研判分析 »
              </button>
            </div>
          ) : (
            grouped.map(group => (
              <div key={group.title} className="space-y-1.5">
                <div className="text-[11px] font-bold text-slate-500 px-1">
                  {group.title}
                </div>
                <div className="space-y-1">
                  {group.list.map(session => {
                    const isSelected = currentSessionId === session.sessionId;
                    const isEditing = editingSessionId === session.sessionId;

                    return (
                      <div
                        key={session.sessionId}
                        onClick={() => {
                          if (!isEditing) {
                            onSelectSession(session.sessionId);
                            onClose();
                          }
                        }}
                        className={`group relative p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col gap-1.5 ${
                          isSelected
                            ? 'bg-sky-50/80 dark:bg-sky-950/40 border-sky-300 dark:border-sky-500/50 shadow-xs'
                            : 'bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-800/60 border-slate-200 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        {/* 标题与操作栏 */}
                        <div className="flex items-start justify-between gap-2">
                          {isEditing ? (
                            <div className="flex items-center gap-1.5 flex-1" onClick={e => e.stopPropagation()}>
                              <input
                                type="text"
                                value={editTitleInput}
                                onChange={(e) => setEditTitleInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveRename(e as any, session.sessionId);
                                  if (e.key === 'Escape') setEditingSessionId(null);
                                }}
                                autoFocus
                                className="flex-1 text-xs bg-white dark:bg-slate-950 border border-sky-500 rounded px-2 py-1 text-slate-900 dark:text-slate-100 focus:outline-none"
                              />
                              <button
                                onClick={(e) => handleSaveRename(e, session.sessionId)}
                                className="p-1 rounded bg-sky-600 hover:bg-sky-500 text-white"
                                title="保存标题"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingSessionId(null);
                                }}
                                className="p-1 rounded text-slate-400 hover:text-slate-600"
                                title="取消"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                              {session.isPinned && (
                                <Pin className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />
                              )}
                              <span className={`text-xs font-semibold truncate ${
                                isSelected ? 'text-sky-700 dark:text-sky-300' : 'text-slate-800 dark:text-slate-200'
                              }`}>
                                {session.title}
                              </span>
                            </div>
                          )}

                          {/* 悬浮/操作按钮组 */}
                          {!isEditing && (
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                              <button
                                onClick={(e) => handleTogglePin(e, session)}
                                title={session.isPinned ? '取消置顶' : '置顶会话'}
                                className="p-1 rounded text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                              >
                                {session.isPinned ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingSessionId(session.sessionId);
                                  setEditTitleInput(session.title);
                                }}
                                title="重命名会话"
                                className="p-1 rounded text-slate-400 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/40"
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>
                              <button
                                onClick={(e) => handleDeleteSession(e, session.sessionId)}
                                title="删除会话"
                                className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* 会话元数据信息 */}
                        <div className="flex items-center justify-between text-[10px] text-slate-400 px-0.5">
                          <div className="flex items-center gap-2">
                            <span className="flex items-center gap-1">
                              <MessageSquare className="w-3 h-3" />
                              <span>{session.messageCount} 条对话</span>
                            </span>
                            {session.lastGenerativeViewType && (
                              <span className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono">
                                {session.lastGenerativeViewType}
                              </span>
                            )}
                          </div>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{session.updatedAt.substring(5, 16)}</span>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* 底部 Footer 管理区 */}
        <div className="p-3 bg-slate-50 dark:bg-slate-950/90 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          {confirmClearAll ? (
            <div className="flex items-center justify-between w-full gap-2">
              <span className="text-[11px] text-rose-600 font-medium">确认清空所有历史？</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleClearAllUserSessions}
                  className="px-2 py-1 text-xs bg-rose-600 hover:bg-rose-500 text-white rounded font-medium cursor-pointer"
                >
                  确认清空
                </button>
                <button
                  onClick={() => setConfirmClearAll(false)}
                  className="px-2 py-1 text-xs bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded cursor-pointer"
                >
                  取消
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                onClick={() => setConfirmClearAll(true)}
                disabled={sessions.length === 0}
                className="text-[11px] text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 disabled:opacity-30 disabled:hover:text-slate-400 flex items-center gap-1 px-1.5 py-1 rounded transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>清空该用户历史</span>
              </button>

              <button
                onClick={() => {
                  onNewSession();
                  onClose();
                }}
                className="text-xs px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold flex items-center gap-1 shadow-sm transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>开启新会话</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
