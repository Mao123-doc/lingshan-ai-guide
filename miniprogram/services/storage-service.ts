/**
 * storage-service.ts — 灵小禅小程序本地存储管理服务
 */

import { RoutePlanResponse } from '../types/route';
import { RouteGraph, Spot } from '../types/spot';
import { ChatMessage } from '../types/chat';

const KEYS = {
  SAVED_ROUTE: 'lxz_saved_route',
  CACHED_GRAPH: 'lxz_cached_graph',
  CACHED_SPOTS: 'lxz_cached_spots',
  FAVORITES: 'lxz_favorite_spots',
  CHAT_MESSAGES: 'lxz_chat_messages',
  QA_MODE: 'lxz_qa_mode',
  DH_STYLE: 'lxz_dh_style',
  LAST_SESSION_ID: 'lxz_last_session_id',
};

export const storageService = {
  // 保存/读取已规划路线
  saveRoute(route: RoutePlanResponse): void {
    try {
      wx.setStorageSync(KEYS.SAVED_ROUTE, route);
    } catch (e) {
      console.error('Failed to save route', e);
    }
  },

  getSavedRoute(): RoutePlanResponse | null {
    try {
      return wx.getStorageSync(KEYS.SAVED_ROUTE) || null;
    } catch {
      return null;
    }
  },

  clearSavedRoute(): void {
    wx.removeStorageSync(KEYS.SAVED_ROUTE);
  },

  // 离线路网缓存
  cacheGraph(graph: RouteGraph): void {
    try {
      wx.setStorageSync(KEYS.CACHED_GRAPH, {
        graph,
        cachedAt: new Date().toISOString(),
      });
    } catch (e) {
      console.error('Failed to cache graph', e);
    }
  },

  getCachedGraph(): { graph: RouteGraph; cachedAt: string } | null {
    try {
      return wx.getStorageSync(KEYS.CACHED_GRAPH) || null;
    } catch {
      return null;
    }
  },

  // 景点列表缓存
  cacheSpots(spots: Spot[]): void {
    try {
      wx.setStorageSync(KEYS.CACHED_SPOTS, spots);
    } catch (e) {
      console.error('Failed to cache spots', e);
    }
  },

  getCachedSpots(): Spot[] {
    try {
      return wx.getStorageSync(KEYS.CACHED_SPOTS) || [];
    } catch {
      return [];
    }
  },

  // 收藏景点
  getFavorites(): string[] {
    try {
      return wx.getStorageSync(KEYS.FAVORITES) || [];
    } catch {
      return [];
    }
  },

  toggleFavorite(spotId: string): boolean {
    const list = this.getFavorites();
    const index = list.indexOf(spotId);
    let isFav = false;
    if (index >= 0) {
      list.splice(index, 1);
      isFav = false;
    } else {
      list.push(spotId);
      isFav = true;
    }
    wx.setStorageSync(KEYS.FAVORITES, list);
    return isFav;
  },

  isFavorite(spotId: string): boolean {
    return this.getFavorites().includes(spotId);
  },

  // 问答历史缓存
  getChatHistory(): ChatMessage[] {
    try {
      return wx.getStorageSync(KEYS.CHAT_MESSAGES) || [];
    } catch {
      return [];
    }
  },

  saveChatHistory(messages: ChatMessage[]): void {
    try {
      // 最多缓存最新 30 条对话，避免超过 storage 限制
      const trimmed = messages.slice(-30);
      wx.setStorageSync(KEYS.CHAT_MESSAGES, trimmed);
    } catch (e) {
      console.error('Failed to save chat history', e);
    }
  },

  clearChatHistory(): void {
    wx.removeStorageSync(KEYS.CHAT_MESSAGES);
  },

  // 问答传输模式（stream / json）
  getQaMode(): 'stream' | 'json' {
    try {
      return wx.getStorageSync(KEYS.QA_MODE) || 'stream';
    } catch {
      return 'stream';
    }
  },

  setQaMode(mode: 'stream' | 'json'): void {
    wx.setStorageSync(KEYS.QA_MODE, mode);
  },

  // 数字人预设风格
  getDhStyle(): string {
    try {
      return wx.getStorageSync(KEYS.DH_STYLE) || 'zen_red_gold';
    } catch {
      return 'zen_red_gold';
    }
  },

  setDhStyle(style: string): void {
    wx.setStorageSync(KEYS.DH_STYLE, style);
  },

  // 跨页面/跨Tab参数中转
  setPendingChatQuery(query: string): void {
    try {
      wx.setStorageSync('lxz_pending_chat_query', query);
    } catch {}
  },

  getAndClearPendingChatQuery(): string | null {
    try {
      const q = wx.getStorageSync('lxz_pending_chat_query');
      if (q) {
        wx.removeStorageSync('lxz_pending_chat_query');
        return q;
      }
    } catch {}
    return null;
  },

  setPendingRouteSpot(spot: { spotId: string; name: string }): void {
    try {
      wx.setStorageSync('lxz_pending_route_spot', spot);
    } catch {}
  },

  getAndClearPendingRouteSpot(): { spotId: string; name: string } | null {
    try {
      const s = wx.getStorageSync('lxz_pending_route_spot');
      if (s) {
        wx.removeStorageSync('lxz_pending_route_spot');
        return s;
      }
    } catch {}
    return null;
  },
};
