import assert from 'node:assert/strict';
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
      '/api/v1/admin/knowledge/documents',
      '/api/v1/admin/knowledge/stats',
      '/api/v1/admin/knowledge/test-qa',
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

test('knowledge APIs validate upload and support index refresh', async () => {
  const server = await startTestServer();
  try {
    const token = await login(server);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const upload = await server.request('/api/v1/admin/knowledge/documents', { method: 'POST', headers });
    assert.equal(upload.status, 400);

    const missingDocument = await server.request('/api/v1/admin/knowledge/documents/missing.txt', { headers });
    assert.equal(missingDocument.status, 404);

    const refresh = await server.request('/api/v1/admin/knowledge/refresh-index', { method: 'POST', headers });
    assert.equal(refresh.status, 200);
    assert.equal(refresh.body.status, 'ok');

  } finally {
    await server.close();
  }
});
