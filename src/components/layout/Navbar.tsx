'use client';

import React from 'react';
import { useRbac } from '@/lib/rbac/rbac-context';
import { useTheme, ThemeMode } from '@/lib/theme/theme-context';
import { UserRole } from '@/lib/rbac/types';
import { Shield, UserCheck, Layers, Sun, Moon, Laptop, Bot } from 'lucide-react';

interface NavbarProps {
  onOpenSkills: () => void;
  onSelectPrompt: (prompt: string) => void;
  showEmbeddedWidget?: boolean;
  onToggleEmbeddedWidget?: () => void;
  skillsCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({ 
  onOpenSkills, 
  onSelectPrompt,
  showEmbeddedWidget = false,
  onToggleEmbeddedWidget,
  skillsCount
}) => {
  const { activeRole, switchRole } = useRbac();
  const { theme, setTheme, resolvedTheme } = useTheme();

  const themeOptions: { mode: ThemeMode; label: string; icon: React.ReactNode }[] = [
    { mode: 'system', label: '跟随系统', icon: <Laptop className="w-3.5 h-3.5" /> },
    { mode: 'light', label: '浅色模式', icon: <Sun className="w-3.5 h-3.5" /> },
    { mode: 'dark', label: '深色模式', icon: <Moon className="w-3.5 h-3.5" /> },
  ];

  return (
    <header className="w-full bg-white/90 dark:bg-slate-950/90 backdrop-blur-md border-b border-slate-200 dark:border-sky-500/20 px-6 py-3 sticky top-0 z-40 flex flex-wrap items-center justify-between gap-4 shadow-sm dark:shadow-xl transition-colors">
      {/* 品牌与标题 */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-600 to-cyan-500 dark:from-sky-600 dark:to-cyan-400 flex items-center justify-center text-white shadow-md shadow-sky-500/30">
          <Shield className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-extrabold bg-gradient-to-r from-sky-600 via-cyan-600 to-slate-900 dark:from-sky-400 dark:via-cyan-200 dark:to-white bg-clip-text text-transparent">
              CdcBuddy · 疾控病媒生物监测预警智能体
            </h1>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700 border border-sky-300 dark:bg-sky-500/20 dark:text-sky-300 dark:border-sky-500/30 font-semibold">
              (v1.1)
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            河南省疾病预防控制中心 · 消毒与媒介生物控制所
          </p>
        </div>
      </div>

      {/* 快捷功能、主题切换与 RBAC 角色切换器 */}
      <div className="flex items-center gap-3">
        {/* 亮暗模式切换器 (自动跟随系统 / 浅色 / 深色) - 仅图标+Hover提示 */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-800 text-xs gap-0.5">
          {themeOptions.map((opt) => {
            const isActive = theme === opt.mode;
            return (
              <button
                key={opt.mode}
                onClick={() => setTheme(opt.mode)}
                title={opt.label}
                aria-label={opt.label}
                className={`flex items-center justify-center p-1.5 rounded-md text-xs transition-all ${
                  isActive
                    ? 'bg-white dark:bg-sky-600 text-sky-600 dark:text-white shadow-sm font-semibold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {opt.icon}
              </button>
            );
          })}
        </div>

        {/* Skills 技能库触发按钮 */}
        <button
          onClick={onOpenSkills}
          className="px-3 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 dark:bg-slate-900 dark:hover:bg-slate-800 dark:text-sky-300 text-xs font-semibold flex items-center gap-1.5 border border-sky-300 dark:border-sky-500/30 shadow-sm transition-all hover:border-sky-400"
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Skills 技能集市 ({skillsCount ?? 15})</span>
        </button>

        {/* 悬浮 Copilot 助手显隐开关 - 仅图标+Hover提示 */}
        {onToggleEmbeddedWidget && (
          <button
            onClick={onToggleEmbeddedWidget}
            title={showEmbeddedWidget ? '收起浮窗助手' : '展开浮窗助手'}
            aria-label={showEmbeddedWidget ? '收起浮窗助手' : '展开浮窗助手'}
            className={`p-1.5 rounded-lg text-xs font-medium flex items-center justify-center border transition-all ${
              showEmbeddedWidget
                ? 'bg-sky-600 text-white border-sky-600 shadow-sm shadow-sky-600/30'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800'
            }`}
          >
            <Bot className="w-4 h-4" />
          </button>
        )}

        {/* RBAC 角色切换 */}
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900/90 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs">
          <UserCheck className="w-3.5 h-3.5 text-sky-600 dark:text-cyan-400" />
          <span className="text-slate-500 dark:text-slate-400 hidden sm:inline">当前身份:</span>
          <select
            value={activeRole}
            onChange={(e) => switchRole(e.target.value as UserRole)}
            className="bg-white dark:bg-slate-950 text-slate-800 dark:text-sky-300 font-semibold rounded px-2 py-0.5 border border-slate-300 dark:border-slate-700 text-xs focus:outline-none focus:border-sky-500"
          >
            <option value="PROVINCIAL_ADMIN">省级管理员 (全权限)</option>
            <option value="CITY_EXPERT">市级专家 (郑州市)</option>
            <option value="DISTRICT_SURVEILLANCE">区县监测员 (金水区)</option>
            <option value="PUBLIC_VIEWER">公众访客 (科普视图)</option>
          </select>
        </div>
      </div>
    </header>
  );
};
