'use client';

import React from 'react';
import { CopilotKit } from '@copilotkit/react-core';
import { RbacProvider } from '@/lib/rbac/rbac-context';
import { ThemeProvider } from '@/lib/theme/theme-context';

export function Providers({ children }: { children: React.ReactNode }) {
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
