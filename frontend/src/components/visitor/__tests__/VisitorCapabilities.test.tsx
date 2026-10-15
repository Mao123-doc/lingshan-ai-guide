import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import VisitorCapabilities from '../VisitorCapabilities';
vi.mock('../DigitalHuman', () => ({default: () => <div>数字人</div>}));
describe('visitor capabilities', () => {
 it('shows unsupported speech and does not rate welcome messages', () => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({style_preset:'ink_wash'})));
  render(<VisitorCapabilities sessionId="s" onTranscript={vi.fn()} resetKey={0} busy={false} />);
  fireEvent.click(screen.getByRole('button', {name: '语音输入'}));
  expect(screen.getByText(/不支持语音识别/)).toBeInTheDocument();
  expect(screen.queryByRole('button', {name:/提交评价/})).not.toBeInTheDocument();
  vi.unstubAllGlobals();
 });
 it('binds feedback to a returned answer and prevents duplicate submission', async () => {
  const calls: RequestInit[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => { if(url.endsWith('/feedback')) calls.push(init!); return Response.json({}); }));
  render(<VisitorCapabilities sessionId="s" answer={{answer:'说明',conversation_id:42}} onTranscript={vi.fn()} resetKey={0} busy={false} />);
  fireEvent.click(screen.getByRole('button', {name:/提交评价/}));
  await screen.findByText('评价已保存');
  expect(JSON.parse(String(calls[0].body))).toMatchObject({session_id:'s',conversation_id:42,rating:5});
  await waitFor(() => expect(screen.getByRole('button', {name:/提交评价/})).toBeDisabled());
  vi.unstubAllGlobals();
 });
 it('discards a pending image recognition after reset', async () => {
  let finish: (response: Response) => void = () => {};
  const transcript = vi.fn();
  vi.stubGlobal('fetch', vi.fn(async (url: string) => url.endsWith('/dh-config') ? Response.json({}) : new Promise<Response>(resolve => {finish = resolve;})));
  const view = render(<VisitorCapabilities sessionId="s" onTranscript={transcript} resetKey={0} busy={false} />);
  fireEvent.change(screen.getByLabelText('上传景点图片'), {target:{files:[new File(['image'], 'spot.png', {type:'image/png'})]}});
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  view.rerender(<VisitorCapabilities sessionId="new" onTranscript={transcript} resetKey={1} busy={false} />);
  await act(async () => {finish(Response.json({spot_name:'旧景点',description:'过期识别'}));});
  expect(transcript).not.toHaveBeenCalled();
  expect(screen.queryByText('过期识别')).not.toBeInTheDocument();
  vi.unstubAllGlobals();
 });
 it('shows vision service unavailable without fabricating recognition', async () => {
  const transcript = vi.fn();
  vi.stubGlobal('fetch', vi.fn(async (url: string) => url.endsWith('/dh-config') ? Response.json({}) : Response.json({error:'视觉服务未配置'}, {status:503})));
  render(<VisitorCapabilities sessionId="s" onTranscript={transcript} resetKey={0} busy={false} />);
  fireEvent.change(screen.getByLabelText('上传景点图片'), {target:{files:[new File(['image'], 'spot.png', {type:'image/png'})]}});
  await screen.findByText('视觉服务未配置');
  expect(transcript).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
 });
});
