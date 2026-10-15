import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, Button, Card, Drawer, Input, Space, Tag, Typography } from 'antd';
import './QAPage.css';
import VisitorCapabilities from '../../components/visitor/VisitorCapabilities';
import { readAnswerResponse } from '../../services/qa-stream';

type Evidence = { id?: string; text: string; score?: number; source: string };
type Answer = { answer: string; conversation_id?: string | number; emotion?: string; session_id?: string; used_llm?: boolean; response_time_ms?: number;
  evaluation_trace?: { retrievedDocuments?: Evidence[]; contextIds?: string[] } };
type Message = { id: string; role: 'user' | 'assistant'; content: string; answer?: Answer };

export default function QAPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [input, setInput] = useState(() => params.get('q') || '');
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [partialAnswer, setPartialAnswer] = useState('');
  const [sessionEpoch, setSessionEpoch] = useState(0);
  const [evidenceAnswer, setEvidenceAnswer] = useState<Answer>();
  const epoch = useRef(0);
  const inFlight = useRef(false);
  const messageSequence = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  const resetSession = useCallback(async () => {
    const current = ++epoch.current;
    setSessionEpoch(current);
    controller.current?.abort();
    setPartialAnswer('');
    const request = new AbortController(); controller.current = request;
    setMessages([]); setSessionId(''); setEvidenceAnswer(undefined); setError(''); setBusy(true); inFlight.current = true;
    try {
      const response = await fetch('/api/v1/visitor/session/init', { method: 'POST', signal: request.signal });
      if (!response.ok) throw new Error('新会话创建失败，请重试。');
      const data = await response.json() as { session_id: string; welcome_message: string };
      if (current !== epoch.current) return;
      setSessionId(data.session_id);
      setMessages([{ id: 'welcome', role: 'assistant', content: data.welcome_message }]);
    } catch (cause) {
      if (!request.signal.aborted && current === epoch.current) setError(cause instanceof Error ? cause.message : '新会话创建失败');
    } finally {
      if (current === epoch.current) { setBusy(false); inFlight.current = false; }
    }
  }, []);

  useEffect(() => {
    let active = true;
    const sessionEpoch = epoch;
    queueMicrotask(() => { if (active) void resetSession(); });
    return () => { active = false; sessionEpoch.current += 1; controller.current?.abort(); };
  }, [resetSession]);
  useEffect(() => { bottom.current?.scrollIntoView?.({ block: 'end' }); }, [messages]);

  const send = async () => {
    const query = input.trim();
    if (!query || !sessionId || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(''); setInput('');
    const current = epoch.current;
    const request = new AbortController(); controller.current = request;
    const questionId = `question-${++messageSequence.current}`;
    setMessages(previous => [...previous, { id: questionId, role: 'user', content: query }]);
    try {
      const response = await fetch('/api/v1/visitor/qa', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream, application/json' },
        body: JSON.stringify({ query, session_id: sessionId }), signal: request.signal,
      });
      if (!response.ok) throw new Error('问答暂时不可用，请稍后重试。');
      const answer = await readAnswerResponse<Answer>(response, token => {
        if (current === epoch.current) setPartialAnswer(previous => previous + token);
      });
      if (current !== epoch.current) return;
      const answerId = `answer-${++messageSequence.current}`;
      setMessages(previous => [...previous, { id: answerId, role: 'assistant', content: answer.answer, answer }]);
    } catch (cause) {
      if (!request.signal.aborted && current === epoch.current) { setError(cause instanceof Error ? cause.message : '问答请求失败'); setInput(query); }
    } finally {
      if (current === epoch.current) { setBusy(false); setPartialAnswer(''); inFlight.current = false; }
    }
  };
  const evidence = evidenceAnswer?.evaluation_trace?.retrievedDocuments || [];
  return <main className="qa-page">
    <header className="qa-core-header"><Button onClick={() => navigate('/')}>返回首页</Button>
      <Typography.Title level={3}>灵小禅 · 智能问答</Typography.Title>
      <Space><Button onClick={() => navigate('/recommend')}>规划路线</Button><Button onClick={() => void resetSession()}>清空对话</Button></Space></header>
    {error && <Alert type="error" showIcon title={error} action={!sessionId && <Button onClick={() => void resetSession()}>重试</Button>} />}
    <VisitorCapabilities sessionId={sessionId} answer={[...messages].reverse().find(item => item.answer)?.answer} resetKey={sessionEpoch} busy={busy} onTranscript={setInput} />
    <section className="qa-core-messages" aria-live="polite">
      {messages.map(item => <Card key={item.id} className={`qa-core-message ${item.role}`}>
        <Typography.Text strong>{item.role === 'user' ? '你' : '灵小禅'}</Typography.Text>
        <p className="qa-core-answer">{item.content}</p>
        {item.answer && <Space wrap><Tag>{item.answer.used_llm ? '模型回答' : '知识库摘录'}</Tag>
          <Button onClick={() => setEvidenceAnswer(item.answer)}>查看回答依据</Button></Space>}
      </Card>)}{partialAnswer && <Card aria-label="正在生成回答"><Typography.Text type="secondary">正在生成，完成后显示回答依据</Typography.Text><p className="qa-core-answer">{partialAnswer}</p></Card>}<div ref={bottom} />
    </section>
    <footer className="qa-core-input"><Input.TextArea value={input} onChange={event => setInput(event.target.value)}
      placeholder="想问什么？输入后按 Enter 发送~" autoSize={{ minRows: 2, maxRows: 5 }}
      onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }} />
      <Button type="primary" loading={busy} disabled={!input.trim() || !sessionId} onClick={() => void send()}>发送</Button></footer>
    <Drawer title="回答依据" open={!!evidenceAnswer} onClose={() => setEvidenceAnswer(undefined)} size="default">
      <Typography.Paragraph>响应耗时：{evidenceAnswer?.response_time_ms ?? '未知'} ms。相关度是检索排序分值，不等于准确率。</Typography.Paragraph>
      {!evidence.length && <Alert type="info" title="本次未返回可展示的检索证据。" />}
      {evidence.map((item, index) => <Card key={item.id || index} title={item.source || '未知来源'} style={{ marginBottom: 12 }}>
        <p className="qa-core-answer">{item.text}</p><Typography.Text type="secondary">相关度：{item.score?.toFixed(4) ?? '未知'}</Typography.Text>
      </Card>)}
    </Drawer>
  </main>;
}
