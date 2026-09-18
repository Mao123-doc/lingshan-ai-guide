import type { RouteOutcome } from '../../services/api';
export type { RouteOutcome };

export function getRouteOutcomeLabel(outcome: RouteOutcome | undefined, stepCount: number): string {
  if (stepCount === 0) {
    if (outcome === 'needs_clarification') return '还需要一点信息';
    if (outcome === 'infeasible') return '按目前时间安排，暂时无法全部满足';
    return '暂时无法安排合适路线';
  }

  switch (outcome) {
    case 'feasible':
      return '可以按这条路线游览';
    case 'feasible_with_rejected_preferences':
      return '已为你安排替代方案';
    case 'needs_clarification':
      return '还需要一点信息';
    case 'infeasible':
      return '按目前时间安排，暂时无法全部满足';
    default:
      return '路线安排待确认';
  }
}

export function getRouteRequestLabel(item: string): string {
  switch (item) {
    case 'currentTime':
    case 'current_time':
      return '现在时间';
    case 'currentLocation':
    case 'current_location':
      return '出发位置';
    case 'remainingMinutes':
    case 'remaining_minutes':
      return '可用时间';
    case 'performance_lingshan_jixiangsong':
    case 'performance_jiulong_guanyu':
      return '你想看的演出';
    default:
      return '这项安排';
  }
}

export function getRouteRejectionMessage(reasonCode: string): string {
  switch (reasonCode) {
    case 'performance_already_started':
      return '这场演出已经开始了';
    case 'performance_outside_time_budget':
      return '在剩余时间内赶不上这场演出';
    case 'no_alternative_route':
      return '暂时找不到合适的替代安排';
    case 'must_visit_unreachable':
      return '你指定的地点按目前安排无法到达';
    case 'missing_critical_field':
      return '还缺少一点路线信息';
    case 'performance_unavailable':
      return '暂时没有找到符合时间的演出场次';
    default:
      return '这项安排暂时无法满足';
  }
}

export const ROUTE_CLARIFICATION_PROMPTS: Record<string, string> = {
  currentTime: '还需要知道您现在大约几点开始游览，请告诉我现在几点（例如“现在上午10点”或“10:00”），这样才能判断能否赶上目标演出。',
  current_time: '还需要知道您现在大约几点开始游览，请告诉我现在几点（例如“现在上午10点”或“10:00”），这样才能判断能否赶上目标演出。',
  currentLocation: '请告诉我现在位于景区哪里，例如“景区入口”或“灵山大佛附近”。',
  current_location: '请告诉我现在位于景区哪里，例如“景区入口”或“灵山大佛附近”。',
  remainingMinutes: '请告诉我还剩多少游览时间，例如“还有3小时”或“剩90分钟”。',
  remaining_minutes: '请告诉我还剩多少游览时间，例如“还有3小时”或“剩90分钟”。',
  partyType: '请问您是和家人、朋友、伴侣还是带长辈出行？',
  party_type: '请问您是和家人、朋友、伴侣还是带长辈出行？',
  mobility: '请问随行人员是否有轮椅或腿脚不便等需要照顾的情况？',
  mustVisitSpotNames: '请问您有哪些特别想去的必去景点？',
  mustVisitSpotIds: '请问您有哪些特别想去的必去景点？',
  preferredPerformanceNames: '请问您有特别想看的演出吗？',
  preferredPerformanceIds: '请问您有特别想看的演出吗？',
  mealRequested: '请问游览途中是否需要安排用餐？',
};

export function getClarificationPrompt(field: string): string {
  return ROUTE_CLARIFICATION_PROMPTS[field] || '请补充相关游览信息。';
}

export function isSceneExtractionFallback(extraction?: {
  source?: string;
  trace?: { fallbackUsed?: boolean; status?: string };
}): boolean {
  if (!extraction) return false;
  return extraction.source === 'fallback' || extraction.trace?.fallbackUsed === true;
}

export function getSceneExtractionNote(extraction?: {
  source?: string;
  trace?: { fallbackUsed?: boolean; status?: string };
}): string | undefined {
  if (isSceneExtractionFallback(extraction)) {
    return '我先按您提供的信息安排路线。';
  }
  return undefined;
}
