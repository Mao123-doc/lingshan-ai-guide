import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { jsonBody, startTestServer } from '../helpers/api-fixtures';

test('invalid credentials and tokens are rejected', async () => {
  const server = await startTestServer();
  try {
    const invalidLogin = await server.request('/api/v1/auth/login', jsonBody({
      username: 'admin',
      password: 'wrong-password',
    }));
    assert.equal(invalidLogin.status, 401);

    const invalidToken = await server.request('/api/v1/admin/knowledge/documents', {
      headers: { Authorization: 'Bearer invalid-token' },
    });
    assert.equal(invalidToken.status, 401);

    const invalidRefresh = await server.request('/api/v1/auth/refresh', jsonBody({ token: 'invalid-token' }));
    assert.equal(invalidRefresh.status, 401);
  } finally {
    await server.close();
  }
});

test('document deletion cannot escape the isolated data root', async () => {
  const server = await startTestServer();
  try {
    const login = await server.request('/api/v1/auth/login', jsonBody({
      username: 'admin',
      password: 'lingshan2026',
    }));
    const protectedFile = path.join(server.dataRoot, 'conversations.json');
    fs.writeFileSync(protectedFile, '[]', 'utf8');

    const response = await server.request('/api/v1/admin/knowledge/documents/..%2Fconversations.json', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${login.body.access_token}` },
    });
    assert.equal(response.status, 404);
    assert.equal(fs.readFileSync(protectedFile, 'utf8'), '[]');
  } finally {
    await server.close();
  }
});

test('CSV export neutralizes formula-like user content', async () => {
  const server = await startTestServer();
  try {
    const login = await server.request('/api/v1/auth/login', jsonBody({
      username: 'admin',
      password: 'lingshan2026',
    }));
    fs.writeFileSync(path.join(server.dataRoot, 'conversations.json'), JSON.stringify([{
      id: 'csv-injection',
      session_id: 'security-test',
      timestamp: new Date().toISOString(),
      query: '=HYPERLINK("http://evil.example")',
      answer: '+CMD()',
      emotion: 'other',
      used_llm: false,
      response_time_ms: 1,
    }]), 'utf8');

    const response = await server.request('/api/v1/admin/conversations/export', {
      headers: { Authorization: `Bearer ${login.body.access_token}` },
    });
    assert.equal(response.status, 200);
    const csv = new TextDecoder().decode(response.rawBody);
    assert.match(csv, /'=HYPERLINK/);
    assert.match(csv, /'\+CMD/);
  } finally {
    await server.close();
  }
});

test('unsupported document types are rejected before persistence', async () => {
  const server = await startTestServer();
  try {
    const login = await server.request('/api/v1/auth/login', jsonBody({
      username: 'admin',
      password: 'lingshan2026',
    }));
    const body = new FormData();
    body.append('file', new Blob(['executable payload'], { type: 'application/octet-stream' }), 'payload.exe');

    const response = await server.request('/api/v1/admin/knowledge/documents', {
      method: 'POST',
      headers: { Authorization: `Bearer ${login.body.access_token}` },
      body,
    });
    assert.equal(response.status, 400);
    assert.equal(fs.existsSync(path.join(server.dataRoot, 'uploads')), false);
  } finally {
    await server.close();
  }
});

test('oversized document uploads are rejected', async () => {
  const server = await startTestServer();
  try {
    const login = await server.request('/api/v1/auth/login', jsonBody({
      username: 'admin',
      password: 'lingshan2026',
    }));
    const body = new FormData();
    body.append(
      'file',
      new Blob([new Uint8Array(20 * 1024 * 1024 + 1)], { type: 'text/plain' }),
      'oversized.txt',
    );

    const response = await server.request('/api/v1/admin/knowledge/documents', {
      method: 'POST',
      headers: { Authorization: `Bearer ${login.body.access_token}` },
      body,
    });
    assert.equal(response.status, 413);
  } finally {
    await server.close();
  }
});
