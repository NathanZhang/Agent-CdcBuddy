'use client';

import React, { useState } from 'react';
import { 
  Droplets, 
  ShieldAlert, 
  MapPin, 
  Activity, 
  CheckCircle2, 
  AlertTriangle, 
  Search,
  Filter,
  BarChart2,
  Sparkles
} from 'lucide-react';

interface WaterPipelineGisMapProps {
  data?: any;
}

export const WaterPipelineGisMap: React.FC<WaterPipelineGisMapProps> = ({ data = {} }) => {
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [searchKey, setSearchKey] = useState<string>('');

  const evaluation = data?.evaluationResult || {};
  const featureImportances = data?.randomForestFeatureImportances || [
    { feature: '三氯甲烷 (消毒副产物)', importance: 0.364, riskType: '致癌健康风险首要因子' },
    { feature: '总大肠菌群 (微生物指标)', importance: 0.285, riskType: '急性肠道感染高危因子' },
    { feature: '重金属铅 (管网溶出)', importance: 0.168, riskType: '神经与肾脏蓄积毒性' },
    { feature: '高锰酸盐指数 (COD)', importance: 0.112, riskType: '有机污染综合指标' },
    { feature: '重金属镉', importance: 0.071, riskType: '骨骼与肾功能危害' }
  ];
  const gridPoints = data?.krigingGridPoints || [
    { city: '郑州市', district: '金水区', hazardIndex: 0.42, riskLevel: 'safe', lat: 34.80, lon: 113.66 },
    { city: '新乡市', district: '凤泉区', hazardIndex: 1.15, riskLevel: 'moderate', lat: 35.44, lon: 113.78 },
    { city: '焦作市', district: '山阳区', hazardIndex: 0.54, riskLevel: 'moderate', lat: 35.06, lon: 113.20 },
    { city: '洛阳市', district: '吉利区', hazardIndex: 0.88, riskLevel: 'moderate', lat: 34.90, lon: 112.58 },
    { city: '开封市', district: '鼓楼区', hazardIndex: 0.35, riskLevel: 'safe', lat: 34.70, lon: 114.17 }
  ];

  const totalPoints = evaluation?.totalStationsSampled || 465;
  const complianceRate = evaluation?.overallComplianceRate || '96.2%';
  const maxCr = evaluation?.maxCarcinogenicRiskCR || '1.82×10⁻⁵';
  const maxHq = evaluation?.maxHazardQuotientHQ || 1.15;
  const disposalAdvice = data?.disposalAdvice || '强化老旧供水管网末梢水冲洗排污，严格次氯酸钠在线投加闭环控制，定期检测消毒副产物。';

  const filteredPoints = gridPoints.filter((pt: any) => {
    if (filterLevel !== 'all' && pt.riskLevel !== filterLevel) return false;
    if (searchKey) {
      const q = searchKey.toLowerCase();
      return (pt.city && pt.city.toLowerCase().includes(q)) || 
             (pt.district && pt.district.toLowerCase().includes(q));
    }
    return true;
  });

  return (
    <div className="w-full bg-white dark:bg-slate-900 rounded-xl p-5 border border-cyan-200 dark:border-cyan-500/30 shadow-md space-y-5">
      {/* 头部态势栏 */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-cyan-100 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 flex items-center justify-center font-bold">
            <Droplets className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>饮用水全流程健康风险评估与普通克里金空间场</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300 font-medium">
                GB 5749-2022 · 随机森林 CR/HQ
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              全省生活饮用水水厂出厂水、管网末梢水与二次供水水质多维监测
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="px-2.5 py-1 rounded-md bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-500/30">
            水质综合达标率: {complianceRate}
          </span>
          <span className="px-2.5 py-1 rounded-md bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 font-bold border border-cyan-200 dark:border-cyan-500/30">
            监测点位: {totalPoints} 处
          </span>
        </div>
      </div>

      {/* 核心指标统计卡片 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
          <span className="text-[11px] text-slate-500 dark:text-slate-400">致癌健康风险峰值 (CR)</span>
          <p className="text-xl font-black text-rose-600 dark:text-rose-400 mt-0.5">{maxCr}</p>
          <span className="text-[10px] text-slate-400">参考阈值 ≤ 1.0×10⁻⁶</span>
        </div>
        <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
          <span className="text-[11px] text-slate-500 dark:text-slate-400">非致癌危害商数峰值 (HQ)</span>
          <p className="text-xl font-black text-amber-600 dark:text-amber-400 mt-0.5">{maxHq}</p>
          <span className="text-[10px] text-slate-400">安全限值 HQ ≤ 1.0</span>
        </div>
        <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
          <span className="text-[11px] text-slate-500 dark:text-slate-400">普通克里金空间插值场</span>
          <p className="text-xl font-black text-cyan-600 dark:text-cyan-400 mt-0.5">高精度连续场</p>
          <span className="text-[10px] text-slate-400">球状变异函数拟合</span>
        </div>
        <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
          <span className="text-[11px] text-slate-500 dark:text-slate-400">高危超标管网风险点</span>
          <p className="text-xl font-black text-red-600 dark:text-red-400 mt-0.5">
            {gridPoints.filter((p: any) => p.riskLevel === 'moderate' || p.riskLevel === 'high').length} 处
          </p>
          <span className="text-[10px] text-slate-400">均已派发处置工单</span>
        </div>
      </div>

      {/* 风险权重与特征重要性 */}
      <div className="bg-slate-50 dark:bg-slate-950/80 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-800 dark:text-slate-200">
          <span className="flex items-center gap-1.5 text-cyan-600 dark:text-cyan-400">
            <BarChart2 className="w-4 h-4" /> 随机森林模型多指标健康风险重要性权重 (Feature Importances)
          </span>
          <span className="text-slate-400 font-normal">基于全省 4,662 条水质理化监测训练</span>
        </div>
        <div className="space-y-2">
          {featureImportances.map((item: any, idx: number) => (
            <div key={idx} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-700 dark:text-slate-300 font-medium">{item.feature}</span>
                <span className="text-cyan-600 dark:text-cyan-400 font-bold">
                  {(item.importance * 100).toFixed(1)}% · <span className="text-[11px] text-slate-400 font-normal">{item.riskType}</span>
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    idx === 0 ? 'bg-rose-500' : idx === 1 ? 'bg-amber-500' : 'bg-cyan-500'
                  }`}
                  style={{ width: `${Math.min(100, item.importance * 100 * 2.5)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 克里金网格监测点位与下钻过滤 */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">空间采样点位健康风险评级</span>
            <div className="flex gap-1">
              {['all', 'safe', 'moderate'].map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setFilterLevel(lvl)}
                  className={`px-2 py-0.5 text-xs rounded-md font-medium transition-colors ${
                    filterLevel === lvl
                      ? 'bg-cyan-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  {lvl === 'all' ? '全部' : lvl === 'safe' ? '安全达标' : '中高风险'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-800">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input 
              type="text" 
              placeholder="搜索区县/地市..." 
              value={searchKey}
              onChange={(e) => setSearchKey(e.target.value)}
              className="text-xs bg-transparent border-none outline-none w-28 text-slate-700 dark:text-slate-200 placeholder-slate-400"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto pr-1">
          {filteredPoints.slice(0, 15).map((pt: any, i: number) => {
            const isHigh = pt.riskLevel === 'moderate' || pt.hazardIndex > 0.5;
            return (
              <div 
                key={i} 
                className={`p-2.5 rounded-lg border text-xs space-y-1 transition-all ${
                  isHigh 
                    ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-500/30' 
                    : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-cyan-500" />
                    {pt.city} · {pt.district}
                  </span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    isHigh ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                  }`}>
                    HQ: {Number(pt.hazardIndex).toFixed(2)}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 flex justify-between">
                  <span>坐标: [{Number(pt.lat).toFixed(2)}, {Number(pt.lon).toFixed(2)}]</span>
                  <span className={isHigh ? 'text-amber-600 font-medium' : 'text-emerald-600'}>
                    {isHigh ? '重点监测管段' : '水质达标'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 协同处置建议 */}
      <div className="bg-cyan-50/60 dark:bg-cyan-950/20 p-3 rounded-lg border border-cyan-200 dark:border-cyan-500/30 flex items-start gap-2.5 text-xs">
        <Sparkles className="w-4 h-4 text-cyan-600 dark:text-cyan-400 flex-shrink-0 mt-0.5" />
        <div className="text-slate-700 dark:text-slate-300">
          <span className="font-bold text-cyan-800 dark:text-cyan-300">智能处置研判与闭环建议：</span>
          <span className="ml-1">{disposalAdvice}</span>
        </div>
      </div>
    </div>
  );
};
