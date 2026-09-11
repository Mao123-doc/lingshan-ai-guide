export interface LatLng {
  lat: number;
  lng: number;
}

const X_PI = (Math.PI * 3000) / 180;
const GCJ_A = 6378245;
const GCJ_EE = 0.006693421622965943;

function outOfChina(lat: number, lng: number): boolean {
  return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
}

function transformLat(x: number, y: number): number {
  let ret = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  ret += ((20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2) / 3;
  ret += ((20 * Math.sin(y * Math.PI) + 40 * Math.sin((y / 3) * Math.PI)) * 2) / 3;
  ret += ((160 * Math.sin((y / 12) * Math.PI) + 320 * Math.sin((y * Math.PI) / 30)) * 2) / 3;
  return ret;
}

function transformLng(x: number, y: number): number {
  let ret = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  ret += ((20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2) / 3;
  ret += ((20 * Math.sin(x * Math.PI) + 40 * Math.sin((x / 3) * Math.PI)) * 2) / 3;
  ret += ((150 * Math.sin((x / 12) * Math.PI) + 300 * Math.sin((x / 30) * Math.PI)) * 2) / 3;
  return ret;
}

function wgs84ToGcj02(lat: number, lng: number): LatLng {
  if (outOfChina(lat, lng)) return { lat, lng };
  let dLat = transformLat(lng - 105, lat - 35);
  let dLng = transformLng(lng - 105, lat - 35);
  const radLat = (lat / 180) * Math.PI;
  let magic = Math.sin(radLat);
  magic = 1 - GCJ_EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180) / (((GCJ_A * (1 - GCJ_EE)) / (magic * sqrtMagic)) * Math.PI);
  dLng = (dLng * 180) / ((GCJ_A / sqrtMagic) * Math.cos(radLat) * Math.PI);
  return { lat: lat + dLat, lng: lng + dLng };
}

export function wgs84ToBd09(lat: number, lng: number): LatLng {
  const gcj = wgs84ToGcj02(lat, lng);
  const x = gcj.lng;
  const y = gcj.lat;
  const z = Math.sqrt(x * x + y * y) + 0.00002 * Math.sin(y * X_PI);
  const theta = Math.atan2(y, x) + 0.000003 * Math.cos(x * X_PI);
  return { lat: z * Math.sin(theta) + 0.006, lng: z * Math.cos(theta) + 0.0065 };
}

export function getBrowserLocation(timeout = 8000): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('geolocation unavailable'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout, maximumAge: 60000 },
    );
  });
}

export type DestCoordType = 'wgs84' | 'bd09ll';

export function buildBaiduDirectionUrl(
  dest: LatLng,
  destName: string,
  origin?: LatLng | null,
  destCoordType: DestCoordType = 'wgs84',
): string {
  let originParam = 'name:我的位置';
  if (origin) {
    const converted = destCoordType === 'bd09ll' ? wgs84ToBd09(origin.lat, origin.lng) : origin;
    originParam = `latlng:${converted.lat},${converted.lng}|name:我的位置`;
  }
  const params = new URLSearchParams({
    origin: originParam,
    destination: `name:${destName}|latlng:${dest.lat},${dest.lng}`,
    mode: 'driving',
    region: '无锡',
    output: 'html',
    coord_type: destCoordType,
    src: 'lingshan-ai-guide',
  });
  return `https://api.map.baidu.com/direction?${params.toString()}`;
}

export async function openBaiduNavigation(
  dest: LatLng,
  destName: string,
  cachedOrigin?: LatLng | null,
  destCoordType: DestCoordType = 'wgs84',
): Promise<void> {
  let origin = cachedOrigin ?? null;
  if (!origin) {
    try {
      origin = await getBrowserLocation();
    } catch {
      origin = null;
    }
  }
  const url = buildBaiduDirectionUrl(dest, destName, origin, destCoordType);
  window.open(url, '_blank', 'noopener,noreferrer');
}
