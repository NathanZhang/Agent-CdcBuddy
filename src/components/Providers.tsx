'use client';

import React, { useEffect } from 'react';
import { CopilotKit } from '@copilotkit/react-core';
import { RbacProvider } from '@/lib/rbac/rbac-context';
import { ThemeProvider } from '@/lib/theme/theme-context';

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // 捕获并过滤开发环境下 HMR/WebSocket 断连产生的原生 Event 错误
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (event.reason instanceof Event || (event.reason && typeof event.reason === 'object' && !('message' in event.reason))) {
        event.preventDefault();
      }
    };

    const handleError = (event: ErrorEvent) => {
      if (event.error instanceof Event || (event.message && event.message.includes('[object Event]'))) {
        event.preventDefault();
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleError);

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleError);
    };
  }, []);

  return (
    <ThemeProvider>
      <CopilotKit runtimeUrl="/api/copilotkit" showDevConsole={false}>
        <RbacProvider>
          {children}
        </RbacProvider>
      </CopilotKit>
    </ThemeProvider>
  );
}

