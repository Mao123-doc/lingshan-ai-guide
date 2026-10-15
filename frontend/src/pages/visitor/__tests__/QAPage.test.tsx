import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import QAPage from '../QAPage';

vi.mock('../../../components/visitor/VisitorCapabilities', () => ({ default: () => null }));

describe('core text question answering', () => {
  it('uses only core endpoints and exposes the returned evidence', async () => {
    // Ordinary HTTP deployments need not provide secure-context randomUUID.
    vi.stubGlobal('crypto', {});
    const requests: string[] = [];
    const bodies: Record<string, unknown>[] = [];
    let session = 0;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input); requests.push(url);
      if (url.endsWith('/session/init')) return Response.json({ session_id: `session-${++session}`, welcome_message: '欢迎来到灵山胜境。' });
      if (url.endsWith('/qa')) {
        expect(new Headers(init?.headers).get('accept')).toContain('event-stream');
        bodies.push(JSON.parse(String(init?.body)));
        return Response.json({ answer: '灵山大佛高88米', used_llm: false, response_time_ms: 12,
          evaluation_trace: { retrievedDocuments: [{ text: '大佛高88米。', score: 0.9, source: 'knowledge_guide.txt' }] } });
      }
      throw new Error(`unexpected URL: ${url}`);
    }));
    try {
      render(<MemoryRouter><QAPage /></MemoryRouter>);
      await screen.findByText('欢迎来到灵山胜境。');
      const input = screen.getByPlaceholderText('想问什么？输入后按 Enter 发送~');
      fireEvent.change(input, { target: { value: '灵山大佛有多高？' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      await screen.findByText('灵山大佛高88米');
      expect(screen.getByText('知识库摘录')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: '查看回答依据' }));
      await screen.findByText('knowledge_guide.txt');
      expect(screen.getByText('大佛高88米。')).toBeInTheDocument();
      expect(requests.every(url => /\/(session\/init|qa)$/.test(url))).toBe(true);
      fireEvent.click(screen.getByRole('button', { name: /关闭|Close/ }));
      fireEvent.click(screen.getByRole('button', { name: '清空对话' }));
      await waitFor(() => expect(session).toBe(2));
      fireEvent.change(input, { target: { value: '第二个问题' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      await waitFor(() => expect(bodies).toHaveLength(2));
      expect(bodies.map(body => body.session_id)).toEqual(['session-1', 'session-2']);
    } finally { vi.unstubAllGlobals(); }
  });
  it('discards a pending answer after the user starts a new session', async () => {
    let finishAnswer: (response: Response) => void = () => {};
    let session = 0;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/session/init')) return Response.json({ session_id: `new-${++session}`, welcome_message: `欢迎 ${session}` });
      return new Promise<Response>(resolve => { finishAnswer = resolve; });
    }));
    try {
      render(<MemoryRouter><QAPage /></MemoryRouter>);
      await screen.findByText('欢迎 1');
      const input = screen.getByPlaceholderText('想问什么？输入后按 Enter 发送~');
      fireEvent.change(input, { target: { value: '旧问题' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      fireEvent.click(screen.getByRole('button', { name: '清空对话' }));
      await screen.findByText('欢迎 2');
      finishAnswer(Response.json({ answer: '过期回答', used_llm: false }));
      await waitFor(() => expect(screen.queryByText('过期回答')).not.toBeInTheDocument());
      expect(screen.queryByRole('button', { name: '查看回答依据' })).not.toBeInTheDocument();
    } finally { vi.unstubAllGlobals(); }
  });

});
