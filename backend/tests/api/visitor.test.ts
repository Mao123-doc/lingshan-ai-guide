import assert from 'node:assert/strict';
import test from 'node:test';
import { jsonBody, startTestServer, waitForFile } from '../helpers/api-fixtures';

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
