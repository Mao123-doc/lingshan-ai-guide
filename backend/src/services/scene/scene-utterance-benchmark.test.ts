import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { extractSceneStateWithLLM } from './scene-extractor';
import { loadRouteGraph } from '../route/route-contract';
import { planRoute } from '../route/route-planner';
import { validateRoute } from '../route/route-validator';
import { SceneState, SceneStateSchema } from './scene-state';

type BenchmarkCase = {
  id: string;
  category: string;
  query: string;
  expected: Partial<SceneState> & {
    mealRequested?: boolean;
    missingCriticalFields: string[];
  };
};

const fixturePath = path.resolve(__dirname, '../../../../evaluation/scene/scene_utterance_benchmark.json');
const cases: BenchmarkCase[] = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

assert.ok(cases.length >= 30, `Expected at least 30 benchmark cases, got ${cases.length}`);

const requiredCategories = [
  'party_type',
  'location',
  'explicit_time',
  'time_range',
  'remaining_duration',
  'indirect_performance_time',
  'meal_request',
  'mobility_limitation',
  'must_visit_intent',
];

for (const cat of requiredCategories) {
  const catCases = cases.filter(c => c.category === cat);
  assert.ok(catCases.length >= 5, `Expected at least 5 variants for category '${cat}', got ${catCases.length}`);
}

const CRITICAL_FIELDS = new Set([
  'currentLocation',
  'currentTime',
  'remainingMinutes',
  'preferredPerformanceTimes',
  'missingCriticalFields',
]);

const FORBIDDEN_FIELDS = ['steps', 'walkingMinutes', 'totalMinutes', 'feasible', 'outcome'];

async function runBenchmark() {
  const graph = loadRouteGraph();
  let totalCritical = 0;
  let correctCritical = 0;
  let totalAll = 0;
  let correctAll = 0;
  const criticalFailures: string[] = [];
  const fieldStats = new Map<string, { correct: number; total: number }>();

  for (const item of cases) {
    const result = await extractSceneStateWithLLM(item.query);

    // Truthful fallback metadata verification
    assert.equal(result.source, 'fallback');
    assert.equal(result.trace.status, 'fallback');
    assert.equal(result.trace.fallbackUsed, true);
    assert.equal(result.trace.reason, 'llm_unavailable');
    assert.equal(result.trace.configured, false);
    assert.equal(result.trace.executed, false);

    // No route field leakage
    for (const forbidden of FORBIDDEN_FIELDS) {
      assert.equal(forbidden in result.state, false, `${item.id}: forbidden route field ${forbidden} found in state`);
      assert.equal(forbidden in result, false, `${item.id}: forbidden route field ${forbidden} found in result`);
    }

    const actual = result.state as Record<string, unknown>;

    for (const [field, expectedValue] of Object.entries(item.expected)) {
      totalAll += 1;
      const isCritical = CRITICAL_FIELDS.has(field);
      if (isCritical) totalCritical += 1;

      const stat = fieldStats.get(field) || { correct: 0, total: 0 };
      stat.total += 1;

      const actualValue = actual[field];
      const match = JSON.stringify(actualValue) === JSON.stringify(expectedValue);

      if (match) {
        correctAll += 1;
        if (isCritical) correctCritical += 1;
        stat.correct += 1;
      } else {
        const failureMsg = `${item.id} (${item.category}).${field}: expected=${JSON.stringify(expectedValue)}, actual=${JSON.stringify(actualValue)}`;
        if (isCritical) criticalFailures.push(failureMsg);
      }
      fieldStats.set(field, stat);
    }

    // End-to-end route planning and deterministic validation
    if (result.state.currentLocation && result.state.remainingMinutes) {
      const planningScene: SceneState = {
        ...result.state,
        mobility: result.state.mobility || 'unknown',
        interests: result.state.interests || [],
        mustVisitSpotIds: result.state.mustVisitSpotIds || [],
        preferredPerformanceIds: result.state.preferredPerformanceIds || [],
        visitedSpotIds: result.state.visitedSpotIds || [],
        missingCriticalFields: result.state.missingCriticalFields || [],
        currentTime: result.state.currentTime || '09:00',
      };
      const parsedScene = SceneStateSchema.safeParse(planningScene);
      assert.ok(parsedScene.success, `${item.id}: parsed scene must conform to SceneStateSchema`);
      const route = planRoute(parsedScene.data, graph, 12);
      if (route.feasible) {
        const validation = validateRoute(route, parsedScene.data, graph);
        const hardViolations = validation.violations.filter(v => v.code !== 'missing_preferred_performance');
        assert.deepEqual(hardViolations, [], `${item.id}: route has hard violations: ${JSON.stringify(hardViolations)}`);
      }
    }
  }

  const criticalAccuracy = correctCritical / totalCritical;
  const overallAccuracy = correctAll / totalAll;

  console.log(JSON.stringify({
    totalCases: cases.length,
    criticalAccuracy: Number(criticalAccuracy.toFixed(4)),
    overallAccuracy: Number(overallAccuracy.toFixed(4)),
    criticalCount: `${correctCritical}/${totalCritical}`,
    fields: Object.fromEntries(fieldStats),
  }, null, 2));

  if (criticalFailures.length > 0) {
    console.error('Critical failures:\n' + criticalFailures.join('\n'));
  }

  assert.ok(
    criticalAccuracy >= 0.95,
    `Critical field accuracy ${criticalAccuracy.toFixed(4)} is below the 95% threshold (${correctCritical}/${totalCritical})`,
  );
  console.log('Natural language utterance benchmark passed (>= 95% critical accuracy, zero hard violations)');

  await testLLMStructuredGate();
}

async function testLLMStructuredGate() {
  const llmServicePath = require.resolve('../llm-service');
  const originalLLMService = require(llmServicePath);
  const llmModuleCache = require.cache[llmServicePath];
  if (!llmModuleCache) return;

  const originalExports = llmModuleCache.exports;
  try {
    let mockResponse = JSON.stringify({
      state: {
        currentLocation: 'south_gate',
        remainingMinutes: 240,
        partyType: 'couple',
      },
      confidence: {
        currentLocation: 0.98,
        remainingMinutes: 0.95,
        partyType: 0.92,
      },
    });

    llmModuleCache.exports = {
      ...originalLLMService,
      isLLMAvailable: () => true,
      callLLMWithMetadata: async () => ({
        content: mockResponse,
        modelIdentity: { status: 'match', requestedModel: 'mock-model', providerModel: 'mock-model' },
      }),
    };

    delete require.cache[require.resolve('./scene-extractor')];
    const { extractSceneStateWithLLM: extractWithMockedLLM } = require('./scene-extractor');

    // 1. Successful LLM structured extraction
    const successRes = await extractWithMockedLLM('我和对象一起从景区南门进园，准备玩四个小时。');
    assert.equal(successRes.trace.status, 'success');
    assert.equal(successRes.trace.fallbackUsed, false);
    assert.equal(successRes.state.partyType, 'couple');
    assert.equal(successRes.state.currentLocation, 'south_gate');
    assert.equal(successRes.state.remainingMinutes, 240);

    // 2. Forbidden route field fallback
    mockResponse = JSON.stringify({
      state: {
        currentLocation: 'south_gate',
        steps: [{ spotId: 'LS-011' }],
        feasible: true,
      },
      confidence: { currentLocation: 0.95 },
    });
    const forbiddenRes = await extractWithMockedLLM('在南门，还有两小时');
    assert.equal(forbiddenRes.source, 'fallback');
    assert.equal(forbiddenRes.trace.reason, 'forbidden_route_field');
    assert.equal(forbiddenRes.trace.fallbackUsed, true);
    assert.equal('steps' in forbiddenRes.state, false);

    // 3. Low critical field confidence fallback
    mockResponse = JSON.stringify({
      state: {
        currentLocation: 'south_gate',
      },
      confidence: { currentLocation: 0.70 },
    });
    const lowConfRes = await extractWithMockedLLM('在南门，还有两小时');
    assert.equal(lowConfRes.source, 'fallback');
    assert.equal(lowConfRes.trace.reason, 'low_critical_field_confidence');
    assert.equal(lowConfRes.trace.fallbackUsed, true);
  } finally {
    llmModuleCache.exports = originalExports;
    delete require.cache[require.resolve('./scene-extractor')];
  }
  console.log('LLM structured extraction gate passed (valid schema, forbidden rejection, confidence threshold)');
}

runBenchmark().catch(err => {
  console.error(err);
  process.exit(1);
});

