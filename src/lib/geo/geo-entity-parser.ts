/**
 * 疾控病媒智能体 - 地理实体与协议解析工具 (Geo Entity Parser)
 * 具备独立性与高可测性，负责解析 geo 协议、纯文本历史坐标以及行政地名反查
 */

import { HENAN_CITIES_GEO } from './henan-geojson';

export interface ParsedGeoTarget {
  lat: number;
  lon: number;
  title?: string;
  zoom?: number;
  level?: 'red' | 'orange' | 'yellow' | 'info';
}

/**
 * 1. 解析 Markdown 的 geo: 协议 URL
 * 示例:
 *   geo:34.335,113.685
 *   geo:34.335,113.685?title=观音寺镇&level=red&zoom=13.5
 */
export function parseGeoProtocolUrl(url: string): ParsedGeoTarget | null {
  if (!url) return null;
  const cleanUrl = url.trim();
  if (!cleanUrl.toLowerCase().startsWith('geo:')) {
    return null;
  }

  try {
    const rawPath = cleanUrl.slice(4).trim(); // 移除 'geo:'
    const [coordsPart, queryPart] = rawPath.split('?');
    if (!coordsPart) return null;

    const parts = coordsPart.replace(/[,，;；]/g, ' ').split(/\s+/).filter(Boolean).map(s => parseFloat(s.trim()));
    if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) {
      return null;
    }

    let lat = parts[0];
    let lon = parts[1];

    // 智能经纬度纠偏（河南通常: 纬度 ~34, 经度 ~113）
    if (lat > 70 && lon < 40) {
      const temp = lat;
      lat = lon;
      lon = temp;
    }

    let title: string | undefined;
    let level: 'red' | 'orange' | 'yellow' | 'info' | undefined;
    let zoom: number | undefined;

    if (queryPart) {
      const searchParams = new URLSearchParams(queryPart);
      title = searchParams.get('title') || searchParams.get('name') || undefined;
      const parsedLevel = searchParams.get('level');
      if (parsedLevel === 'red' || parsedLevel === 'orange' || parsedLevel === 'yellow' || parsedLevel === 'info') {
        level = parsedLevel;
      }
      const parsedZoom = parseFloat(searchParams.get('zoom') || '');
      if (!isNaN(parsedZoom)) {
        zoom = parsedZoom;
      }
    }

    return { lat, lon, title, level, zoom };
  } catch {
    return null;
  }
}

/**
 * 2. 解析自然语言历史坐标文本 (兼容历史会话中模型直接输出经纬度的情况)
 * 示例:
 *   34.335°N、113.685°E
 *   34.335°N, 113.685°E
 *   北纬 34.335°，东经 113.685°
 *   113.685°E, 34.335°N
 */
export function parseLegacyCoordinateText(text: string): { lat: number; lon: number } | null {
  if (!text) return null;

  // 模式 A: 34.335°N、113.685°E 或 34.335°N, 113.685°E
  const regexDegree = /([0-9]+(?:\.[0-9]+)?)\s*°?\s*([NSns])\s*[,、，\s]+\s*([0-9]+(?:\.[0-9]+)?)\s*°?\s*([EWew])/;
  const matchA = text.match(regexDegree);
  if (matchA) {
    const latVal = parseFloat(matchA[1]);
    const latDir = matchA[2].toUpperCase();
    const lonVal = parseFloat(matchA[3]);
    const lonDir = matchA[4].toUpperCase();
    return {
      lat: latDir === 'S' ? -latVal : latVal,
      lon: lonDir === 'W' ? -lonVal : lonVal
    };
  }

  // 模式 B: 反向 113.685°E, 34.335°N
  const regexDegreeRev = /([0-9]+(?:\.[0-9]+)?)\s*°?\s*([EWew])\s*[,、，\s]+\s*([0-9]+(?:\.[0-9]+)?)\s*°?\s*([NSns])/;
  const matchB = text.match(regexDegreeRev);
  if (matchB) {
    const lonVal = parseFloat(matchB[1]);
    const lonDir = matchB[2].toUpperCase();
    const latVal = parseFloat(matchB[3]);
    const latDir = matchB[4].toUpperCase();
    return {
      lat: latDir === 'S' ? -latVal : latVal,
      lon: lonDir === 'W' ? -lonVal : lonVal
    };
  }

  // 模式 C: 北纬 34.335度, 东经 113.685度
  const regexChinese = /北纬\s*([0-9]+(?:\.[0-9]+)?)[°度]?\s*[,、，\s]+\s*东经\s*([0-9]+(?:\.[0-9]+)?)[°度]?/;
  const matchC = text.match(regexChinese);
  if (matchC) {
    return {
      lat: parseFloat(matchC[1]),
      lon: parseFloat(matchC[2])
    };
  }

  return null;
}

/**
 * 3. 基于河南省行政区划地名库的逆查询匹配（兜底策略）
 * 示例:
 *   "新郑市观音寺镇" -> 匹配到新郑市 [113.7383, 34.3986]
 *   "金水区未来路" -> 匹配到金水区 [113.6627, 34.8003]
 */
export function matchHenanPlaceCoordinates(placeName: string): { lat: number; lon: number; matchedName: string } | null {
  if (!placeName || placeName.length < 2) return null;

  for (const city of Object.values(HENAN_CITIES_GEO)) {
    // 1. 优先匹配区县 (更精准)
    if (city.districts && city.districts.length > 0) {
      for (const dist of city.districts) {
        if (placeName.includes(dist.name) || dist.name.includes(placeName)) {
          return {
            lon: dist.center[0],
            lat: dist.center[1],
            matchedName: `${city.name}${dist.name}`
          };
        }
      }
    }

    // 2. 匹配地级市
    if (placeName.includes(city.name) || city.name.includes(placeName)) {
      return {
        lon: city.center[0],
        lat: city.center[1],
        matchedName: city.name
      };
    }
  }

  return null;
}
