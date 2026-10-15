import type { Server } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import { isAdminToken } from '../api/v1/auth';
import { operationsEvents } from './operations-service';

/** Tokens are sent in the first frame, never in URLs or server access logs. */
export function attachOperationsSocket(server: Server): WebSocketServer {
  const hub = new WebSocketServer({ server, path: '/ws', maxPayload: 4096 });
  const subscribers = new Map<WebSocket, string>();
  hub.on('connection', socket => {
    const timeout = setTimeout(() => socket.close(1008, 'authentication required'), 5000);
    socket.once('close', () => { clearTimeout(timeout); subscribers.delete(socket); });
    socket.on('error', () => socket.terminate());
    socket.on('message', data => {
      clearTimeout(timeout);
      try {
        const message = JSON.parse(data.toString());
        if (message.type !== 'subscribe_admin' || !isAdminToken(message.token)) {
          socket.close(1008, 'invalid admin token'); return;
        }
        subscribers.set(socket, message.token);
        socket.send(JSON.stringify({ type: 'connected' }));
      } catch { socket.close(1008, 'invalid message'); }
    });
  });
  const publish = (event: unknown) => {
    for (const [socket, token] of subscribers) {
      if (!isAdminToken(token)) { socket.close(1008, 'expired token'); subscribers.delete(socket); }
      else if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(event));
    }
  };
  operationsEvents.on('change', publish);
  hub.once('close', () => operationsEvents.off('change', publish));
  return hub;
}
