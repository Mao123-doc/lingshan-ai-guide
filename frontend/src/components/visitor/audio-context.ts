let audioContext: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let mediaSource: MediaElementAudioSourceNode | null = null;
const timeDomainBuffer = new Uint8Array(new ArrayBuffer(128));

export async function ensureAudioContext(): Promise<{ ctx: AudioContext; analyser: AnalyserNode }> {
  if (!audioContext) audioContext = new AudioContext();
  if (!analyser) {
    analyser = new AnalyserNode(audioContext, { fftSize: 256, smoothingTimeConstant: 0.4 });
    analyser.connect(audioContext.destination);
  }
  if (audioContext.state === 'suspended') {
    console.log('[AudioCtx] resuming from suspended...');
    await audioContext.resume();
    console.log('[AudioCtx] state =', audioContext.state);
  }
  console.log('[AudioCtx] ready, state =', audioContext.state);
  return { ctx: audioContext, analyser };
}

export async function connectAudio(audio: HTMLAudioElement) {
  try {
    const { ctx, analyser: audioAnalyser } = await ensureAudioContext();
    if (mediaSource) {
      try { mediaSource.disconnect(); } catch { /* already disconnected */ }
    }
    mediaSource = ctx.createMediaElementSource(audio);
    mediaSource.connect(audioAnalyser);
  } catch { /* audio wiring is optional */ }
}

export function readAudioVolume(): number {
  if (!analyser) return 0;
  analyser.getByteTimeDomainData(timeDomainBuffer);
  let sum = 0;
  for (let i = 0; i < timeDomainBuffer.length; i++) {
    const value = (timeDomainBuffer[i] - 128) / 128;
    sum += value * value;
  }
  return Math.sqrt(sum / timeDomainBuffer.length);
}
