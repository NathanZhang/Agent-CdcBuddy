'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { HENAN_CITIES_GEO, HENAN_BORDER_GEOJSON } from '@/lib/geo/henan-geojson';
import { useTheme } from '@/lib/theme/theme-context';
import { MapPin, Layers, Eye, EyeOff, Navigation, Flame, Radio, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface SatScanClusterItem {
  cluster_id: string;
  cluster_type: string;
  center_city: string;
  center_district: string;
  center_coord: [number, number]; // [lon, lat]
  radius_km: number;
  observed_count: number;
  expected_count: number;
  log_likelihood_ratio: number;
  relative_risk: number;
  p_value: number;
  is_statistically_significant: boolean;
  affected_cities: string[];
  affected_districts: string[];
  member_locations?: Array<{
    city: string;
    district: string;
    lat: number;
    lon: number;
    observed: number;
    temp?: number;
    humidity?: number;
  }>;
}

interface SatScanSpatialGISMapProps {
  clusters: SatScanClusterItem[];
  selectedCity?: string;
  onSelectCluster?: (cluster: SatScanClusterItem) => void;
  category?: string;
}

export const SatScanSpatialGISMap: React.FC<SatScanSpatialGISMapProps> = ({
  clusters = [],
  selectedCity,
  onSelectCluster,
  category = '蚊'
}) => {
  const { isDark } = useTheme();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  const [activeCluster, setActiveCluster] = useState<SatScanClusterItem | null>(clusters[0] || null);
  const [showRadiusCircles, setShowRadiusCircles] = useState<boolean>(true);
  const [showStations, setShowStations] = useState<boolean>(true);
  const [useMapLibre, setUseMapLibre] = useState<boolean>(true);
  const [mapError, setMapError] = useState<boolean>(false);

  const tiandituKey = process.env.NEXT_PUBLIC_TIANDITU_KEY || '45052613ad935c678a6a702faf0511b1';

  // 监听外部选中的城市联动聚焦
  useEffect(() => {
    if (selectedCity && clusters.length > 0) {
      const match = clusters.find(c => c.center_city === selectedCity || c.affected_cities?.includes(selectedCity));
      if (match) {
        setActiveCluster(match);
      }
    }
  }, [selectedCity, clusters]);

  // 构造圆形扫描区域的多边形 GeoJSON (将中心经纬度与半径转换为 64 边形多边形)
  const createCircleGeoJSON = (center: [number, number], radiusKm: number, points = 64) => {
    const coords: number[][] = [];
    const [lon, lat] = center;
    const distanceX = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));
    const distanceY = radiusKm / 110.574;

    for (let i = 0; i <= points; i++) {
      const theta = (i / points) * (2 * Math.PI);
      const x = distanceX * Math.cos(theta);
      const y = distanceY * Math.sin(theta);
      coords.push([lon + x, lat + y]);
    }
    return coords;
  };

  const clustersGeoJSON = useMemo(() => {
    const features: any[] = [];

    clusters.forEach((c, idx) => {
      if (!c.center_coord || c.center_coord.length < 2) return;
      const circleCoords = createCircleGeoJSON(c.center_coord, Math.max(c.radius_km || 15, 12));
      features.push({
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [circleCoords]
        },
        properties: {
          cluster_id: c.cluster_id,
          cluster_type: c.cluster_type,
          city: c.center_city,
          district: c.center_district,
          llr: c.log_likelihood_ratio,
          rr: c.relative_risk,
          p_value: c.p_value,
          is_primary: idx === 0
        }
      });
    });

    return {
      type: 'FeatureCollection' as const,
      features
    };
  }, [clusters]);

  // 初始化 MapLibreGL 地图
  useEffect(() => {
    if (!mapContainerRef.current) return;

    try {
      // 销毁旧实例
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      // 清空旧 marker
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];

      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: {
          version: 8,
          sources: {
            'tianditu-vec': {
              type: 'raster',
              tiles: [
                `https://t0.tianditu.gov.cn/vec_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=vec&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${tiandituKey}`
              ],
              tileSize: 256
            },
            'tianditu-cva': {
              type: 'raster',
              tiles: [
                `https://t0.tianditu.gov.cn/cva_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cva&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${tiandituKey}`
              ],
              tileSize: 256
            },
            'henan-border-source': {
              type: 'geojson',
              data: HENAN_BORDER_GEOJSON as any
            }
          },
          layers: [
            {
              id: 'tianditu-vec-layer',
              type: 'raster',
              source: 'tianditu-vec',
              minzoom: 0,
              maxzoom: 18
            },
            {
              id: 'henan-border-fill-layer',
              type: 'fill',
              source: 'henan-border-source',
              minzoom: 0,
              maxzoom: 9.5, // 放大到城市区县内时自动隐藏
              paint: {
                'fill-color': isDark ? '#38bdf8' : '#0284c7',
                'fill-opacity': isDark ? 0.06 : 0.04
              }
            },
            {
              id: 'henan-border-line-layer',
              type: 'line',
              source: 'henan-border-source',
              minzoom: 0,
              maxzoom: 9.5, // 放大到城市区县内时自动隐藏
              paint: {
                'line-color': isDark ? '#38bdf8' : '#0284c7',
                'line-width': 1.2,
                'line-opacity': isDark ? 0.55 : 0.45
              }
            },
            {
              id: 'tianditu-cva-layer',
              type: 'raster',
              source: 'tianditu-cva',
              minzoom: 0,
              maxzoom: 18
            }
          ]
        },
        center: [113.62, 34.2],
        zoom: 6.8,
        minZoom: 5.5,
        maxZoom: 14,
        attributionControl: false
      });

      map.on('error', () => {
        setMapError(true);
      });

      map.on('load', () => {
        // 添加 SaTScan 扫描聚集区 GeoJSON 多边形图层
        map.addSource('satscan-clusters-source', {
          type: 'geojson',
          data: clustersGeoJSON
        });

        // 填充面图层
        map.addLayer({
          id: 'satscan-clusters-fill',
          type: 'fill',
          source: 'satscan-clusters-source',
          paint: {
            'fill-color': [
              'case',
              ['get', 'is_primary'],
              '#ef4444',
              '#f59e0b'
            ],
            'fill-opacity': 0.22
          }
        });

        // 描边图层
        map.addLayer({
          id: 'satscan-clusters-line',
          type: 'line',
          source: 'satscan-clusters-source',
          paint: {
            'line-color': [
              'case',
              ['get', 'is_primary'],
              '#dc2626',
              '#d97706'
            ],
            'line-width': 2.5,
            'line-dasharray': [2, 2]
          }
        });

        // 添加聚类中心与测站 Marker
        clusters.forEach((c, idx) => {
          if (!c.center_coord) return;
          const isPrimary = idx === 0;

          const el = document.createElement('div');
          el.className = 'cursor-pointer transform hover:scale-110 transition-transform';
          el.innerHTML = `
            <div class="relative flex items-center justify-center">
              <div class="absolute w-8 h-8 rounded-full ${isPrimary ? 'bg-rose-500/30' : 'bg-amber-500/30'} animate-ping"></div>
              <div class="w-7 h-7 rounded-full ${isPrimary ? 'bg-rose-600 border-2 border-white' : 'bg-amber-500 border-2 border-white'} shadow-lg flex items-center justify-center text-white text-[10px] font-bold">
                ${isPrimary ? '★' : idx + 1}
              </div>
              <div class="absolute -bottom-5 bg-slate-900/90 text-white text-[10px] px-1.5 py-0.5 rounded shadow whitespace-nowrap font-medium border border-slate-700">
                ${c.center_city} (LLR:${Math.round(c.log_likelihood_ratio)})
              </div>
            </div>
          `;

          el.onclick = () => {
            setActiveCluster(c);
            if (onSelectCluster) onSelectCluster(c);
            map.flyTo({ center: c.center_coord, zoom: 8.5, duration: 1000 });
          };

          const marker = new maplibregl.Marker({ element: el })
            .setLngLat(c.center_coord)
            .addTo(map);

          markersRef.current.push(marker);

          // 添加窗内采样点小 Marker
          if (c.member_locations && showStations) {
            c.member_locations.forEach((loc) => {
              const dotEl = document.createElement('div');
              dotEl.className = `w-2 h-2 rounded-full ${isPrimary ? 'bg-rose-500' : 'bg-amber-400'} border border-white shadow-sm`;
              const dotMarker = new maplibregl.Marker({ element: dotEl })
                .setLngLat([loc.lon, loc.lat])
                .addTo(map);
              markersRef.current.push(dotMarker);
            });
          }
        });
      });

      mapRef.current = map;
    } catch {
      setUseMapLibre(false);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [clustersGeoJSON, clusters, tiandituKey, showStations]);

  // 控制飞向全省或特定聚集区
  const handleFlyTo = (coord: [number, number], zoom = 8.5) => {
    if (mapRef.current) {
      mapRef.current.flyTo({ center: coord, zoom, duration: 1000 });
    }
  };

  const handleResetView = () => {
    if (mapRef.current) {
      mapRef.current.flyTo({ center: [113.62, 34.2], zoom: 6.8, duration: 1000 });
    }
  };

  return (
    <div className="w-full bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm flex flex-col space-y-0 transition-colors">
      {/* GIS 头部控制栏 */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-slate-50 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 text-xs">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
            <Navigation className="w-4 h-4" />
          </div>
          <span className="font-bold text-slate-800 dark:text-slate-200">
            SaTScan 空间泊松扫描聚集热点与扫描半径分布 (GIS Map)
          </span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            共扫描识别 {clusters.length} 个聚集簇
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowStations(!showStations)}
            className={`px-2 py-1 rounded text-[11px] font-medium border transition-all flex items-center gap-1 ${
              showStations
                ? 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/20 dark:text-sky-300 dark:border-sky-500/30'
                : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
            }`}
          >
            {showStations ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            <span>监测点位</span>
          </button>
          <button
            onClick={handleResetView}
            className="px-2.5 py-1 rounded text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 flex items-center gap-1 transition-all"
          >
            <RotateCcw className="w-3 h-3" />
            <span>全省复位</span>
          </button>
        </div>
      </div>

      {/* 地图主体区域 */}
      <div className="relative w-full h-72 md:h-80 bg-slate-100 dark:bg-slate-950">
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* 悬浮在地图上的聚集区交互卡片 */}
        {activeCluster && (
          <div className="absolute top-3 left-3 z-10 max-w-xs bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg text-xs space-y-1.5 animate-fade-in">
            <div className="flex items-center justify-between">
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                activeCluster.is_statistically_significant
                  ? 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/30'
                  : 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30'
              }`}>
                {activeCluster.cluster_type}
              </span>
              <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                p = {activeCluster.p_value}
              </span>
            </div>
            <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-rose-500" />
              {activeCluster.center_city} · {activeCluster.center_district}
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/80 p-2 rounded-lg">
              <div>扫描半径: <b>{activeCluster.radius_km} km</b></div>
              <div>相对危险度 RR: <b className="text-rose-600 dark:text-rose-400">{activeCluster.relative_risk}</b></div>
              <div>似然比 LLR: <b className="text-sky-600 dark:text-sky-400">{activeCluster.log_likelihood_ratio}</b></div>
              <div>观测数: <b>{activeCluster.observed_count}</b></div>
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400">
              波及范围: {activeCluster.affected_districts?.join(', ')}
            </div>
          </div>
        )}

        {/* 右下角图例 */}
        <div className="absolute bottom-3 right-3 z-10 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 shadow text-[10px] text-slate-700 dark:text-slate-300 space-y-1">
          <div className="flex items-center gap-1.5 font-bold mb-1">
            <Layers className="w-3 h-3 text-indigo-500" />
            <span>SaTScan 空间图例</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 border border-white"></span>
            <span>一类核心聚集区 (Primary Cluster)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 border border-white"></span>
            <span>二类次级聚集区 (Secondary Cluster)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-400"></span>
            <span>高危病媒现场监测点位</span>
          </div>
        </div>
      </div>

      {/* 底部聚集区快速切换条 */}
      <div className="p-2.5 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2 overflow-x-auto text-xs">
        <span className="text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap font-medium">聚焦高危簇:</span>
        {clusters.map((c, i) => (
          <button
            key={c.cluster_id || i}
            onClick={() => {
              setActiveCluster(c);
              if (onSelectCluster) onSelectCluster(c);
              handleFlyTo(c.center_coord, 8.5);
            }}
            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap transition-all flex items-center gap-1 ${
              activeCluster?.cluster_id === c.cluster_id
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-rose-400'
            }`}
          >
            <MapPin className="w-3 h-3" />
            <span>{c.center_city} ({c.center_district})</span>
            <span className="text-[10px] opacity-80">RR:{c.relative_risk}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
