import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Card, InputNumber, Select, Space, Typography, message } from 'antd';
import DigitalHuman from '../../components/visitor/DigitalHuman';
import { adminAPI } from '../../services/api';
import { BrowserSpeech } from '../../services/browser-speech';

const STYLES = [{ value: 'zen_red_gold', label: '禅意红金' }, { value: 'celadon_elegance', label: '青瓷雅韵' }, { value: 'tang_splendor', label: '唐风华韵' }, { value: 'ink_wash', label: '水墨丹青' }];
export default function DigitalHumanPage() {
  const navigate = useNavigate();
  const [speech] = useState(() => new BrowserSpeech());
  const [style, setStyle] = useState('zen_red_gold');
  const [voice, setVoice] = useState('browser-default');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [rate, setRate] = useState(1); const [pitch, setPitch] = useState(1);
  const [speaking, setSpeaking] = useState(false); const [mouth, setMouth] = useState(0);
  const [error, setError] = useState(''); const [saving, setSaving] = useState(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    const updateVoices = () => { if (active.current) setVoices(window.speechSynthesis?.getVoices() || []); };
    window.speechSynthesis?.addEventListener('voiceschanged', updateVoices);
    queueMicrotask(updateVoices);
    void adminAPI.getDigitalHuman().then(({ data }) => {
      if (!active.current) return;
      setStyle(data.style_preset); setVoice(data.voice_id || 'browser-default'); setRate(data.voice_speed || 1); setPitch(data.voice_pitch || 1);
    }).catch(() => { if (active.current) setError('配置读取失败，请重试。'); });
    return () => { active.current = false; speech.stop(); window.speechSynthesis?.removeEventListener('voiceschanged', updateVoices); };
  }, [speech]);
  useEffect(() => { if (!speaking) return; const timer = setInterval(() => setMouth(value => value === 1 ? 3 : 1), 150); return () => clearInterval(timer); }, [speaking]);
  const save = async () => {
    setSaving(true); setError('');
    try { await adminAPI.updateDigitalHuman({ name: '灵小禅', style_preset: style, voice_id: voice, voice_speed: rate, voice_pitch: pitch }); message.success('数字人配置已保存'); }
    catch { setError('配置保存失败，请重试。'); } finally { setSaving(false); }
  };
  const preview = () => { setError(''); try { speech.speak('你好，我是灵小禅，欢迎来到灵山胜境。', setSpeaking, setError, { voiceURI: voice, rate, pitch }); } catch (cause) { setError((cause as Error).message); } };
  return <main style={{ maxWidth: 1000, margin: 'auto', padding: 24 }}>
    <Typography.Title level={2}>数字人形象管理</Typography.Title>
    <Space wrap><Button onClick={() => navigate('/admin/dashboard')}>运营看板</Button><Button onClick={() => navigate('/admin/knowledge')}>知识库</Button><Button onClick={() => navigate('/admin/reports')}>情感报告</Button></Space>
    {error && <Alert type="error" title={error} />}
    <Card title="形象与浏览器语音" style={{ marginTop: 20 }}>
      <DigitalHuman stylePreset={style} emotion={speaking ? 'explain' : 'greet'} isSpeaking={speaking} visemeId={speaking ? mouth : 0} size="normal" />
      <Space wrap><label>形象 <Select aria-label="数字人形象" value={style} onChange={setStyle} options={STYLES} style={{ width: 160 }} /></label>
        <label>声音 <Select aria-label="播报声音" value={voice} onChange={setVoice} options={[{ value: 'browser-default', label: '浏览器中文默认声音' }, ...voices.map(item => ({ value: item.voiceURI, label: `${item.name} (${item.lang})` }))]} style={{ minWidth: 240 }} /></label>
        <label>语速 <InputNumber min={0.5} max={2} step={0.1} value={rate} onChange={value => setRate(value || 1)} /></label><label>音调 <InputNumber min={0.5} max={2} step={0.1} value={pitch} onChange={value => setPitch(value || 1)} /></label>
        <Button onClick={preview}>试听</Button><Button onClick={() => { speech.stop(); setSpeaking(false); }}>停止</Button><Button type="primary" loading={saving} onClick={() => void save()}>保存配置</Button>
      </Space><Typography.Paragraph type="secondary">可用声音由当前设备和浏览器提供；跨设备找不到指定声音时使用中文默认声音。口型为播报节奏近似动画。形象风格影响静态肖像和配色，共用当前 Live2D 模型。</Typography.Paragraph>
    </Card>
  </main>;
}
