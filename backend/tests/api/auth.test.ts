import assert from 'node:assert/strict';
import test from 'node:test';
import { jsonBody, startTestServer } from '../helpers/api-fixtures';

test('auth rejects invalid credentials and protects admin routes', async () => {
  const server = await startTestServer();
  try {
    const badLogin = await server.request('/api/v1/auth/login', jsonBody({ username: 'admin', password: 'wrong' }));
    assert.equal(badLogin.status, 401);

    const unauthenticated = await server.request('/api/v1/admin/dashboard/summary');
    assert.equal(unauthenticated.status, 401);
  } finally {
    await server.close();
  }
});

test('auth issues and refreshes an admin token', async () => {
  const server = await startTestServer();
  try {
    const login = await server.request('/api/v1/auth/login', jsonBody({ username: 'admin', password: 'lingshan2026' }));
    assert.equal(login.status, 200);
    assert.equal(login.body.role, 'admin');
    assert.equal(typeof login.body.access_token, 'string');

    const refresh = await server.request('/api/v1/auth/refresh', jsonBody({ token: login.body.access_token }));
    assert.equal(refresh.status, 200);
    assert.equal(typeof refresh.body.access_token, 'string');

    const dashboard = await server.request('/api/v1/admin/dashboard/summary', {
      headers: { Authorization: `Bearer ${login.body.access_token}` },
    });
    assert.equal(dashboard.status, 200);
  } finally {
    await server.close();
  }
});

test('auth rejects invalid refresh tokens', async () => {
  const server = await startTestServer();
  try {
    const refresh = await server.request('/api/v1/auth/refresh', jsonBody({ token: 'not-a-jwt' }));
    assert.equal(refresh.status, 401);
  } finally {
    await server.close();
  }
});
