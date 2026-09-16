import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { jsonBody, startTestServer } from '../helpers/api-fixtures';
import {
  addClient,
  broadcastQueryEvent,
  getAdminCount,
} from '../../src/services/websocket-service';

test('LLM outage is explicit and never masquerades as generated Full-RAG output', async () => {
  const server = await startTestServer();
  try {
    const response = await server.request('/api/v1/visitor/qa', jsonBody({
      query: '灵山大佛有多高？',
      session_id: 'reliability-llm-outage',
    }));

    assert.equal(response.status, 200);
    assert.equal(response.body.used_llm, false);
    assert.equal(response.body.evaluation_trace.generation.configured, true);
    assert.equal(response.body.evaluation_trace.generation.executed, false);
    assert.equal(response.body.evaluation_trace.generation.status, 'skipped');
    assert.equal(response.body.evaluation_trace.generation.fallbackUsed, true);
  } finally {
    await server.close();
  }
});

test('malformed JSON is rejected without taking down the application', async () => {
  const server = await startTestServer();
  try {
    const malformed = await fetch(`${server.baseUrl}/api/v1/visitor/qa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Connection: 'close' },
      body: '{',
    });
    assert.equal(malformed.status, 400);

    const health = await server.request('/health');
    assert.equal(health.status, 200);
    assert.equal(health.body.status, 'ok');
  } finally {
    await server.close();
  }
});

test('WebSocket admin clients receive events and are removed after disconnect', () => {
  class FakeSocket extends EventEmitter {
    readonly OPEN = 1;
    readonly readyState = this.OPEN;
    readonly messages: string[] = [];
    send(message: string): void {
      this.messages.push(message);
    }
  }

  const before = getAdminCount();
  const socket = new FakeSocket();
  addClient(socket as never, 'admin');
  assert.equal(getAdminCount(), before + 1);

  broadcastQueryEvent({
    query_short: '测试问题',
    emotion: 'explain',
    response_time_ms: 12,
    used_llm: false,
  });
  assert.equal(JSON.parse(socket.messages[0]).type, 'new_query');

  socket.emit('close');
  assert.equal(getAdminCount(), before);
});
