'use client';

import React, { useState } from 'react';
import { 
  ClipboardCheck, 
  AlertTriangle, 
  CheckCircle2, 
  ShieldAlert, 
  MapPin, 
  Clock, 
  Send,
  UserX,
  FileText,
  Sparkles
} from 'lucide-react';

interface DeathCertQcCardProps {
  data?: any;
}

export const DeathCertQcCard: React.FC<DeathCertQcCardProps> = ({ data = {} }) => {
  const [fixedMap, setFixedMap] = useState<Record<string, boolean>>({});

  const totalChecked = data?.totalCertificatesChecked || 500;
  const validCount = data?.validCertificatesCount || 498;
  const conflictCount = data?.conflictCasesCount || 2;
  const qcMetrics = data?.qcMetrics || {
    errorDetectionRateText: '99.2% (国家规范≥98.0%)',
    logicalAccuracyRate: 0.995,
    qcRulesAppliedCount: 38,
    complianceStatus: '达标 (优于国家标准)'
  };
  const distribution = data?.conflictTypeDistribution || [
    { type: '性别-死因生理逻辑冲突', count: 1, share: '33.3%' },
    { type: '年龄-低龄罕见退行性病变冲突', count: 1, share: '33.3%' },
    { type: '死因链因果逻辑倒置', count: 1, share: '33.3%' }
  ];
  const conflictCases = data?.flaggedConflictCases || [
    {
      certId: 'CERT-2026-ERR-001',
      patientName: '张建国',
      gender: '男',
      age: 56,
      location: '洛阳市 · 涧西区',
      deathDate: '2026-08-10',
      reportedChain: {
        causeA: '癌性恶病质',
        causeB: '广泛性盆腔浸润转移',
        causeC: '宫颈浸润性鳞状细胞癌',
        underlying: '宫颈恶性肿瘤'
      },
      detectedErrors: ['性别与死因严重逻辑冲突: 患者为【男性】，但死因链出现【宫颈】相关疾病'],
      suggestedAction: '已自动拦截并下发属地填报医院流调质控员 24 小时内核实订正。'
    },
    {
      certId: 'CERT-2026-ERR-002',
      patientName: '李小明',
      gender: '男',
      age: 5,
      location: '新乡市 · 原阳县',
      deathDate: '2026-08-12',
      reportedChain: {
        causeA: '吸入性肺炎',
        causeB: '吞咽障碍',
        causeC: '重度阿尔茨海默病老年痴呆',
        underlying: '阿尔茨海默病'
      },
      detectedErrors: ['年龄与死因矛盾: 患者年龄为【5岁】，阿尔茨海默病罕见于40岁以下'],
      suggestedAction: '已自动拦截并下发属地填报医院流调质控员 24 小时内核实订正。'
    }
  ];

  const handleFix = (certId: string) => {
    setFixedMap(prev => ({ ...prev, [certId]: true }));
  };

  return (
    <div className="w-full bg-white dark:bg-slate-900 rounded-xl p-5 border border-rose-200 dark:border-rose-500/30 shadow-md space-y-5">
      {/* 头部态势栏 */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold">
            <ClipboardCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>人口死亡医学证明书智能逻辑质控与冲突校验</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300 font-medium">
                规则引擎 · 检出率≥98%
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              全省医疗机构死亡证明书多维逻辑顺应性、年龄性别冲突与死因链倒置自动排查
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="px-2.5 py-1 rounded-md bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-500/30">
            错误检出率: {qcMetrics.errorDetectionRateText}
          </span>
          <span className="px-2.5 py-1 rounded-md bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 font-bold border border-rose-200 dark:border-rose-500/30">
            拦截冲突: {conflictCount} 份
          </span>
        </div>
      </div>

      {/* 核心指标统计卡片 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
          <span className="text-[11px] text-slate-500 dark:text-slate-400">已核查证明书总数</span>
          <p className="text-xl font-black text-rose-600 dark:text-rose-400 mt-0.5">{totalChecked} 份</p>
        </div>
        <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
          <span className="text-[11px] text-slate-500 dark:text-slate-400">质控通过有效卡</span>
          <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{validCount} 份</p>
        </div>
        <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
          <span className="text-[11px] text-slate-500 dark:text-slate-400">执行质控规则集</span>
          <p className="text-xl font-black text-sky-600 dark:text-sky-400 mt-0.5">{qcMetrics.qcRulesAppliedCount} 条</p>
        </div>
        <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
          <span className="text-[11px] text-slate-500 dark:text-slate-400">国家质控标准评价</span>
          <p className="text-xl font-black text-purple-600 dark:text-purple-400 mt-0.5">{qcMetrics.complianceStatus}</p>
        </div>
      </div>

      {/* 冲突类型分布 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-800 dark:text-slate-200">
          <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
            <ShieldAlert className="w-4 h-4" /> 错误与冲突类型分类分布
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {distribution.map((d: any, i: number) => (
            <div key={i} className="bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800 flex justify-between items-center text-xs">
              <span className="text-slate-700 dark:text-slate-300 font-medium">{d.type}</span>
              <span className="font-bold text-rose-600 dark:text-rose-400">{d.count} 例 ({d.share})</span>
            </div>
          ))}
        </div>
      </div>

      {/* 拦截逻辑冲突证明书明细与协同订正 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
          <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
            <AlertTriangle className="w-4 h-4" /> 智能拦截的逻辑冲突死因证明书台账 (需人工核实/订正)
          </span>
          <span className="text-[11px] text-slate-400 font-normal">系统已阻断异常归档并派发督办单</span>
        </div>

        <div className="space-y-3">
          {conflictCases.map((c: any, idx: number) => {
            const isFixed = fixedMap[c.certId];
            return (
              <div 
                key={idx}
                className="bg-rose-50/40 dark:bg-rose-950/20 p-4 rounded-xl border border-rose-200 dark:border-rose-500/30 space-y-3 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rose-200 dark:border-rose-500/20 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                      {c.patientName} ({c.gender}性, {c.age}岁)
                    </span>
                    <span className="font-mono text-[11px] text-slate-500">{c.certId}</span>
                    <span className="flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-400">
                      <MapPin className="w-3 h-3 text-rose-500" /> {c.location}
                    </span>
                  </div>

                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    isFixed 
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' 
                      : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
                  }`}>
                    {isFixed ? '已下发督办订正工单' : '待流调员核实'}
                  </span>
                </div>

                {/* 原始死因链汇报 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                  <div>(a) 直接导致死亡疾病: <span className="font-medium text-slate-800 dark:text-slate-200">{c.reportedChain.causeA}</span></div>
                  <div>(b) 引起(a)的疾病: <span className="font-medium text-slate-800 dark:text-slate-200">{c.reportedChain.causeB}</span></div>
                  <div>(c) 引起(b)的疾病: <span className="font-medium text-slate-800 dark:text-slate-200">{c.reportedChain.causeC}</span></div>
                  <div>推断根本死因: <span className="font-bold text-rose-600 dark:text-rose-400">{c.reportedChain.underlying}</span></div>
                </div>

                {/* 检测到的冲突规则与建议 */}
                <div className="space-y-1.5">
                  {c.detectedErrors.map((err: string, i: number) => (
                    <div key={i} className="flex items-start gap-1.5 text-rose-700 dark:text-rose-300 font-medium">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-rose-600" />
                      <span>{err}</span>
                    </div>
                  ))}
                  <div className="text-slate-500 dark:text-slate-400 text-[11px]">
                    处置指引: {c.suggestedAction}
                  </div>
                </div>

                {/* 操作栏 */}
                <div className="flex justify-end pt-1">
                  <button
                    onClick={() => handleFix(c.certId)}
                    disabled={isFixed}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                      isFixed
                        ? 'bg-slate-200 text-slate-500 dark:bg-slate-800 cursor-default'
                        : 'bg-rose-600 hover:bg-rose-700 text-white shadow'
                    }`}
                  >
                    {isFixed ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>已派发流调督办工单</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>下发医院质控督办通知</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
