import { describe, expect, it, vi } from 'vitest';
import { BrowserSpeech } from '../browser-speech';
describe('browser speech adapter', () => {
  it('reports unavailable recognition clearly', () => {
    const speech = new BrowserSpeech();
    expect(() => speech.listen(vi.fn(), vi.fn())).toThrow('浏览器不支持语音识别');
  });
  it('reports denied microphone permission and ignores callbacks after cancellation', () => {
    let instance: { onerror?: (event: {error:string}) => void; onresult?: (event: unknown) => void };
    class Recognition { onerror?: (event: {error:string}) => void; onresult?: (event: unknown) => void; constructor() { instance = { onerror: undefined, onresult: undefined }; Object.defineProperties(instance, { onerror: { get: () => this.onerror }, onresult: { get: () => this.onresult } }); } start() {} abort() {} }
    vi.stubGlobal('SpeechRecognition', Recognition);
    const result = vi.fn(); const error = vi.fn();
    const speech = new BrowserSpeech();
    speech.listen(result, error);
    instance!.onerror?.({ error: 'not-allowed' });
    expect(error).toHaveBeenCalledWith(expect.stringContaining('麦克风权限'));
    speech.stop();
    instance!.onerror?.({ error: 'network' });
    expect(error).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});
