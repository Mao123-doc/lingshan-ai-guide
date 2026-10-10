import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import QAPage from '../QAPage';

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
afterEach(() => vi.unstubAllGlobals());

function mockApi(fail = false) {
  const requests: Array<{ query: string; session_id: string }> = [];
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).endsWith('/session/init')) return json({ session_id: 'session-one', welcome_message: '欢迎来到灵山胜境。' });
    if (String(input).endsWith('/qa')) {
      requests.push(JSON.parse(String(init?.body)));
      if (fail) return json({ error: '问答处理失败' }, 500);
      return json({ answer: '灵山大佛高88米', session_id: requests.at(-1)?.session_id, used_llm: false,
        response_time_ms: 123, evaluation_trace: { contextIds: ['guide'], fullKnowledgeIncluded: true,
          retrievedDocuments: [{ id: 'guide', source: '官方指南', text: '大佛通高88米。', score: 0.032 }] } });
    }
    throw new Error(`Unexpected request: ${input}`);
  }));
  return requests;
}

async function ask(query: string) {
  const input = await screen.findByPlaceholderText('想问什么？输入后按 Enter 发送');
  await waitFor(() => expect(input).toBeEnabled());
  fireEvent.change(input, { target: { value: query } });
  fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
}

describe('core question answering', () => {
  it('shows the answer, evidence and fallback status without peripheral requests', async () => {
    const requests = mockApi();
    render(<MemoryRouter><QAPage /></MemoryRouter>);
    await screen.findByText('欢迎来到灵山胜境。');
    await ask('大佛高度');
    expect(await screen.findByText('灵山大佛高88米')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '查看依据' }));
    expect(await screen.findByText('大佛通高88米。')).toBeInTheDocument();
    expect(screen.getByText('官方指南')).toBeInTheDocument();
    expect(screen.getByText(/知识库摘录/)).toBeInTheDocument();
    expect(requests).toEqual([{ query: '大佛高度', session_id: 'session-one' }]);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it('keeps follow-ups in one session and starts a new session after clearing', async () => {
    const requests = mockApi();
    render(<MemoryRouter><QAPage /></MemoryRouter>);
    await ask('问题一');
    await screen.findByText('灵山大佛高88米');
    await ask('问题二');
    await waitFor(() => expect(requests).toHaveLength(2));
    await waitFor(() => expect(screen.getByPlaceholderText('想问什么？输入后按 Enter 发送')).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: '清空对话' }));
    await ask('新问题');
    await waitFor(() => expect(requests).toHaveLength(3));
    expect(requests[1].session_id).toBe(requests[0].session_id);
    expect(requests[2].session_id).not.toBe(requests[0].session_id);
    expect(screen.queryByText('问题一')).not.toBeInTheDocument();
  });

  it('shows a failed request and permits another question', async () => {
    mockApi(true);
    render(<MemoryRouter><QAPage /></MemoryRouter>);
    await ask('失败请求');
    expect(await screen.findByRole('alert')).toHaveTextContent('问答处理失败');
    expect(screen.getByPlaceholderText('想问什么？输入后按 Enter 发送')).toBeEnabled();
  });

  it('submits a homepage question once after session initialization', async () => {
    const requests = mockApi();
    render(<MemoryRouter initialEntries={['/qa?q=大佛高度']}><QAPage /></MemoryRouter>);
    await screen.findByText('灵山大佛高88米');
    expect(requests).toHaveLength(1);
  });
});
