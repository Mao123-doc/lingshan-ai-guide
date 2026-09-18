import assert from 'node:assert/strict';
import { SceneState, SceneStateSchema } from './scene-state';

const llmServicePath = require.resolve('../llm-service');
const originalLLMService = require(llmServicePath) as typeof import('../llm-service');
const llmModuleCache = require.cache[llmServicePath];
if (!llmModuleCache) throw new Error('LLM service module was not cached');

type LLMCall = typeof originalLLMService.callLLMWithMetadata;
type MockLLMResult = Awaited<ReturnType<LLMCall>>;

let llmAvailable = true;
let llmCall: LLMCall = async () => {
  throw new Error('LLM mock response was not configured');
};
const llmCalls: Array<Parameters<LLMCall>> = [];

llmModuleCache.exports = {
  ...originalLLMService,
  isLLMAvailable: () => llmAvailable,
  callLLMWithMetadata: async (...args: Parameters<LLMCall>) => {
    llmCalls.push(args);
    return llmCall(...args);
  },
};

const {
  extractSceneState,
  extractSceneStateWithLLM,
  mergeSceneStates,
  validateSceneState,
} = require('./scene-extractor') as typeof import('./scene-extractor');

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
      (actual as Record<string, unknown>)[field],
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
assert.deepEqual(conflict.state.missingCriticalFields, ['currentTime']);
assert.ok(conflict.missingFields.includes('currentTime'));

const nonCriticalConflict = mergeSceneStates(
  { ...baseRuleState, mobility: 'limited' },
  { mobility: 'normal' },
  { confidence: { mobility: 0.9 }, trace },
);
assert.equal(nonCriticalConflict.state.mobility, 'normal');
assert.deepEqual(nonCriticalConflict.conflicts, ['mobility']);

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

const staleMissingCriticalFields = mergeSceneStates(
  {
    ...baseRuleState,
    currentLocation: undefined,
    currentTime: undefined,
    preferredPerformanceIds: ['performance_lingshan_jixiangsong'],
    missingCriticalFields: [],
  },
  { missingCriticalFields: [] },
  { confidence: {}, trace },
);
assert.deepEqual(staleMissingCriticalFields.state.missingCriticalFields, [
  'currentLocation',
  'currentTime',
]);
assert.ok(staleMissingCriticalFields.missingFields.includes('currentLocation'));
assert.ok(staleMissingCriticalFields.missingFields.includes('currentTime'));
assert.ok(!staleMissingCriticalFields.conflicts.includes('missingCriticalFields'));
assert.equal(staleMissingCriticalFields.source, 'rules');

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

function llmResult(content: string, model = 'test-model'): MockLLMResult {
  return {
    content,
    modelIdentity: {
      status: 'match',
      requestedModel: model,
      providerModel: model,
    },
  };
}

async function runLLMAdapterTests(): Promise<void> {
  const query = '我和对象现在10点在景区入口，还有3小时，步行正常，喜欢佛教文化';

  llmAvailable = true;
  llmCalls.length = 0;
  llmCall = async () => llmResult(JSON.stringify({
    state: {
      currentLocation: 'south_gate',
      currentTime: '10:00',
      remainingMinutes: 180,
      partyType: 'couple',
      mobility: 'normal',
      mealRequested: null,
      interests: ['culture'],
      mustVisitSpotNames: [],
      mustVisitSpotIds: [],
      preferredPerformanceNames: [],
      preferredPerformanceIds: [],
      preferredPerformanceTimes: null,
      visitedSpotNames: [],
      visitedSpotIds: [],
    },
    confidence: {
      currentLocation: 0.99,
      currentTime: 0.98,
      remainingMinutes: 0.99,
      partyType: 0.95,
      mobility: 0.96,
      interests: 0.9,
    },
  }));
  const valid = await extractSceneStateWithLLM(query);
  assert.equal(valid.source, 'llm');
  assert.equal(valid.state.currentLocation, 'south_gate');
  assert.equal(valid.state.remainingMinutes, 180);
  assert.equal(valid.trace.status, 'success');
  assert.equal(valid.trace.executed, true);
  assert.equal(valid.trace.fallbackUsed, false);
  assert.deepEqual(llmCalls[0][1], { temperature: 0, max_tokens: 500 });
  const systemPrompt = llmCalls[0][0][0].content;
  assert.match(systemPrompt, /JSON only/i);
  assert.match(systemPrompt, /null/i);
  assert.match(systemPrompt, /0 and 1/i);
  assert.match(systemPrompt, /do not guess/i);
  assert.match(systemPrompt, /route fields/i);

  llmCall = async () => llmResult(JSON.stringify({
    state: {
      currentLocation: '灵山梵宫',
      remainingMinutes: 180,
      mustVisitSpotNames: ['灵山大佛'],
      preferredPerformanceNames: ['吉祥颂'],
      preferredPerformanceTimes: { 吉祥颂: '14:00' },
      visitedSpotNames: ['五印坛城'],
    },
    confidence: {
      currentLocation: 0.99,
      remainingMinutes: 0.99,
      preferredPerformanceTimes: 0.98,
    },
  }));
  const mappedNames = await extractSceneStateWithLLM('还有3小时');
  assert.equal(mappedNames.source, 'merged');
  assert.equal(mappedNames.state.currentLocation, 'LS-013');
  assert.deepEqual(mappedNames.state.mustVisitSpotIds, ['LS-011']);
  assert.deepEqual(mappedNames.state.preferredPerformanceIds, [
    'performance_lingshan_jixiangsong',
  ]);
  assert.deepEqual(mappedNames.state.preferredPerformanceTimes, {
    performance_lingshan_jixiangsong: '14:00',
  });
  assert.deepEqual(mappedNames.state.visitedSpotIds, ['LS-014']);

  llmCall = async () => llmResult(JSON.stringify({
    state: { mealRequested: true },
    confidence: { mealRequested: 0.99 },
  }));
  const modelOnlyMeal = await extractSceneStateWithLLM('还有3小时');
  assert.equal(modelOnlyMeal.state.mealRequested, true);

  llmCall = async () => llmResult(JSON.stringify({
    state: {
      currentLocation: '不存在的地点',
      mustVisitSpotIds: ['UNKNOWN-SPOT-ID'],
      mustVisitSpotNames: ['不存在的景点'],
      preferredPerformanceIds: ['performance_unknown'],
      preferredPerformanceNames: ['不存在的演出'],
      preferredPerformanceTimes: { 不存在的演出: '12:00' },
    },
    confidence: {
      currentLocation: 0.99,
      preferredPerformanceTimes: 0.99,
    },
  }));
  const unknownNames = await extractSceneStateWithLLM(
    '景区入口，还有3小时，想去灵山大佛，想看下午4点的吉祥颂',
  );
  assert.equal(unknownNames.state.currentLocation, 'south_gate');
  assert.deepEqual(unknownNames.state.mustVisitSpotIds, ['LS-011']);
  assert.deepEqual(unknownNames.state.preferredPerformanceIds, [
    'performance_lingshan_jixiangsong',
  ]);
  assert.deepEqual(unknownNames.state.preferredPerformanceTimes, {
    performance_lingshan_jixiangsong: '16:00',
  });

  llmCall = async () => llmResult(JSON.stringify({
    state: { mustVisitSpotIds: [], mustVisitSpotNames: null },
    confidence: { mustVisitSpotIds: 0.99 },
  }));
  const explicitEmpty = await extractSceneStateWithLLM('景区入口，还有3小时，想去灵山大佛');
  assert.deepEqual(explicitEmpty.state.mustVisitSpotIds, []);

  llmCall = async () => llmResult('{not json');
  const invalidJson = await extractSceneStateWithLLM(query);
  assert.equal(invalidJson.source, 'fallback');
  assert.equal(invalidJson.trace.reason, 'invalid_json');
  assert.equal(invalidJson.trace.fallbackUsed, true);
  assert.deepEqual(invalidJson.state, extractSceneState(query));

  llmCall = async () => llmResult(JSON.stringify({
    state: { currentTime: '25:00' },
    confidence: { currentTime: 0.99 },
  }));
  const schemaError = await extractSceneStateWithLLM(query);
  assert.equal(schemaError.source, 'fallback');
  assert.equal(schemaError.trace.reason, 'schema_error');
  assert.deepEqual(schemaError.state, extractSceneState(query));

  llmCall = async () => llmResult('   ');
  const empty = await extractSceneStateWithLLM(query);
  assert.equal(empty.source, 'fallback');
  assert.equal(empty.trace.reason, 'empty_response');
  assert.equal(empty.trace.executed, true);

  llmAvailable = false;
  llmCalls.length = 0;
  llmCall = async () => llmResult('unexpected');
  const unavailable = await extractSceneStateWithLLM(query);
  assert.equal(unavailable.source, 'fallback');
  assert.equal(unavailable.trace.reason, 'llm_unavailable');
  assert.equal(unavailable.trace.configured, false);
  assert.equal(unavailable.trace.executed, false);
  assert.equal(llmCalls.length, 0);

  llmAvailable = true;
  llmCall = async () => llmResult(JSON.stringify({
    state: {
      currentLocation: 'south_gate',
      steps: [{ spotId: 'LS-011' }],
    },
    confidence: { currentLocation: 0.99 },
  }));
  const forbiddenRouteField = await extractSceneStateWithLLM(query);
  assert.equal(forbiddenRouteField.source, 'fallback');
  assert.equal(forbiddenRouteField.trace.reason, 'forbidden_route_field');
  assert.equal(forbiddenRouteField.trace.status, 'fallback');

  llmCall = async () => llmResult(JSON.stringify({
    state: { currentLocation: 'south_gate' },
    confidence: { currentLocation: 0.74 },
  }));
  const lowConfidence = await extractSceneStateWithLLM(query);
  assert.equal(lowConfidence.source, 'fallback');
  assert.equal(lowConfidence.trace.reason, 'low_critical_field_confidence');
  assert.deepEqual(lowConfidence.state, extractSceneState(query));

  llmCall = async () => {
    throw new Error('provider timeout containing secret details');
  };
  const timeout = await extractSceneStateWithLLM(query);
  assert.equal(timeout.source, 'fallback');
  assert.equal(timeout.trace.reason, 'llm_call_failed');
  assert.equal(timeout.trace.executed, true);
  assert.ok(!JSON.stringify(timeout).includes('secret details'));
}

void runLLMAdapterTests()
  .then(() => {
    llmModuleCache.exports = originalLLMService;
    console.log('Scene extractor contract tests passed');
  })
  .catch(error => {
    llmModuleCache.exports = originalLLMService;
    console.error(error);
    process.exitCode = 1;
  });
