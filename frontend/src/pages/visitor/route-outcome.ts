export type RouteOutcome =
  | 'feasible'
  | 'feasible_with_rejected_preferences'
  | 'needs_clarification'
  | 'infeasible';

export function getRouteOutcomeLabel(outcome: RouteOutcome | undefined, stepCount: number): string {
  if (stepCount === 0) {
    if (outcome === 'needs_clarification') return '需要补充信息';
    if (outcome === 'infeasible') return '当前约束无法满足';
    return '无法生成可执行路线';
  }

  switch (outcome) {
    case 'feasible':
      return '路线可执行';
    case 'feasible_with_rejected_preferences':
      return '已调整部分偏好';
    case 'needs_clarification':
      return '需要补充信息';
    case 'infeasible':
      return '当前约束无法满足';
    default:
      return '路线状态待确认';
  }
}

export function getRouteRejectionMessage(reasonCode: string): string {
  switch (reasonCode) {
    case 'performance_already_started':
      return '演出已开始';
    case 'performance_outside_time_budget':
      return '演出超出当前时间预算';
    case 'no_alternative_route':
      return '当前约束下没有可执行的替代路线';
    case 'must_visit_unreachable':
      return '必到地点在当前约束下无法到达';
    case 'missing_critical_field':
      return '缺少路线规划所需信息';
    case 'performance_unavailable':
      return '没有匹配到可用演出场次';
    default:
      return reasonCode;
  }
}
