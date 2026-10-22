/**
 * route.ts — 灵小禅移动端多约束智能路线规划
 *
 * 遵循红线约定：
 * 1. 路线规划由后端确定性运筹引擎计算（Dijkstra + 24宽 Beam Search）。
 * 2. 真实处理 4 种规划状态：feasible, feasible_with_rejected_preferences, needs_clarification, infeasible。
 * 3. 严格保留倒排时空、演出提前入场缓冲与返回南门约束。
 * 4. 进度确认晚于计划超过 10 分钟且开启自动纠偏时，自动增量重规划。
 * 5. 断网时提供本地确定性应急规划，不含演出。
 */

import { visitorApi } from '../../services/api';
import { storageService } from '../../services/storage-service';
import { locationService } from '../../services/location-service';
import { planOfflineRoute } from '../../services/offline-route';
import { RouteGraph, Spot } from '../../types/spot';
import { RoutePlanningRequest, RoutePlanResponse, RouteOutcome } from '../../types/route';
import {
  getRouteOutcomeLabel,
  getRouteRequestLabel,
  getRouteRejectionMessage,
  getClarificationPrompt,
  parseMinutes,
  formatMinutes,
} from '../../utils/format';

const DEFAULT_QUERY = '我带腿脚不方便的妈妈，现在在景区入口，只有三小时，还想看两点的《吉祥颂》，应该怎么走？';

const INTERESTS = [
  { key: '历史', label: '历史文化', icon: '📜', desc: '千年佛教传承' },
  { key: '文化', label: '佛教文化', icon: '⭐', desc: '深度文化体验' },
  { key: '自然', label: '自然风光', icon: '🌲', desc: '太湖山水美景' },
  { key: '建筑', label: '建筑艺术', icon: '🏛️', desc: '佛教建筑杰作' },
  { key: '祈福', label: '祈福体验', icon: '🙏', desc: '吉祥平安之旅' },
];

Page({
  data: {
    graph: null as RouteGraph | null,
    spots: [] as Spot[],
    activeTab: 'natural' as 'natural' | 'structured',
    sceneQuery: DEFAULT_QUERY,
    selectedInterests: ['文化', '历史'],
    startSpotId: 'south_gate',
    currentTimeStr: '09:00',
    durationHours: 3,
    travelType: '带长辈',
    mobility: 'limited' as 'normal' | 'limited' | 'wheelchair',
    pace: 'normal' as 'slow' | 'normal' | 'fast',
    ageGroup: '中年',
    budget: '舒适型',
    interestsList: INTERESTS,
    isLoading: false,
    routePlan: null as RoutePlanResponse | null,
    routeOutcome: null as RouteOutcome | null,
    routeOutcomeLabel: '',
    clarificationPrompt: '',
    clarificationInput: '',
    rejectedList: [] as Array<{ item: string; reason: string }>,
    routeSteps: [] as any[],
    // 进度与自动纠偏
    progressSpotId: 'south_gate',
    progressTimeStr: '09:00',
    deadlineTimeStr: '12:00',
    completedSpotIds: [] as string[],
    autoCorrect: true,
    progressNotice: '',
    lastAutoKey: '',
    isOfflineView: false,
    errorMessage: '',
  },

  onLoad(options?: { spotId?: string; name?: string; q?: string }) {
    this.loadGraphAndSpots();
    // 恢复已保存路线（如有）
    const saved = storageService.getSavedRoute();
    if (saved) {
      this.hydrateRouteResponse(saved);
    }

    if (options?.spotId) {
      const decodedId = decodeURIComponent(options.spotId);
      const decodedName = options.name ? decodeURIComponent(options.name) : decodedId;
      this.setData({
        startSpotId: decodedId,
        progressSpotId: decodedId,
        sceneQuery: `我想去${decodedName}游玩，请帮我规划合适路线`,
      });
    } else if (options?.q) {
      this.setData({ sceneQuery: decodeURIComponent(options.q) });
    }
  },

  onShow() {
    const pending = storageService.getAndClearPendingRouteSpot();
    if (pending) {
      this.setData({
        startSpotId: pending.spotId,
        progressSpotId: pending.spotId,
        sceneQuery: `我想去${pending.name}游玩，请帮我规划合适路线`,
      });
    }
  },

  async loadGraphAndSpots() {
    try {
      const graph = await visitorApi.getRouteGraph();
      if (graph && graph.spots) {
        this.setData({
          graph,
          spots: graph.spots,
        });
        storageService.cacheGraph(graph);
        storageService.cacheSpots(graph.spots);
      }
    } catch {
      // 离线降级读取缓存
      const cached = storageService.getCachedGraph();
      if (cached) {
        this.setData({
          graph: cached.graph,
          spots: cached.graph.spots,
          isOfflineView: true,
        });
      }
    }
  },

  switchTab(e: WechatMiniprogram.CustomEvent) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
  },

  onQueryInput(e: WechatMiniprogram.Input) {
    this.setData({ sceneQuery: e.detail.value });
  },

  toggleInterest(e: WechatMiniprogram.CustomEvent) {
    const key = e.currentTarget.dataset.key;
    const current = [...this.data.selectedInterests];
    const idx = current.indexOf(key);
    if (idx >= 0) {
      current.splice(idx, 1);
    } else {
      current.push(key);
    }
    this.setData({ selectedInterests: current });
  },

  onStartSpotChange(e: WechatMiniprogram.PickerChange) {
    const idx = Number(e.detail.value);
    const spot = this.data.spots[idx];
    if (spot) {
      this.setData({ startSpotId: spot.id, progressSpotId: spot.id });
    }
  },

  onTimeChange(e: WechatMiniprogram.PickerChange) {
    const time = String(e.detail.value);
    const [h, m] = time.split(':').map(Number);
    const endMinutes = h * 60 + m + this.data.durationHours * 60;
    this.setData({
      currentTimeStr: time,
      progressTimeStr: time,
      deadlineTimeStr: formatMinutes(endMinutes),
    });
  },

  onDurationChange(e: WechatMiniprogram.CustomEvent) {
    const hours = Number(e.currentTarget.dataset.hours);
    const [h, m] = this.data.currentTimeStr.split(':').map(Number);
    const endMinutes = h * 60 + m + hours * 60;
    this.setData({
      durationHours: hours,
      deadlineTimeStr: formatMinutes(endMinutes),
    });
  },

  onMobilityChange(e: WechatMiniprogram.CustomEvent) {
    this.setData({ mobility: e.currentTarget.dataset.val });
  },

  onTravelTypeChange(e: WechatMiniprogram.CustomEvent) {
    this.setData({ travelType: e.currentTarget.dataset.val });
  },

  onAutoCorrectToggle(e: WechatMiniprogram.SwitchChange) {
    this.setData({ autoCorrect: e.detail.value });
  },

  // 提交自然语言路线规划
  handleNaturalPlan() {
    const q = this.data.sceneQuery.trim();
    if (!q || this.data.isLoading) return;
    this.submitPlanningRequest({
      query: q,
      scene_state: {
        returnToExit: true,
        exitSpotId: 'south_gate',
      },
    });
  },

  // 提交结构化参数路线规划
  handleStructuredPlan() {
    if (this.data.isLoading) return;
    const {
      startSpotId,
      currentTimeStr,
      durationHours,
      travelType,
      mobility,
      pace,
      selectedInterests,
      ageGroup,
      budget,
    } = this.data;

    this.submitPlanningRequest({
      scene_state: {
        returnToExit: true,
        exitSpotId: 'south_gate',
        currentLocation: startSpotId,
        currentTime: currentTimeStr,
        remainingMinutes: durationHours * 60,
        partyType: travelType,
        mobility,
        pace,
        interests: selectedInterests,
        mustVisitSpotIds: [],
        preferredPerformanceIds: [],
        visitedSpotIds: [],
      },
      advisory_profile: {
        ageGroup: ageGroup as any,
        budget: budget as any,
      },
    });
  },

  // 统一调用规划服务
  async submitPlanningRequest(req: RoutePlanningRequest) {
    this.setData({ isLoading: true, errorMessage: '' });
    try {
      const res = await visitorApi.planRoute(req);
      this.hydrateRouteResponse(res);
      storageService.saveRoute(res);
    } catch (err: any) {
      console.warn('Online planning failed, checking offline', err);
      if (this.data.graph) {
        wx.showModal({
          title: '在线规划不可用',
          content: '网络连接异常或未启动服务。是否使用本地缓存路网进行离线应急规划？',
          confirmText: '应急规划',
          success: (mRes) => {
            if (mRes.confirm) {
              this.handleOfflinePlan();
            }
          },
        });
      } else {
        this.setData({
          errorMessage: err.error || '路线规划服务暂时不可用，请稍后重试',
        });
      }
    } finally {
      this.setData({ isLoading: false });
    }
  },

  // 处理规划响应渲染
  hydrateRouteResponse(res: RoutePlanResponse) {
    const outcome = (res.outcome || (res.feasibility ? 'feasible' : 'infeasible')) as RouteOutcome;
    const steps = res.route?.steps || [];
    const outcomeLabel = getRouteOutcomeLabel(outcome, steps.length);

    // 格式化被拒绝项
    const rejectedList = (res.route?.rejectedRequests || []).map((r) => ({
      item: getRouteRequestLabel(r.item),
      reason: getRouteRejectionMessage(r.reasonCode),
    }));

    // 格式化追问
    let clarificationPrompt = res.clarification || '';
    if (!clarificationPrompt && res.scene_state?.missingCriticalFields?.length) {
      clarificationPrompt = res.scene_state.missingCriticalFields
        .map(getClarificationPrompt)
        .join(' ');
    }

    // 注入景点名称与经纬度
    const decoratedSteps = steps.map((step, idx) => {
      const spotObj = this.data.spots.find((s) => s.id === step.spotId);
      return {
        ...step,
        stepIndex: idx + 1,
        spotName: spotObj?.name || step.spotId,
        spotLat: spotObj?.lat,
        spotLng: spotObj?.lng,
        isReturn: step.reasonCode === 'return_to_exit',
        accessibleDesc: step.pathEvidence?.every((p: any) => p.accessible)
          ? '全线无障碍通行'
          : '部分路段含台阶或坡道',
      };
    });

    this.setData({
      routePlan: res,
      routeOutcome: outcome,
      routeOutcomeLabel: outcomeLabel,
      routeSteps: decoratedSteps,
      rejectedList,
      clarificationPrompt,
      clarificationInput: '',
    });

    // 自动更新进度栏默认状态
    if (res.scene_state?.currentLocation) {
      this.setData({ progressSpotId: res.scene_state.currentLocation });
    }
    if (res.scene_state?.currentTime) {
      this.setData({ progressTimeStr: res.scene_state.currentTime });
    }
  },

  // 澄清追问补充提交
  onClarificationInput(e: WechatMiniprogram.Input) {
    this.setData({ clarificationInput: e.detail.value });
  },

  submitClarification() {
    const extra = this.data.clarificationInput.trim();
    if (!extra) return;
    const newQuery = `${this.data.sceneQuery}，${extra}`;
    this.setData({ sceneQuery: newQuery, clarificationInput: '' });
    this.submitPlanningRequest({
      query: newQuery,
      scene_state: {
        returnToExit: true,
        exitSpotId: 'south_gate',
      },
    });
  },

  // 进度打卡确认
  confirmProgressStep(e: WechatMiniprogram.CustomEvent) {
    const spotId = e.currentTarget.dataset.id;
    const currentCompleted = [...this.data.completedSpotIds];
    if (!currentCompleted.includes(spotId)) {
      currentCompleted.push(spotId);
    }

    const step = this.data.routeSteps.find((s) => s.spotId === spotId && !s.isReturn);
    let notice = `已确认完成【${step?.spotName || spotId}】游览。`;

    if (step && step.end) {
      const plannedEndMin = parseMinutes(step.end);
      const nowMin = parseMinutes(this.data.progressTimeStr);
      const delay = nowMin - plannedEndMin;

      if (delay > 0) {
        notice += ` 比计划延迟了 ${delay} 分钟。`;
      } else {
        notice += ` 比计划提前了 ${Math.abs(delay)} 分钟。`;
      }

      // 超时 10 分钟自动增量纠偏
      const key = `${spotId}|${this.data.progressTimeStr}`;
      if (this.data.autoCorrect && delay > 10 && this.data.lastAutoKey !== key) {
        this.setData({
          lastAutoKey: key,
          progressNotice: `${notice} 已自动优化后续游览路线。`,
          completedSpotIds: currentCompleted,
          progressSpotId: spotId,
        });
        this.replanFromProgress(currentCompleted, spotId);
        return;
      }
    }

    this.setData({
      completedSpotIds: currentCompleted,
      progressSpotId: spotId,
      progressNotice: notice,
    });
  },

  // 按进度重新规划
  replanFromProgress(completed?: any, fromSpot?: string) {
    const visited = Array.isArray(completed) ? completed : this.data.completedSpotIds;
    const origin = (typeof fromSpot === 'string' && fromSpot) ? fromSpot : this.data.progressSpotId;
    const nowMin = parseMinutes(this.data.progressTimeStr);
    const deadlineMin = parseMinutes(this.data.deadlineTimeStr);
    const remaining = deadlineMin - nowMin;

    if (remaining <= 0) {
      wx.showModal({
        title: '已到计划离园时间',
        content: '距离计划离园时间已不足，建议您沿主干平缓步道经由南门出口出园。',
        showCancel: false,
      });
      return;
    }

    this.submitPlanningRequest({
      scene_state: {
        returnToExit: true,
        exitSpotId: 'south_gate',
        currentLocation: origin,
        currentTime: this.data.progressTimeStr,
        remainingMinutes: remaining,
        visitedSpotIds: visited,
        mobility: this.data.mobility,
        pace: this.data.pace,
        interests: this.data.selectedInterests,
      },
    });
  },

  // 离线应急规划
  handleOfflinePlan() {
    if (!this.data.graph) {
      wx.showToast({
        title: '缺少路网缓存，请先联网同步',
        icon: 'none',
      });
      return;
    }

    wx.showLoading({ title: '正在定制游览路线…' });
    try {
      const nowMin = parseMinutes(this.data.progressTimeStr);
      const deadlineMin = parseMinutes(this.data.deadlineTimeStr);
      const remaining = Math.max(deadlineMin - nowMin, 60);

      const res = planOfflineRoute(this.data.graph, {
        currentLocation: this.data.progressSpotId,
        currentTime: this.data.progressTimeStr,
        remainingMinutes: remaining,
        mobility: this.data.mobility,
        visitedSpotIds: this.data.completedSpotIds,
      });

      this.hydrateRouteResponse(res);
      this.setData({ isOfflineView: true });
      wx.hideLoading();
      wx.showToast({
        title: '离线路线规划就绪',
        icon: 'success',
      });
    } catch (e: any) {
      wx.hideLoading();
      wx.showModal({
        title: '离线规划失败',
        content: e.message || '数据不全，无法计算',
        showCancel: false,
      });
    }
  },

  // 调起微信实景导航
  openStepNav(e: WechatMiniprogram.CustomEvent) {
    const step = e.currentTarget.dataset.step;
    if (step && step.spotLat && step.spotLng) {
      locationService.openNavigation({
        name: step.spotName,
        lat: step.spotLat,
        lng: step.spotLng,
        description: `路线第${step.stepIndex}站，计划用时${step.visitMinutes}分钟`,
      });
    } else {
      wx.showToast({
        title: '该节点暂无坐标数据',
        icon: 'none',
      });
    }
  },

  // 快速去问答
  askStepDetail(e: WechatMiniprogram.CustomEvent) {
    const name = e.currentTarget.dataset.name;
    if (name) {
      wx.reLaunch({
        url: `/pages/chat/chat?q=${encodeURIComponent(`请介绍${name}`)}`,
      });
    }
  },
});
