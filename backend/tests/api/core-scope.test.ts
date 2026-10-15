import assert from 'node:assert/strict';
import test from 'node:test';
import { jsonBody, startTestServer } from '../helpers/api-fixtures';

test('restored operations remain authenticated and server TTS is replaced by browser speech', async () => {
  const server = await startTestServer();
  try {
    const login = await server.request('/api/v1/auth/login', jsonBody({ username: 'admin', password: 'public-api-test-password' }));
    const headers = { Authorization: `Bearer ${login.body.access_token}`, 'Content-Type': 'application/json' };
    for (const [method, path] of [['POST', '/visitor/tts'], ['POST', '/admin/vision/recognize']]) {
      const result = await server.request(`/api/v1${path}`, { method, headers, ...(method === 'POST' ? { body: '{}' } : {}) });
      assert.equal(result.status, 404, `${method} ${path}`);
    }
    for (const path of ['/admin/dashboard/summary', '/admin/reports/sentiment', '/admin/digital-human/appearance', '/admin/conversations/export']) {
      assert.equal((await server.request(`/api/v1${path}`)).status, 401);
      assert.equal((await server.request(`/api/v1${path}`, { headers })).status, 200);
    }
  } finally { await server.close(); }
});
