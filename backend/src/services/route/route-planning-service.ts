import { extractSceneState, extractSceneStateWithLLM, type SceneExtractionResult } from '../scene/scene-extractor';
import {
  normalizeSceneStateInput,
  SceneStateSchema,
  type SceneState,
} from '../scene/scene-state';
import { loadRouteGraph, type RouteGraph } from './route-contract';
import { planRoute, type RoutePlanResult } from './route-planner';
import { validateRoute } from './route-validator';
import {
  normalizeRoutePreferences,
  type NormalizedRoutePreferences,
} from './route-preferences';

export interface RoutePlanningRequest {
  query?: string;
  scene_state?: Partial<SceneState>;
  advisory_profile?: {
    ageGroup?: '青年' | '中年' | '老年';
    budget?: '经济型' | '舒适型' | '豪华型';
  };
}

export type RoutePlanningSource = 'explicit' | 'merged' | 'llm' | 'rules' | 'fallback';

export interface InputEffect {
  field: string;
  kind: 'hard_constraint' | 'soft_preference' | 'advisory';
  applied: boolean;
  summary: string;
}

export interface RouteExplanation {
  input_effects: InputEffect[];
  route_rationale: string[];
  clarification?: string;
  rejected_requests?: Array<{ item: string; reasonCode: string }>;
  consumer_advice?: string[];
  satisfied_constraints?: string[];
  violations?: RoutePlanResult['violations'];
}

export interface RoutePlanningSceneExtraction {
  source: RoutePlanningSource;
  confidence: Record<string, number>;
  missingFields: string[];
  conflicts: string[];
  trace: SceneExtractionResult['trace'];
}

export interface UnifiedRoutePlanResponse {
  query?: string;
  scene_state: SceneState;
  route: RoutePlanResult;
  feasibility: boolean;
  outcome: RoutePlanResult['outcome'];
  clarification?: string;
  explanation: RouteExplanation;
  evidence: Array<{ spot_id: string; name?: string; source?: string; confidence?: string }>;
  scene_extraction: RoutePlanningSceneExtraction;
}

export interface RoutePlanningDependencies {
  graph?: RouteGraph;
  extractSceneStateWithLLM?: typeof extractSceneStateWithLLM;
}

export class RoutePlanningInputError extends Error {
  readonly statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = 'RoutePlanningInputError';
  }
}

const EMPTY_SCENE_STATE: Omit<SceneState, 'currentLocation' | 'currentTime' | 'remainingMinutes'> = {
  mobility: 'unknown',
  interests: [],
  mustVisitSpotIds: [],
  preferredPerformanceIds: [],
  visitedSpotIds: [],
  missingCriticalFields: [],
};

const CRITICAL_FIELDS: Array<keyof Pick<SceneState, 'currentLocation' | 'currentTime' | 'remainingMinutes'>> = [
  'currentLocation',
  'currentTime',
  'remainingMinutes',
];

function assertRequestShape(request: RoutePlanningRequest): void {
  if (!request || (request.query === undefined && request.scene_state === undefined)) {
    throw new RoutePlanningInputError('请求至少需要 query 或 scene_state');
  }
  if (request.query !== undefined && (typeof request.query !== 'string' || !request.query.trim())) {
    throw new RoutePlanningInputError('query 必须是非空文本');
  }
}

function parseExplicitState(value: Partial<SceneState> | undefined): Partial<SceneState> | undefined {
  if (value === undefined) return undefined;
  const normalized = normalizeSceneStateInput(value as Record<string, unknown>);
  const parsed = SceneStateSchema.partial().strict().safeParse(normalized);
  if (!parsed.success) throw new RoutePlanningInputError('scene_state 不符合数据契约');
  return parsed.data;
}

function missingCriticalFields(state: Partial<SceneState>): string[] {
  return CRITICAL_FIELDS.filter(field => state[field] === undefined);
}

function safeExtraction(extraction: SceneExtractionResult, sourceOverride?: RoutePlanningSource): RoutePlanningSceneExtraction {
  return {
    source: sourceOverride || extraction.source,
    confidence: Object.fromEntries(
      Object.entries(extraction.confidence).filter(([, value]) => Number.isFinite(value) && value >= 0 && value <= 1),
    ),
    missingFields: extraction.missingFields.filter(field => typeof field === 'string'),
    conflicts: extraction.conflicts.filter(field => typeof field === 'string'),
    trace: {
      configured: extraction.trace.configured === true,
      executed: extraction.trace.executed === true,
      status: extraction.trace.status,
      ...(extraction.trace.model ? { model: extraction.trace.model } : {}),
      ...(extraction.trace.latencyMs !== undefined ? { latencyMs: extraction.trace.latencyMs } : {}),
      fallbackUsed: extraction.trace.fallbackUsed === true,
      ...(extraction.trace.reason ? { reason: extraction.trace.reason } : {}),
    },
  };
}

function clarificationFor(fields: string[]): string | undefined {
  const prompts: Record<string, string> = {
    currentLocation: '你现在位于景区哪里？例如“景区入口”或“灵山大佛附近”。',
    currentTime: '你现在大约几点开始游览？例如“现在上午10点”或“10:00”。',
    remainingMinutes: '你还计划游览多长时间？例如“还有3小时”或“剩90分钟”。',
  };
  const messages = fields.map(field => prompts[field]).filter((value): value is string => Boolean(value));
  return messages.length > 0 ? messages.join(' ') : undefined;
}

function inputEffects(state: SceneState, advisory?: RoutePlanningRequest['advisory_profile']): InputEffect[] {
  const effects: InputEffect[] = [
    { field: 'currentLocation', kind: 'hard_constraint', applied: Boolean(state.currentLocation), summary: '已将当前位置作为路线真实起点。' },
    { field: 'currentTime', kind: 'hard_constraint', applied: Boolean(state.currentTime), summary: '已将开始时间作为演出时间窗和路线时间轴基准。' },
    { field: 'remainingMinutes', kind: 'hard_constraint', applied: state.remainingMinutes !== undefined, summary: '已将可游览时长作为完整路线时间预算。' },
    { field: 'mobility', kind: 'hard_constraint', applied: state.mobility !== 'unknown', summary: '已按行动能力过滤不可通行道路和景点。' },
    { field: 'interests', kind: 'soft_preference', applied: state.interests.length > 0, summary: '已让所选兴趣共同参与路线评分。' },
    { field: 'partyType', kind: 'soft_preference', applied: Boolean(state.partyType), summary: '已按同行类型应用已有景点标签偏好，不推断行动能力。' },
    { field: 'pace', kind: 'soft_preference', applied: Boolean(state.pace), summary: '已调整建议停留节奏，未缩短路网步行时间或演出时长。' },
    { field: 'ageGroup', kind: 'advisory', applied: Boolean(advisory?.ageGroup), summary: '年龄仅用于个性化提示，不改变物理路线。' },
    { field: 'budget', kind: 'advisory', applied: Boolean(advisory?.budget), summary: '预算用于消费建议，不改变物理路线。' },
  ];
  return effects;
}

function routeRationale(state: SceneState, route: RoutePlanResult, preferences: NormalizedRoutePreferences): string[] {
  const rationale: string[] = [];
  if (state.mobility === 'limited' || state.mobility === 'wheelchair') rationale.push('可达性约束优先，已过滤不适合当前行动能力的道路和景点。');
  if (state.mustVisitSpotIds.length > 0) rationale.push('必去景点优先于软偏好排序。');
  if (state.preferredPerformanceIds.length > 0) rationale.push('演出时间窗参与了路线排序和等待时间计算。');
  if (preferences.interests.length > 0) rationale.push(`${preferences.interests.join('、')}兴趣共同参与评分。`);
  if (route.steps.length > 0) rationale.push('最终路线按时间预算、步行成本和稳定景点 ID 顺序确定。');
  if (rationale.length === 0) rationale.push('当前路线由可达性、开放时间和剩余时间共同决定。');
  return rationale;
}

export async function planRouteRequest(
  request: RoutePlanningRequest,
  dependencies: RoutePlanningDependencies = {},
): Promise<UnifiedRoutePlanResponse> {
  assertRequestShape(request);
  const explicitState = parseExplicitState(request.scene_state);
  let extraction: SceneExtractionResult | undefined;
  if (request.query) {
    const extractor = dependencies.extractSceneStateWithLLM || extractSceneStateWithLLM;
    extraction = await extractor(request.query);
    const validated = SceneStateSchema.safeParse(extraction.state);
    if (!validated.success) {
      const fallbackState = extractSceneState(request.query);
      extraction = {
        state: fallbackState,
        source: 'fallback',
        confidence: {},
        missingFields: [...fallbackState.missingCriticalFields],
        conflicts: [],
        trace: {
          configured: extraction.trace.configured === true,
          executed: extraction.trace.executed === true,
          status: 'fallback',
          fallbackUsed: true,
          reason: 'invalid_scene_state',
        },
      };
    }
  }

  const merged = {
    ...EMPTY_SCENE_STATE,
    ...(extraction?.state || {}),
    ...(explicitState || {}),
  };
  const sceneState = SceneStateSchema.parse({
    ...merged,
    missingCriticalFields: missingCriticalFields(merged),
  });
  const source: RoutePlanningSource = explicitState && extraction
    ? 'merged'
    : explicitState
      ? 'explicit'
      : extraction?.source || 'fallback';
  const sceneExtraction = extraction
    ? safeExtraction(extraction, source)
    : {
      source: 'explicit' as const,
      confidence: {},
      missingFields: sceneState.missingCriticalFields,
      conflicts: [],
      trace: { configured: false, executed: false, status: 'skipped' as const, fallbackUsed: false },
    };
  const graph = dependencies.graph || loadRouteGraph();
  const missing = sceneState.missingCriticalFields;
  const preferences = normalizeRoutePreferences(sceneState);
  const effects = inputEffects(sceneState, request.advisory_profile);

  if (missing.length > 0) {
    const clarification = clarificationFor(missing);
    const route: RoutePlanResult = {
      feasible: false,
      outcome: 'needs_clarification',
      startTime: sceneState.currentTime || '00:00',
      steps: [],
      totalMinutes: 0,
      walkingMinutes: 0,
      visitingMinutes: 0,
      waitingMinutes: 0,
      satisfiedConstraints: [],
      rejectedRequests: missing.map(field => ({ item: field, reasonCode: 'missing_critical_field' })),
      violations: [],
    };
    return {
      ...(request.query ? { query: request.query } : {}),
      scene_state: sceneState,
      route,
      feasibility: false,
      outcome: route.outcome,
      ...(clarification ? { clarification } : {}),
      explanation: {
        input_effects: effects,
        route_rationale: ['路线尚未生成，因为缺少路线所需的当前位置、开始时间或可游览时长。'],
        ...(clarification ? { clarification } : {}),
        rejected_requests: route.rejectedRequests,
      },
      evidence: [],
      scene_extraction: sceneExtraction,
    };
  }

  const route = planRoute(sceneState, graph, 12);
  const validation = validateRoute(route, sceneState, graph);
  const hardViolations = validation.violations.filter(violation => violation.code !== 'missing_preferred_performance');
  if (hardViolations.length > 0) {
    route.feasible = false;
    route.outcome = 'infeasible';
    route.violations = validation.violations;
  }
  const evidence = route.steps.map(step => {
    const spot = graph.spots.find(item => item.id === step.spotId);
    return { spot_id: step.spotId, name: spot?.name, source: spot?.source, confidence: spot?.confidence };
  });
  const consumerAdvice = request.advisory_profile?.budget
    ? [`${request.advisory_profile.budget}预算只用于消费建议，不改变本次物理路线。`]
    : undefined;
  return {
    ...(request.query ? { query: request.query } : {}),
    scene_state: sceneState,
    route,
    feasibility: route.feasible === true,
    outcome: route.outcome,
    explanation: {
      input_effects: effects,
      route_rationale: routeRationale(sceneState, route, preferences),
      rejected_requests: route.rejectedRequests || [],
      satisfied_constraints: route.satisfiedConstraints || [],
      violations: route.violations || [],
      ...(consumerAdvice ? { consumer_advice: consumerAdvice } : {}),
    },
    evidence,
    scene_extraction: sceneExtraction,
  };
}
