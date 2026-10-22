/**
 * api.ts — 灵小禅小程序端与原系统 Express 后端全量 API 契约层
 *
 * 共享原有后端业务逻辑：
 * 1. 真实问答与证据检索 (/api/v1/visitor/qa)
 * 2. 真实多约束运筹路线规划 (/api/v1/visitor/route/plan)
 * 3. 23 景点与周边设施真实查询 (/api/v1/visitor/spots, /nearby)
 * 4. 拍照识景 (/api/v1/visitor/vision/recognize)
 * 5. 数字人配置与问答反馈 (/api/v1/visitor/dh-config, /feedback)
 */

import { request, requestStream, StreamCallbacks } from '../utils/request';
import { SessionInitResponse, ServerStatusResponse, DigitalHumanConfig } from '../types/api';
import { Spot, Facility, RouteGraph } from '../types/spot';
import { RoutePlanningRequest, RoutePlanResponse } from '../types/route';
import { QaResponse, VisionRecognizeResponse, FeedbackInput } from '../types/chat';

export const visitorApi = {
  /**
   * 初始化游客问答会话
   */
  initSession(): Promise<SessionInitResponse> {
    return request<SessionInitResponse>({
      url: '/visitor/session/init',
      method: 'POST',
    });
  },

  /**
   * 发送问答提问（标准稳定 JSON 模式）
   */
  askQuestion(query: string, sessionId: string): Promise<QaResponse> {
    return request<QaResponse>({
      url: '/visitor/qa',
      method: 'POST',
      data: { query, session_id: sessionId },
      timeout: 45000,
    });
  },

  /**
   * 发送问答提问（流式打字机 SSE 模式）
   */
  askQuestionStream(query: string, sessionId: string, callbacks: StreamCallbacks<QaResponse>) {
    return requestStream<QaResponse>(
      '/visitor/qa',
      { query, session_id: sessionId },
      callbacks
    );
  },

  /**
   * 多约束时空路线规划
   */
  planRoute(planningRequest: RoutePlanningRequest): Promise<RoutePlanResponse> {
    return request<RoutePlanResponse>({
      url: '/visitor/route/plan',
      method: 'POST',
      data: planningRequest,
      timeout: 45000,
    });
  },

  /**
   * 获取所有登记景点（23 核心节点）
   */
  getSpots(): Promise<Spot[]> {
    return request<Spot[]>({
      url: '/visitor/spots',
      method: 'GET',
      retryOnTimeout: true,
    });
  },

  /**
   * 获取单个景点详情
   */
  getSpotDetail(spotId: string): Promise<Spot> {
    return request<Spot>({
      url: `/visitor/spots/${encodeURIComponent(spotId)}`,
      method: 'GET',
      retryOnTimeout: true,
    });
  },

  /**
   * 获取路网图数据（节点、边、演出）
   */
  getRouteGraph(): Promise<RouteGraph> {
    return request<RouteGraph>({
      url: '/visitor/route/graph',
      method: 'GET',
      retryOnTimeout: true,
    });
  },

  /**
   * 查询附近景点（按实际 GPS 坐标计算直线距离）
   */
  getNearbySpots(lat: number, lng: number): Promise<Spot[]> {
    return request<Spot[]>({
      url: `/visitor/nearby?lat=${lat}&lng=${lng}`,
      method: 'GET',
      retryOnTimeout: true,
    });
  },

  /**
   * 查询周边服务设施（厕所、餐饮、接驳等）
   */
  getNearbyFacilities(lat: number, lng: number): Promise<Facility[]> {
    return request<Facility[]>({
      url: `/visitor/nearby-facilities?lat=${lat}&lng=${lng}`,
      method: 'GET',
      retryOnTimeout: true,
    });
  },

  /**
   * 获取数字人形象及音色配置
   */
  getDigitalHumanConfig(): Promise<DigitalHumanConfig> {
    return request<DigitalHumanConfig>({
      url: '/visitor/dh-config',
      method: 'GET',
    });
  },

  /**
   * 拍照识景适配接口
   */
  recognizeVision(imageBase64: string): Promise<VisionRecognizeResponse> {
    return request<VisionRecognizeResponse>({
      url: '/visitor/vision/recognize',
      method: 'POST',
      data: { image_base64: imageBase64 },
      timeout: 30000,
    });
  },

  /**
   * 提交回答评价反馈
   */
  submitFeedback(input: FeedbackInput): Promise<{ success: boolean; feedback: any }> {
    return request<{ success: boolean; feedback: any }>({
      url: '/visitor/feedback',
      method: 'POST',
      data: input,
    });
  },

  /**
   * 获取热门常见问题列表
   */
  getHotQuestions(): Promise<Array<{ question: string; count: number }>> {
    return request<Array<{ question: string; count: number }>>({
      url: '/visitor/hot-questions',
      method: 'GET',
      retryOnTimeout: true,
    });
  },

  /**
   * 获取后端健康度及 RAG 索引状态
   */
  getServerStatus(): Promise<ServerStatusResponse> {
    return request<ServerStatusResponse>({
      url: '/visitor/status',
      method: 'GET',
    });
  },
};
