/** Admin-only updates: authenticate each connection and refresh after reconnect. */
export function subscribeOperations(url: string, getToken: () => string | null, refresh: () => void, connection: (connected: boolean) => void): () => void {
  let socket: WebSocket | undefined;
  let stopped = false;
  let delay = 1000;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const connect = () => {
    if (stopped || !getToken()) return;
    socket = new WebSocket(url);
    socket.onopen = () => socket?.send(JSON.stringify({ type: 'subscribe_admin', token: getToken() }));
    socket.onmessage = event => {
      if (stopped) return;
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'connected') { delay = 1000; connection(true); refresh(); }
        else if (message.type === 'new_query' || message.type === 'feedback') refresh();
      } catch { /* Ignore malformed event, refreshes remain authenticated HTTP. */ }
    };
    socket.onerror = () => connection(false);
    socket.onclose = event => {
      if (stopped) return;
      connection(false);
      if (event.code === 1008) { refresh(); return; }
      timer = setTimeout(connect, delay); delay = Math.min(delay * 2, 30000);
    };
  };
  connect();
  return () => { stopped = true; clearTimeout(timer); socket?.close(); };
}
