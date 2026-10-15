import { describe, expect, it } from 'vitest';
import { readAnswerResponse } from '../qa-stream';

describe('question answer stream', () => {
  it('assembles tokens and retains final evidence metadata', async () => {
    const tokens: string[] = [];
    const encoder = new TextEncoder();
    const text = 'data: {"type":"chunk","content":"大佛"}\n\ndata: {"type":"chunk","content":"88米"}\n\ndata: {"type":"done","answer":"大佛88米","conversation_id":"a","evaluation_trace":{"retrievedDocuments":[{"source":"guide"}]}}\n\n';
    const response = new Response(new ReadableStream({ start(controller) {
      const bytes = encoder.encode(text); for (let i = 0; i < bytes.length; i += 7) controller.enqueue(bytes.slice(i, i + 7)); controller.close();
    } }), { headers: { 'Content-Type': 'text/event-stream' } });
    const result = await readAnswerResponse(response, content => tokens.push(content));
    expect(tokens).toEqual(['大佛', '88米']);
    expect(result).toMatchObject({ conversation_id: 'a', evaluation_trace: { retrievedDocuments: [{ source: 'guide' }] } });
  });
  it('rejects truncated or failed streams rather than accepting partial answers', async () => {
    const response = new Response('data: {"type":"chunk","content":"一半"}\n\n', { headers: { 'Content-Type': 'text/event-stream' } });
    await expect(readAnswerResponse(response)).rejects.toThrow('中断');
    const error = new Response('data: {"type":"error","error":"模型连接失败"}\n\n', { headers: { 'Content-Type': 'text/event-stream' } });
    await expect(readAnswerResponse(error)).rejects.toThrow('模型连接失败');
  });
});
