/**
 * home.ts — 灵小禅移动端首页（灵山胜境官方数字文旅导览）
 */

import { visitorApi } from '../../services/api';
import { storageService } from '../../services/storage-service';
import { ServerStatusResponse } from '../../types/api';

const DEFAULT_QUESTIONS = [
  '九龙灌浴今天开演时间与最佳观赏点？',
  '带老人游览怎么走台阶最少？',
  '灵山大佛抱佛脚如何参观？',
  '梵宫《吉祥颂》演出需要预约吗？',
];

const DEFAULT_PERFORMANCES = [
  {
    id: 'jiulong',
    name: '九龙灌浴',
    desc: '莲花绽开 · 太子金身喷泉盛典',
    times: '10:00 / 11:30 / 14:45 / 16:45',
    location: '九龙灌浴广场',
    tag: '必看胜景',
  },
  {
    id: 'jixiangsong',
    name: '灵山吉祥颂',
    desc: '千人圣坛 · 环形穹顶光影音乐史诗',
    times: '10:30 / 11:30 / 14:00 / 16:00',
    location: '灵山梵宫三层圣坛',
    tag: '震撼视听',
  },
];

Page({
  data: {
    status: null as ServerStatusResponse | null,
    serverConnected: false,
    serviceStatusText: '随身伴游在线',
    knowledgeCount: 0,
    hotQuestions: DEFAULT_QUESTIONS,
    performances: DEFAULT_PERFORMANCES,
    isOffline: false,
    dhStyle: 'zen_red_gold',
    dhEmotion: 'idle',
    isSpeaking: false,
    isLoading: true,
  },

  onLoad() {
    this.checkNetworkAndFetch();
    this.listenNetwork();
    this.syncDigitalHumanConfig();
    this.preloadRouteGraph();
  },

  onShow() {
    // 每次显示时更新用户在设置页可能修改的形象风格
    const style = storageService.getDhStyle();
    if (style !== this.data.dhStyle) {
      this.setData({ dhStyle: style });
    }
  },

  onPullDownRefresh() {
    this.checkNetworkAndFetch().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  listenNetwork() {
    wx.onNetworkStatusChange((res) => {
      this.setData({ isOffline: !res.isConnected });
      if (res.isConnected) {
        this.checkNetworkAndFetch();
      }
    });
  },

  async checkNetworkAndFetch() {
    this.setData({ isLoading: true });
    try {
      const netRes = await wx.getNetworkType();
      if (netRes.networkType === 'none') {
        this.setData({
          isOffline: true,
          serverConnected: false,
          serviceStatusText: '离线导览模式',
          isLoading: false,
        });
        return;
      }

      const status = await visitorApi.getServerStatus();
      this.setData({
        status,
        serverConnected: true,
        isOffline: false,
        serviceStatusText: status.llm_available ? '随身伴游在线' : '离线导览模式',
        knowledgeCount: status.knowledge_chunks || 0,
        isLoading: false,
      });

      // 拉取热门问答
      const hot = await visitorApi.getHotQuestions().catch(() => []);
      if (Array.isArray(hot) && hot.length > 0) {
        this.setData({
          hotQuestions: hot.map((h) => h.question).slice(0, 4),
        });
      }
    } catch (e) {
      console.warn('Backend status check failed, using fallback display', e);
      this.setData({
        serverConnected: false,
        serviceStatusText: '离线离网模式',
        isLoading: false,
      });
    }
  },

  async syncDigitalHumanConfig() {
    try {
      const config = await visitorApi.getDigitalHumanConfig();
      if (config.style_preset) {
        this.setData({ dhStyle: config.style_preset });
        storageService.setDhStyle(config.style_preset);
      }
    } catch {
      // 保持本地存储预设
    }
  },

  async preloadRouteGraph() {
    try {
      const graph = await visitorApi.getRouteGraph();
      if (graph && graph.spots && graph.spots.length > 0) {
        storageService.cacheGraph(graph);
        storageService.cacheSpots(graph.spots);
      }
    } catch (e) {
      console.warn('Preload graph failed', e);
    }
  },

  // 演艺卡片点击 -> 直达问答咨询该演艺
  onPerformanceTap(e: WechatMiniprogram.CustomEvent) {
    const name = e.currentTarget.dataset.name || '';
    if (name) {
      const query = `请介绍${name}的演出时间、观赏位置与游览建议`;
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

  // 导航跳转
  goToChat(e?: WechatMiniprogram.CustomEvent) {
    const q = e?.currentTarget?.dataset?.question || '';
    if (q) {
      storageService.setPendingChatQuery(q);
      wx.switchTab({
        url: '/pages/chat/chat',
        fail: () => {
          wx.reLaunch({
            url: `/pages/chat/chat?q=${encodeURIComponent(q)}`,
          });
        },
      });
    } else {
      wx.switchTab({
        url: '/pages/chat/chat',
      });
    }
  },

  goToRoute() {
    wx.switchTab({
      url: '/pages/route/route',
    });
  },

  goToSpots() {
    wx.switchTab({
      url: '/pages/spots/spots',
    });
  },

  goToProfile() {
    wx.switchTab({
      url: '/pages/profile/profile',
    });
  },

  // 分享小程序
  onShareAppMessage() {
    return {
      title: '灵山胜境 · 灵小禅随身智能文旅导览',
      path: '/pages/home/home',
    };
  },
});
