import assert from 'node:assert/strict';
import { loadRouteGraph } from './route-contract';
import { planRoute } from './route-planner';
import { validateRoute } from './route-validator';
import { SceneStateSchema, type SceneState } from '../scene/scene-state';

const graph = loadRouteGraph();
const makeScene = (overrides: Record<string, unknown>): SceneState => SceneStateSchema.parse({
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

const cases: Array<{ id: string; expectedFeasible: boolean; scene: SceneState }> = [
  ...Array.from({ length: 20 }, (_, index) => ({
    id: `normal-${index + 1}`,
    expectedFeasible: true,
    scene: makeScene({ remainingMinutes: 150 + (index % 3) * 30, interests: index % 2 ? ['history'] : ['culture'] }),
  })),
  ...Array.from({ length: 10 }, (_, index) => ({
    id: `mobility-${index + 1}`,
    expectedFeasible: true,
    scene: makeScene({ mobility: index % 2 ? 'limited' : 'wheelchair', mustVisitSpotIds: ['LS-013'], remainingMinutes: 180 }),
  })),
  ...Array.from({ length: 10 }, (_, index) => ({
    id: `performance-${index + 1}`,
    expectedFeasible: true,
    scene: makeScene({ currentTime: index % 2 ? '09:30' : '13:00', preferredPerformanceIds: ['performance_lingshan_jixiangsong'], preferredPerformanceTimes: { performance_lingshan_jixiangsong: index % 2 ? '10:35' : '14:00' } }),
  })),
  ...Array.from({ length: 10 }, (_, index) => ({
    id: `tight-${index + 1}`,
    expectedFeasible: false,
    scene: makeScene({ remainingMinutes: 20 + (index % 2) * 5, mustVisitSpotIds: ['LS-013'] }),
  })),
  ...Array.from({ length: 10 }, (_, index) => ({
    id: `infeasible-mobility-${index + 1}`,
    expectedFeasible: false,
    scene: makeScene({ mobility: 'wheelchair', mustVisitSpotIds: ['NH-006'], remainingMinutes: 600 }),
  })),
];

assert.equal(cases.length, 60);
let feasibleExpected = 0;
let feasibleCorrect = 0;
let hardViolations = 0;
let truePositive = 0;
let falsePositive = 0;
let falseNegative = 0;

for (const item of cases) {
  const plan = planRoute(item.scene, graph, 12);
  if (item.expectedFeasible) feasibleExpected += 1;
  if (plan.feasible === item.expectedFeasible) feasibleCorrect += 1;
  if (!item.expectedFeasible && !plan.feasible) truePositive += 1;
  if (!item.expectedFeasible && plan.feasible) falseNegative += 1;
  if (item.expectedFeasible && !plan.feasible) falsePositive += 1;
  if (plan.feasible) {
    const validation = validateRoute(plan, item.scene, graph);
    hardViolations += validation.violations.filter(violation => violation.code !== 'missing_preferred_performance').length;
  }
}

const infeasiblePrecision = truePositive + falsePositive === 0 ? 1 : truePositive / (truePositive + falsePositive);
const infeasibleRecall = truePositive + falseNegative === 0 ? 1 : truePositive / (truePositive + falseNegative);
const infeasibleF1 = infeasiblePrecision + infeasibleRecall === 0 ? 0 : 2 * infeasiblePrecision * infeasibleRecall / (infeasiblePrecision + infeasibleRecall);

assert.equal(hardViolations, 0);
assert.ok(feasibleCorrect / cases.length >= 0.9, `feasible classification ${(feasibleCorrect / cases.length).toFixed(3)} < 0.9`);
assert.ok(infeasibleF1 >= 0.9, `infeasible F1 ${infeasibleF1.toFixed(3)} < 0.9`);
const deterministicReference = planRoute(cases[32].scene, graph, 12);
for (let run = 0; run < 9; run += 1) {
  assert.deepEqual(planRoute(cases[32].scene, graph, 12), deterministicReference);
}
console.log(JSON.stringify({ cases: cases.length, feasibleExpected, feasibleCorrect, hardViolations, infeasiblePrecision, infeasibleRecall, infeasibleF1 }));
console.log('Route benchmark passed');
