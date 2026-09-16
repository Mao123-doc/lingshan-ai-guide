import assert from 'node:assert/strict';
import { loadRouteGraph } from './route-contract';
import { planRoute } from './route-planner';
import { SceneStateSchema } from '../scene/scene-state';

const graph = loadRouteGraph();
const scene = (overrides: Record<string, unknown> = {}) => SceneStateSchema.parse({
  currentLocation: 'south_gate',
  currentTime: '09:00',
  remainingMinutes: 180,
  mobility: 'normal',
  interests: ['culture'],
  mustVisitSpotIds: [],
  preferredPerformanceIds: [],
  visitedSpotIds: [],
  missingCriticalFields: [],
  ...overrides,
});

const basic = planRoute(scene(), graph);
assert.equal(basic.feasible, true);
assert.ok(basic.steps.length > 0);
assert.equal(basic.violations.length, 0);
assert.ok(basic.totalMinutes <= 180);

const mustVisit = planRoute(scene({ mustVisitSpotIds: ['LS-006'] }), graph);
assert.equal(mustVisit.feasible, true);
assert.ok(mustVisit.steps.some(step => step.spotId === 'LS-006'));
assert.ok(mustVisit.satisfiedConstraints?.includes('must_visit:LS-006'));

const preference = planRoute(scene({ currentTime: '13:00', preferredPerformanceIds: ['performance_lingshan_jixiangsong'], preferredPerformanceTimes: { performance_lingshan_jixiangsong: '14:00' } }), graph, 12);
assert.equal(preference.feasible, true);
assert.equal(preference.outcome, 'feasible');
assert.ok(preference.steps.some(step => step.performanceId === 'performance_lingshan_jixiangsong'));
assert.equal(preference.violations.length, 0);

const unavailable = planRoute(scene({ currentTime: '14:10', preferredPerformanceIds: ['performance_lingshan_jixiangsong'], preferredPerformanceTimes: { performance_lingshan_jixiangsong: '14:00' } }), graph, 12);
assert.equal(unavailable.feasible, true);
assert.equal(unavailable.outcome, 'feasible_with_rejected_preferences');
assert.ok(unavailable.steps.length > 0);
assert.deepEqual(unavailable.rejectedRequests, [{ item: 'performance_lingshan_jixiangsong', reasonCode: 'performance_already_started' }]);
assert.equal(unavailable.violations.length, 0);

const outsideBudget = planRoute(scene({ currentTime: '10:00', remainingMinutes: 180, preferredPerformanceIds: ['performance_lingshan_jixiangsong'], preferredPerformanceTimes: { performance_lingshan_jixiangsong: '14:00' } }), graph, 12);
assert.notEqual(outsideBudget.outcome, 'feasible');
assert.ok(outsideBudget.steps.length > 0 || outsideBudget.outcome === 'infeasible');
assert.ok(outsideBudget.rejectedRequests?.some(request => request.reasonCode === 'performance_outside_time_budget'));

const noAlternative = planRoute(scene({ currentTime: '10:00', remainingMinutes: 1, preferredPerformanceIds: ['performance_lingshan_jixiangsong'], preferredPerformanceTimes: { performance_lingshan_jixiangsong: '14:00' } }), graph, 12);
assert.equal(noAlternative.outcome, 'infeasible');
assert.equal(noAlternative.feasible, false);
assert.equal(noAlternative.steps.length, 0);
assert.ok(noAlternative.rejectedRequests?.some(request => request.reasonCode === 'no_alternative_route'));

const wheelchair = planRoute(scene({ mobility: 'wheelchair', mustVisitSpotIds: ['NH-006'], remainingMinutes: 600 }), graph, 12);
assert.equal(wheelchair.feasible, false);
assert.ok(wheelchair.rejectedRequests?.some(request => request.item === 'NH-006' && request.reasonCode === 'must_visit_unreachable'));

const missing = planRoute(scene({ currentTime: undefined, missingCriticalFields: ['currentTime'] }), graph);
assert.equal(missing.feasible, false);
assert.equal(missing.rejectedRequests?.[0].reasonCode, 'missing_critical_field');

const deterministicA = planRoute(scene({ mustVisitSpotIds: ['LS-006'] }), graph);
const deterministicB = planRoute(scene({ mustVisitSpotIds: ['LS-006'] }), graph);
assert.deepEqual(deterministicA, deterministicB);

console.log('Route planner tests passed');
