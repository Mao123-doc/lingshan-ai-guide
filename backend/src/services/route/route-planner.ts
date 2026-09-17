import type { SceneState } from '../scene/scene-state';
import type { RouteGraph, RouteSpot } from './route-contract';
import { validateRoute, type RouteOutcome, type RoutePlan, type RouteStep, type RouteViolation } from './route-validator';
import { findPath } from './pathfinding';

interface SearchState {
  current: string;
  time: number;
  steps: RouteStep[];
  visited: Set<string>;
  score: number;
  walking: number;
  visiting: number;
  waiting: number;
}

function toMinutes(value: string): number {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}

function clock(value: number): string {
  const normalized = ((value % 1440) + 1440) % 1440;
  return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`;
}

function openAt(spot: RouteSpot, time: number): boolean {
  return spot.opening_windows.some(window => {
    const [start, end] = window.split('-').map(toMinutes);
    return start <= end ? time >= start && time <= end : time >= start || time <= end;
  });
}

function spotInterestScore(spot: RouteSpot, interests: string[]): number {
  const text = spot.name;
  let score = 0;
  if (interests.includes('history') && /禅寺|大照壁|阿育王|无尽意/.test(text)) score += 25;
  if (interests.includes('culture') && /大佛|梵宫|坛城|禅寺|博览馆/.test(text)) score += 25;
  if (interests.includes('nature') && /菩提|花海|鹿鸣|湖|花街/.test(text)) score += 25;
  if (interests.includes('architecture') && /宫|塔|门|桥|大佛/.test(text)) score += 25;
  if (interests.includes('family') && /百子|九龙|梵宫/.test(text)) score += 25;
  if (interests.includes('prayer') && /大佛|佛足|九龙|禅寺|弥勒/.test(text)) score += 25;
  return score;
}

function requestedPerformance(scene: SceneState, graph: RouteGraph, spotId: string): { id: string; time?: number; durationMinutes: number } | undefined {
  const performance = graph.performances.find(item => item.location_id === spotId && scene.preferredPerformanceIds.includes(item.id));
  if (!performance) return undefined;
  const requested = scene.preferredPerformanceTimes?.[performance.id];
  if (requested) return { id: performance.id, time: toMinutes(requested), durationMinutes: performance.duration_minutes };
  const current = scene.currentTime ? toMinutes(scene.currentTime) : 0;
  const next = performance.start_times.map(toMinutes).find(time => time >= current);
  return { id: performance.id, time: next, durationMinutes: performance.duration_minutes };
}

function makePlan(startTime: string, state: SearchState, rejectedRequests: Array<{ item: string; reasonCode: string }>, satisfiedConstraints: string[]): RoutePlan {
  const totalMinutes = state.steps.length > 0 ? state.time - toMinutes(startTime) : 0;
  return {
    feasible: true,
    startTime,
    steps: state.steps,
    totalMinutes,
    walkingMinutes: state.walking,
    visitingMinutes: state.visiting,
    waitingMinutes: state.waiting,
    satisfiedConstraints: [...satisfiedConstraints, 'within_time_budget'],
    rejectedRequests,
  };
}

export interface RoutePlanResult extends RoutePlan {
  outcome: RouteOutcome;
  feasible: boolean;
  violations: RouteViolation[];
}

function performanceRejectionReason(id: string, scene: SceneState, graph: RouteGraph): string {
  const performance = graph.performances.find(item => item.id === id);
  const current = scene.currentTime ? toMinutes(scene.currentTime) : undefined;
  const requested = scene.preferredPerformanceTimes?.[id];
  if (!performance) return 'performance_unavailable';
  if (requested && !performance.start_times.includes(requested)) return 'performance_unavailable';
  if (requested && current !== undefined && toMinutes(requested) < current) return 'performance_already_started';
  if (requested && current !== undefined && scene.remainingMinutes !== undefined) {
    const deadline = current + scene.remainingMinutes;
    if (toMinutes(requested) + performance.duration_minutes > deadline) return 'performance_outside_time_budget';
  }
  return 'performance_unavailable';
}

function planRouteInternal(scene: SceneState, graph: RouteGraph, maxStops: number, allowPerformancePreferences: boolean): RoutePlanResult {
  const missing = [...new Set([
    ...scene.missingCriticalFields,
    ...(!scene.currentTime ? ['currentTime'] : []),
  ])].filter(field => ['currentLocation', 'currentTime', 'remainingMinutes'].includes(field));
  if (missing.length > 0 || !scene.currentLocation || !scene.currentTime || scene.remainingMinutes === undefined) {
    return {
      feasible: false,
      outcome: 'needs_clarification',
      startTime: scene.currentTime || '00:00',
      steps: [],
      totalMinutes: 0,
      walkingMinutes: 0,
      visitingMinutes: 0,
      waitingMinutes: 0,
      satisfiedConstraints: [],
      rejectedRequests: missing.map(field => ({ item: field, reasonCode: 'missing_critical_field' })),
      violations: [],
    };
  }

  const startTime = scene.currentTime;
  const deadline = toMinutes(startTime) + scene.remainingMinutes;
  const initial: SearchState = {
    current: scene.currentLocation,
    time: toMinutes(startTime),
    steps: [],
    visited: new Set(scene.visitedSpotIds),
    score: 0,
    walking: 0,
    visiting: 0,
    waiting: 0,
  };
  let beam = [initial];
  const allStates: SearchState[] = [initial];
  const candidates = graph.spots.filter(spot => spot.id !== scene.currentLocation);

  for (let depth = 0; depth < maxStops; depth += 1) {
    const expanded: SearchState[] = [];
    for (const state of beam) {
      for (const spot of candidates) {
        if (state.visited.has(spot.id)) continue;
        const path = findPath(graph, state.current, spot.id, scene.mobility);
        if (!path) continue;
        if ((scene.mobility === 'limited' || scene.mobility === 'wheelchair') && !spot.mobility.wheelchair_accessible) continue;
        const arrive = state.time + path.walkMinutes;
        if (!openAt(spot, arrive)) continue;
        const preference = allowPerformancePreferences ? requestedPerformance(scene, graph, spot.id) : undefined;
        let stepStart = arrive;
        let performanceId: string | undefined;
        let performanceStartTime: string | undefined;
        let performanceDurationMinutes: number | undefined;
        if (preference?.time !== undefined && preference.time >= arrive) {
          stepStart = preference.time;
          performanceId = preference.id;
          performanceStartTime = clock(preference.time);
          performanceDurationMinutes = preference.durationMinutes;
        }
        const visitMinutes = performanceDurationMinutes ?? spot.visit_minutes;
        const end = stepStart + visitMinutes;
        if (!openAt(spot, end) || end > deadline) continue;
        const nextVisited = new Set(state.visited);
        nextVisited.add(spot.id);
        const mustBonus = scene.mustVisitSpotIds.includes(spot.id) ? 1000 : 0;
        const performanceBonus = performanceId ? 500 : 0;
        const coverageBonus = 100;
        const score = state.score + coverageBonus + mustBonus + performanceBonus + spotInterestScore(spot, scene.interests) - path.walkMinutes;
        expanded.push({
          current: spot.id,
          time: end,
          steps: [...state.steps, {
            spotId: spot.id,
            arrive: clock(arrive),
            start: clock(stepStart),
            end: clock(end),
            walkMinutes: path.walkMinutes,
            visitMinutes,
            ...(performanceDurationMinutes !== undefined ? { performanceDurationMinutes } : {}),
            pathSpotIds: path.spotIds,
            reasonCode: scene.mustVisitSpotIds.includes(spot.id) ? 'must_visit' : 'interest_match',
            ...(performanceId ? { performanceId, performanceStartTime } : {}),
          }],
          visited: nextVisited,
          score,
          walking: state.walking + path.walkMinutes,
          visiting: state.visiting + visitMinutes,
          waiting: state.waiting + (stepStart - arrive),
        });
      }
    }
    if (expanded.length === 0) break;
    allStates.push(...expanded);
    expanded.sort((left, right) => right.score - left.score || left.time - right.time || left.current.localeCompare(right.current));
    beam = expanded.slice(0, 24);
  }

  const mustSatisfied = (state: SearchState) => scene.mustVisitSpotIds.every(id => state.visited.has(id));
  const feasibleCandidates = allStates.filter(mustSatisfied);
  const candidateStates = feasibleCandidates.length > 0 ? feasibleCandidates : allStates;
  const rankedStates = scene.mustVisitSpotIds.length === 0 && candidateStates.some(state => state.steps.length > 0)
    ? candidateStates.filter(state => state.steps.length > 0)
    : candidateStates;
  const selected = [...rankedStates].sort((left, right) =>
    Number(mustSatisfied(right)) - Number(mustSatisfied(left)) || right.score - left.score || left.time - right.time,
  )[0] || initial;
  const rejectedRequests: Array<{ item: string; reasonCode: string }> = [];
  for (const id of scene.mustVisitSpotIds) if (!selected.visited.has(id)) rejectedRequests.push({ item: id, reasonCode: 'must_visit_unreachable' });
  const rejectedPerformanceIds = scene.preferredPerformanceIds.filter(id => !selected.steps.some(step => step.performanceId === id));
  for (const id of rejectedPerformanceIds) rejectedRequests.push({ item: id, reasonCode: performanceRejectionReason(id, scene, graph) });
  const satisfiedConstraints = scene.mustVisitSpotIds.filter(id => selected.visited.has(id)).map(id => `must_visit:${id}`);
  const plan = makePlan(startTime, selected, rejectedRequests, satisfiedConstraints);
  const validation = validateRoute(plan, scene, graph);
  const hardViolations = validation.violations.filter(violation => violation.code !== 'missing_preferred_performance');
  const hardRequestRejected = rejectedRequests.some(request => request.reasonCode === 'must_visit_unreachable');

  if (allowPerformancePreferences && rejectedPerformanceIds.length > 0 && !hardRequestRejected && hardViolations.length === 0) {
    const alternative = planRouteInternal({
      ...scene,
      preferredPerformanceIds: [],
      preferredPerformanceTimes: undefined,
    }, graph, maxStops, false);
    if (alternative.feasible && alternative.steps.length > 0) {
      return {
        ...alternative,
        outcome: 'feasible_with_rejected_preferences',
        rejectedRequests,
      };
    }
  }

  const noSteps = selected.steps.length === 0;
  if (noSteps && rejectedPerformanceIds.length > 0 && !rejectedRequests.some(request => request.reasonCode === 'no_alternative_route')) {
    rejectedRequests.push({ item: 'route', reasonCode: 'no_alternative_route' });
  }
  const outcome: RouteOutcome = hardViolations.length > 0 || hardRequestRejected || noSteps
    ? 'infeasible'
    : rejectedPerformanceIds.length > 0
      ? 'feasible_with_rejected_preferences'
      : 'feasible';
  return {
    ...plan,
    feasible: outcome !== 'infeasible',
    outcome,
    rejectedRequests,
    violations: validation.violations,
  };
}

export function planRoute(scene: SceneState, graph: RouteGraph, maxStops = 6): RoutePlanResult {
  return planRouteInternal(scene, graph, maxStops, true);
}
