import assert from 'node:assert/strict';
import { loadRouteGraph, RouteGraphSchema, validateRouteGraph, type RouteGraph } from './route-contract';
import { validateRoute, type RoutePlan } from './route-validator';
import { SceneStateSchema, type SceneState } from '../scene/scene-state';

const graph = loadRouteGraph();
const baseScene: SceneState = SceneStateSchema.parse({
  currentLocation: 'south_gate',
  remainingMinutes: 60,
  mobility: 'normal',
  interests: [],
  mustVisitSpotIds: [],
  preferredPerformanceIds: [],
  visitedSpotIds: [],
  missingCriticalFields: [],
});
const basePlan = (): RoutePlan => ({
  startTime: '09:00',
  steps: [
    { spotId: 'LS-001', arrive: '09:05', start: '09:05', end: '09:20', walkMinutes: 5, visitMinutes: 15, reasonCode: 'entry' },
    { spotId: 'LS-002', arrive: '09:22', start: '09:22', end: '09:37', walkMinutes: 2, visitMinutes: 15, reasonCode: 'culture' },
  ],
  totalMinutes: 37,
  walkingMinutes: 7,
  visitingMinutes: 30,
  waitingMinutes: 0,
});
const has = (plan: RoutePlan, scene = baseScene, code: string) =>
  validateRoute(plan, scene, graph).violations.some(violation => violation.code === code);
const inaccessiblePlan: RoutePlan = {
  startTime: '09:00',
  steps: [
    { spotId: 'NH-001', arrive: '09:35', start: '09:35', end: '09:55', walkMinutes: 35, visitMinutes: 20, reasonCode: 'nature' },
    { spotId: 'NH-003', arrive: '10:03', start: '10:03', end: '10:33', walkMinutes: 8, visitMinutes: 30, reasonCode: 'nature' },
    { spotId: 'NH-005', arrive: '10:38', start: '10:38', end: '11:08', walkMinutes: 5, visitMinutes: 30, reasonCode: 'nature' },
    { spotId: 'NH-004', arrive: '11:12', start: '11:12', end: '11:42', walkMinutes: 4, visitMinutes: 30, reasonCode: 'nature' },
    { spotId: 'NH-002', arrive: '11:50', start: '11:50', end: '12:30', walkMinutes: 8, visitMinutes: 40, reasonCode: 'nature' },
    { spotId: 'NH-006', arrive: '12:42', start: '12:42', end: '13:12', walkMinutes: 12, visitMinutes: 30, reasonCode: 'nature' },
  ],
  totalMinutes: 252,
  walkingMinutes: 72,
  visitingMinutes: 180,
  waitingMinutes: 0,
};

assert.equal(validateRoute(basePlan(), baseScene, graph).valid, true); // 1
assert.equal(validateRoute({
  startTime: '09:00',
  steps: [{ spotId: 'south_gate', arrive: '09:12', start: '09:12', end: '09:12', walkMinutes: 12, visitMinutes: 0, reasonCode: 'return' }],
  totalMinutes: 12,
  walkingMinutes: 12,
  visitingMinutes: 0,
  waitingMinutes: 0,
}, { ...baseScene, currentLocation: 'LS-006' }, graph).violations.some(violation => violation.code === 'outside_opening_window'), false); // 1b
assert.equal(has({ ...basePlan(), steps: [{ ...basePlan().steps[0], spotId: 'missing' }] }, baseScene, 'unknown_spot'), true); // 2
assert.equal(has({ ...basePlan(), steps: [...basePlan().steps, { ...basePlan().steps[1] }] }, baseScene, 'duplicate_spot'), true); // 3
assert.equal(has({ ...basePlan(), steps: [{ ...basePlan().steps[0], spotId: 'NH-006', end: '09:35', visitMinutes: 30 }] }, baseScene, 'disconnected'), true); // 4
assert.equal(has(basePlan(), { ...baseScene, mustVisitSpotIds: ['LS-011'] }, 'missing_must_visit'), true); // 5
assert.equal(has(basePlan(), { ...baseScene, visitedSpotIds: ['LS-001'] }, 'already_visited'), true); // 6
assert.equal(has({ ...basePlan(), totalMinutes: 61 }, { ...baseScene, remainingMinutes: 20 }, 'time_budget_exceeded'), true); // 7
assert.equal(has({ ...basePlan(), steps: [{ ...basePlan().steps[0], start: '07:00', end: '07:15' }] }, baseScene, 'outside_opening_window'), true); // 8
assert.equal(has({ ...basePlan(), steps: [{ ...basePlan().steps[0], arrive: '09:20', start: '09:05' }] }, baseScene, 'invalid_time_order'), true); // 9
assert.equal(has({ ...basePlan(), steps: [{ ...basePlan().steps[0], arrive: 'invalid' }] }, baseScene, 'invalid_step_time'), true); // 10
assert.equal(has({ ...basePlan(), steps: [{ ...basePlan().steps[0], end: '09:00' }] }, baseScene, 'invalid_time_order'), true); // 11
assert.equal(has({ ...basePlan(), steps: [{ ...basePlan().steps[0], performanceId: 'missing' }] }, baseScene, 'unknown_performance'), true); // 12
assert.equal(has({ ...basePlan(), steps: [{ ...basePlan().steps[0], performanceId: 'performance_lingshan_jixiangsong' }] }, baseScene, 'performance_location_mismatch'), true); // 13
assert.equal(has({ ...basePlan(), steps: [{ ...basePlan().steps[0], spotId: 'LS-013', arrive: '09:05', start: '09:05', end: '10:05', visitMinutes: 60, performanceId: 'performance_lingshan_jixiangsong', performanceStartTime: '12:00' }] }, { ...baseScene, currentLocation: 'south_gate' }, 'performance_time_mismatch'), true); // 14
assert.equal(has(basePlan(), { ...baseScene, preferredPerformanceIds: ['performance_lingshan_jixiangsong'] }, 'missing_preferred_performance'), true); // 15
assert.equal(validateRoute({ ...basePlan(), rejectedRequests: [{ item: 'performance_lingshan_jixiangsong', reasonCode: 'performance_unavailable' }] }, { ...baseScene, preferredPerformanceIds: ['performance_lingshan_jixiangsong'] }, graph).violations.some(violation => violation.code === 'missing_preferred_performance'), false); // 15b
assert.equal(has({ ...basePlan(), steps: [{ ...basePlan().steps[0], visitMinutes: 20 }] }, baseScene, 'visit_duration_mismatch'), true); // 16
assert.equal(has({ ...basePlan(), totalMinutes: 99 }, baseScene, 'total_time_mismatch'), true); // 17
assert.equal(has({ ...basePlan(), walkingMinutes: 99 }, baseScene, 'walking_time_mismatch'), true); // 18
assert.equal(has({ ...basePlan(), visitingMinutes: 99 }, baseScene, 'visiting_time_mismatch'), true); // 19
assert.equal(has({ ...basePlan(), startTime: 'bad' }, baseScene, 'invalid_start_time'), true); // 20
assert.equal(has({ ...basePlan(), steps: [] }, { ...baseScene, mustVisitSpotIds: ['LS-001'] }, 'missing_must_visit'), true); // 21
assert.equal(has(basePlan(), { ...baseScene, currentLocation: undefined }, 'missing_current_location'), true); // 22
assert.equal(has(inaccessiblePlan, { ...baseScene, mobility: 'wheelchair' }, 'mobility_inaccessible_spot'), true); // 23
assert.equal(has(inaccessiblePlan, { ...baseScene, mobility: 'wheelchair' }, 'mobility_inaccessible_edge'), true); // 24
assert.equal(has({ ...basePlan(), steps: [{ ...basePlan().steps[0], spotId: 'LS-001', performanceId: 'performance_lingshan_jixiangsong', performanceStartTime: '14:00' }] }, baseScene, 'performance_location_mismatch'), true); // 25
assert.equal(has({ ...basePlan(), steps: [{ ...basePlan().steps[0], spotId: 'LS-001', performanceId: 'performance_lingshan_jixiangsong', performanceStartTime: '14:00' }] }, { ...baseScene, preferredPerformanceIds: ['performance_lingshan_jixiangsong'] }, 'performance_location_mismatch'), true); // 26
assert.equal(has({ ...basePlan(), steps: [{ ...basePlan().steps[0], spotId: 'LS-013', arrive: '08:30', start: '08:30', end: '09:30', visitMinutes: 60, performanceId: 'performance_lingshan_jixiangsong', performanceStartTime: '10:35' }] }, baseScene, 'outside_opening_window'), true); // 27
assert.equal(has({ ...basePlan(), steps: [{ ...basePlan().steps[0], spotId: 'LS-001', arrive: '09:05', start: '09:05', end: '09:20', visitMinutes: 15 }, { ...basePlan().steps[1], arrive: '09:22', start: '09:22', end: '09:37' }] }, baseScene, 'disconnected'), false); // 28
assert.equal(validateRoute(basePlan(), { ...baseScene, remainingMinutes: undefined }, graph).valid, true); // 29
assert.equal(validateRouteGraph(graph).length, 0); // 30
assert.equal(RouteGraphSchema.safeParse(graph).success, true);

const brokenGraph = { ...graph, edges: [{ ...graph.edges[0], to: 'missing' }] } as RouteGraph;
assert.equal(validateRouteGraph(brokenGraph).some(error => error.includes('edge.to unknown')), true);

console.log('Route validator tests passed: 30+ assertions');
