import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { jsonBody, startTestServer } from '../helpers/api-fixtures';

async function login(server: Awaited<ReturnType<typeof startTestServer>>): Promise<string> {
  const response = await server.request('/api/v1/auth/login', jsonBody({ username: 'admin', password: 'lingshan2026' }));
  assert.equal(response.status, 200);
  return response.body.access_token;
}

test('admin read APIs require auth and return valid empty-state contracts', async () => {
  const server = await startTestServer();
  try {
    const token = await login(server);
    const headers = { Authorization: `Bearer ${token}` };
    const endpoints = [
      '/api/v1/admin/reports/sentiment?period=day',
      '/api/v1/admin/knowledge/documents',
      '/api/v1/admin/knowledge/stats',
      '/api/v1/admin/knowledge/test-qa',
      '/api/v1/admin/digital-human/appearance',
      '/api/v1/admin/conversations?page=1&pageSize=20',
      '/api/v1/admin/top-unsatisfied',
      '/api/v1/admin/visitor-locations',
      '/api/v1/admin/category-distribution',
    ];
    for (const endpoint of endpoints) {
      const unauthenticated = await server.request(endpoint);
      assert.equal(unauthenticated.status, 401, endpoint);
      const authenticated = await server.request(endpoint, { headers });
      assert.ok(authenticated.status >= 200 && authenticated.status < 300, `${endpoint}: ${authenticated.status}`);
    }
  } finally {
    await server.close();
  }
});

test('admin APIs reject invalid analysis, upload and feedback requests', async () => {
  const server = await startTestServer();
  try {
    const token = await login(server);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const analysis = await server.request('/api/v1/admin/reports/analyze-sentiment', {
      method: 'POST', headers, body: JSON.stringify({ text: '' }),
    });
    assert.ok([400, 503].includes(analysis.status));

    const upload = await server.request('/api/v1/admin/knowledge/documents', { method: 'POST', headers });
    assert.equal(upload.status, 400);

    const vision = await server.request('/api/v1/admin/vision/recognize', { method: 'POST', headers });
    assert.equal(vision.status, 400);

    const feedback = await server.request('/api/v1/admin/conversations/feedback', jsonBody({}),);
    assert.equal(feedback.status, 401);
    const authenticatedFeedback = await server.request('/api/v1/admin/conversations/feedback', {
      method: 'POST', headers, body: JSON.stringify({}),
    });
    assert.equal(authenticatedFeedback.status, 400);

    const config = await server.request('/api/v1/admin/digital-human/appearance', {
      method: 'PUT', headers, body: JSON.stringify({ style_preset: 'api_isolated', voice_id: 'api-test-voice' }),
    });
    assert.equal(config.status, 200);
    const saved = JSON.parse(fs.readFileSync(path.join(server.dataRoot, 'dh_config.json'), 'utf8'));
    assert.equal(saved.style_preset, 'api_isolated');

    const missingDocument = await server.request('/api/v1/admin/knowledge/documents/missing.txt', { headers });
    assert.equal(missingDocument.status, 404);

    const refresh = await server.request('/api/v1/admin/knowledge/refresh-index', { method: 'POST', headers });
    assert.equal(refresh.status, 200);
    assert.equal(refresh.body.status, 'ok');

    const exportResponse = await server.request('/api/v1/admin/conversations/export', { headers });
    assert.equal(exportResponse.status, 200);
    assert.ok(exportResponse.headers.get('content-type')?.includes('text/csv'), exportResponse.headers.get('content-type') || 'missing content type');
    assert.deepEqual(Array.from(exportResponse.rawBody.slice(0, 3)), [0xef, 0xbb, 0xbf]);
  } finally {
    await server.close();
  }
});
