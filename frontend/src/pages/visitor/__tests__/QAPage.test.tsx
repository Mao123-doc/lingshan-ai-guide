import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import QAPage from '../QAPage';

vi.mock('../../../components/visitor/DigitalHuman', () => ({
  default: () => <div data-testid="digital-human" />,
  ensureAudioContext: vi.fn(),
}));

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('QAPage critical states', () => {
  it('renders the session welcome and accumulates a streamed answer', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/dh-config')) return jsonResponse({ style_preset: 'zen_red_gold' });
      if (url.endsWith('/session/init')) return jsonResponse({ session_id: 'ui-session', welcome_message: '欢迎来到灵山胜境。' });
      if (url.includes(':8001/tts')) return jsonResponse({ audio_base64: '' });
      if (url.endsWith('/qa')) {
        return new Response(
          'data: {"type":"chunk","content":"灵山大佛高88米"}\n' +
          'data: {"type":"done","emotion":"explain"}\n\n',
          { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
        );
      }
      throw new Error(`unexpected URL: ${url}`);
    }) as typeof fetch;

    try {
      render(<MemoryRouter><QAPage /></MemoryRouter>);
      expect(await screen.findByText('欢迎来到灵山胜境。')).toBeInTheDocument();

      const input = screen.getByPlaceholderText('想问什么？输入后按 Enter 发送~');
      fireEvent.change(input, { target: { value: '灵山大佛有多高？' } });
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', shiftKey: false });

      await waitFor(() => expect(screen.getByText('灵山大佛高88米')).toBeInTheDocument());
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
