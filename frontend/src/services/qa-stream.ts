/** Decode arbitrary network chunks; only a complete done frame is an answer. */
export async function readAnswerResponse<T extends { answer: string }>(response: Response, onToken?: (content: string) => void): Promise<T> {
  if (!response.ok) throw new Error('问答暂时不可用，请稍后重试。');
  if (!response.headers.get('Content-Type')?.includes('text/event-stream')) return response.json() as Promise<T>;
  if (!response.body) throw new Error('问答流已中断，请重试。');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let answer: T | undefined;
  const consume = (frame: string) => {
    const data = frame.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
    if (!data) return;
    const event = JSON.parse(data);
    if (event.type === 'error') throw new Error(event.error || '问答流已中断，请重试。');
    if (event.type === 'chunk' && typeof event.content === 'string') onToken?.(event.content);
    if (event.type === 'done' && typeof event.answer === 'string') answer = event as T;
  };
  try {
    while (!answer) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done }).replace(/\r\n/g, '\n');
      let boundary: number;
      while ((boundary = buffer.indexOf('\n\n')) >= 0) {
        consume(buffer.slice(0, boundary)); buffer = buffer.slice(boundary + 2);
      }
      if (done) break;
    }
    if (!answer) throw new Error('问答流已中断，请重试。');
    return answer;
  } finally { await reader.cancel(); reader.releaseLock(); }
}
