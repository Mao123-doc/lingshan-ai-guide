import assert from 'node:assert/strict';
import {
  extractSceneState,
  mergeSceneStates,
  validateSceneState,
} from './scene-extractor';
import { SceneState, SceneStateSchema } from './scene-state';

type ExpectedSceneFields = {
  partyType?: string;
  currentLocation?: string;
  currentTime?: string;
  remainingMinutes?: number;
  mealRequested?: boolean;
};

const cases: Array<[query: string, expected: ExpectedSceneFields]> = [
  [
    '我和对象一起，从上午10点玩到下午5点',
    { partyType: 'couple', currentTime: '10:00', remainingMinutes: 420 },
  ],
  [
    '陪家里老人，从景区入口开始，还有3小时',
    { partyType: 'with_elderly', currentLocation: 'south_gate', remainingMinutes: 180 },
  ],
  [
    '现在在入口，还有两小时，想看下午4点的吉祥颂',
    { currentTime: '14:00', remainingMinutes: 120 },
  ],
  [
    '中午想找地方吃饭，还有5小时',
    { mealRequested: true, remainingMinutes: 300 },
  ],
];

for (const [query, expected] of cases) {
  const actual = extractSceneState(query);
  for (const [field, expectedValue] of Object.entries(expected)) {
    assert.deepEqual(
      actual[field as keyof ExpectedSceneFields],
      expectedValue,
      `${query}: expected ${field}=${JSON.stringify(expectedValue)}`,
    );
  }
}

const baseRuleState: SceneState = {
  currentLocation: 'south_gate',
  currentTime: '10:00',
  remainingMinutes: 240,
  mobility: 'normal',
  interests: ['culture'],
  mustVisitSpotIds: [],
  preferredPerformanceIds: [],
  visitedSpotIds: [],
  missingCriticalFields: [],
};

const trace = {
  configured: true,
  executed: true,
  status: 'success' as const,
  model: 'test-model',
  fallbackUsed: false,
};

const matching = mergeSceneStates(
  baseRuleState,
  { currentLocation: 'south_gate', mobility: 'normal' },
  { confidence: { currentLocation: 0.99 }, trace },
);
assert.equal(matching.state.currentLocation, 'south_gate');
assert.equal(matching.source, 'merged');
assert.deepEqual(matching.conflicts, []);

const completedFromRules = mergeSceneStates(
  baseRuleState,
  { partyType: 'couple' },
  { confidence: { partyType: 0.96 }, trace },
);
assert.equal(completedFromRules.state.partyType, 'couple');
assert.equal(completedFromRules.state.currentTime, '10:00');
assert.equal(completedFromRules.state.remainingMinutes, 240);

const conflict = mergeSceneStates(
  baseRuleState,
  { currentTime: '11:00' },
  { confidence: { currentTime: 0.92 }, trace },
);
assert.equal(conflict.state.currentTime, '10:00');
assert.deepEqual(conflict.conflicts, ['currentTime']);

const computed = mergeSceneStates(
  { ...baseRuleState, currentTime: undefined },
  {},
  {
    confidence: {},
    trace,
    computedState: { currentTime: '11:00' },
    unambiguousComputedFields: ['currentTime'],
  },
);
assert.equal(computed.state.currentTime, '11:00');

const ambiguousComputed = mergeSceneStates(
  { ...baseRuleState, currentTime: undefined },
  {},
  {
    confidence: {},
    trace,
    computedState: { currentTime: '11:00' },
    unambiguousComputedFields: [],
  },
);
assert.equal(ambiguousComputed.state.currentTime, undefined);
assert.ok(ambiguousComputed.missingFields.includes('currentTime'));

const mergedSchemaResult = SceneStateSchema.safeParse(completedFromRules.state);
assert.equal(mergedSchemaResult.success, true);

const invalid = validateSceneState({ ...baseRuleState, currentTime: '25:00' });
assert.equal(invalid.success, false);
if (!invalid.success) {
  assert.ok(invalid.errors.some(error => error.includes('currentTime')));
}

for (const routeField of ['steps', 'walkingMinutes', 'totalMinutes', 'feasible', 'outcome']) {
  assert.throws(
    () => mergeSceneStates(baseRuleState, { [routeField]: true }, { confidence: {}, trace }),
    new RegExp(`forbidden LLM field: ${routeField}`),
  );
}

console.log('Scene extractor contract tests passed');
