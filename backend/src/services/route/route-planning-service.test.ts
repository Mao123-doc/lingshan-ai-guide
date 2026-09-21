import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRouteGraph } from './route-contract';
import {
  planRouteRequest,
  type RoutePlanningDependencies,
} from './route-planning-service';
import { SceneStateSchema, type SceneState } from '../scene/scene-state';

const graph = loadRouteGraph();

function state(overrides: Partial<SceneState> = {}): SceneState {
  return SceneStateSchema.parse({
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
}

function dependencies(extracted: SceneState, calls: { count: number }): RoutePlanningDependencies {
  return {
    graph,
    extractSceneStateWithLLM: async () => {
      calls.count += 1;
      return {
        state: extracted,
        source: 'llm',
        confidence: { currentLocation: 0.99, currentTime: 0.99, remainingMinutes: 0.99 },
        missingFields: [],
        conflicts: [],
        trace: { configured: true, executed: true, status: 'success', fallbackUsed: false },
      };
    },
  };
}

test('plans a pure structured request without invoking scene extraction', async () => {
  const calls = { count: 0 };
  const response = await planRouteRequest(
    { scene_state: state({ interests: ['nature', 'culture', 'nature'] }) },
    dependencies(state(), calls),
  );

  assert.equal(calls.count, 0);
  assert.equal(response.scene_extraction.source, 'explicit');
  assert.equal(response.outcome, 'feasible');
  assert.ok(response.route.steps.length > 0);
});

test('extracts a natural-language request and marks its source', async () => {
  const calls = { count: 0 };
  const response = await planRouteRequest(
    { query: '请安排一条路线' },
    dependencies(state(), calls),
  );

  assert.equal(calls.count, 1);
  assert.equal(response.scene_extraction.source, 'llm');
  assert.equal(response.scene_state.currentTime, '09:00');
});

test('lets explicit fields override extracted values and recomputes missing fields', async () => {
  const calls = { count: 0 };
  const extracted = state({ currentTime: undefined, missingCriticalFields: ['currentTime'] });
  const response = await planRouteRequest(
    { query: '我想规划路线', scene_state: { currentTime: '10:00' } },
    dependencies(extracted, calls),
  );

  assert.equal(calls.count, 1);
  assert.equal(response.scene_extraction.source, 'merged');
  assert.equal(response.scene_state.currentTime, '10:00');
  assert.deepEqual(response.scene_state.missingCriticalFields, []);
  assert.notEqual(response.outcome, 'needs_clarification');
});

test('returns clarification instead of guessing missing hard constraints', async () => {
  const calls = { count: 0 };
  const incomplete = state({ currentLocation: undefined, currentTime: undefined, remainingMinutes: undefined });
  const response = await planRouteRequest(
    { scene_state: incomplete },
    dependencies(state(), calls),
  );

  assert.equal(calls.count, 0);
  assert.equal(response.outcome, 'needs_clarification');
  assert.match(response.explanation.clarification || '', /几点|位置|多长时间/);
  assert.equal(response.route.steps.length, 0);
});

test('rejects an empty request and planner-only fields before planning', async () => {
  await assert.rejects(
    () => planRouteRequest({}),
    error => error instanceof Error && error.message.includes('query 或 scene_state'),
  );
  await assert.rejects(
    () => planRouteRequest({ scene_state: { feasible: true } as never }),
    error => error instanceof Error && error.message.includes('scene_state'),
  );
});

test('explains advisory budget without changing the physical route', async () => {
  const calls = { count: 0 };
  const baseRequest = { scene_state: state() };
  const economy = await planRouteRequest(
    { ...baseRequest, advisory_profile: { ageGroup: '青年', budget: '经济型' } },
    dependencies(state(), calls),
  );
  const premium = await planRouteRequest(
    { ...baseRequest, advisory_profile: { ageGroup: '青年', budget: '豪华型' } },
    dependencies(state(), calls),
  );

  assert.deepEqual(economy.route, premium.route);
  const budgetEffect = economy.explanation.input_effects.find(effect => effect.field === 'budget');
  assert.equal(budgetEffect?.kind, 'advisory');
  assert.match(budgetEffect?.summary || '', /消费|物理路线/);
});
