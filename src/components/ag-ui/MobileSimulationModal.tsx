'use client';

import React, { useState } from 'react';
import { Smartphone, Camera, CheckCircle2, AlertCircle, RefreshCw, Send, Code } from 'lucide-react';

export const MobileSimulationModal: React.FC = () => {
  const [photoRecognized, setPhotoRecognized] = useState(false);
  const [recognizing, setRecognizing] = useState(false);
  const [formData, setFormData] = useState({
    species: '白纹伊蚊 (Aedes albopictus)',
    confidence: 96.8,
    captureCount: 45,
    temp: 29.5,
    humidity: 78,
    location: '郑州市金水区未来路街道',
    method: '诱蚊灯法'
  });
  const [validationResult, setValidationResult] = useState<any>(null);

  const handleSimulateCamera = () => {
    setRecognizing(true);
    setTimeout(() => {
      setRecognizing(false);
      setPhotoRecognized(true);
    }, 1200);
  };

  const handleValidateForm = () => {
    // 逻辑质控校验
    if (formData.temp < 10 && formData.captureCount > 50) {
      setValidationResult({
        valid: false,
        warning: '【逻辑质控拦截】实测气温低于 10℃ 属于越冬休眠期，单次捕获量 45 只存在逻辑冲突，建议现场复核！'
      });
    } else {
      setValidationResult({
        valid: true,
        message: '【数据质控通过】经纬度、生境类型、气温/湿度与捕获数量符合流行病学逻辑，已通过自动校验。'
      });
    }
  };

  return (
    <div className="w-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-xl p-5 border border-slate-200 dark:border-violet-500/20 shadow-sm dark:shadow-xl flex flex-col gap-4 transition-colors">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-violet-50 text-violet-600 border border-violet-200 dark:bg-violet-500/10 dark:text-violet-400 dark:border-violet-500/30">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              移动端现场采集识别与数据质控 API 仿真器
              <span className="text-xs px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200 dark:bg-violet-500/20 dark:text-violet-300 dark:border-violet-500/30 font-medium">
                RESTful API
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">支持现场拍照物种 AI 识别、自动填单与气象生境逻辑性实时质控校验</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 左侧：移动端界面模拟 */}
        <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col gap-3 text-xs">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
            <span className="font-bold text-slate-800 dark:text-slate-200">📱 移动端监测助手 (现场采集中)</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-mono font-medium">GPS: 34.8003°N, 113.6627°E</span>
          </div>

          <div className="flex flex-col items-center justify-center p-4 rounded-lg bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 gap-2">
            {photoRecognized ? (
              <div className="text-center space-y-1">
                <div className="text-3xl">🦟</div>
                <div className="font-bold text-sky-600 dark:text-sky-400">{formData.species}</div>
                <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono font-medium">识别置信度: {formData.confidence}%</div>
              </div>
            ) : (
              <button
                onClick={handleSimulateCamera}
                disabled={recognizing}
                className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-semibold flex items-center gap-2 transition-all shadow-md"
              >
                {recognizing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                <span>{recognizing ? 'AI 视觉分析中...' : '模拟现场拍照物种识别'}</span>
              </button>
            )}
          </div>

          {/* 表单 */}
          <div className="space-y-2">
            <div>
              <label className="text-slate-600 dark:text-slate-400 block mb-0.5">采集点位:</label>
              <input 
                type="text" 
                value={formData.location} 
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1 text-slate-800 dark:text-slate-100"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-slate-600 dark:text-slate-400 block mb-0.5">实测气温 (℃):</label>
                <input 
                  type="number" 
                  value={formData.temp} 
                  onChange={(e) => setFormData({ ...formData, temp: parseFloat(e.target.value) })}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1 text-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="text-slate-600 dark:text-slate-400 block mb-0.5">捕获数量 (只):</label>
                <input 
                  type="number" 
                  value={formData.captureCount} 
                  onChange={(e) => setFormData({ ...formData, captureCount: parseInt(e.target.value, 10) })}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1 text-slate-800 dark:text-slate-100"
                />
              </div>
            </div>
          </div>

          <button
            onClick={handleValidateForm}
            className="w-full py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
          >
            <Send className="w-3.5 h-3.5" />
            <span>实时校验并上传监测记录</span>
          </button>

          {validationResult && (
            <div className={`p-2.5 rounded-lg border text-[11px] ${
              validationResult.valid ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-300' : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-500/40 text-red-800 dark:text-red-300'
            }`}>
              {validationResult.valid ? <CheckCircle2 className="w-4 h-4 inline mr-1" /> : <AlertCircle className="w-4 h-4 inline mr-1" />}
              {validationResult.message || validationResult.warning}
            </div>
          )}
        </div>

        {/* 右侧：API 接口说明与代码 */}
        <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col gap-3 text-xs">
          <div className="flex items-center gap-2 text-violet-600 dark:text-violet-400 font-semibold border-b border-slate-200 dark:border-slate-800 pb-2">
            <Code className="w-4 h-4" />
            <span>移动端 OpenAPI 标准接口说明</span>
          </div>

          <div className="space-y-2 text-slate-700 dark:text-slate-300">
            <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-mono text-[10px] mr-2 font-bold">POST</span>
              <span className="font-mono text-sky-700 dark:text-sky-300 font-semibold">/api/v1/mobile/detect-species</span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">输入图片 Base64，返回物种分类、拉丁学名与置信度。</p>
            </div>

            <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-mono text-[10px] mr-2 font-bold">POST</span>
              <span className="font-mono text-sky-700 dark:text-sky-300 font-semibold">/api/v1/mobile/validate</span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">校验气象-生境-数量逻辑一致性规则引擎。</p>
            </div>

            <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-mono text-[10px] mr-2 font-bold">POST</span>
              <span className="font-mono text-sky-700 dark:text-sky-300 font-semibold">/api/v1/mobile/record</span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">提交现场监测记录并关联审核流。</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
