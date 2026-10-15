/**
 * detail.ts — 景点深度文化详情页
 */

import { visitorApi } from '../../services/api';
import { storageService } from '../../services/storage-service';
import { locationService } from '../../services/location-service';
import { Spot } from '../../types/spot';

Page({
  data: {
    spotId: '',
    spot: null as Spot | null,
    isFavorite: false,
    isLoading: true,
  },

  onLoad(options: { id?: string }) {
    if (options.id) {
      const id = decodeURIComponent(options.id);
      this.setData({
        spotId: id,
        isFavorite: storageService.isFavorite(id),
      });
      this.fetchDetail(id);
    }
  },

  async fetchDetail(id: string) {
    this.setData({ isLoading: true });
    try {
      const data = await visitorApi.getSpotDetail(id);
      this.setData({ spot: data, isLoading: false });
      wx.setNavigationBarTitle({ title: data.name });
    } catch {
      // 离线读取缓存
      const cached = storageService.getCachedSpots().find((s) => s.id === id);
      if (cached) {
        this.setData({ spot: cached, isLoading: false });
        wx.setNavigationBarTitle({ title: cached.name });
      } else {
        this.setData({ isLoading: false });
        wx.showToast({
          title: '未找到该景点信息',
          icon: 'none',
        });
      }
    }
  },

  toggleFavorite() {
    const isFav = storageService.toggleFavorite(this.data.spotId);
    this.setData({ isFavorite: isFav });
    wx.showToast({
      title: isFav ? '已加入常用收藏' : '已取消收藏',
      icon: 'none',
    });
  },

  handleNavigate() {
    const s = this.data.spot;
    if (s && s.lat && s.lng) {
      locationService.openNavigation({
        name: s.name,
        lat: s.lat,
        lng: s.lng,
        description: s.description,
      });
    } else {
      wx.showToast({
        title: '该地点暂无精确坐标',
        icon: 'none',
      });
    }
  },

  askAbout() {
    const name = this.data.spot?.name;
    if (name) {
      const query = `请详细介绍${name}的历史渊源与文化内涵`;
      storageService.setPendingChatQuery(query);
      wx.switchTab({
        url: '/pages/chat/chat',
        fail: () => {
          wx.reLaunch({
            url: `/pages/chat/chat?q=${encodeURIComponent(query)}`,
          });
        },
      });
    }
  },

  planRouteWithSpot() {
    const name = this.data.spot?.name || '';
    const spotId = this.data.spotId;
    if (name || spotId) {
      storageService.setPendingRouteSpot({ spotId, name });
      wx.switchTab({
        url: '/pages/route/route',
        fail: () => {
          wx.reLaunch({
            url: `/pages/route/route?spotId=${encodeURIComponent(spotId)}&name=${encodeURIComponent(name)}`,
          });
        },
      });
    }
  },

  onShareAppMessage() {
    return {
      title: `${this.data.spot?.name || '灵山胜境景点'} · 灵小禅文旅导览`,
      path: `/pages/spots/detail?id=${encodeURIComponent(this.data.spotId)}`,
    };
  },
});
