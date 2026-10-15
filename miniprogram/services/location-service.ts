/**
 * location-service.ts — 灵小禅小程序定位与周边导览服务
 *
 * 遵循红线约定：
 * 1. 明确标注距离为直线几何距离，不等于复杂地形下的实际步行距离。
 * 2. GPS 定位不能直接当做路线规划的起点（必须由游客确认或基于登记节点）。
 * 3. 采用原生 wx.openLocation 调起地图实景导航，提供真机无缝导航能力。
 */

import { visitorApi } from './api';
import { Spot, Facility } from '../types/spot';

export interface LocationResult {
  latitude: number;
  longitude: number;
  accuracy: number;
  nearbySpots: Spot[];
  nearbyFacilities: Facility[];
  notice: string;
}

export const locationService = {
  /**
   * 获取游客当前位置并拉取周边景点与设施
   */
  async getCurrentLocationAndNearby(): Promise<LocationResult> {
    const coords = await this.getLocationCoords();
    const [spots, facilities] = await Promise.all([
      visitorApi.getNearbySpots(coords.latitude, coords.longitude).catch(() => []),
      visitorApi.getNearbyFacilities(coords.latitude, coords.longitude).catch(() => []),
    ]);

    return {
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy: Math.round(coords.accuracy),
      nearbySpots: spots,
      nearbyFacilities: facilities,
      notice: `已获取定位（精度约 ${Math.round(coords.accuracy)} 米）。所显距离为坐标直线距离；估算坐标仅供参考，不可直接代替实地无障碍路网。`,
    };
  },

  getLocationCoords(): Promise<{ latitude: number; longitude: number; accuracy: number }> {
    return new Promise((resolve, reject) => {
      wx.getLocation({
        type: 'gcj02', // 火星坐标系，与高德/腾讯地图及景区数据库直接一致
        isHighAccuracy: true,
        highAccuracyExpireTime: 5000,
        success: (res) => {
          resolve({
            latitude: res.latitude,
            longitude: res.longitude,
            accuracy: res.accuracy || 20,
          });
        },
        fail: (err) => {
          console.warn('wx.getLocation failed:', err);
          if (err.errMsg.includes('auth deny') || err.errMsg.includes('authorize:fail')) {
            wx.showModal({
              title: '需要定位权限',
              content: '需要获取您的地理位置以计算周边景点与设施距离。',
              confirmText: '去授权',
              success: (modalRes) => {
                if (modalRes.confirm) {
                  wx.openSetting({});
                }
              },
            });
            reject(new Error('定位权限被拒绝，请在设置中开启定位'));
          } else {
            reject(new Error('无法获取设备定位，请确认手机 GPS 定位服务已开启'));
          }
        },
      });
    });
  },

  /**
   * 调起微信原生地图实景导航
   */
  openNavigation(item: { name: string; lat: number; lng: number; description?: string }): void {
    if (!Number.isFinite(item.lat) || !Number.isFinite(item.lng)) {
      wx.showToast({
        title: '该地点暂无精确坐标',
        icon: 'none',
      });
      return;
    }

    wx.openLocation({
      latitude: item.lat,
      longitude: item.lng,
      name: item.name,
      address: item.description || '无锡市滨湖区灵山胜境景区内',
      scale: 17,
      fail: (e) => {
        console.error('wx.openLocation failed', e);
        wx.showToast({
          title: '调起地图失败',
          icon: 'none',
        });
      },
    });
  },
};
