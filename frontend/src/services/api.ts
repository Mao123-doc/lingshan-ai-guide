import axios from 'axios';

type JsonObject = Record<string, unknown>;
type QueryParams = Record<string, string | number | boolean | undefined>;

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 90000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor — inject JWT for admin routes
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token');
  if (token && config.url?.startsWith('/admin')) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — handle 401 by redirecting to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && error.config?.url?.startsWith('/admin')) {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
      if (window.location.pathname.startsWith('/admin') && !window.location.pathname.includes('/login')) {
        window.location.href = '/admin/login';
      }
    }
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export default api;

// API types
export type RouteOutcome =
  | 'feasible'
  | 'feasible_with_rejected_preferences'
  | 'needs_clarification'
  | 'infeasible';

export type SceneExtractionSource = 'explicit' | 'llm' | 'rules' | 'fallback' | 'merged';
export type SceneExtractionStatus = 'success' | 'fallback' | 'failed' | 'skipped';

export interface SceneExtractionTrace {
  configured: boolean;
  executed: boolean;
  status: SceneExtractionStatus;
  model?: string;
  latencyMs?: number;
  fallbackUsed: boolean;
  reason?: string;
}

export interface SceneExtractionMetadata {
  source: SceneExtractionSource;
  confidence: Record<string, number>;
  missingFields: string[];
  conflicts: string[];
  trace: SceneExtractionTrace;
}

export interface RouteStep {
  start: string;
  end: string;
  spotId: string;
  arrive: string;
  walkMinutes: number;
  visitMinutes: number;
  waitingMinutes?: number;
  performanceId?: string;
  performanceName?: string;
  performanceStartTime?: string;
}

export interface RejectedRequest {
  item: string;
  reasonCode: string;
}

export interface RouteEvidence {
  spot_id?: string;
  name?: string;
  source?: string;
  confidence?: string;
}

export type Mobility = 'normal' | 'limited' | 'wheelchair' | 'unknown';
export type Pace = 'slow' | 'normal' | 'fast';

export interface SceneStateInput {
  currentLocation?: string;
  currentTime?: string;
  remainingMinutes?: number;
  partyType?: string;
  mobility?: Mobility | '正常' | '行动不便' | '轮椅';
  mealRequested?: boolean;
  interests?: string[];
  mustVisitSpotIds?: string[];
  preferredPerformanceIds?: string[];
  preferredPerformanceTimes?: Record<string, string>;
  visitedSpotIds?: string[];
  pace?: Pace | '轻松' | '标准' | '紧凑';
  missingCriticalFields?: string[];
}

export interface AdvisoryProfile {
  ageGroup?: '青年' | '中年' | '老年';
  budget?: '经济型' | '舒适型' | '豪华型';
}

export interface RoutePlanningRequest {
  query?: string;
  scene_state?: SceneStateInput;
  advisory_profile?: AdvisoryProfile;
}

export interface InputEffect {
  field: string;
  kind: 'hard_constraint' | 'soft_preference' | 'advisory';
  applied: boolean;
  summary: string;
}

export interface RoutePlanResponse {
  query?: string;
  outcome?: RouteOutcome;
  feasibility?: boolean;
  clarification?: string;
  scene_state?: {
    missingCriticalFields?: string[];
    [key: string]: unknown;
  };
  route?: {
    steps?: RouteStep[];
    totalMinutes?: number;
    walkingMinutes?: number;
    visitingMinutes?: number;
    waitingMinutes?: number;
    rejectedRequests?: RejectedRequest[];
    satisfiedConstraints?: string[];
    violations?: string[];
  };
  explanation?: {
    clarification?: string;
    satisfied_constraints?: string[];
    rejected_requests?: RejectedRequest[];
    violations?: Array<{ code: string; message: string; stepIndex?: number }>;
    input_effects?: InputEffect[];
    route_rationale?: string[];
    consumer_advice?: string[];
  };
  evidence?: RouteEvidence[];
  scene_extraction?: SceneExtractionMetadata;
}

// API methods
export const visitorAPI = {
  initSession: () => api.post('/visitor/session/init'),
  askQuestion: (query: string, sessionId: string) =>
    api.post('/visitor/qa', { query, session_id: sessionId }),
  getSpots: () => api.get('/visitor/spots'),
  getSpotDetail: (id: string) => api.get(`/visitor/spots/${id}`),
  recommend: (payload: JsonObject) =>
    api.post('/visitor/recommend', payload),
  /** @deprecated Use planRoute; retained only for external legacy clients. */
  planRouteLegacy: (payload: JsonObject) =>
    api.post<RoutePlanResponse>('/visitor/recommend', payload),
  planRoute: (request: RoutePlanningRequest) =>
    api.post<RoutePlanResponse>('/visitor/route/plan', request),
  planRouteQuery: (query: string, sceneState?: SceneStateInput) =>
    api.post<RoutePlanResponse>('/visitor/route/plan', { query, scene_state: sceneState }),
  submitFeedback: (sessionId: string, rating: number, comment: string) =>
    api.post('/visitor/feedback', { session_id: sessionId, rating, comment }),
  getHotQuestions: () => api.get('/visitor/hot-questions'),
  recognizeImage: (imageBase64: string) =>
    api.post('/visitor/vision/recognize', { image_base64: imageBase64 }),
  textToSpeech: (text: string) =>
    api.post('/visitor/tts', { text }),
  getStatus: () => api.get('/visitor/status'),
};

export const adminAPI = {
  login: (username: string, password: string) =>
    api.post('/auth/login', { username, password }),
  getDashboard: () => api.get('/admin/dashboard/summary'),
  getSentimentReport: (period: string = 'week') =>
    api.get('/admin/reports/sentiment', { params: { period } }),
  getDigitalHuman: () => api.get('/admin/digital-human/appearance'),
  updateDigitalHuman: (config: JsonObject) =>
    api.put('/admin/digital-human/appearance', config),
  uploadDocument: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/admin/knowledge/documents', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  getDocuments: () => api.get('/admin/knowledge/documents'),
  deleteDocument: (id: string) => api.delete(`/admin/knowledge/documents/${id}`),
  refreshIndex: () => api.post('/admin/knowledge/refresh-index'),
  getKnowledgeStats: () => api.get('/admin/knowledge/stats'),
  analyzeSentiment: (text: string) =>
    api.post('/admin/reports/analyze-sentiment', { text }),
  getConversations: (params: QueryParams) =>
    api.get('/admin/conversations', { params }),
  getTopUnsatisfied: () =>
    api.get('/admin/top-unsatisfied'),
  getVisitorLocations: () =>
    api.get('/admin/visitor-locations'),
  getCategoryDistribution: () =>
    api.get('/admin/category-distribution'),
  exportConversations: async (params: QueryParams) => {
    const token = localStorage.getItem('admin_token');
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) query.set(key, String(value));
    });
    const queryStr = query.toString();
    const res = await fetch(`/api/v1/admin/conversations/export?${queryStr}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversations_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  },
};
