import assert from 'node:assert/strict';
import test from 'node:test';

import { getRouteOutcomeLabel } from '../src/pages/visitor/route-outcome.ts';

test('does not label an empty feasible route as executable', () => {
  assert.equal(getRouteOutcomeLabel('feasible', 0), '无法生成可执行路线');
});

test('labels a route with rejected preferences explicitly', () => {
  assert.equal(getRouteOutcomeLabel('feasible_with_rejected_preferences', 2), '已调整部分偏好');
});

test('labels infeasible and clarification outcomes', () => {
  assert.equal(getRouteOutcomeLabel('infeasible', 0), '当前约束无法满足');
  assert.equal(getRouteOutcomeLabel('needs_clarification', 0), '需要补充信息');
});
