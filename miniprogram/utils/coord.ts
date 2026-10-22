/**
 * coord.ts — 坐标转换与距离计算工具
 *
 * 坐标系说明：
 * 1. 景区登记数据（data/route/spots.json）为高德/腾讯系 GCJ-02 坐标。
 * 2. 微信小程序 wx.getLocation 推荐使用 type: 'gcj02' 获得火星坐标系，与景区及地图组件直接契合。
 * 3. 如设备返回标准 WGS-84 坐标，本模块提供严格火星偏移算法转换。
 */

const PI = Math.PI;
const X_PI = (PI * 3000.0) / 180.0;
const A = 6378245.0; // 长半轴
const EE = 0.00669342162296594323; // 偏心率平方

/**
 * 判断坐标是否在中国大陆境外（境外无需偏移）
 */
export function outOfChina(lat: number, lng: number): boolean {
  return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
}

function transformLat(x: number, y: number): number {
  let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  ret += ((20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0) / 3.0;
  ret += ((20.0 * Math.sin(y * PI) + 40.0 * Math.sin((y / 3.0) * PI)) * 2.0) / 3.0;
  ret += ((160.0 * Math.sin((y / 12.0) * PI) + 320 * Math.sin((y * PI) / 30.0)) * 2.0) / 3.0;
  return ret;
}

function transformLng(x: number, y: number): number {
  let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  ret += ((20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0) / 3.0;
  ret += ((20.0 * Math.sin(x * PI) + 40.0 * Math.sin((x / 3.0) * PI)) * 2.0) / 3.0;
  ret += ((150.0 * Math.sin((x / 12.0) * PI) + 300.0 * Math.sin((x / 30.0) * PI)) * 2.0) / 3.0;
  return ret;
}

/**
 * WGS-84 坐标转 GCJ-02 火星坐标
 */
export function wgs84ToGcj02(lat: number, lng: number): { lat: number; lng: number } {
  if (outOfChina(lat, lng)) {
    return { lat, lng };
  }
  let dLat = transformLat(lng - 105.0, lat - 35.0);
  let dLng = transformLng(lng - 105.0, lat - 35.0);
  const radLat = (lat / 180.0) * PI;
  let magic = Math.sin(radLat);
  magic = 1 - EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / (((A * (1 - EE)) / (magic * sqrtMagic)) * PI);
  dLng = (dLng * 180.0) / ((A / sqrtMagic) * Math.cos(radLat) * PI);
  return {
    lat: lat + dLat,
    lng: lng + dLng,
  };
}

/**
 * 球面大圆距离（Haversine）算法，单位：米
 */
export function calculateDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const rad = PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return Math.round(6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

/**
 * 格式化距离文本
 */
export function formatDistance(meters?: number): string {
  if (meters === undefined || !Number.isFinite(meters)) return '未知';
  if (meters < 1000) return `${Math.round(meters)}米`;
  return `${(meters / 1000).toFixed(1)}公里`;
}
