/**
 * profile.ts — 设置中心、形象定制与离线缓存管理
 */

import { getApiBaseUrl, setApiBaseUrl, DEFAULT_API_BASE } from '../../utils/request';
import { visitorApi } from '../../services/api';
import { storageService } from '../../services/storage-service';
import { Spot } from '../../types/spot';

const STYLES = [
  { key: 'zen_red_gold', name: '禅意红金', color: '#c41d7f', desc: '祥符禅韵与灵山法华之美' },
  { key: 'celadon_elegance', name: '青瓷雅韵', color: '#2e7d5b', desc: '江南水乡青瓷淡雅温润' },
  { key: 'tang_splendor', name: '盛唐华彩', color: '#b8860b', desc: '盛唐重彩佛国庄严气度' },
  { key: 'ink_wash', name: '水墨丹青', color: '#455a7b', desc: '太湖山水墨色深远意境' },
];

Page({
  data: {
    styles: STYLES,
    currentStyle: 'zen_red_gold',
    apiBaseUrl: '',
    defaultApiBase: DEFAULT_API_BASE,
    serverPingStatus: '待检测',
    isTestingServer: false,
    cachedGraphInfo: null as any,
    cachedSpotsCount: 0,
    favoriteSpots: [] as Spot[],
  },

  onShow() {
    const style = storageService.getDhStyle();
    const url = getApiBaseUrl();
    const cached = storageService.getCachedGraph();
    const spots = storageService.getCachedSpots();
    const favIds = storageService.getFavorites();
    const favSpots = spots.filter((s) => favIds.includes(s.id));

    this.setData({
      currentStyle: style,
      apiBaseUrl: url,
      cachedGraphInfo: cached,
      cachedSpotsCount: spots.length,
      favoriteSpots: favSpots,
    });
  },

  onStyleSelect(e: WechatMiniprogram.CustomEvent) {
    const key = e.currentTarget.dataset.key;
    this.setData({ currentStyle: key });
    storageService.setDhStyle(key);
    wx.showToast({
      title: '形象风格已更新',
      icon: 'success',
    });
  },

  onApiUrlInput(e: WechatMiniprogram.Input) {
    this.setData({ apiBaseUrl: e.detail.value });
  },

  saveApiUrl() {
    const url = this.data.apiBaseUrl.trim();
    if (!url) {
      wx.showToast({ title: '地址不能为空', icon: 'none' });
      return;
    }
    setApiBaseUrl(url);
    wx.showToast({ title: 'API地址已保存', icon: 'success' });
    this.testServerConnection();
  },

  resetDefaultApiUrl() {
    setApiBaseUrl(DEFAULT_API_BASE);
    this.setData({ apiBaseUrl: DEFAULT_API_BASE });
    wx.showToast({ title: '已恢复默认地址', icon: 'success' });
    this.testServerConnection();
  },

  async testServerConnection() {
    this.setData({ isTestingServer: true, serverPingStatus: '正在探测…' });
    try {
      const res = await visitorApi.getServerStatus();
      this.setData({
        serverPingStatus: `连接正常 (知识库: ${res.knowledge_chunks} 切片, LLM: ${res.llm_available ? res.model : '离线'})`,
        isTestingServer: false,
      });
      wx.showToast({ title: '连接后端成功', icon: 'success' });
    } catch (e: any) {
      this.setData({
        serverPingStatus: `连接失败: ${e.error || '无法连通'}`,
        isTestingServer: false,
      });
      wx.showToast({ title: '连接失败，请检查服务', icon: 'none' });
    }
  },

  async cacheAllData() {
    wx.showLoading({ title: '正在缓存全景区路网…' });
    try {
      const graph = await visitorApi.getRouteGraph();
      if (graph && graph.spots) {
        storageService.cacheGraph(graph);
        storageService.cacheSpots(graph.spots);
        this.setData({
          cachedGraphInfo: { graph, cachedAt: new Date().toISOString() },
          cachedSpotsCount: graph.spots.length,
        });
        wx.hideLoading();
        wx.showToast({ title: '路网离线缓存成功', icon: 'success' });
      }
    } catch (e: any) {
      wx.hideLoading();
      wx.showToast({ title: e.error || '缓存失败', icon: 'none' });
    }
  },

  clearCache() {
    wx.showModal({
      title: '清空确认',
      content: '确定清空已缓存的离线路网与历史规划路线吗？',
      success: (res) => {
        if (res.confirm) {
          storageService.clearSavedRoute();
          wx.removeStorageSync('lxz_cached_graph');
          wx.removeStorageSync('lxz_cached_spots');
          this.setData({
            cachedGraphInfo: null,
            cachedSpotsCount: 0,
          });
          wx.showToast({ title: '缓存已清空', icon: 'success' });
        }
      },
    });
  },

  goToSpotDetail(e: WechatMiniprogram.CustomEvent) {
    const id = e.currentTarget.dataset.id;
    if (id) {
      wx.navigateTo({
        url: `/pages/spots/detail?id=${encodeURIComponent(id)}`,
      });
    }
  },
});
