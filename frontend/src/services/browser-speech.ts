type Recognition = {
 lang: string; continuous: boolean; interimResults: boolean;
 onresult: ((event: {results: ArrayLike<ArrayLike<{transcript: string}>>}) => void) | null;
 onerror: ((event: {error: string}) => void) | null;
 onend: (() => void) | null; start(): void; abort(): void;
};
export class BrowserSpeech {
 private recognition?: Recognition;
 private generation = 0;
 stop() {
  this.generation++;
  if (this.recognition) { this.recognition.onend = null; this.recognition.abort(); this.recognition = undefined; }
  window.speechSynthesis?.cancel();
 }
 listen(result: (text: string) => void, error: (message: string) => void, ended: () => void = () => {}) {
  this.stop();
  const browser = window as Window & {SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition};
  const Constructor = browser.SpeechRecognition || browser.webkitSpeechRecognition;
  if (!Constructor) throw new Error('当前浏览器不支持语音识别，请使用文字输入或 Chrome。');
  const generation = this.generation;
  const recognition = new Constructor(); this.recognition = recognition;
  recognition.lang = 'zh-CN'; recognition.continuous = false; recognition.interimResults = false;
  recognition.onresult = event => { if (generation === this.generation) result(Array.from(event.results).map(item => item[0].transcript).join('')); };
  recognition.onerror = event => { if (generation === this.generation) error(event.error === 'not-allowed' || event.error === 'service-not-allowed' ? '麦克风权限被拒绝，请在浏览器设置中允许录音。' : `语音识别失败（${event.error}），请重试或输入文字。`); };
  recognition.onend = () => { if (generation === this.generation) { this.recognition = undefined; ended(); } };
  recognition.start();
 }
 speak(text: string, state: (speaking: boolean) => void, error: (message: string) => void, options?: { voiceURI?: string; rate?: number; pitch?: number }) {
  this.stop();
  if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) throw new Error('当前浏览器不支持语音播报。');
  const generation = this.generation;
  const utterance = new SpeechSynthesisUtterance(text); utterance.lang = 'zh-CN';
  const voices = window.speechSynthesis.getVoices?.() || [];
  utterance.voice = voices.find(voice => voice.voiceURI === options?.voiceURI) || voices.find(voice => voice.lang.startsWith('zh')) || null;
  utterance.rate = options?.rate || 1; utterance.pitch = options?.pitch || 1;
  utterance.onstart = () => { if (generation === this.generation) state(true); };
  utterance.onend = () => { if (generation === this.generation) state(false); };
  utterance.onerror = event => { if (generation === this.generation) { state(false); error(`语音播报失败（${event.error}）。`); } };
  window.speechSynthesis.speak(utterance);
 }
}
