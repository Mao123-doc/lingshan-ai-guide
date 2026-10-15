/**
 * app.ts — 灵小禅微信小程序核心入口
 *
 * 灵小禅 · 灵山胜境可信文旅决策智能体
 * 第八届全球校园人工智能算法精英大赛（AIC）
 */

import { visitorApi } from './services/api';
import { storageService } from './services/storage-service';

export interface IAppOption {
  globalData: {
    isConnected: boolean;
    serverReady: boolean;
    dhStyle: string;
  };
  bootstrapApp(): Promise<void>;
}

App<IAppOption>({
  globalData: {
    isConnected: true,
    serverReady: false,
    dhStyle: 'zen_red_gold',
  },

  onLaunch() {
    console.log('🌸 灵小禅微信小程序启动中…');

    // 1. 监听设备网络状态
    wx.getNetworkType({
      success: (res) => {
        const isConnected = res.networkType !== 'none';
        this.globalData.isConnected = isConnected;
        if (isConnected) {
          this.bootstrapApp();
        }
      },
    });

    wx.onNetworkStatusChange((res) => {
      this.globalData.isConnected = res.isConnected;
    });
  },

  async bootstrapApp() {
    try {
      // 2. 检测后端连通性与 RAG 状态
      const status = await visitorApi.getServerStatus();
      this.globalData.serverReady = true;
      console.log('✅ 后端服务连接成功:', status);

      // 3. 同步数字人配置
      const dhConfig = await visitorApi.getDigitalHumanConfig();
      if (dhConfig.style_preset) {
        this.globalData.dhStyle = dhConfig.style_preset;
        storageService.setDhStyle(dhConfig.style_preset);
      }

      // 4. 预载并缓存 23 景点与 30 拓扑道路
      const graph = await visitorApi.getRouteGraph();
      if (graph && graph.spots) {
        storageService.cacheGraph(graph);
        storageService.cacheSpots(graph.spots);
        console.log(`🗺️ 路网与景点预载成功（${graph.spots.length} 景点，${graph.edges.length} 道路）`);
      }
    } catch (e) {
      console.warn('⚠️ 离线或后端服务连接暂不可用，已自动启用本地降级缓存:', e);
      this.globalData.serverReady = false;
    }
  },
});
