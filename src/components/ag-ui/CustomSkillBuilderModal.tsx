'use client';

import React from 'react';
import { MetaCustomSkillData } from '@/lib/skills/types';
import { Sparkles, Database, Lock, Globe } from 'lucide-react';

interface CustomSkillBuilderProps {
  data: {
    skill: MetaCustomSkillData;
    previewData: any[];
  };
}

export const CustomSkillBuilderModal: React.FC<CustomSkillBuilderProps> = ({ data }) => {
  const isPrivate = (data.skill.visibility ?? 'private') === 'private';

  return (
    <div className="w-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-xl p-5 border border-slate-200 dark:border-pink-500/30 shadow-sm dark:shadow-2xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-300 transition-colors">
      {/* 头部 */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-pink-50 text-pink-600 border border-pink-200 dark:bg-pink-500/10 dark:text-pink-400 dark:border-pink-500/30">
            <Sparkles className="w-5 h-5 animate-spin" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs px-2 py-0.5 rounded bg-pink-50 text-pink-700 border border-pink-200 dark:bg-pink-500/20 dark:text-pink-300 dark:border-pink-500/40 font-bold">
                🎉 新技能创建成功并已注册生效
              </span>
              {isPrivate ? (
                <span className="text-[11px] px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-800 font-semibold flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  <span>默认私有 (仅自己可见)</span>
                </span>
              ) : (
                <span className="text-[11px] px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-900/40 dark:text-sky-300 dark:border-sky-800 font-semibold flex items-center gap-1">
                  <Globe className="w-3 h-3" />
                  <span>公开技能 (全员可见)</span>
                </span>
              )}
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-1">{data.skill.name}</h3>
          </div>
        </div>
      </div>

      {/* 技能详情 */}
      <div className="space-y-2 text-xs">
        <p className="text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-950/60 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 leading-relaxed">
          <span className="text-pink-600 dark:text-pink-400 font-semibold">技能描述: </span>
          {data.skill.description}
        </p>

        <div className="bg-slate-50 dark:bg-slate-950/80 p-3 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1">
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
            <Database className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
            <span>自动编译的聚合分析 SQL:</span>
          </div>
          <pre className="text-[11px] font-mono text-cyan-700 dark:text-cyan-300 bg-white dark:bg-slate-900/90 p-2 rounded overflow-x-auto border border-slate-200 dark:border-slate-800">
            {data.skill.sqlQuery.trim()}
          </pre>
        </div>
      </div>

      {/* 预览数据表格 */}
      <div className="space-y-1.5 text-xs">
        <span className="font-semibold text-slate-700 dark:text-slate-300">📊 技能即时试跑与数据预览:</span>
        <div className="bg-white dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                {data.previewData.length > 0 && Object.keys(data.previewData[0]).map((k, i) => (
                  <th key={i} className="p-2 font-mono">{k}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {data.previewData.slice(0, 5).map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                  {Object.values(row).map((v: any, cIdx) => (
                    <td key={cIdx} className="p-2 font-mono">{String(v)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
