'use client';

import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { HENAN_CITIES_GEO } from '@/lib/geo/henan-geojson';
import { EarlyWarningAlertItem } from '@/lib/db/data-provider';
import { useTheme } from '@/lib/theme/theme-context';
import { MapPin, RotateCcw, Layers, Compass } from 'lucide-react';

interface VectorMapProps {
  alerts?: EarlyWarningAlertItem[];
  selectedCity?: string;
  onSelectCity?: (city: string) => void;
  title?: string;
}

export const VectorMapComponent: React.FC<VectorMapProps> = ({
  alerts = [],
  selectedCity,
  onSelectCity,
  title = '河南省病媒生物监测与时空风险地图'
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<EarlyWarningAlertItem | null>(null);
  const [currentViewCity, setCurrentViewCity] = useState<string>(selectedCity || '全省全景');
  const [mapLayerType, setMapLayerType] = useState<'vec' | 'img'>('vec'); // vec: 天地图矢量, img: 天地图影像
  const { isDark } = useTheme();

  const tiandituKey = process.env.NEXT_PUBLIC_TIANDITU_KEY || '45052613ad935c678a6a702faf0511b1';

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // 天地图 WMTS 多子域切片 URL
    const subdomains = ['0', '1', '2', '3', '4', '5', '6', '7'];
    
    // 底图切片 (矢量 vec_w 或 影像 img_w)
    const baseTiles = subdomains.map(s => 
      `https://t${s}.tianditu.gov.cn/${mapLayerType}_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${mapLayerType}&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${tiandituKey}`
    );

    // 中文地名注记切片 (矢量注记 cva_w 或 影像注记 cia_w)
    const annoLayer = mapLayerType === 'vec' ? 'cva' : 'cia';
    const annoTiles = subdomains.map(s => 
      `https://t${s}.tianditu.gov.cn/${annoLayer}_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${annoLayer}&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${tiandituKey}`
    );

    // 初始化 MapLibre GL 地图 (正射视角 Orthographic Perspective: pitch 0, bearing 0)
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          'tianditu-base': {
            type: 'raster',
            tiles: baseTiles,
            tileSize: 256,
            attribution: '© 天地图 GS(2024)0000号 | 河南省疾病预防控制中心'
          },
          'tianditu-anno': {
            type: 'raster',
            tiles: annoTiles,
            tileSize: 256
          }
        },
        layers: [
          {
            id: 'tianditu-base-layer',
            type: 'raster',
            source: 'tianditu-base',
            minzoom: 0,
            maxzoom: 18,
            paint: {
              'raster-saturation': isDark ? (mapLayerType === 'vec' ? -0.7 : -0.2) : 0.05,
              'raster-contrast': isDark ? 0.25 : 0.05,
              'raster-brightness-min': isDark ? 0.15 : 0,
              'raster-brightness-max': isDark ? 0.75 : 1.0,
              'raster-opacity': isDark ? 0.88 : 0.98
            }
          },
          {
            id: 'tianditu-anno-layer',
            type: 'raster',
            source: 'tianditu-anno',
            minzoom: 0,
            maxzoom: 18,
            paint: {
              'raster-opacity': 0.95
            }
          }
        ]
      },
      center: [113.6253, 34.2466], // 河南地理中心
      zoom: 6.8,
      pitch: 0, // 正射俯视视角 (0度倾角)
      bearing: 0, // 正北朝向 (0度旋转)
      maxPitch: 0, // 锁定正射视角
      dragRotate: false, // 禁用鼠标右键拖拽倾斜旋转，保持标准正射地图
      touchPitch: false
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false, showZoom: true }), 'top-right');
    mapRef.current = map;

    map.on('load', () => {
      // 渲染地级市行政标记点
      Object.values(HENAN_CITIES_GEO).forEach((city) => {
        const el = document.createElement('div');
        el.className = 'city-map-badge cursor-pointer px-2 py-1 bg-white/90 dark:bg-slate-900/90 text-sky-700 dark:text-sky-400 text-xs font-semibold rounded-md border border-sky-300 dark:border-sky-500/30 shadow-md hover:bg-sky-600 hover:text-white transition-all flex items-center gap-1';
        el.innerHTML = `<span>🏙️</span><span>${city.name}</span>`;
        el.onclick = () => {
          map.flyTo({ center: city.center, zoom: 9.5, pitch: 0, bearing: 0, duration: 1000 });
          setCurrentViewCity(city.name);
          if (onSelectCity) onSelectCity(city.name);
        };

        new maplibregl.Marker({ element: el })
          .setLngLat(city.center)
          .addTo(map);
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [isDark, mapLayerType]);

  // 渲染预警点位标记
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // 清除旧 marker
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    alerts.forEach(alert => {
      const el = document.createElement('div');
      const colorClass = alert.level === 'red' 
        ? 'bg-red-600 border-red-300 animate-pulse text-white' 
        : (alert.level === 'orange' ? 'bg-orange-500 border-orange-300 text-white' : 'bg-amber-400 border-amber-200 text-slate-900');
      
      el.className = `w-7 h-7 rounded-full border-2 flex items-center justify-center font-bold text-xs shadow-xl cursor-pointer transform hover:scale-125 transition-transform ${colorClass}`;
      el.innerHTML = alert.level === 'red' ? '!' : (alert.level === 'orange' ? '▲' : '●');
      el.title = `${alert.title} (捕获密度: ${alert.currentDensity})`;

      el.onclick = () => {
        setSelectedAlert(alert);
        map.flyTo({ center: [alert.longitude, alert.latitude], zoom: 11, pitch: 0, bearing: 0, duration: 800 });
      };

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([alert.longitude, alert.latitude])
        .addTo(map);

      markersRef.current.push(marker);
    });
  }, [alerts]);

  const resetView = () => {
    if (mapRef.current) {
      mapRef.current.flyTo({ center: [113.6253, 34.2466], zoom: 6.8, pitch: 0, bearing: 0, duration: 1000 });
      setCurrentViewCity('全省全景');
    }
  };

  return (
    <div className="relative w-full h-[520px] rounded-xl overflow-hidden border border-slate-200 dark:border-sky-500/20 bg-slate-100 dark:bg-slate-950 shadow-sm dark:shadow-2xl flex flex-col transition-colors">
      {/* 顶部控制栏 */}
      <div className="absolute top-3 left-3 z-10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-4 py-2 rounded-lg border border-slate-200 dark:border-sky-500/30 flex items-center gap-3 text-sm shadow-md">
        <div className="flex items-center gap-2 text-sky-600 dark:text-sky-400 font-semibold">
          <MapPin className="w-4 h-4 text-sky-600 dark:text-cyan-400 animate-bounce" />
          <span>{title}</span>
        </div>
        <span className="text-slate-400 dark:text-slate-500">|</span>
        <span className="text-xs text-slate-600 dark:text-slate-300">当前视角: <span className="text-sky-600 dark:text-sky-300 font-mono font-medium">{currentViewCity}</span></span>
        
        {/* 正射视角与底图标示 */}
        <span className="text-slate-400 dark:text-slate-500">|</span>
        <div className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 font-medium">
          <Compass className="w-3 h-3" />
          <span>正射视角 (2D 垂直俯视)</span>
        </div>

        {/* 底图切换器: 天地图矢量 vs 天地图影像 */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded p-0.5 border border-slate-300 dark:border-slate-700 text-xs">
          <button
            onClick={() => setMapLayerType('vec')}
            className={`px-2 py-0.5 rounded font-medium transition-colors ${
              mapLayerType === 'vec'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            天地图矢量
          </button>
          <button
            onClick={() => setMapLayerType('img')}
            className={`px-2 py-0.5 rounded font-medium transition-colors ${
              mapLayerType === 'img'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            天地图影像
          </button>
        </div>

        <button
          onClick={resetView}
          className="ml-1 px-2.5 py-1 rounded bg-sky-50 hover:bg-sky-100 dark:bg-sky-500/20 dark:hover:bg-sky-500/30 text-sky-700 dark:text-sky-300 text-xs flex items-center gap-1 border border-sky-300 dark:border-sky-500/40 transition-colors font-medium"
        >
          <RotateCcw className="w-3 h-3" /> 重置全景
        </button>
      </div>

      {/* 图例 */}
      <div className="absolute bottom-4 left-4 z-10 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700/60 text-xs text-slate-700 dark:text-slate-300 shadow-lg flex flex-col gap-1.5">
        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5">风险预警图例</span>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-600 border border-red-300 animate-ping inline-block"></span>
          <span className="text-red-600 dark:text-red-400 font-medium">严重预警 (一级) ≥80只</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-orange-500 border border-orange-300 inline-block"></span>
          <span className="text-orange-600 dark:text-orange-400 font-medium">较重预警 (二级) 50~79只</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-amber-400 border border-amber-200 inline-block"></span>
          <span className="text-amber-600 dark:text-amber-300 font-medium">一般预警 (三级) 30~49只</span>
        </div>
      </div>

      {/* 地图渲染 DOM */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* 预警点详情弹窗浮层 */}
      {selectedAlert && (
        <div className="absolute top-14 right-3 z-10 w-80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-xl border border-slate-200 dark:border-sky-500/40 p-4 shadow-2xl text-slate-800 dark:text-slate-200 text-xs animate-in fade-in slide-in-from-right-4 duration-300">
          <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-700 pb-2 mb-2">
            <div>
              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase mb-1 ${
                selectedAlert.level === 'red' ? 'bg-red-50 text-red-600 border border-red-200 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/40' : (
                  selectedAlert.level === 'orange' ? 'bg-orange-50 text-orange-600 border border-orange-200 dark:bg-orange-500/20 dark:text-orange-400 dark:border-orange-500/40' : 'bg-yellow-50 text-yellow-700 border border-yellow-200 dark:bg-yellow-500/20 dark:text-yellow-300 dark:border-yellow-500/40'
                )
              }`}>
                {selectedAlert.levelName}
              </span>
              <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">{selectedAlert.title}</h4>
            </div>
            <button 
              onClick={() => setSelectedAlert(null)}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1"
            >
              ✕
            </button>
          </div>

          <div className="space-y-1.5 text-slate-700 dark:text-slate-300">
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">所属辖区:</span>
              <span className="font-medium text-slate-900 dark:text-slate-100">{selectedAlert.city} · {selectedAlert.district}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">实测密度:</span>
              <span className="font-mono font-bold text-rose-600 dark:text-rose-400">{selectedAlert.currentDensity} 只/台次</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">基线阈值:</span>
              <span className="font-mono text-slate-700 dark:text-slate-300">{selectedAlert.threshold} 只</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">预估影响人口:</span>
              <span className="font-mono text-amber-600 dark:text-amber-300 font-semibold">{selectedAlert.affectedPopulationEstimate.toLocaleString()} 人</span>
            </div>
            <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <span className="text-slate-500 dark:text-slate-400 font-semibold block mb-1">处置建议:</span>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-950/60 p-2 rounded border border-slate-200 dark:border-slate-800">
                {selectedAlert.recommendedAction}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
