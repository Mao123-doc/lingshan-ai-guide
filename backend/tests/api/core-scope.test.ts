import assert from 'node:assert/strict';
import test from 'node:test';
import { jsonBody, startTestServer } from '../helpers/api-fixtures';

test('retired peripheral APIs are unavailable even for authenticated admins', async () => {
  const server = await startTestServer();
  try {
    const login = await server.request('/api/v1/auth/login', jsonBody({ username: 'admin', password: 'lingshan2026' }));
    const headers = { Authorization: `Bearer ${login.body.access_token}`, 'Content-Type': 'application/json' };
    for (const [method, path] of [
      ['POST', '/visitor/tts'], ['POST', '/visitor/vision/recognize'],
      ['POST', '/visitor/feedback'], ['GET', '/visitor/nearby'],
      ['GET', '/visitor/nearby-facilities'], ['GET', '/visitor/dh-config'],
      ['GET', '/admin/dashboard/summary'], ['GET', '/admin/reports/sentiment'],
      ['POST', '/admin/reports/analyze-sentiment'], ['POST', '/admin/vision/recognize'],
      ['GET', '/admin/digital-human/appearance'], ['GET', '/admin/conversations/export'],
    ]) {
      const result = await server.request(`/api/v1${path}`, { method, headers, ...(method === 'POST' ? { body: '{}' } : {}) });
      assert.equal(result.status, 404, `${method} ${path}`);
    }
  } finally { await server.close(); }
});
