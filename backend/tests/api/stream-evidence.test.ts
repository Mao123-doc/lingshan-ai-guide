import assert from 'node:assert/strict';
import test from 'node:test';
import { jsonBody, startTestServer } from '../helpers/api-fixtures';

test('SSE completion preserves evidence, actual fallback status and conversation identity', async () => {
  const server = await startTestServer();
  try {
    const init = jsonBody({ query: '灵山大佛有多高', session_id: 'stream-audit-session' });
    const response = await server.request('/api/v1/visitor/qa', {
      ...init, headers: { ...init.headers, Accept: 'text/event-stream' },
    });
    assert.equal(response.status, 200);
    const events = String(response.body).split('\n\n').filter(line => line.startsWith('data: '))
      .map(line => JSON.parse(line.slice(6)));
    const done = events.find(event => event.type === 'done');
    assert.ok(done.conversation_id);
    assert.equal(done.used_llm, false);
    assert.ok(Array.isArray(done.evaluation_trace.retrievedDocuments));
    assert.equal(events.filter(event => event.type === 'chunk').map(event => event.content).join(''), done.answer);
    assert.equal(done.session_id, 'stream-audit-session');
  } finally { await server.close(); }
});

test('CORS uses configured origins for cross-origin browser requests', async () => {
  process.env.CORS_ORIGINS = 'http://allowed.example';
  const server = await startTestServer();
  try {
    const allowed = await server.request('/health', { headers: { Origin: 'http://allowed.example' } });
    assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://allowed.example');
    const denied = await server.request('/health', { headers: { Origin: 'http://other.example' } });
    assert.equal(denied.headers.get('access-control-allow-origin'), null);
  } finally { delete process.env.CORS_ORIGINS; await server.close(); }
});
