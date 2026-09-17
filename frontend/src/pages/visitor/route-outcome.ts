export type RouteOutcome =
  | 'feasible'
  | 'feasible_with_rejected_preferences'
  | 'needs_clarification'
  | 'infeasible';

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
