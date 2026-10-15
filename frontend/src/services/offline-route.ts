import { planRoute } from '../../../backend/src/services/route/route-planner';
import { RouteGraphSchema, validateRouteGraph, type RouteGraph } from '../../../backend/src/services/route/route-types';
import { normalizeSceneStateInput, SceneStateSchema } from '../../../backend/src/services/scene/scene-state';
import type { RoutePlanResponse, SceneStateInput } from './api';

export interface RouteGraphCache { version:2; savedAt:string; sha256:string; graph:RouteGraph }

function validatedGraph(input:unknown):RouteGraph {
  const result=RouteGraphSchema.safeParse(input);
  if(!result.success || result.data.spots.length===0 || validateRouteGraph(result.data).length>0) throw new Error('缓存路网结构或地点引用无效，请联网更新。');
  return result.data;
}
async function graphChecksum(graph:RouteGraph, subtle:SubtleCrypto | null | undefined):Promise<string> {
  if(!subtle) throw new Error('当前环境无法执行 SHA-256 校验，离线规划已停用；请联网使用在线规划。');
  const digest=await subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(graph)));
  return Array.from(new Uint8Array(digest),value=>value.toString(16).padStart(2,'0')).join('');
}
// An unsigned checksum detects accidental corruption; it does not authenticate the source.
export async function createRouteGraphCache(input:unknown, subtle:SubtleCrypto | null | undefined=globalThis.crypto?.subtle):Promise<RouteGraphCache> {
  const graph=validatedGraph(input);
  return {version:2,savedAt:new Date().toISOString(),sha256:await graphChecksum(graph,subtle),graph};
}
export async function restoreRouteGraphCache(input:unknown, subtle:SubtleCrypto | null | undefined=globalThis.crypto?.subtle):Promise<RouteGraphCache> {
  if(!input || typeof input!=='object') throw new Error('路网缓存校验失败，请重新联网加载。');
  const record=input as Partial<RouteGraphCache>;
  if(record.version!==2 || typeof record.savedAt!=='string' || !Number.isFinite(Date.parse(record.savedAt)) || typeof record.sha256!=='string' || !/^[a-f0-9]{64}$/.test(record.sha256)) throw new Error('路网缓存校验信息无效，请重新联网加载。');
  const graph=validatedGraph(record.graph);
  if(await graphChecksum(graph,subtle)!==record.sha256) throw new Error('路网缓存校验失败，数据可能损坏，请重新联网加载。');
  return {version:2,savedAt:record.savedAt,sha256:record.sha256,graph};
}

// The browser uses the server's deterministic solver and validator. No model or network call.
export function planOfflineRoute(graphInput: unknown, input: SceneStateInput): RoutePlanResponse {
  const graph=validatedGraph(graphInput);
  const scene = SceneStateSchema.parse(normalizeSceneStateInput({ mobility:'normal', interests:[], mustVisitSpotIds:[], visitedSpotIds:[], missingCriticalFields:[], ...input, preferredPerformanceIds:[], preferredPerformanceTimes:{}, returnToExit:true, exitSpotId:'south_gate' }));
  const route = planRoute(scene, { ...graph, performances:[] }, 12);
  const { violations, ...routeView } = route;
  return {
    scene_state:scene,
    route:routeView,
    feasibility:route.feasible,
    outcome:route.outcome,
    evidence:[...new Set(route.steps.flatMap(step=>step.pathSpotIds || [step.spotId]))].map(id=>{ const spot=graph.spots.find(s=>s.id===id); return {spot_id:id,name:spot?.name,source:spot?.source,confidence:spot?.confidence}; }),
    explanation:{route_rationale:['离线应急结果由缓存路网及服务端同源确定性规划器计算；包含返回南门。未使用演出场次、实时路况或大模型。开放时间和无障碍条件以缓存为准，可能过期。'],violations,rejected_requests:route.rejectedRequests},
  };
}
