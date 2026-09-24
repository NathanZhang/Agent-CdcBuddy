"use client";

import React, { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global Error Caught:", error);
  }, [error]);

  return (
    <html lang="zh-CN">
      <body className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-100 p-6">
        <div className="max-w-md w-full bg-slate-800/90 border border-slate-700/80 rounded-2xl p-6 shadow-2xl backdrop-blur text-center space-y-4">
          <div className="w-14 h-14 bg-red-500/10 border border-red-500/30 text-red-400 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold tracking-tight text-white">系统全局加载异常</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              {error?.message || "全局上下文加载中断，请点击重试重新加载页面。"}
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={() => reset()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-medium text-sm transition-all shadow-lg shadow-sky-600/20 active:scale-95 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              重新载入系统
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
