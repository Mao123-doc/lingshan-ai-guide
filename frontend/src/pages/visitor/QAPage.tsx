import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, Button, Drawer, Input, Tag, Typography } from 'antd';
import './QAPage.css';

interface Evidence { id: string; source: string; text: string; score: number }
interface Answer {
  answer: string;
  session_id: string;
  used_llm: boolean;
  response_time_ms?: number;
  evaluation_trace?: {
    retrievedDocuments?: Evidence[];
    contextIds?: string[];
    fullKnowledgeIncluded?: boolean;
  };
}
interface ChatMessage { id: string; role: 'user' | 'assistant'; content: string; result?: Answer }
const WELCOME = '您好，我是灵小禅。可以询问景点、票价和演出时间，也可以前往路线规划安排行程。';
const QUESTIONS = ['灵山大佛有多高？', '九龙灌浴表演时间？', '门票价格是多少？'];

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '请求失败，请稍后再试。');
  return data as T;
}

export default function QAPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [sessionId, setSessionId] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [evidence, setEvidence] = useState<Answer | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const initialQuestionRef = useRef<string | null>(null);
  const messagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/v1/visitor/session/init', { method: 'POST', signal: controller.signal })
      .then(readJson<{ session_id: string; welcome_message: string }>)
      .then(data => {
        if (controller.signal.aborted) return;
        setSessionId(data.session_id || crypto.randomUUID());
        setMessages([{ id: 'welcome', role: 'assistant', content: data.welcome_message || WELCOME }]);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setSessionId(crypto.randomUUID());
        setMessages([{ id: 'welcome', role: 'assistant', content: WELCOME }]);
      });
    return () => { controller.abort(); requestRef.current?.abort(); };
  }, []);

  const sendQuestion = useCallback(async (text: string) => {
    const query = text.trim();
    if (!query || !sessionId || requestRef.current) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setBusy(true);
    setError('');
    setInput('');
    setMessages(previous => [...previous, { id: crypto.randomUUID(), role: 'user', content: query }]);
    const timeout = setTimeout(() => controller.abort(), 90000);
    try {
      const response = await fetch('/api/v1/visitor/qa', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, session_id: sessionId }), signal: controller.signal,
      });
      const result = await readJson<Answer>(response);
      if (controller.signal.aborted || requestRef.current !== controller) return;
      if (!result.answer) throw new Error('未收到回答，请稍后再试。');
      setMessages(previous => [...previous, { id: crypto.randomUUID(), role: 'assistant', content: result.answer, result }]);
    } catch (err) {
      if (requestRef.current === controller) {
        setError(controller.signal.aborted ? '回答超时，请稍后重试。' : err instanceof Error ? err.message : '请求失败，请稍后再试。');
        setInput(query);
      }
    } finally {
      clearTimeout(timeout);
      if (requestRef.current === controller) { requestRef.current = null; setBusy(false); }
    }
  }, [sessionId]);

  useEffect(() => {
    const query = searchParams.get('q');
    if (query && sessionId && initialQuestionRef.current !== query) {
      initialQuestionRef.current = query;
      void sendQuestion(query);
    }
  }, [searchParams, sessionId, sendQuestion]);

  useEffect(() => {
    const container = messagesRef.current;
    container?.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  function clearChat() {
    requestRef.current?.abort();
    requestRef.current = null;
    setBusy(false);
    setSessionId(crypto.randomUUID());
    setMessages([{ id: 'welcome', role: 'assistant', content: WELCOME }]);
    setInput('');
    setError('');
    setEvidence(null);
  }

  const documents = evidence?.evaluation_trace?.retrievedDocuments || [];
  return (
    <main className="qa-page">
      <header className="qa-header">
        <Button onClick={() => navigate('/')}>首页</Button>
        <Typography.Title level={4}>灵小禅 · 可信问答</Typography.Title>
        <div className="qa-header-actions">
          <Button onClick={() => navigate('/recommend')}>路线规划</Button>
          <Button onClick={clearChat} disabled={!sessionId}>清空对话</Button>
        </div>
      </header>
      <div className="qa-questions">{QUESTIONS.map(question => <Button key={question} size="small" disabled={busy || !sessionId} onClick={() => void sendQuestion(question)}>{question}</Button>)}</div>
      <div className="qa-messages" ref={messagesRef} role="log" aria-label="对话记录" aria-live="polite">
        {messages.map(item => <article key={item.id} className={`qa-message ${item.role}`}>
          <div className="qa-message-role">{item.role === 'user' ? '你' : '灵小禅'}</div>
          <div className="qa-message-content">{item.content}</div>
          {item.result && <div className="qa-message-meta">
            {!item.result.used_llm && <Tag>知识库摘录</Tag>}
            <Button type="link" size="small" onClick={() => setEvidence(item.result!)}>查看依据</Button>
          </div>}
        </article>)}
        {busy && <div role="status">正在查阅资料，请稍候…</div>}
      </div>
      {error && <Alert type="error" showIcon title={error} />}
      <div className="qa-input-area">
        <Input.TextArea value={input} onChange={event => setInput(event.target.value)}
          onPressEnter={event => { if (!event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void sendQuestion(input); } }}
          placeholder="想问什么？输入后按 Enter 发送" aria-label="问题" autoSize={{ minRows: 1, maxRows: 4 }} disabled={busy || !sessionId} />
        <Button type="primary" loading={busy} disabled={!input.trim() || !sessionId} onClick={() => void sendQuestion(input)}>发送</Button>
      </div>
      <Drawer title="回答依据" open={!!evidence} onClose={() => setEvidence(null)} styles={{ wrapper: { width: 'min(480px, 100vw)' } }}>
        {evidence && <>
          {evidence.response_time_ms !== undefined && <Typography.Paragraph>响应耗时：{evidence.response_time_ms} 毫秒</Typography.Paragraph>}
          {evidence.used_llm && evidence.evaluation_trace?.fullKnowledgeIncluded && <Typography.Paragraph type="secondary">本次回答还参考了完整官方指南。</Typography.Paragraph>}
          <Typography.Paragraph type="secondary">以下为检索到的参考片段，相关度分值不代表回答正确率。</Typography.Paragraph>
          {documents.length === 0 && <Typography.Paragraph>本次未返回可展示的检索片段。</Typography.Paragraph>}
          {documents.map(document => <section className="qa-evidence" key={document.id}>
            <Typography.Text strong>{document.source || '知识库'}</Typography.Text>
            {evidence.used_llm && evidence.evaluation_trace?.contextIds?.includes(document.id) && <Tag>已选入上下文</Tag>}
            <Typography.Paragraph className="qa-message-content">{document.text}</Typography.Paragraph>
            <Typography.Text type="secondary">检索相关度：{document.score.toFixed(4)}</Typography.Text>
          </section>)}
        </>}
      </Drawer>
    </main>
  );
}
