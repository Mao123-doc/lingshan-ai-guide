/**
 * home.ts — 灵小禅移动端首页
 */

import { visitorApi } from '../../services/api';
import { storageService } from '../../services/storage-service';
import { ServerStatusResponse } from '../../types/api';

const DEFAULT_QUESTIONS = [
  '灵山大佛有多高？',
  '门票价格是多少？',
  '九龙灌浴表演时间？',
  '梵宫有什么好看的？',
];

Page({
  data: {
    status: null as ServerStatusResponse | null,
    serverConnected: false,
    llmName: '检索增强知识库',
    knowledgeCount: 0,
    hotQuestions: DEFAULT_QUESTIONS,
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
    // 每次显示时更新用户在设置页可能修改的数字人风格
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
        this.setData({ isOffline: true, serverConnected: false, isLoading: false });
        return;
      }

      const status = await visitorApi.getServerStatus();
      this.setData({
        status,
        serverConnected: true,
        isOffline: false,
        llmName: status.llm_available ? (status.model || '在线大模型') : '离线知识库模式',
        knowledgeCount: status.knowledge_chunks || 0,
        isLoading: false,
      });

      // 拉取真实热门问题
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

  // 导航跳转
  goToChat(e: WechatMiniprogram.CustomEvent) {
    const q = e.currentTarget.dataset.question || '';
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
      title: '灵小禅 · 灵山胜境AI文旅决策智能体',
      path: '/pages/home/home',
    };
  },
});
