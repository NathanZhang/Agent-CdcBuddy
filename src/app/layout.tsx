import type { Metadata } from "next";
import "./globals.css";
import "@copilotkit/react-ui/styles.css";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "CdcBuddy - 疾控病媒生物监测预警智能体",
  description: "基于 CopilotKit 框架与河南省 5.6 万条病媒监测治理成果数据集构建的智能研判系统",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 min-h-screen antialiased selection:bg-sky-500 selection:text-white transition-colors duration-200">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
