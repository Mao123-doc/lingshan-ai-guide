/**
 * offline-route.ts — 灵小禅小程序端确定性离线应急路线规划器
 *
 * 核心原则：
 * 1. 纯本地确定性算法，不发起任何网络请求或大模型调用。
 * 2. 基于本地缓存的真实 23 景点与 30 拓扑道路。
 * 3. 严格预留返回南门出口时间，保证游客安全。
 * 4. 离线模式明确提示不含实时演出、接驳班次与动态路况。
 */

import { RouteGraph, Spot, RouteEdge } from '../types/spot';
import { RoutePlanResponse, RouteStep, SceneStateInput } from '../types/route';
import { parseMinutes, formatMinutes } from '../utils/format';

interface PathResult {
  path: string[];
  totalDistance: number;
  totalWalkMinutes: number;
  evidence: Array<{
    from: string;
    to: string;
    distance_m: number;
    walk_minutes: number;
    source: string;
    confidence: string;
    accessible: boolean;
  }>;
}

export function findShortestPath(
  graph: RouteGraph,
  fromId: string,
  toId: string,
  wheelchairOnly = false
): PathResult | null {
  if (fromId === toId) {
    return { path: [fromId], totalDistance: 0, totalWalkMinutes: 0, evidence: [] };
  }

  // 建立双向邻接表
  const adj = new Map<string, Array<{ to: string; edge: RouteEdge }>>();
  for (const edge of graph.edges) {
    if (wheelchairOnly && !edge.accessible) continue;
    if (!adj.has(edge.from)) adj.set(edge.from, []);
    if (!adj.has(edge.to)) adj.set(edge.to, []);
    adj.get(edge.from)!.push({ to: edge.to, edge });
    adj.get(edge.to)!.push({ to: edge.from, edge: { ...edge, from: edge.to, to: edge.from } });
  }

  const dist = new Map<string, number>();
  const prev = new Map<string, { from: string; edge: RouteEdge }>();
  const pq: Array<{ id: string; d: number }> = [];

  dist.set(fromId, 0);
  pq.push({ id: fromId, d: 0 });

  while (pq.length > 0) {
    pq.sort((a, b) => a.d - b.d);
    const curr = pq.shift()!;
    if (curr.id === toId) break;
    if (curr.d > (dist.get(curr.id) ?? Infinity)) continue;

    const neighbors = adj.get(curr.id) || [];
    for (const { to, edge } of neighbors) {
      const alt = curr.d + edge.walk_minutes;
      if (alt < (dist.get(to) ?? Infinity)) {
        dist.set(to, alt);
        prev.set(to, { from: curr.id, edge });
        pq.push({ id: to, d: alt });
      }
    }
  }

  if (!dist.has(toId)) return null;

  const path: string[] = [];
  const evidence: PathResult['evidence'] = [];
  let curr = toId;
  let totalDist = 0;
  let totalWalk = 0;

  while (curr !== fromId) {
    path.unshift(curr);
    const step = prev.get(curr);
    if (!step) break;
    totalDist += step.edge.distance_m;
    totalWalk += step.edge.walk_minutes;
    evidence.unshift({
      from: step.edge.from,
      to: step.edge.to,
      distance_m: step.edge.distance_m,
      walk_minutes: step.edge.walk_minutes,
      source: step.edge.source,
      confidence: step.edge.confidence,
      accessible: step.edge.accessible,
    });
    curr = step.from;
  }
  path.unshift(fromId);

  return { path, totalDistance: totalDist, totalWalkMinutes: totalWalk, evidence };
}

export function planOfflineRoute(
  graph: RouteGraph,
  input: SceneStateInput
): RoutePlanResponse {
  const startSpot = input.currentLocation || 'south_gate';
  const startTime = input.currentTime || '09:00';
  const budget = input.remainingMinutes || 180;
  const isWheelchair = input.mobility === 'wheelchair';

  const visited = new Set<string>(input.visitedSpotIds || []);
  const availableSpots = graph.spots.filter(
    (s) => s.id !== 'south_gate' && !visited.has(s.id) && (!isWheelchair || s.mobility?.wheelchair_accessible)
  );

  let currentTimeMin = parseMinutes(startTime);
  const deadlineMin = currentTimeMin + budget;
  let currentSpotId = startSpot;

  const steps: RouteStep[] = [];
  let totalWalk = 0;
  let totalVisit = 0;

  // 贪心选择可达且时间预算充足的景点
  for (const nextSpot of availableSpots) {
    const pathToNext = findShortestPath(graph, currentSpotId, nextSpot.id, isWheelchair);
    if (!pathToNext) continue;

    const returnPath = findShortestPath(graph, nextSpot.id, 'south_gate', isWheelchair);
    if (!returnPath) continue;

    const visitMins = nextSpot.visit_minutes || 20;
    const needed = pathToNext.totalWalkMinutes + visitMins + returnPath.totalWalkMinutes;

    if (currentTimeMin + needed <= deadlineMin) {
      // 安排前往该站
      const arriveMin = currentTimeMin + pathToNext.totalWalkMinutes;
      const endMin = arriveMin + visitMins;

      steps.push({
        spotId: nextSpot.id,
        purpose: 'visit',
        start: formatMinutes(currentTimeMin),
        arrive: formatMinutes(arriveMin),
        end: formatMinutes(endMin),
        walkMinutes: pathToNext.totalWalkMinutes,
        visitMinutes: visitMins,
        waitingMinutes: 0,
        distanceMeters: pathToNext.totalDistance,
        pathSpotIds: pathToNext.path,
        pathEvidence: pathToNext.evidence,
      });

      currentTimeMin = endMin;
      totalWalk += pathToNext.totalWalkMinutes;
      totalVisit += visitMins;
      currentSpotId = nextSpot.id;
    }
  }

  // 必须返回南门出口
  const returnToExit = findShortestPath(graph, currentSpotId, 'south_gate', isWheelchair);
  if (returnToExit && currentSpotId !== 'south_gate') {
    const arriveExitMin = currentTimeMin + returnToExit.totalWalkMinutes;
    steps.push({
      spotId: 'south_gate',
      purpose: 'return',
      reasonCode: 'return_to_exit',
      start: formatMinutes(currentTimeMin),
      arrive: formatMinutes(arriveExitMin),
      end: formatMinutes(arriveExitMin),
      walkMinutes: returnToExit.totalWalkMinutes,
      visitMinutes: 0,
      waitingMinutes: 0,
      distanceMeters: returnToExit.totalDistance,
      pathSpotIds: returnToExit.path,
      pathEvidence: returnToExit.evidence,
    });
    totalWalk += returnToExit.totalWalkMinutes;
    currentTimeMin = arriveExitMin;
  }

  const totalMins = totalWalk + totalVisit;
  const feasible = steps.length > 0 && currentTimeMin <= deadlineMin;

  return {
    outcome: feasible ? 'feasible' : 'infeasible',
    feasibility: feasible,
    route: {
      totalMinutes: totalMins,
      walkingMinutes: totalWalk,
      visitingMinutes: totalVisit,
      waitingMinutes: 0,
      steps,
      rejectedRequests: [],
    },
    scene_state: input,
    evidence: steps.map((s) => {
      const sp = graph.spots.find((p) => p.id === s.spotId);
      return {
        spot_id: s.spotId,
        name: sp?.name || s.spotId,
        source: sp?.source || '离线缓存路网',
        confidence: sp?.confidence || 'verified',
      };
    }),
    explanation: {
      route_rationale: [
        '离线应急路线由本地缓存拓扑图及确定性最短路径算法计算；已严格包含返回南门路段。',
        '离线模式下不包含实时演出排期或大模型推荐，开放时间及道路施工状态可能过期，请以现场指示为准。',
      ],
      rejected_requests: [],
    },
  };
}
