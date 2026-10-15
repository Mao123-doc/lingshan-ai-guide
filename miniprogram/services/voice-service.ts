/**
 * voice-service.ts — 灵小禅微信小程序原生语音管理器
 *
 * 遵循红线要求：
 * 1. 采用微信原生 wx.getRecorderManager 与 wx.createInnerAudioContext
 * 2. 真实权限申请与拒绝友好降级
 * 3. 严格诚实：云端 ASR/TTS 服务未连通或未配置时明确提示，绝不编造假识别结果
 */

export interface VoiceRecordResult {
  tempFilePath: string;
  duration: number;
  fileSize: number;
}

export class VoiceService {
  private recorderManager: WechatMiniprogram.RecorderManager | null = null;
  private audioContext: WechatMiniprogram.InnerAudioContext | null = null;
  private isRecording = false;
  private isPlaying = false;

  constructor() {
    this.initRecorder();
    this.initAudioContext();
  }

  private initRecorder(): void {
    try {
      this.recorderManager = wx.getRecorderManager();
    } catch (e) {
      console.warn('RecorderManager is not available', e);
    }
  }

  private initAudioContext(): void {
    try {
      this.audioContext = wx.createInnerAudioContext();
      this.audioContext.onPlay(() => {
        this.isPlaying = true;
      });
      this.audioContext.onEnded(() => {
        this.isPlaying = false;
      });
      this.audioContext.onError((res) => {
        this.isPlaying = false;
        console.error('Audio playback error', res);
      });
    } catch (e) {
      console.warn('InnerAudioContext is not available', e);
    }
  }

  /**
   * 检查并请求录音权限
   */
  async ensureRecordPermission(): Promise<boolean> {
    return new Promise((resolve) => {
      wx.getSetting({
        success: (res) => {
          if (res.authSetting['scope.record']) {
            resolve(true);
          } else if (res.authSetting['scope.record'] === false) {
            // 用户曾经拒绝过授权，引导前往设置页
            wx.showModal({
              title: '需要录音权限',
              content: '请在小程序设置中允许使用麦克风，以便体验语音交互。',
              confirmText: '去设置',
              success: (modalRes) => {
                if (modalRes.confirm) {
                  wx.openSetting({
                    success: (settingRes) => {
                      resolve(!!settingRes.authSetting['scope.record']);
                    },
                    fail: () => resolve(false),
                  });
                } else {
                  resolve(false);
                }
              },
            });
          } else {
            // 首次申请
            wx.authorize({
              scope: 'scope.record',
              success: () => resolve(true),
              fail: () => resolve(false),
            });
          }
        },
        fail: () => resolve(false),
      });
    });
  }

  /**
   * 开始录音
   */
  async startRecording(
    onStopCallback: (result: VoiceRecordResult) => void,
    onErrorCallback: (err: any) => void
  ): Promise<boolean> {
    const hasPerm = await this.ensureRecordPermission();
    if (!hasPerm) {
      onErrorCallback({ message: '麦克风权限未开启，无法录音' });
      return false;
    }

    if (!this.recorderManager) {
      onErrorCallback({ message: '当前设备不支持录音管理器' });
      return false;
    }

    this.recorderManager.onStop((res) => {
      this.isRecording = false;
      onStopCallback({
        tempFilePath: res.tempFilePath,
        duration: Math.round(res.duration / 1000),
        fileSize: res.fileSize,
      });
    });

    this.recorderManager.onError((err) => {
      this.isRecording = false;
      onErrorCallback(err);
    });

    try {
      this.recorderManager.start({
        duration: 30000, // 最长30秒
        sampleRate: 16000,
        numberOfChannels: 1,
        encodeBitRate: 48000,
        format: 'mp3',
      });
      this.isRecording = true;
      return true;
    } catch (e) {
      this.isRecording = false;
      onErrorCallback(e);
      return false;
    }
  }

  /**
   * 停止录音
   */
  stopRecording(): void {
    if (this.isRecording && this.recorderManager) {
      try {
        this.recorderManager.stop();
      } catch (e) {
        console.error('Stop recording error', e);
      }
    }
    this.isRecording = false;
  }

  /**
   * 播放音频
   */
  playAudio(src: string): void {
    if (!this.audioContext) return;
    this.stopAudio();
    this.audioContext.src = src;
    this.audioContext.play();
  }

  /**
   * 停止播放
   */
  stopAudio(): void {
    if (this.audioContext && this.isPlaying) {
      this.audioContext.stop();
      this.isPlaying = false;
    }
  }

  getIsRecording(): boolean {
    return this.isRecording;
  }

  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  /**
   * 资源清理
   */
  destroy(): void {
    this.stopRecording();
    this.stopAudio();
    if (this.audioContext) {
      this.audioContext.destroy();
      this.audioContext = null;
    }
  }
}

export const voiceService = new VoiceService();
