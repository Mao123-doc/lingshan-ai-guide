import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { WebSocket } from 'ws';
import { jsonBody, startTestServer } from '../helpers/api-fixtures';
import { operationsEvents } from '../../src/services/operations-service';

test('operations socket requires admin token before publishing updates', async () => {
  const api = await startTestServer();
  const { attachOperationsSocket } = await import('../../src/services/operations-socket');
  const server = createServer();
  const hub = attachOperationsSocket(server);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('missing port');
  let socket: WebSocket | undefined;
  try {
    const unauthenticated = new WebSocket(`ws://127.0.0.1:${address.port}/ws`);
    await new Promise<void>((resolve, reject) => {
      unauthenticated.on('open', () => unauthenticated.send(JSON.stringify({ type: 'subscribe_admin' })));
      unauthenticated.on('message', () => reject(new Error('unauthorized socket received a message')));
      unauthenticated.on('close', code => { assert.equal(code, 1008); resolve(); });
      unauthenticated.on('error', reject);
    });
    const login = await api.request('/api/v1/auth/login', jsonBody({ username: 'admin', password: 'public-api-test-password' }));
    socket = new WebSocket(`ws://127.0.0.1:${address.port}/ws`);
    const connected = new Promise<Record<string,unknown>>((resolve, reject) => {
      socket!.once('message', value => resolve(JSON.parse(value.toString()))); socket!.once('error', reject);
    });
    socket.on('open', () => socket!.send(JSON.stringify({ type: 'subscribe_admin', token: login.body.access_token })));
    assert.equal((await connected).type, 'connected');
    const update = new Promise<Record<string,unknown>>(resolve => socket!.once('message', value => resolve(JSON.parse(value.toString()))));
    operationsEvents.emit('change', { type: 'new_query' });
    assert.equal((await update).type, 'new_query');
  } finally {
    socket?.terminate(); await new Promise<void>(resolve => hub.close(() => resolve()));
    await new Promise<void>(resolve => server.close(() => resolve())); await api.close();
  }
});
