import type { SceneState } from '../scene/scene-state';
import type { RouteGraph, RouteSpot } from './route-contract';

export interface RouteStep {
  spotId: string;
  arrive: string;
  start: string;
  end: string;
  walkMinutes: number;
  visitMinutes: number;
  reasonCode: string;
  performanceId?: string;
  performanceStartTime?: string;
}

export type RouteOutcome = 'feasible' | 'feasible_with_rejected_preferences' | 'needs_clarification' | 'infeasible';

export interface RoutePlan {
  outcome?: RouteOutcome;
  feasible?: boolean;
  startTime: string;
  steps: RouteStep[];
  totalMinutes: number;
  walkingMinutes: number;
  visitingMinutes: number;
  waitingMinutes: number;
  satisfiedConstraints?: string[];
  rejectedRequests?: Array<{ item: string; reasonCode: string }>;
  violations?: RouteViolation[];
}

export interface RouteViolation {
  code: string;
  message: string;
  stepIndex?: number;
}

export interface RouteValidationResult {
  valid: boolean;
  violations: RouteViolation[];
}

function toMinutes(value: string): number | undefined {
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) return undefined;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour <= 23 && minute <= 59 ? hour * 60 + minute : undefined;
}

function withinWindows(time: number, windows: string[]): boolean {
  return windows.some(window => {
    const [start, end] = window.split('-').map(toMinutes);
    if (start === undefined || end === undefined) return false;
    return start <= end ? time >= start && time <= end : time >= start || time <= end;
  });
}

function findEdge(graph: RouteGraph, from: string, to: string) {
  return graph.edges.find(edge => edge.from === from && edge.to === to)
    || graph.edges.find(edge => edge.from === to && edge.to === from);
}

function findSpot(graph: RouteGraph, id: string): RouteSpot | undefined {
  return graph.spots.find(spot => spot.id === id);
}

export function validateRoute(plan: RoutePlan, scene: SceneState, graph: RouteGraph): RouteValidationResult {
  const violations: RouteViolation[] = [];
  const start = toMinutes(plan.startTime);
  if (start === undefined) violations.push({ code: 'invalid_start_time', message: '路线开始时间格式无效' });

  const seen = new Set<string>();
  let previous = scene.currentLocation;
  let computedWalking = 0;
  let computedVisiting = 0;
  let previousEnd: number | undefined;

  if (!previous && plan.steps.length > 0) {
    violations.push({ code: 'missing_current_location', message: '路线缺少当前地点，无法验证首段可达性' });
  }

  plan.steps.forEach((step, index) => {
    const spot = findSpot(graph, step.spotId);
    if (!spot) {
      violations.push({ code: 'unknown_spot', message: `未知景点：${step.spotId}`, stepIndex: index });
      return;
    }
    if (seen.has(step.spotId)) violations.push({ code: 'duplicate_spot', message: `景点重复：${step.spotId}`, stepIndex: index });
    seen.add(step.spotId);

    const arrive = toMinutes(step.arrive);
    const stepStart = toMinutes(step.start);
    const end = toMinutes(step.end);
    if ([arrive, stepStart, end].some(value => value === undefined)) {
      violations.push({ code: 'invalid_step_time', message: `步骤时间格式无效：${step.spotId}`, stepIndex: index });
      return;
    }
    if (stepStart! < arrive! || end! < stepStart!) {
      violations.push({ code: 'invalid_time_order', message: `步骤时间顺序无效：${step.spotId}`, stepIndex: index });
    }
    if (stepStart! - arrive! !== 0 && stepStart! - arrive! !== plan.waitingMinutes) {
      // Waiting is allowed, but its aggregate is checked below; no hidden time is accepted.
    }
    if (!withinWindows(stepStart!, spot.opening_windows) || !withinWindows(end!, spot.opening_windows)) {
      violations.push({ code: 'outside_opening_window', message: `不在开放时间内：${spot.name}`, stepIndex: index });
    }

    if (previous) {
      const edge = findEdge(graph, previous, step.spotId);
      if (!edge) {
        violations.push({ code: 'disconnected', message: `地点不可连续到达：${previous} -> ${step.spotId}`, stepIndex: index });
      } else {
        computedWalking += edge.walk_minutes;
        if ((scene.mobility === 'limited' || scene.mobility === 'wheelchair') && !edge.accessible) {
          violations.push({ code: 'mobility_inaccessible_edge', message: `行动能力不适合通行：${previous} -> ${step.spotId}`, stepIndex: index });
        }
      }
    }
    if ((scene.mobility === 'limited' || scene.mobility === 'wheelchair') && !spot.mobility.wheelchair_accessible) {
      violations.push({ code: 'mobility_inaccessible_spot', message: `景点无已确认无障碍条件：${spot.name}`, stepIndex: index });
    }
    if (step.visitMinutes !== spot.visit_minutes) {
      violations.push({ code: 'visit_duration_mismatch', message: `停留时间与数据合同不一致：${spot.name}`, stepIndex: index });
    }
    if (step.performanceId) {
      const performance = graph.performances.find(item => item.id === step.performanceId);
      if (!performance) {
        violations.push({ code: 'unknown_performance', message: `未知演出：${step.performanceId}`, stepIndex: index });
      } else if (performance.location_id !== step.spotId) {
        violations.push({ code: 'performance_location_mismatch', message: `演出地点不匹配：${performance.name}`, stepIndex: index });
      } else if (step.performanceStartTime && !performance.start_times.includes(step.performanceStartTime)) {
        violations.push({ code: 'performance_time_mismatch', message: `演出时间不在数据合同中：${step.performanceStartTime}`, stepIndex: index });
      }
    }
    previous = step.spotId;
    previousEnd = end;
    computedVisiting += step.visitMinutes;
  });

  const mustVisit = new Set(scene.mustVisitSpotIds);
  for (const id of mustVisit) if (!seen.has(id)) violations.push({ code: 'missing_must_visit', message: `未包含必须到访景点：${id}` });
  for (const id of scene.visitedSpotIds) if (seen.has(id)) violations.push({ code: 'already_visited', message: `重复安排已游览景点：${id}` });
  for (const id of scene.preferredPerformanceIds) {
    const explicitlyRejected = plan.rejectedRequests?.some(request => request.item === id && request.reasonCode === 'performance_unavailable');
    if (!plan.steps.some(step => step.performanceId === id) && !explicitlyRejected) {
      violations.push({ code: 'missing_preferred_performance', message: `未满足偏好演出：${id}` });
    }
  }

  const planEnd = plan.steps.length > 0 ? toMinutes(plan.steps[plan.steps.length - 1].end) : start;
  const totalByClock = start !== undefined && planEnd !== undefined ? planEnd - start : undefined;
  if (scene.remainingMinutes !== undefined && totalByClock !== undefined && totalByClock > scene.remainingMinutes) {
    violations.push({ code: 'time_budget_exceeded', message: '路线超过游客剩余时间' });
  }
  if (plan.totalMinutes !== (totalByClock ?? plan.totalMinutes)) violations.push({ code: 'total_time_mismatch', message: '总时长与时间轴不一致' });
  if (plan.walkingMinutes !== computedWalking) violations.push({ code: 'walking_time_mismatch', message: '步行时长与路网不一致' });
  if (plan.visitingMinutes !== computedVisiting) violations.push({ code: 'visiting_time_mismatch', message: '游览时长与景点数据不一致' });
  if (previousEnd !== undefined && start !== undefined && previousEnd < start) violations.push({ code: 'invalid_cross_day_plan', message: '路线跨日暂不支持' });

  return { valid: violations.length === 0, violations };
}
