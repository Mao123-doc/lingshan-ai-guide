import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Card, Input, Select, Space, Typography } from 'antd';
import DigitalHuman from './DigitalHuman';
import { BrowserSpeech } from '../../services/browser-speech';

type Reply = {answer: string; conversation_id?: string | number; emotion?: string};
type Nearby = {id?: string; name?: string; distance_m?: number; distance?: number; coordinate_source?: string; provenance?: string; estimated?: boolean; requires_on_site_verification?: boolean};
interface Props {sessionId: string; answer?: Reply; resetKey: number; busy: boolean; onTranscript: (text: string) => void}
export default function VisitorCapabilities({sessionId, answer, resetKey, busy, onTranscript}: Props) {
 const [speech] = useState(() => new BrowserSpeech());
 const [speaking, setSpeaking] = useState(false); const [listening, setListening] = useState(false);
 const [error, setError] = useState(''); const [notice, setNotice] = useState('');
 const [style, setStyle] = useState('zen_red_gold'); const [mouth, setMouth] = useState(0);
 const [voiceOptions, setVoiceOptions] = useState<{voiceURI?:string;rate?:number;pitch?:number}>({});
 const [nearby, setNearby] = useState<Nearby[]>([]); const [working, setWorking] = useState(false);
 const [rating, setRating] = useState(5); const [comment, setComment] = useState('');
 const [rated, setRated] = useState<Array<string | number>>([]); const [ratingBusy, setRatingBusy] = useState(false);
 const generation = useRef(0); const requests = useRef(new Set<AbortController>());
 const file = useRef<HTMLInputElement>(null); const camera = useRef<HTMLInputElement>(null);
 useEffect(() => {
  const request = new AbortController();
  void fetch('/api/v1/visitor/dh-config', {signal:request.signal}).then(async response => {if(!response.ok) throw new Error(); return response.json();}).then(data => {if(!request.signal.aborted) {setStyle(data.style_preset || data.appearance?.style_preset || 'zen_red_gold');setVoiceOptions({voiceURI:data.voice_id,rate:data.voice_speed,pitch:data.voice_pitch});}}).catch(() => {});
  return () => request.abort();
 }, []);
 useEffect(() => {
  const generationRef = generation; const activeRequests = requests.current;
  const current = ++generationRef.current; speech.stop();
  for(const request of requests.current) request.abort(); requests.current.clear();
  queueMicrotask(() => {if(current !== generationRef.current) return; setSpeaking(false); setListening(false); setError(''); setNotice(''); setNearby([]); setWorking(false); setRatingBusy(false); setComment('');});
  if(file.current) file.current.value = ''; if(camera.current) camera.current.value = '';
  return () => {generationRef.current++; speech.stop(); for(const request of activeRequests) request.abort(); activeRequests.clear();};
 }, [resetKey, speech]);
 useEffect(() => {let active = true; if(busy) {speech.stop(); queueMicrotask(() => {if(active) {setSpeaking(false); setListening(false);}});} return () => {active = false;};}, [busy,speech]);
 useEffect(() => {if(!speaking) return; const timer = setInterval(() => setMouth(value => value === 1 ? 3 : 1), 150); return () => clearInterval(timer);}, [speaking]);
 const stop = () => {speech.stop(); setSpeaking(false); setListening(false);};
 const listen = () => {stop(); setError(''); try {speech.listen(text => {setListening(false); onTranscript(text);}, message => {setError(message); setListening(false);}, () => setListening(false)); setListening(true);} catch(cause) {setError((cause as Error).message);} };
 const speak = () => {if(!answer) return; stop(); setError(''); try {speech.speak(answer.answer, setSpeaking, setError, voiceOptions);} catch(cause) {setError((cause as Error).message);} };
 const requestJSON = async (url: string, init?: RequestInit) => {
  const request = new AbortController(); requests.current.add(request);
  try {const response = await fetch(url, {...init,signal:request.signal}); const data = await response.json().catch(() => ({})); if(!response.ok) throw new Error(data.message || data.error || (response.status === 503 ? '此服务尚未配置或暂不可用，请稍后重试。' : '请求失败，请稍后重试。')); return data;}
  finally {requests.current.delete(request);}
 };
 const recognize = async (image: File | undefined) => {
  if(!image) return; setError(''); setNotice('');
  if(!image.type.startsWith('image/')) {setError('请选择图片文件。'); return;}
  if(image.size > 5 * 1024 * 1024) {setError('图片不能超过 5 MB。'); return;}
  const current = generation.current; setWorking(true);
  try {
   const image_base64 = await new Promise<string>((resolve,reject) => {const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('图片读取失败。')); reader.readAsDataURL(image);});
   if(current !== generation.current) return;
   const data = await requestJSON('/api/v1/visitor/vision/recognize', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image_base64})});
   if(current !== generation.current) return;
   const name = data.spot_name || data.spot?.name || data.attraction?.name || data.attraction_name || data.matched_attraction?.name;
   setNotice(data.explanation || data.description || data.message || (name ? `识别结果：${name}` : '未能可靠匹配景点，请换一张清晰图片。'));
   if(name && data.matched !== false && !data.needs_clarification) onTranscript(`请介绍${name}`);
  } catch(cause) {if(current === generation.current) setError((cause as Error).message);} finally {if(current === generation.current) setWorking(false);}
 };
 const locate = () => {
  setError(''); setNotice(''); const current = generation.current;
  if(!navigator.geolocation) {setError('当前浏览器不支持定位。'); return;}
  setWorking(true);
  navigator.geolocation.getCurrentPosition(position => {
   if(current !== generation.current) return;
   const query = `lat=${position.coords.latitude}&lng=${position.coords.longitude}`;
   void Promise.all([requestJSON(`/api/v1/visitor/nearby?${query}`),requestJSON(`/api/v1/visitor/nearby-facilities?${query}`)]).then(([spots,facilities]) => {
    if(current !== generation.current) return;
    setNearby([...(Array.isArray(spots) ? spots : spots.attractions || spots.nearby || spots.items || []),...(Array.isArray(facilities) ? facilities : facilities.facilities || facilities.items || [])]);
    setNotice(`已获取定位（精度约 ${Math.round(position.coords.accuracy)} 米）。距离为坐标直线距离；估算坐标不能用于判断道路或无障碍可达性。`);
   }).catch(cause => {if(current === generation.current) setError(cause.message);}).finally(() => {if(current === generation.current) setWorking(false);});
  }, cause => {if(current === generation.current) {setWorking(false); setError(cause.code === 1 ? '定位权限被拒绝，请在浏览器设置中允许定位。' : '无法获取当前位置，请检查设备定位服务。');}}, {enableHighAccuracy:true, timeout:15000, maximumAge:30000});
 };
 const feedback = async () => {
  const id = answer?.conversation_id; if(id === undefined || ratingBusy || rated.includes(id)) return;
  const current = generation.current; setRatingBusy(true); setError('');
  try {await requestJSON('/api/v1/visitor/feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session_id:sessionId,conversation_id:id,rating,comment})}); if(current === generation.current) {setRated(values => [...values,id]); setNotice('评价已保存');}}
  catch(cause) {if(current === generation.current) setError((cause as Error).message);} finally {if(current === generation.current) setRatingBusy(false);}
 };
 return <details className="qa-capabilities" open><summary>数字人、语音与游览工具</summary><div className="qa-capabilities-grid">
  <div className="qa-digital-human"><DigitalHuman stylePreset={style} isSpeaking={speaking} visemeId={speaking ? mouth : 0} emotion={error ? 'sorry' : listening ? 'greet' : busy ? 'think' : speaking ? 'explain' : answer?.emotion || 'idle'} size="normal" />
  <Typography.Text type="secondary">{listening ? '正在倾听…' : busy ? '正在思考…' : speaking ? '正在讲解…' : '随时为您服务'}。播报口型为节奏近似动画。</Typography.Text></div>
  <div><Space wrap><Button onClick={listen} disabled={busy || listening}>语音输入</Button><Button onClick={speak} disabled={!answer || busy}>播报最新回答</Button><Button onClick={stop} disabled={!speaking && !listening}>停止语音</Button>
   <Button onClick={() => file.current?.click()} disabled={working}>上传识景</Button><Button onClick={() => camera.current?.click()} disabled={working}>拍照识景</Button><Button onClick={locate} loading={working}>查看附近</Button></Space>
   <input ref={file} aria-label="上传景点图片" type="file" accept="image/*" hidden onChange={event => void recognize(event.target.files?.[0])} />
   <input ref={camera} aria-label="拍摄景点图片" type="file" accept="image/*" capture="environment" hidden onChange={event => void recognize(event.target.files?.[0])} />
   {error && <Alert type="error" role="alert" title={error} />}{notice && <Alert type="info" title={notice} />}
   <div className="qa-nearby-list">{nearby.map((item,index) => <Card size="small" key={`${item.id || index}-${index}`}><strong>{item.name || '未命名地点'}</strong> · 直线距离 {item.distance_m !== undefined || item.distance !== undefined ? `${Math.round(item.distance_m ?? item.distance ?? 0)} 米` : '未知'} <Typography.Text type="secondary">{item.coordinate_source || item.provenance || '坐标来源见景区数据'}{item.requires_on_site_verification || item.estimated !== false ? '（坐标/距离待现场核验）' : ''}</Typography.Text></Card>)}</div>
   {answer?.conversation_id !== undefined && <Space wrap className="qa-feedback"><label>最新回答评分 <Select aria-label="回答评分" value={rating} onChange={setRating} options={[1,2,3,4,5].map(value => ({value,label:`${value} 分`}))}/></label><Input aria-label="评价内容" placeholder="可选：补充评价" value={comment} maxLength={1000} onChange={event => setComment(event.target.value)}/><Button onClick={() => void feedback()} loading={ratingBusy} disabled={rated.includes(answer.conversation_id)}>提交评价</Button></Space>}
  </div></div></details>;
}
