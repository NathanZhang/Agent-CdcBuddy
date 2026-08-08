'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export type ThemeMode = 'system' | 'light' | 'dark';

interface ThemeContextType {
  theme: ThemeMode;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: ThemeMode) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>('system');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('dark');

  // 初始化从 localStorage 读取主题，并监听系统配色变化
  useEffect(() => {
    const savedTheme = localStorage.getItem('cdc_theme_mode') as ThemeMode | null;
    const initialTheme: ThemeMode = savedTheme || 'system';
    setThemeState(initialTheme);

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = (mode: ThemeMode) => {
      const isSystemDark = mediaQuery.matches;
      const effectiveDark = mode === 'system' ? isSystemDark : mode === 'dark';
      
      const root = document.documentElement;
      if (effectiveDark) {
        root.classList.add('dark');
        root.classList.remove('light');
        setResolvedTheme('dark');
      } else {
        root.classList.remove('dark');
        root.classList.add('light');
        setResolvedTheme('light');
      }
    };

    applyTheme(initialTheme);

    const handleSystemThemeChange = () => {
      const currentSaved = localStorage.getItem('cdc_theme_mode') as ThemeMode | null;
      if (!currentSaved || currentSaved === 'system') {
        applyTheme('system');
      }
    };

    mediaQuery.addEventListener('change', handleSystemThemeChange);
    return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
  }, []);

  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme);
    localStorage.setItem('cdc_theme_mode', newTheme);
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const isSystemDark = mediaQuery.matches;
    const effectiveDark = newTheme === 'system' ? isSystemDark : newTheme === 'dark';

    const root = document.documentElement;
    if (effectiveDark) {
      root.classList.add('dark');
      root.classList.remove('light');
      setResolvedTheme('dark');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
      setResolvedTheme('light');
    }
  };

  return (
    <ThemeContext.Provider value={{
      theme,
      resolvedTheme,
      setTheme,
      isDark: resolvedTheme === 'dark',
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
