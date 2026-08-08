'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { HENAN_CITIES_GEO } from '@/lib/geo/henan-geojson';
import { EarlyWarningAlertItem } from '@/lib/db/data-provider';
import { useTheme } from '@/lib/theme/theme-context';
import { MapPin, RotateCcw, Flame, AlertTriangle, Eye, EyeOff, Navigation, Layers, CheckCircle2 } from 'lucide-react';

export interface SpatialGridPoint {
  lat: number;
  lon: number;
  density: number;
}

export interface MonitoringStationPoint {
  id?: string;
  city?: string;
  district?: string;
  street?: string;
  lat: number;
  lon: number;
  density: number;
  species?: string;
  weatherTemp?: number;
  weatherHumidity?: number;
  date?: string;
}

interface VectorMapProps {
  alerts?: EarlyWarningAlertItem[];
  spatialGrid?: SpatialGridPoint[];
  monitoringPoints?: MonitoringStationPoint[];
  selectedCity?: string;
  selectedDistrict?: string;
  category?: string;
  onSelectCity?: (city: string) => void;
  onSelectDistrict?: (district: string) => void;
  title?: string;
}

export const VectorMapComponent: React.FC<VectorMapProps> = ({
  alerts = [],
  spatialGrid = [],
  monitoringPoints = [],
  selectedCity,
  selectedDistrict,
  category = '蚊',
  onSelectCity,
  onSelectDistrict,
  title = '河南省病媒生物监测与时空风险地图'
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const cityMarkersRef = useRef<maplibregl.Marker[]>([]);
  const alertMarkersRef = useRef<maplibregl.Marker[]>([]);
  const districtMarkersRef = useRef<maplibregl.Marker[]>([]);
  
  const [selectedAlert, setSelectedAlert] = useState<EarlyWarningAlertItem | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<MonitoringStationPoint | null>(null);
  
  const [currentViewCity, setCurrentViewCity] = useState<string>(selectedCity || '全省全景');
  const [currentViewDistrict, setCurrentViewDistrict] = useState<string | undefined>(selectedDistrict);
  const [mapLayerType, setMapLayerType] = useState<'vec' | 'img'>('vec'); // vec: 天地图矢量, img: 天地图影像
  const [showHeatmap, setShowHeatmap] = useState<boolean>(true);
  const [showAlertPins, setShowAlertPins] = useState<boolean>(true);
  const [showStations, setShowStations] = useState<boolean>(true);
  const { isDark } = useTheme();

  const tiandituKey = process.env.NEXT_PUBLIC_TIANDITU_KEY || '45052613ad935c678a6a702faf0511b1';

  // 构造热力图 GeoJSON FeatureCollection
  const heatmapGeoJSON = useMemo(() => {
    const features: any[] = [];

    // 1. 如果有传入的插值空间网格数据
    if (spatialGrid && spatialGrid.length > 0) {
      spatialGrid.forEach(pt => {
        features.push({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [pt.lon, pt.lat]
          },
          properties: {
            density: Number(pt.density) || 0
          }
        });
      });
    }

    // 2. 如果有具体监测点位
    if (monitoringPoints && monitoringPoints.length > 0) {
      monitoringPoints.forEach(pt => {
        features.push({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [pt.lon, pt.lat]
          },
          properties: {
            density: Number(pt.density) || 0
          }
        });
      });
    }

    // 3. 预警点位作为高权重点
    if (alerts && alerts.length > 0) {
      alerts.forEach(a => {
        features.push({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [a.longitude, a.latitude]
          },
          properties: {
            density: Number(a.currentDensity) || 80
          }
        });
      });
    }

    // 4. 兜底平滑网格（若为空时自动基于河南省核心监测带生成）
    if (features.length === 0) {
      const basePoints = [
        { lon: 113.6627, lat: 34.8003, density: 86 },
        { lon: 113.6788, lat: 34.7538, density: 82 },
        { lon: 113.6732, lat: 34.7865, density: 72 },
        { lon: 113.6396, lat: 34.7233, density: 58 },
        { lon: 113.6062, lat: 34.7523, density: 62 },
        { lon: 113.6820, lat: 34.8120, density: 64 },
        { lon: 113.6920, lat: 34.7380, density: 68 },
        { lon: 113.6650, lat: 34.7450, density: 55 },
        { lon: 112.4540, lat: 34.6197, density: 54 },
        { lon: 112.4640, lat: 34.6190, density: 48 },
        { lon: 114.3580, lat: 35.9220, density: 76 },
        { lon: 114.3924, lat: 36.0976, density: 52 },
        { lon: 114.0750, lat: 32.1280, density: 68 },
        { lon: 114.0913, lat: 32.1470, density: 56 },
        { lon: 113.9268, lat: 35.3030, density: 46 },
        { lon: 114.0260, lat: 33.5760, density: 59 }
      ];

      basePoints.forEach(bp => {
        for (let dx = -0.04; dx <= 0.04; dx += 0.02) {
          for (let dy = -0.04; dy <= 0.04; dy += 0.02) {
            const dist = Math.sqrt(dx * dx + dy * dy);
            const factor = Math.max(0.2, 1 - dist * 15);
            features.push({
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [bp.lon + dx, bp.lat + dy]
              },
              properties: {
                density: Math.round(bp.density * factor)
              }
            });
          }
        }
      });
    }

    return {
      type: 'FeatureCollection',
      features
    };
  }, [spatialGrid, monitoringPoints, alerts]);

  // 构造站点 GeoJSON
  const stationsGeoJSON = useMemo(() => {
    const pts = monitoringPoints.length > 0 ? monitoringPoints : alerts.map(a => ({
      id: a.alertId,
      city: a.city,
      district: a.district,
      street: a.street,
      lat: a.latitude,
      lon: a.longitude,
      density: a.currentDensity,
      species: a.category
    }));

    return {
      type: 'FeatureCollection',
      features: pts.map(p => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [p.lon, p.lat]
        },
        properties: {
          id: p.id || '',
          city: p.city || '',
          district: p.district || '',
          street: p.street || '',
          density: Number(p.density) || 0,
          species: p.species || '白纹伊蚊'
        }
      }))
    };
  }, [monitoringPoints, alerts]);

  // 初始化地图
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const subdomains = ['0', '1', '2', '3', '4', '5', '6', '7'];
    
    const baseTiles = subdomains.map(s => 
      `https://t${s}.tianditu.gov.cn/${mapLayerType}_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${mapLayerType}&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${tiandituKey}`
    );

    const annoLayer = mapLayerType === 'vec' ? 'cva' : 'cia';
    const annoTiles = subdomains.map(s => 
      `https://t${s}.tianditu.gov.cn/${annoLayer}_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${annoLayer}&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${tiandituKey}`
    );

    let initCenter: [number, number] = [113.6253, 34.2466];
    let initZoom = 6.8;

    if (selectedCity && selectedCity !== '全省全景' && HENAN_CITIES_GEO[selectedCity]) {
      initCenter = HENAN_CITIES_GEO[selectedCity].center;
      initZoom = 9.5;
    }
    if (selectedDistrict && (selectedDistrict.includes('金水') || selectedDistrict.includes('管城'))) {
      initCenter = [113.6710, 34.7780];
      initZoom = 11.2;
    } else if (alerts.length > 0 && selectedCity && selectedCity !== '全省全景') {
      initCenter = [alerts[0].longitude, alerts[0].latitude];
      initZoom = 11.0;
    }

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          'tianditu-base': {
            type: 'raster',
            tiles: baseTiles,
            tileSize: 256,
            attribution: '© 天地图 GS(2024)0000号 | 河南省疾控中心'
          },
          'tianditu-anno': {
            type: 'raster',
            tiles: annoTiles,
            tileSize: 256
          },
          'vector-heatmap-source': {
            type: 'geojson',
            data: heatmapGeoJSON as any
          },
          'monitoring-stations-source': {
            type: 'geojson',
            data: stationsGeoJSON as any
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
            id: 'vector-heatmap-layer',
            type: 'heatmap',
            source: 'vector-heatmap-source',
            minzoom: 0,
            maxzoom: 17,
            paint: {
              'heatmap-weight': [
                'interpolate',
                ['linear'],
                ['get', 'density'],
                0, 0,
                20, 0.2,
                40, 0.5,
                60, 0.8,
                80, 1.2,
                120, 2.0
              ],
              'heatmap-intensity': [
                'interpolate',
                ['linear'],
                ['zoom'],
                5, 0.7,
                8, 1.1,
                11, 1.8,
                14, 2.8
              ],
              'heatmap-color': [
                'interpolate',
                ['linear'],
                ['heatmap-density'],
                0, 'rgba(0, 0, 0, 0)',
                0.15, 'rgba(0, 210, 255, 0.55)',
                0.35, 'rgba(34, 197, 94, 0.72)',
                0.55, 'rgba(234, 179, 8, 0.86)',
                0.75, 'rgba(249, 115, 22, 0.94)',
                1.0, 'rgba(239, 68, 68, 0.98)'
              ],
              'heatmap-radius': [
                'interpolate',
                ['linear'],
                ['zoom'],
                5, 18,
                8, 28,
                11, 45,
                14, 75
              ],
              'heatmap-opacity': 0.82
            }
          },
          {
            id: 'monitoring-station-circles',
            type: 'circle',
            source: 'monitoring-stations-source',
            minzoom: 9.5,
            paint: {
              'circle-radius': [
                'interpolate',
                ['linear'],
                ['zoom'],
                9.5, 4,
                12, 7,
                15, 11
              ],
              'circle-color': [
                'step',
                ['get', 'density'],
                '#22c55e',
                30, '#eab308',
                50, '#f97316',
                80, '#ef4444'
              ],
              'circle-stroke-width': 1.5,
              'circle-stroke-color': '#ffffff',
              'circle-opacity': 0.85
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
      center: initCenter,
      zoom: initZoom,
      pitch: 0,
      bearing: 0,
      maxPitch: 0,
      dragRotate: false,
      touchPitch: false
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false, showZoom: true }), 'bottom-right');
    mapRef.current = map;

    map.on('load', () => {
      // 渲染地级市行政标记点
      cityMarkersRef.current.forEach(m => m.remove());
      cityMarkersRef.current = [];

      Object.values(HENAN_CITIES_GEO).forEach((city) => {
        const el = document.createElement('div');
        el.className = 'city-map-badge cursor-pointer px-2 py-0.5 bg-slate-900/90 text-sky-300 text-[11px] font-semibold rounded border border-sky-500/30 shadow-md hover:bg-sky-600 hover:text-white transition-all flex items-center gap-1 backdrop-blur-xs';
        el.innerHTML = `<span>🏙️</span><span>${city.name}</span>`;
        el.onclick = () => {
          map.flyTo({ center: city.center, zoom: 9.8, pitch: 0, bearing: 0, duration: 900 });
          setCurrentViewCity(city.name);
          setCurrentViewDistrict(undefined);
          if (onSelectCity) onSelectCity(city.name);
        };

        const m = new maplibregl.Marker({ element: el })
          .setLngLat(city.center)
          .addTo(map);
        cityMarkersRef.current.push(m);
      });
    });

    map.on('click', 'monitoring-station-circles', (e) => {
      if (!e.features || e.features.length === 0) return;
      const f = e.features[0];
      const props = f.properties;
      setSelectedPoint({
        id: props?.id,
        city: props?.city,
        district: props?.district,
        street: props?.street,
        lat: (f.geometry as any).coordinates[1],
        lon: (f.geometry as any).coordinates[0],
        density: props?.density,
        species: props?.species
      });
    });

    map.on('mouseenter', 'monitoring-station-circles', () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'monitoring-station-circles', () => {
      map.getCanvas().style.cursor = '';
    });

    const resizeObserver = new ResizeObserver(() => {
      map.resize();
    });
    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, [isDark, mapLayerType]);

  // 更新热力图与站点 GeoJSON 数据
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const heatSource = map.getSource('vector-heatmap-source') as maplibregl.GeoJSONSource;
    if (heatSource) {
      heatSource.setData(heatmapGeoJSON as any);
    }

    const stationSource = map.getSource('monitoring-stations-source') as maplibregl.GeoJSONSource;
    if (stationSource) {
      stationSource.setData(stationsGeoJSON as any);
    }
  }, [heatmapGeoJSON, stationsGeoJSON]);

  // 动态控制图层显隐
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    if (map.getLayer('vector-heatmap-layer')) {
      map.setLayoutProperty('vector-heatmap-layer', 'visibility', showHeatmap ? 'visible' : 'none');
    }
    if (map.getLayer('monitoring-station-circles')) {
      map.setLayoutProperty('monitoring-station-circles', 'visibility', showStations ? 'visible' : 'none');
    }
  }, [showHeatmap, showStations]);

  // 仅在选中具体城市时渲染区县标记点（避免全省全景时在省中心扎堆遮挡）
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    districtMarkersRef.current.forEach(m => m.remove());
    districtMarkersRef.current = [];

    // 全省全景状态下不显示区县 pin，防止扎堆
    if (currentViewCity === '全省全景' || currentViewCity === '河南省全域') {
      return;
    }

    const currentCityGeo = HENAN_CITIES_GEO[currentViewCity];
    if (currentCityGeo && currentCityGeo.districts) {
      currentCityGeo.districts.forEach(dist => {
        const isHighlighted = currentViewDistrict && (
          currentViewDistrict.includes(dist.name) || 
          dist.name.includes(currentViewDistrict.replace('区', ''))
        );

        const el = document.createElement('div');
        el.className = `cursor-pointer px-2 py-0.5 rounded text-[10px] font-bold shadow-lg transition-all flex items-center gap-0.5 border ${
          isHighlighted 
            ? 'bg-rose-600 text-white border-rose-300 ring-2 ring-rose-400 scale-105 animate-bounce' 
            : 'bg-slate-900/90 text-slate-200 border-slate-700 hover:bg-sky-500 hover:text-white'
        }`;
        el.innerHTML = `<span>📍</span><span>${dist.name}</span>`;
        el.onclick = () => {
          map.flyTo({ center: dist.center, zoom: 12.2, pitch: 0, bearing: 0, duration: 800 });
          setCurrentViewDistrict(dist.name);
          if (onSelectDistrict) onSelectDistrict(dist.name);
        };

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat(dist.center)
          .addTo(map);

        districtMarkersRef.current.push(marker);
      });
    }
  }, [currentViewCity, currentViewDistrict]);

  // 渲染预警点位标记 Pins
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    alertMarkersRef.current.forEach(m => m.remove());
    alertMarkersRef.current = [];

    if (!showAlertPins) return;

    alerts.forEach(alert => {
      const el = document.createElement('div');
      const colorClass = alert.level === 'red' 
        ? 'bg-red-600 border-red-200 text-white ring-4 ring-red-500/40 shadow-red-500/50' 
        : (alert.level === 'orange' ? 'bg-orange-500 border-orange-200 text-white ring-4 ring-orange-400/40' : 'bg-amber-400 border-amber-200 text-slate-900 ring-4 ring-amber-300/40');
      
      el.className = `w-7 h-7 rounded-full border-2 flex items-center justify-center font-black text-xs shadow-2xl cursor-pointer transform hover:scale-130 transition-transform ${colorClass} animate-pulse`;
      el.innerHTML = alert.level === 'red' ? '!' : (alert.level === 'orange' ? '▲' : '●');
      el.title = `${alert.title} (实测密度: ${alert.currentDensity} 只/台次)`;

      el.onclick = () => {
        setSelectedAlert(alert);
        setSelectedPoint(null);
        map.flyTo({ center: [alert.longitude, alert.latitude], zoom: 12.5, pitch: 0, bearing: 0, duration: 800 });
      };

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([alert.longitude, alert.latitude])
        .addTo(map);

      alertMarkersRef.current.push(marker);
    });
  }, [alerts, showAlertPins]);

  // 当外部传入城市或区县变更时，自动平滑漫游镜头
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (selectedCity && selectedCity !== '全省全景' && selectedCity !== '河南省全域' && HENAN_CITIES_GEO[selectedCity]) {
      setCurrentViewCity(selectedCity);
      if (selectedDistrict) {
        setCurrentViewDistrict(selectedDistrict);
        const cityData = HENAN_CITIES_GEO[selectedCity];
        const targetDist = cityData.districts?.find(d => 
          selectedDistrict.includes(d.name) || d.name.includes(selectedDistrict.replace('区', ''))
        );
        if (targetDist) {
          map.flyTo({ center: targetDist.center, zoom: 12.0, duration: 1000 });
          return;
        }
      }
      map.flyTo({ center: HENAN_CITIES_GEO[selectedCity].center, zoom: 10.0, duration: 1000 });
    }
  }, [selectedCity, selectedDistrict]);

  const resetView = () => {
    if (mapRef.current) {
      mapRef.current.flyTo({ center: [113.6253, 34.2466], zoom: 6.8, pitch: 0, bearing: 0, duration: 1000 });
      setCurrentViewCity('全省全景');
      setCurrentViewDistrict(undefined);
    }
  };

  const drillDownDistrict = (distName: string, center: [number, number]) => {
    if (mapRef.current) {
      mapRef.current.flyTo({ center, zoom: 12.2, pitch: 0, bearing: 0, duration: 800 });
      setCurrentViewDistrict(distName);
      if (onSelectDistrict) onSelectDistrict(distName);
    }
  };

  const currentCityGeo = currentViewCity !== '全省全景' && currentViewCity !== '河南省全域' 
    ? HENAN_CITIES_GEO[currentViewCity] 
    : null;

  return (
    <div className="relative w-full h-full min-h-[440px] rounded-xl overflow-hidden border border-slate-200 dark:border-sky-500/20 bg-slate-100 dark:bg-slate-950 shadow-sm dark:shadow-2xl flex flex-col transition-colors">
      
      {/* 顶部自适应结构化工具条容器 (垂直 Flex，彻底解决换行遮挡) */}
      <div className="absolute top-2.5 left-2.5 right-2.5 z-20 flex flex-col gap-2 pointer-events-none">
        
        {/* 第一行：主功能状态与操作栏 */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          
          {/* 左侧：标题与视角胶囊 */}
          <div className="pointer-events-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-200 dark:border-sky-500/30 flex items-center gap-2 text-xs shadow-md">
            <div className="flex items-center gap-1.5 text-sky-600 dark:text-sky-400 font-bold">
              <Flame className="w-4 h-4 text-rose-500 animate-pulse" />
              <span className="text-slate-900 dark:text-slate-100 hidden sm:inline">{title}</span>
              <span className="text-slate-900 dark:text-slate-100 sm:hidden">病媒时空风险地图</span>
            </div>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <div className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
              <Navigation className="w-3 h-3 text-sky-500" />
              <span className="text-sky-600 dark:text-cyan-300 font-mono font-bold bg-sky-50 dark:bg-sky-950/70 px-1.5 py-0.5 rounded border border-sky-200 dark:border-sky-800 text-[11px]">
                {currentViewCity} {currentViewDistrict ? `· ${currentViewDistrict}` : ''}
              </span>
            </div>
          </div>

          {/* 右侧：紧凑控制按钮组 */}
          <div className="pointer-events-auto flex items-center gap-1.5">
            
            {/* 热力图开关 */}
            <button
              onClick={() => setShowHeatmap(!showHeatmap)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold backdrop-blur-md border transition-all flex items-center gap-1 shadow-sm ${
                showHeatmap 
                  ? 'bg-rose-500 text-white border-rose-400 shadow-rose-500/20 ring-1 ring-rose-300' 
                  : 'bg-white/90 dark:bg-slate-900/90 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:bg-slate-100'
              }`}
              title="切换连续平滑空间插值热力图"
            >
              <Flame className={`w-3.5 h-3.5 ${showHeatmap ? 'text-white' : 'text-slate-400'}`} />
              <span>热力图</span>
            </button>

            {/* 预警点开关 */}
            <button
              onClick={() => setShowAlertPins(!showAlertPins)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold backdrop-blur-md border transition-all flex items-center gap-1 shadow-sm ${
                showAlertPins 
                  ? 'bg-amber-500 text-white border-amber-400 shadow-amber-500/20 ring-1 ring-amber-300' 
                  : 'bg-white/90 dark:bg-slate-900/90 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:bg-slate-100'
              }`}
              title="切换超标预警标记"
            >
              <AlertTriangle className={`w-3.5 h-3.5 ${showAlertPins ? 'text-white' : 'text-slate-400'}`} />
              <span>预警点 ({alerts.length})</span>
            </button>

            {/* 底图切换器 */}
            <div className="flex items-center bg-white/95 dark:bg-slate-900/95 rounded-lg p-0.5 border border-slate-200 dark:border-slate-700 text-xs shadow-sm">
              <button
                onClick={() => setMapLayerType('vec')}
                className={`px-2 py-1 rounded font-medium transition-colors text-[11px] ${
                  mapLayerType === 'vec'
                    ? 'bg-sky-600 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                矢量
              </button>
              <button
                onClick={() => setMapLayerType('img')}
                className={`px-2 py-1 rounded font-medium transition-colors text-[11px] ${
                  mapLayerType === 'img'
                    ? 'bg-sky-600 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                影像
              </button>
            </div>

            {/* 重置全景 */}
            <button
              onClick={resetView}
              className="px-2.5 py-1.5 rounded-lg bg-white/95 dark:bg-slate-900/95 hover:bg-slate-100 dark:hover:bg-slate-800 text-sky-700 dark:text-sky-300 text-xs flex items-center gap-1 border border-slate-200 dark:border-sky-500/30 transition-colors font-medium shadow-sm"
              title="重置为河南省全域正射视角"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>全景</span>
            </button>
          </div>
        </div>

        {/* 第二行：仅当下钻到具体城市时展开专属区县下钻栏 (在同一Flex流中，绝不遮挡) */}
        {currentCityGeo && currentCityGeo.districts && currentCityGeo.districts.length > 0 && (
          <div className="pointer-events-auto self-start bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-200 dark:border-sky-500/30 shadow-lg flex flex-wrap items-center gap-1.5 text-xs animate-in fade-in slide-in-from-top-2 duration-200">
            <span className="text-[11px] font-bold text-sky-600 dark:text-sky-400 flex items-center gap-1 mr-1">
              <span>🏙️ {currentViewCity}辖区下钻:</span>
            </span>
            {currentCityGeo.districts.map(dist => {
              const isSelected = currentViewDistrict && (
                currentViewDistrict.includes(dist.name) || 
                dist.name.includes(currentViewDistrict.replace('区', ''))
              );
              return (
                <button
                  key={dist.name}
                  onClick={() => drillDownDistrict(dist.name, dist.center)}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                    isSelected
                      ? 'bg-sky-600 text-white shadow-xs font-bold scale-105'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-sky-100 dark:hover:bg-sky-950 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {dist.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 连续热力场与预警图例 (左下角) */}
      <div className="absolute bottom-3 left-3 z-10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700/80 text-xs text-slate-800 dark:text-slate-100 shadow-2xl flex flex-col gap-1.5 min-w-[220px]">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1">
          <span className="text-[11px] font-bold text-slate-900 dark:text-white flex items-center gap-1">
            <Flame className="w-3.5 h-3.5 text-rose-500" />
            <span>蚊媒空间热力梯度</span>
          </span>
          <span className="text-[10px] text-slate-500 dark:text-slate-300 font-mono">只/台次</span>
        </div>

        {/* 连续色彩渐变条 */}
        <div className="space-y-0.5">
          <div className="w-full h-2.5 rounded-full overflow-hidden shadow-inner flex" style={{
            background: 'linear-gradient(to right, rgba(0,210,255,0.7), rgba(34,197,94,0.85), rgba(234,179,8,0.9), rgba(249,115,22,0.95), rgba(239,68,68,1.0))'
          }} />
          <div className="flex justify-between text-[10px] font-mono text-slate-600 dark:text-slate-300 font-semibold">
            <span>0</span>
            <span>30</span>
            <span>50</span>
            <span>≥80</span>
          </div>
        </div>

        {/* 分级风险说明 */}
        <div className="grid grid-cols-2 gap-x-2 gap-y-1 pt-0.5 text-[10px]">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-600 animate-ping inline-block"></span>
            <span className="text-red-600 dark:text-red-400 font-bold">一级暴发 (≥80)</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-orange-500 inline-block"></span>
            <span className="text-orange-600 dark:text-orange-400 font-bold">二级较重 (50~79)</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>
            <span className="text-amber-600 dark:text-amber-300 font-bold">三级一般 (30~49)</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">受控 (&lt;30)</span>
          </div>
        </div>
      </div>

      {/* 地图渲染 DOM */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* 预警点详情弹窗浮层 */}
      {selectedAlert && (
        <div className="absolute top-14 right-3 z-30 w-84 bg-white/98 dark:bg-slate-900/98 backdrop-blur-md rounded-xl border border-slate-200 dark:border-sky-500/40 p-4 shadow-2xl text-slate-800 dark:text-slate-100 text-xs animate-in fade-in slide-in-from-right-4 duration-300">
          <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-700/80 pb-2 mb-2">
            <div>
              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-extrabold uppercase mb-1 border ${
                selectedAlert.level === 'red' 
                  ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950/80 dark:text-red-300 dark:border-red-500/60' 
                  : (selectedAlert.level === 'orange' 
                    ? 'bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-950/80 dark:text-orange-300 dark:border-orange-500/60' 
                    : 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-500/60')
              }`}>
                {selectedAlert.levelName}
              </span>
              <h4 className="font-bold text-sm text-slate-900 dark:text-white">{selectedAlert.title}</h4>
            </div>
            <button 
              onClick={() => setSelectedAlert(null)}
              className="text-slate-400 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              ✕
            </button>
          </div>

          <div className="space-y-2 text-slate-800 dark:text-slate-200">
            <div className="flex justify-between items-center">
              <span className="text-slate-600 dark:text-slate-300 font-medium">所属辖区:</span>
              <span className="font-semibold text-slate-900 dark:text-white">{selectedAlert.city} · {selectedAlert.district} · {selectedAlert.street}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600 dark:text-slate-300 font-medium">实测捕获密度:</span>
              <span className="font-mono font-extrabold text-rose-600 dark:text-rose-400 text-sm">{selectedAlert.currentDensity} 只/台次</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600 dark:text-slate-300 font-medium">预警基线阈值:</span>
              <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">{selectedAlert.threshold} 只/台次</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600 dark:text-slate-300 font-medium">预估影响人口:</span>
              <span className="font-mono font-bold text-amber-600 dark:text-amber-300">{selectedAlert.affectedPopulationEstimate.toLocaleString()} 人</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600 dark:text-slate-300 font-medium">处置闭环状态:</span>
              <span className={`font-bold px-2 py-0.5 rounded text-[10px] border ${
                selectedAlert.disposalStatus === 'in_progress' 
                  ? 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/70 dark:text-amber-200 dark:border-amber-500/50' 
                  : 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/70 dark:text-rose-200 dark:border-rose-500/50'
              }`}>
                {selectedAlert.disposalStatus === 'in_progress' ? '处置中 (消杀指令已下发)' : '待响应'}
              </span>
            </div>
            <div className="mt-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
              <span className="text-slate-700 dark:text-slate-200 font-bold block mb-1.5">应急处置建议:</span>
              <p className="text-slate-800 dark:text-slate-100 leading-relaxed bg-slate-100/80 dark:bg-slate-800/90 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-normal">
                {selectedAlert.recommendedAction}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 常规监测点点击详情浮层 */}
      {selectedPoint && !selectedAlert && (
        <div className="absolute top-14 right-3 z-30 w-72 bg-white/98 dark:bg-slate-900/98 backdrop-blur-md rounded-xl border border-slate-200 dark:border-sky-500/40 p-3.5 shadow-2xl text-slate-800 dark:text-slate-100 text-xs animate-in fade-in slide-in-from-right-4 duration-300">
          <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-700/80 pb-2 mb-2">
            <div>
              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-sky-50 text-sky-600 border border-sky-200 dark:bg-sky-950/80 dark:text-sky-300 dark:border-sky-500/50 mb-1">
                常态化监测点位
              </span>
              <h4 className="font-bold text-sm text-slate-900 dark:text-white">{selectedPoint.district} · {selectedPoint.street}</h4>
            </div>
            <button 
              onClick={() => setSelectedPoint(null)}
              className="text-slate-400 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white p-1"
            >
              ✕
            </button>
          </div>
          <div className="space-y-1.5 text-slate-800 dark:text-slate-200">
            <div className="flex justify-between items-center">
              <span className="text-slate-600 dark:text-slate-300 font-medium">优势物种:</span>
              <span className="font-semibold text-slate-900 dark:text-white">{selectedPoint.species}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600 dark:text-slate-300 font-medium">实测捕获密度:</span>
              <span className={`font-mono font-bold ${selectedPoint.density >= 80 ? 'text-rose-600 dark:text-rose-400' : selectedPoint.density >= 50 ? 'text-orange-600 dark:text-orange-400' : selectedPoint.density >= 30 ? 'text-amber-600 dark:text-amber-300' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {selectedPoint.density} 只/台次
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600 dark:text-slate-300 font-medium">经纬度坐标:</span>
              <span className="font-mono text-slate-700 dark:text-slate-300 text-[10px]">[{selectedPoint.lon.toFixed(4)}, {selectedPoint.lat.toFixed(4)}]</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
