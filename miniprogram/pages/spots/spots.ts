/**
 * spots.ts — 灵山胜境景点全景导览列表
 */

import { visitorApi } from '../../services/api';
import { storageService } from '../../services/storage-service';
import { Spot } from '../../types/spot';

Page({
  data: {
    allSpots: [] as Spot[],
    filteredSpots: [] as Spot[],
    searchKeyword: '',
    selectedCategory: 'all',
    isLoading: true,
    categories: [
      { key: 'all', label: '全部景观' },
      { key: 'lingshan', label: '灵山核心区' },
      { key: 'nianhua', label: '拈花湾区' },
      { key: 'accessible', label: '♿ 无障碍友好' },
    ],
  },

  onLoad() {
    this.fetchSpots();
  },

  onPullDownRefresh() {
    this.fetchSpots().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  async fetchSpots() {
    this.setData({ isLoading: true });
    try {
      const spots = await visitorApi.getSpots();
      this.setData({
        allSpots: spots,
        filteredSpots: this.filterList(spots, this.data.searchKeyword, this.data.selectedCategory),
        isLoading: false,
      });
      storageService.cacheSpots(spots);
    } catch {
      // 离线降级
      const cached = storageService.getCachedSpots();
      this.setData({
        allSpots: cached,
        filteredSpots: this.filterList(cached, this.data.searchKeyword, this.data.selectedCategory),
        isLoading: false,
      });
    }
  },

  onSearchInput(e: WechatMiniprogram.Input) {
    const kw = e.detail.value.trim();
    this.setData({
      searchKeyword: kw,
      filteredSpots: this.filterList(this.data.allSpots, kw, this.data.selectedCategory),
    });
  },

  clearSearch() {
    this.setData({
      searchKeyword: '',
      filteredSpots: this.filterList(this.data.allSpots, '', this.data.selectedCategory),
    });
  },

  onCategorySelect(e: WechatMiniprogram.CustomEvent) {
    const cat = e.currentTarget.dataset.key;
    this.setData({
      selectedCategory: cat,
      filteredSpots: this.filterList(this.data.allSpots, this.data.searchKeyword, cat),
    });
  },

  filterList(list: Spot[], keyword: string, category: string): Spot[] {
    return list.filter((spot) => {
      // 分类筛选
      if (category === 'lingshan' && !spot.id.startsWith('LS-') && spot.id !== 'south_gate') {
        return false;
      }
      if (category === 'nianhua' && !spot.id.startsWith('NH-')) {
        return false;
      }
      if (category === 'accessible' && !spot.mobility?.wheelchair_accessible) {
        return false;
      }

      // 关键词搜索
      if (keyword) {
        const matchName = spot.name.toLowerCase().includes(keyword.toLowerCase());
        const matchDesc = spot.description?.toLowerCase().includes(keyword.toLowerCase());
        const matchArea = spot.area?.toLowerCase().includes(keyword.toLowerCase());
        return matchName || matchDesc || matchArea;
      }

      return true;
    });
  },

  goToDetail(e: WechatMiniprogram.CustomEvent) {
    const id = e.currentTarget.dataset.id;
    if (id) {
      wx.navigateTo({
        url: `/pages/spots/detail?id=${encodeURIComponent(id)}`,
      });
    }
  },

  askAboutSpot(e: WechatMiniprogram.CustomEvent) {
    const name = e.currentTarget.dataset.name;
    if (name) {
      wx.reLaunch({
        url: `/pages/chat/chat?q=${encodeURIComponent(`请介绍${name}`)}`,
      });
    }
  },
});
