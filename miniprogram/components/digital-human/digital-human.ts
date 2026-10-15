/**
 * digital-human.ts — 灵小禅移动端数字人组件
 *
 * 遵循真实性要求：
 * 1. 采用东方禅意高保真立绘肖像 + CSS 呼吸光环与情绪微动效。
 * 2. 诚实展示当前状态：倾听、思考、讲解、致歉、欢喜。
 * 3. 动态模型需 WebGL 适配包，非汉服定制模型；本组件提供可靠的移动端静态高质感交互。
 */

const PORTRAITS: Record<string, string> = {
  zen_red_gold: '/assets/images/portrait-zen-red-gold.png',
  celadon_elegance: '/assets/images/portrait-celadon.png',
  tang_splendor: '/assets/images/portrait-tang-splendor.png',
  ink_wash: '/assets/images/portrait-ink-wash.png',
};

const EMOTION_TEXTS: Record<string, string> = {
  idle: '随时为您服务',
  greet: '阿弥陀佛，欢迎来到灵山胜境！',
  think: '正在为您推演检索…',
  explain: '正在为您讲解…',
  sorry: '抱歉，此项暂时受限',
  happy: '愿您吉祥如意，法喜充满！',
};

Component({
  properties: {
    stylePreset: {
      type: String,
      value: 'zen_red_gold',
      observer(newVal: string) {
        this.updatePortrait(newVal);
      },
    },
    emotion: {
      type: String,
      value: 'idle',
      observer(newVal: string) {
        this.updateEmotionText(newVal);
      },
    },
    isSpeaking: {
      type: Boolean,
      value: false,
    },
    size: {
      type: String,
      value: 'normal', // 'normal' | 'large' | 'mini'
    },
    showStatusText: {
      type: Boolean,
      value: true,
    },
  },

  data: {
    portraitSrc: '/assets/images/portrait-zen-red-gold.png',
    statusText: '随时为您服务',
  },

  lifetimes: {
    attached() {
      this.updatePortrait(this.data.stylePreset);
      this.updateEmotionText(this.data.emotion);
    },
  },

  methods: {
    updatePortrait(preset: string) {
      const src = PORTRAITS[preset] || '/assets/images/avatar-default.png';
      this.setData({ portraitSrc: src });
    },

    updateEmotionText(emotion: string) {
      const text = EMOTION_TEXTS[emotion] || EMOTION_TEXTS.idle;
      this.setData({ statusText: text });
    },
  },
});
