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

const normalVariants = [
  { currentLocation: 'south_gate', remainingMinutes: 150, interests: ['culture'] },
  { currentLocation: 'south_gate', remainingMinutes: 180, interests: ['history'] },
  { currentLocation: 'south_gate', remainingMinutes: 210, interests: ['nature'] },
  { currentLocation: 'south_gate', remainingMinutes: 240, interests: ['architecture'] },
  { currentLocation: 'south_gate', remainingMinutes: 270, interests: ['prayer'] },
  { currentLocation: 'south_gate', remainingMinutes: 300, interests: ['family'] },
  { currentLocation: 'LS-006', remainingMinutes: 120, interests: ['culture'] },
  { currentLocation: 'LS-006', remainingMinutes: 150, interests: ['history'] },
  { currentLocation: 'LS-010', remainingMinutes: 120, interests: ['culture'] },
  { currentLocation: 'LS-010', remainingMinutes: 180, interests: ['history'] },
  { currentLocation: 'LS-011', remainingMinutes: 120, interests: ['architecture'] },
  { currentLocation: 'LS-011', remainingMinutes: 180, interests: ['nature'] },
  { currentLocation: 'LS-013', remainingMinutes: 120, interests: ['culture'] },
  { currentLocation: 'LS-013', remainingMinutes: 180, interests: ['architecture'] },
  { currentLocation: 'LS-014', remainingMinutes: 120, interests: ['culture'] },
  { currentLocation: 'LS-014', remainingMinutes: 180, interests: ['history'] },
  { currentLocation: 'LS-015', remainingMinutes: 120, interests: ['architecture'] },
  { currentLocation: 'LS-015', remainingMinutes: 180, interests: ['nature'] },
  { currentLocation: 'LS-016', remainingMinutes: 120, interests: ['history'] },
  { currentLocation: 'LS-016', remainingMinutes: 180, interests: ['culture'] },
];

const mobilityVariants = [
  { currentLocation: 'south_gate', mobility: 'wheelchair', remainingMinutes: 180 },
  { currentLocation: 'south_gate', mobility: 'limited', remainingMinutes: 210 },
  { currentLocation: 'LS-006', mobility: 'wheelchair', remainingMinutes: 180 },
  { currentLocation: 'LS-006', mobility: 'limited', remainingMinutes: 210 },
  { currentLocation: 'LS-010', mobility: 'wheelchair', remainingMinutes: 180 },
  { currentLocation: 'LS-010', mobility: 'limited', remainingMinutes: 210 },
  { currentLocation: 'LS-011', mobility: 'wheelchair', remainingMinutes: 180 },
  { currentLocation: 'LS-011', mobility: 'limited', remainingMinutes: 210 },
  { currentLocation: 'LS-014', mobility: 'wheelchair', remainingMinutes: 180 },
  { currentLocation: 'LS-015', mobility: 'limited', remainingMinutes: 240 },
];

const performanceVariants = [
  { currentLocation: 'south_gate', currentTime: '09:00', remainingMinutes: 180, performanceTime: '10:35' },
  { currentLocation: 'south_gate', currentTime: '09:30', remainingMinutes: 180, performanceTime: '10:35' },
  { currentLocation: 'south_gate', currentTime: '10:00', remainingMinutes: 180, performanceTime: '11:30' },
  { currentLocation: 'south_gate', currentTime: '11:00', remainingMinutes: 180, performanceTime: '11:30' },
  { currentLocation: 'south_gate', currentTime: '12:00', remainingMinutes: 180, performanceTime: '14:00' },
  { currentLocation: 'south_gate', currentTime: '13:00', remainingMinutes: 180, performanceTime: '14:00' },
  { currentLocation: 'LS-006', currentTime: '09:30', remainingMinutes: 180, performanceTime: '10:35' },
  { currentLocation: 'LS-006', currentTime: '13:20', remainingMinutes: 180, performanceTime: '14:00' },
  { currentLocation: 'LS-010', currentTime: '13:00', remainingMinutes: 180, performanceTime: '14:00' },
  { currentLocation: 'LS-014', currentTime: '15:00', remainingMinutes: 120, performanceTime: '16:00' },
];

const tightVariants = [
  { currentLocation: 'south_gate', remainingMinutes: 15 },
  { currentLocation: 'south_gate', remainingMinutes: 20 },
  { currentLocation: 'south_gate', remainingMinutes: 25 },
  { currentLocation: 'south_gate', remainingMinutes: 30 },
  { currentLocation: 'LS-006', remainingMinutes: 15 },
  { currentLocation: 'LS-006', remainingMinutes: 20 },
  { currentLocation: 'LS-010', remainingMinutes: 25 },
  { currentLocation: 'LS-010', remainingMinutes: 30 },
  { currentLocation: 'LS-011', remainingMinutes: 20 },
  { currentLocation: 'LS-014', remainingMinutes: 30 },
];

const infeasibleMobilityVariants = [
  { currentLocation: 'south_gate', remainingMinutes: 180 },
  { currentLocation: 'south_gate', remainingMinutes: 360 },
  { currentLocation: 'LS-006', remainingMinutes: 240 },
  { currentLocation: 'LS-010', remainingMinutes: 300 },
  { currentLocation: 'LS-011', remainingMinutes: 360 },
  { currentLocation: 'LS-013', remainingMinutes: 480 },
  { currentLocation: 'NH-001', remainingMinutes: 240 },
  { currentLocation: 'NH-002', remainingMinutes: 360 },
  { currentLocation: 'NH-003', remainingMinutes: 480 },
  { currentLocation: 'NH-005', remainingMinutes: 600 },
];

const cases: Array<{ id: string; expectedFeasible: boolean; scene: SceneState }> = [
  ...normalVariants.map((variant, index) => ({
    id: `normal-${index + 1}`,
    expectedFeasible: true,
    scene: makeScene(variant),
  })),
  ...mobilityVariants.map((variant, index) => ({
    id: `mobility-${index + 1}`,
    expectedFeasible: true,
    scene: makeScene({ ...variant, mustVisitSpotIds: ['LS-013'] }),
  })),
  ...performanceVariants.map((variant, index) => ({
    id: `performance-${index + 1}`,
    expectedFeasible: true,
    scene: makeScene({
      currentLocation: variant.currentLocation,
      currentTime: variant.currentTime,
      remainingMinutes: variant.remainingMinutes,
      preferredPerformanceIds: ['performance_lingshan_jixiangsong'],
      preferredPerformanceTimes: { performance_lingshan_jixiangsong: variant.performanceTime },
    }),
  })),
  ...tightVariants.map((variant, index) => ({
    id: `tight-${index + 1}`,
    expectedFeasible: false,
    scene: makeScene({ ...variant, mustVisitSpotIds: ['LS-013'] }),
  })),
  ...infeasibleMobilityVariants.map((variant, index) => ({
    id: `infeasible-mobility-${index + 1}`,
    expectedFeasible: false,
    scene: makeScene({ ...variant, mobility: 'wheelchair', mustVisitSpotIds: ['NH-006'] }),
  })),
];

assert.equal(cases.length, 60);
const distinctSceneCount = new Set(cases.map(item => JSON.stringify(item.scene))).size;
assert.ok(distinctSceneCount >= 30, `route benchmark has only ${distinctSceneCount} distinct scenes`);
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
