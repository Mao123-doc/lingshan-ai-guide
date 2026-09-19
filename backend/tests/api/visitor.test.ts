import assert from 'node:assert/strict';
import test from 'node:test';
import { jsonBody, startTestServer, waitForFile } from '../helpers/api-fixtures';

const sceneExtractorPath = require.resolve('../../src/services/scene/scene-extractor');
const originalSceneExtractor = require(sceneExtractorPath) as typeof import('../../src/services/scene/scene-extractor');
const sceneExtractorModule = require.cache[sceneExtractorPath];
if (!sceneExtractorModule) throw new Error('Scene extractor module was not cached');

type SceneExtractor = typeof originalSceneExtractor.extractSceneStateWithLLM;

let extractSceneStateWithLLMMock: SceneExtractor = async query => {
  const state = originalSceneExtractor.extractSceneState(query);
  return {
    state,
    source: 'fallback',
    confidence: {},
    missingFields: [...state.missingCriticalFields],
    conflicts: [],
    trace: {
      configured: false,
      executed: false,
      status: 'fallback',
      fallbackUsed: true,
      reason: 'llm_unavailable',
    },
  };
};

sceneExtractorModule.exports = {
  ...originalSceneExtractor,
  extractSceneStateWithLLM: (query: string) => extractSceneStateWithLLMMock(query),
};

test.after(() => {
  sceneExtractorModule.exports = originalSceneExtractor;
});

function validExtractedState() {
  return {
    currentLocation: 'south_gate',
    currentTime: '09:00',
    remainingMinutes: 180,
    mobility: 'normal' as const,
    interests: ['culture'],
    mustVisitSpotIds: ['LS-006'],
    preferredPerformanceIds: [],
    visitedSpotIds: [],
    missingCriticalFields: [],
  };
}

test('visitor read APIs return stable contracts', async () => {
  const server = await startTestServer();
  try {
    const spots = await server.request('/api/v1/visitor/spots');
    assert.equal(spots.status, 200);
    assert.ok(Array.isArray(spots.body));
    assert.ok(spots.body.length > 0);

    const detail = await server.request(`/api/v1/visitor/spots/${spots.body[0].id}`);
    assert.equal(detail.status, 200);
    assert.equal(detail.body.id, spots.body[0].id);

    const missing = await server.request('/api/v1/visitor/spots/does-not-exist');
    assert.equal(missing.status, 404);

    const sessionA = await server.request('/api/v1/visitor/session/init', { method: 'POST' });
    const sessionB = await server.request('/api/v1/visitor/session/init', { method: 'POST' });
    assert.equal(sessionA.status, 200);
    assert.equal(sessionB.status, 200);
    assert.notEqual(sessionA.body.session_id, sessionB.body.session_id);

    const hotQuestions = await server.request('/api/v1/visitor/hot-questions');
    assert.equal(hotQuestions.status, 200);
    assert.ok(Array.isArray(hotQuestions.body));

    const status = await server.request('/api/v1/visitor/status');
    assert.equal(status.status, 200);
    assert.ok('llm_available' in status.body);
    assert.ok('knowledge_indexed' in status.body);

    const dhConfig = await server.request('/api/v1/visitor/dh-config');
    assert.equal(dhConfig.status, 200);
    assert.ok(typeof dhConfig.body.style_preset === 'string');
  } finally {
    await server.close();
  }
});

test('visitor APIs validate route, feedback and nearby inputs', async () => {
  const server = await startTestServer();
  try {
    const emptyRoute = await server.request('/api/v1/visitor/route/plan', jsonBody({ query: '' }));
    assert.equal(emptyRoute.status, 400);

    const missingTime = await server.request('/api/v1/visitor/route/plan', jsonBody({
      query: '我在景区入口，只有三小时，带腿脚不方便的妈妈',
    }));
    assert.equal(missingTime.status, 200);
    assert.equal(missingTime.body.outcome, 'needs_clarification');
    assert.match(missingTime.body.explanation.clarification, /现在.*几点|开始游览/);
    assert.equal(missingTime.body.explanation.clarification.includes('currentTime'), false);

    const recommendation = await server.request('/api/v1/visitor/recommend', jsonBody({
      interests: ['文化'], duration: 2, travelType: '带长辈', ageGroup: '老年', budget: '经济型',
    }));
    assert.equal(recommendation.status, 200);
    assert.ok(Array.isArray(recommendation.body.route));
    assert.ok(recommendation.body.total_duration <= 120);

    const feedback = await server.request('/api/v1/visitor/feedback', jsonBody({
      session_id: 'api-test-session', rating: 5, comment: 'contract',
    }));
    assert.equal(feedback.status, 200);
    await waitForFile(`${server.dataRoot}/feedback.json`);

    const missingFeedback = await server.request('/api/v1/visitor/conversation-feedback', jsonBody({}));
    assert.equal(missingFeedback.status, 400);

    const nearby = await server.request('/api/v1/visitor/nearby?lat=31.43205&lng=120.09151&radius=2000');
    assert.equal(nearby.status, 200);
    assert.ok(Array.isArray(nearby.body.nearby_spots));

    const badNearby = await server.request('/api/v1/visitor/nearby?lat=bad&lng=bad');
    assert.equal(badNearby.status, 400);

    const badFacility = await server.request('/api/v1/visitor/nearby-facilities?type=invalid');
    assert.equal(badFacility.status, 400);
  } finally {
    await server.close();
  }
});

test('route plan uses structured extraction and exposes only sanitized deterministic metadata', async () => {
  extractSceneStateWithLLMMock = async () => ({
    state: validExtractedState(),
    source: 'llm',
    confidence: { currentLocation: 0.99, currentTime: 0.98, remainingMinutes: 0.97 },
    missingFields: [],
    conflicts: [],
    trace: {
      configured: true,
      executed: true,
      status: 'success',
      model: 'test-model',
      latencyMs: 7,
      fallbackUsed: false,
      rawCompletion: 'do-not-return',
      providerError: 'provider-secret',
      configuration: { apiKey: 'test-secret-key' },
    },
    rawCompletion: 'top-level-secret',
  } as Awaited<ReturnType<SceneExtractor>>);

  const server = await startTestServer();
  try {
    const request = jsonBody({
      query: '请帮我安排一条路线',
      scene_state: { currentTime: '10:00' },
    });
    const first = await server.request('/api/v1/visitor/route/plan', request);
    const second = await server.request('/api/v1/visitor/route/plan', request);

    assert.equal(first.status, 200);
    assert.equal(first.body.scene_state.currentLocation, 'south_gate');
    assert.equal(first.body.scene_state.currentTime, '10:00');
    assert.equal(first.body.route.startTime, '10:00');
    assert.ok(first.body.route.steps.some((step: { spotId: string }) => step.spotId === 'LS-006'));
    assert.deepEqual(first.body.route, second.body.route);
    assert.equal(first.body.feasibility, first.body.route.feasible);
    assert.equal(first.body.outcome, first.body.route.outcome);
    assert.deepEqual(first.body.scene_extraction, {
      source: 'llm',
      confidence: { currentLocation: 0.99, currentTime: 0.98, remainingMinutes: 0.97 },
      missingFields: [],
      conflicts: [],
      trace: {
        configured: true,
        executed: true,
        status: 'success',
        model: 'test-model',
        latencyMs: 7,
        fallbackUsed: false,
      },
    });
    const serialized = JSON.stringify(first.body);
    assert.equal(serialized.includes('do-not-return'), false);
    assert.equal(serialized.includes('provider-secret'), false);
    assert.equal(serialized.includes('test-secret-key'), false);
    assert.equal(serialized.includes('top-level-secret'), false);
  } finally {
    await server.close();
  }
});

test('route plan reports truthful fallback without exposing provider details', async () => {
  extractSceneStateWithLLMMock = async query => ({
    state: originalSceneExtractor.extractSceneState(query),
    source: 'fallback',
    confidence: {},
    missingFields: [],
    conflicts: [],
    trace: {
      configured: true,
      executed: true,
      status: 'fallback',
      model: 'test-model',
      latencyMs: 11,
      fallbackUsed: true,
      reason: 'llm_call_failed',
      providerError: 'timeout with provider token',
      config: { apiKey: 'fallback-secret-key' },
    },
  } as Awaited<ReturnType<SceneExtractor>>);

  const server = await startTestServer();
  try {
    const response = await server.request('/api/v1/visitor/route/plan', jsonBody({
      query: '现在上午9点在景区入口，还有3小时，想去九龙灌浴',
    }));

    assert.equal(response.status, 200);
    assert.equal(response.body.scene_extraction.source, 'fallback');
    assert.deepEqual(response.body.scene_extraction.trace, {
      configured: true,
      executed: true,
      status: 'fallback',
      model: 'test-model',
      latencyMs: 11,
      fallbackUsed: true,
      reason: 'llm_call_failed',
    });
    assert.ok(response.body.route.steps.some((step: { spotId: string }) => step.spotId === 'LS-006'));
    const serialized = JSON.stringify(response.body);
    assert.equal(serialized.includes('timeout with provider token'), false);
    assert.equal(serialized.includes('fallback-secret-key'), false);
  } finally {
    await server.close();
  }
});

test('route plan falls back safely when extracted scene state is invalid', async () => {
  extractSceneStateWithLLMMock = async () => ({
    state: { ...validExtractedState(), currentTime: '25:00' },
    source: 'llm',
    confidence: { currentTime: 0.99 },
    missingFields: [],
    conflicts: [],
    trace: {
      configured: true,
      executed: true,
      status: 'success',
      fallbackUsed: false,
    },
  } as Awaited<ReturnType<SceneExtractor>>);

  const server = await startTestServer();
  try {
    const response = await server.request('/api/v1/visitor/route/plan', jsonBody({
      query: '请帮我安排一条路线',
    }));

    assert.equal(response.status, 200);
    assert.equal(response.body.outcome, 'needs_clarification');
    assert.equal(response.body.scene_extraction.source, 'fallback');
    assert.equal(response.body.scene_extraction.trace.fallbackUsed, true);
    assert.equal(response.body.scene_extraction.trace.reason, 'invalid_scene_state');
  } finally {
    await server.close();
  }
});

test('route plan rejects an invalid explicit scene_state override', async () => {
  extractSceneStateWithLLMMock = async () => ({
    state: validExtractedState(),
    source: 'llm',
    confidence: { currentTime: 0.99 },
    missingFields: [],
    conflicts: [],
    trace: {
      configured: true,
      executed: true,
      status: 'success',
      fallbackUsed: false,
    },
  });

  const server = await startTestServer();
  try {
    const response = await server.request('/api/v1/visitor/route/plan', jsonBody({
      query: '请帮我安排一条路线',
      scene_state: { currentTime: '25:00' },
    }));

    assert.equal(response.status, 400);
    assert.equal(response.body.error, 'scene_state 不符合数据契约');
    assert.equal(JSON.stringify(response.body).includes('25:00'), false);
  } finally {
    await server.close();
  }
});

test('route plan processes natural language utterance through structured extraction and deterministic planner', async () => {
  extractSceneStateWithLLMMock = async () => ({
    state: {
      currentLocation: 'south_gate',
      currentTime: '10:00',
      remainingMinutes: 240,
      partyType: 'couple',
      mobility: 'normal',
      interests: ['culture'],
      mustVisitSpotIds: ['LS-011'],
      preferredPerformanceIds: [],
      visitedSpotIds: [],
      missingCriticalFields: [],
    },
    source: 'llm',
    confidence: {
      currentLocation: 0.98,
      currentTime: 0.95,
      remainingMinutes: 0.95,
      partyType: 0.92,
      mustVisitSpotIds: 0.99,
    },
    missingFields: [],
    conflicts: [],
    trace: {
      configured: true,
      executed: true,
      status: 'success',
      model: 'qwen-plus',
      latencyMs: 85,
      fallbackUsed: false,
    },
  });

  const server = await startTestServer();
  try {
    const response = await server.request('/api/v1/visitor/route/plan', jsonBody({
      query: '我和对象一起从景区南门进园，上午10点开始，准备玩四个小时，必去灵山大佛。',
    }));

    assert.equal(response.status, 200);
    assert.equal(response.body.scene_extraction.source, 'llm');
    assert.equal(response.body.scene_extraction.trace.fallbackUsed, false);
    assert.equal(response.body.scene_extraction.trace.status, 'success');
    assert.equal(response.body.scene_extraction.trace.model, 'qwen-plus');
    assert.equal(response.body.scene_state.partyType, 'couple');
    assert.equal(response.body.scene_state.currentLocation, 'south_gate');
    assert.equal(response.body.scene_state.currentTime, '10:00');
    assert.equal(response.body.scene_state.remainingMinutes, 240);
    assert.equal(response.body.outcome, 'feasible');
    assert.equal(response.body.feasibility, true);
    assert.ok(response.body.route.steps.length > 0);
    assert.ok(response.body.route.steps.some((s: { spotId: string }) => s.spotId === 'LS-011'));
  } finally {
    await server.close();
  }
});

test('visitor APIs reject empty QA, TTS and vision input', async () => {
  const server = await startTestServer();
  try {
    const qa = await server.request('/api/v1/visitor/qa', jsonBody({ query: '' }));
    assert.equal(qa.status, 400);

    const tts = await server.request('/api/v1/visitor/tts', jsonBody({ text: '' }));
    assert.equal(tts.status, 400);

    const vision = await server.request('/api/v1/visitor/vision/recognize', jsonBody({ image_base64: '' }));
    assert.equal(vision.status, 400);
  } finally {
    await server.close();
  }
});
