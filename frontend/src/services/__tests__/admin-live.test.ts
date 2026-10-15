import { afterEach, expect, it, vi } from 'vitest';
import { subscribeOperations } from '../admin-live';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
it('reconnects after a dropped socket, refreshes snapshots, and cancels on unmount', () => {
  vi.useFakeTimers();
  const sockets: Array<{ onopen?: () => void; onmessage?: (event: { data: string }) => void; onclose?: (event: { code: number }) => void; close: () => void; send: ReturnType<typeof vi.fn> }> = [];
  class Socket {
    onopen?: () => void; onmessage?: (event: { data: string }) => void; onclose?: (event: { code: number }) => void;
    send = vi.fn(); close = vi.fn();
    constructor() { sockets.push(this); }
  }
  vi.stubGlobal('WebSocket', Socket);
  const refresh = vi.fn(); const state = vi.fn();
  const stop = subscribeOperations('ws://example/ws', () => 'token', refresh, state);
  sockets[0].onopen?.();
  expect(JSON.parse(sockets[0].send.mock.calls[0][0]).token).toBe('token');
  sockets[0].onmessage?.({ data: '{"type":"connected"}' });
  expect(refresh).toHaveBeenCalledTimes(1);
  sockets[0].onclose?.({ code: 1006 });
  expect(state).toHaveBeenLastCalledWith(false);
  vi.advanceTimersByTime(1000); expect(sockets).toHaveLength(2);
  sockets[1].onmessage?.({ data: '{"type":"connected"}' });
  expect(refresh).toHaveBeenCalledTimes(2);
  sockets[1].onclose?.({ code: 1006 }); stop();
  vi.advanceTimersByTime(60000); expect(sockets).toHaveLength(2);
});
