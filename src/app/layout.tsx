import { getAgentProfile } from "@/lib/config/agent-profile";
import { getRuntimeProfile } from "@/application/config/runtime-profile";
import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";

export const dynamic = 'force-dynamic';

export function generateMetadata():Metadata {
 const profile=getRuntimeProfile();return {title:`CdcBuddy - ${getAgentProfile(profile.domain).fullName}`,description:'通过主线 Agent、大模型与真实执行技能提供疾控监测分析及 AG-UI 工作台。'};
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 antialiased selection:bg-sky-500 selection:text-white transition-colors duration-200">
        <script dangerouslySetInnerHTML={{ __html: `window.__CDC_RUNTIME_PROFILE__=${JSON.stringify(getRuntimeProfile()).replaceAll('<','\\u003c')};` }} />
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
