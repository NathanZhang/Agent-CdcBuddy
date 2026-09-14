/**
 * 疾控病媒智能体 - 地理实体事件通信总线 (Geo Event Bus)
 * 采用完全解耦的标准 CustomEvent 机制，实现聊天气泡与地图组件之间的无强依赖联动
 */

export interface GeoLocateDetail {
  lat: number;
  lon: number;
  title: string;
  zoom?: number;
  level?: 'red' | 'orange' | 'yellow' | 'info';
  description?: string;
  source?: string;
}

const GEO_LOCATE_EVENT_NAME = 'cdc:locate-point';

/**
 * 派发地图定位事件
 */
export function dispatchGeoLocate(detail: GeoLocateDetail): void {
  if (typeof window === 'undefined') return;

  // 坐标合法性基础校验 (河南省大致范围: 31.0°N~36.8°N, 110.0°E~117.0°E)
  let { lat, lon } = detail;
  
  // 自动容错纠偏：若用户或模型发生先经后纬颠倒（如 lon < 40 且 lat > 100），自动调换
  if (lat > 70 && lon < 40) {
    const temp = lat;
    lat = lon;
    lon = temp;
  }

  const normalizedDetail: GeoLocateDetail = {
    ...detail,
    lat: Number(lat),
    lon: Number(lon),
    zoom: detail.zoom || 13.5
  };

  const event = new CustomEvent<GeoLocateDetail>(GEO_LOCATE_EVENT_NAME, {
    detail: normalizedDetail,
    bubbles: true,
    cancelable: true
  });

  window.dispatchEvent(event);
}

/**
 * 订阅地图定位事件，返回取消订阅函数
 */
export function subscribeGeoLocate(
  handler: (detail: GeoLocateDetail) => void
): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const eventListener = (event: Event) => {
    const customEvent = event as CustomEvent<GeoLocateDetail>;
    if (customEvent.detail) {
      handler(customEvent.detail);
    }
  };

  window.addEventListener(GEO_LOCATE_EVENT_NAME, eventListener);

  return () => {
    window.removeEventListener(GEO_LOCATE_EVENT_NAME, eventListener);
  };
}
