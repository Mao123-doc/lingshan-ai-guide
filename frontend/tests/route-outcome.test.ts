import assert from 'node:assert/strict';
import test from 'node:test';

import { getRouteOutcomeLabel, getRouteRejectionMessage, getRouteRequestLabel } from '../src/pages/visitor/route-outcome.ts';

test('does not label an empty feasible route as executable', () => {
  assert.equal(getRouteOutcomeLabel('feasible', 0), '暂时无法安排合适路线');
});

test('labels a route with rejected preferences explicitly', () => {
  assert.equal(getRouteOutcomeLabel('feasible_with_rejected_preferences', 2), '已为你安排替代方案');
});

test('labels infeasible and clarification outcomes', () => {
  assert.equal(getRouteOutcomeLabel('infeasible', 0), '按目前时间安排，暂时无法全部满足');
  assert.equal(getRouteOutcomeLabel('needs_clarification', 0), '还需要一点信息');
});

test('translates route rejection details for visitors', () => {
  assert.equal(getRouteRequestLabel('performance_lingshan_jixiangsong'), '你想看的演出');
  assert.equal(getRouteRequestLabel('currentTime'), '现在时间');
  assert.equal(getRouteRejectionMessage('performance_outside_time_budget'), '在剩余时间内赶不上这场演出');
  assert.equal(getRouteRejectionMessage('must_visit_unreachable'), '你指定的地点按目前安排无法到达');
});
