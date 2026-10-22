/**
 * chat.ts — 灵小禅移动端智能问答核心页面
 */

import { visitorApi } from '../../services/api';
import { storageService } from '../../services/storage-service';
import { voiceService } from '../../services/voice-service';
import { visionService } from '../../services/vision-service';
import { locationService } from '../../services/location-service';
import { ChatMessage, QaResponse } from '../../types/chat';

let activeStreamAbort: (() => void) | null = null;

Page({
  data: {
    messages: [] as ChatMessage[],
    inputText: '',
    sessionId: '',
    isBusy: false,
    isStreaming: false,
    partialAnswer: '',
    dhStyle: 'zen_red_gold',
    dhEmotion: 'idle',
    isSpeaking: false,
    selectedEvidenceAnswer: null as QaResponse | null,
    showEvidenceDrawer: false,
    ratedIds: [] as string[],
    feedbackModalVisible: false,
    feedbackConversationId: '',
    feedbackRating: 5,
    feedbackComment: '',
    feedbackSubmitting: false,
    nearbyModalVisible: false,
    nearbyList: [] as any[],
    nearbyNotice: '',
    qaMode: 'stream' as 'stream' | 'json',
    scrollToViewId: 'msg-bottom',
    isRecording: false,
    recordTimer: null as any,
    recordSeconds: 0,
    toolsOpen: false,
    speakingMsgId: '',
  },

  onLoad(options: { q?: string }) {
    const mode = storageService.getQaMode();
    const style = storageService.getDhStyle();
    this.setData({
      qaMode: mode,
      dhStyle: style,
    });

    this.initNewSession().then(() => {
      if (options.q) {
        const decoded = decodeURIComponent(options.q);
        this.setData({ inputText: decoded });
        this.sendMessage(decoded);
      }
    });
  },

  onShow() {
    const style = storageService.getDhStyle();
    if (style !== this.data.dhStyle) {
      this.setData({ dhStyle: style });
    }

    const pending = storageService.getAndClearPendingChatQuery();
    if (pending) {
      if (this.data.sessionId) {
        this.setData({ inputText: pending });
        this.sendMessage(pending);
      } else {
        this.initNewSession().then(() => {
          this.setData({ inputText: pending });
          this.sendMessage(pending);
        });
      }
    }
  },

  onUnload() {
    if (activeStreamAbort) {
      activeStreamAbort();
      activeStreamAbort = null;
    }
    voiceService.destroy();
  },

  async initNewSession() {
    if (activeStreamAbort) {
      activeStreamAbort();
      activeStreamAbort = null;
    }

    this.setData({
      isBusy: true,
      dhEmotion: 'greet',
      partialAnswer: '',
      messages: [],
    });

    try {
      const res = await visitorApi.initSession();
      const welcomeMsg: ChatMessage = {
        id: 'msg-welcome',
        role: 'assistant',
        content: res.welcome_message,
        timestamp: Date.now(),
        status: 'success',
      };

      this.setData({
        sessionId: res.session_id,
        messages: [welcomeMsg],
        isBusy: false,
        dhEmotion: 'idle',
        scrollToViewId: 'msg-welcome',
      });
    } catch (e: any) {
      console.error('Session init error', e);
      wx.showToast({
        title: e.error || '连接服务异常，请重试',
        icon: 'none',
      });
      this.setData({
        isBusy: false,
        dhEmotion: 'sorry',
      });
    }
  },

  onInput(e: WechatMiniprogram.Input) {
    this.setData({ inputText: e.detail.value });
  },

  onTextInput(e: WechatMiniprogram.Input) {
    this.setData({ inputText: e.detail.value });
  },

  onSuggestTap(e: WechatMiniprogram.CustomEvent) {
    const text = e.currentTarget.dataset.text;
    if (text && !this.data.isBusy) {
      this.sendMessage(text);
    }
  },

  toggleQaMode() {
    const nextMode = this.data.qaMode === 'stream' ? 'json' : 'stream';
    this.setData({ qaMode: nextMode });
    storageService.setQaMode(nextMode);
    wx.showToast({
      title: nextMode === 'stream' ? '已开启实时逐字解答' : '已开启完整快速解答',
      icon: 'none',
    });
  },

  toggleTools() {
    this.setData({ toolsOpen: !this.data.toolsOpen });
  },

  onSendTap() {
    const q = this.data.inputText.trim();
    if (!q || this.data.isBusy || !this.data.sessionId) return;
    this.sendMessage(q);
  },

  async sendMessage(query: string) {
    const { sessionId, messages, qaMode } = this.data;
    if (!query.trim() || !sessionId) return;

    const userMsgId = `msg-user-${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      role: 'user',
      content: query,
      timestamp: Date.now(),
      status: 'success',
    };

    const newMessages = [...messages, userMsg];
    this.setData({
      messages: newMessages,
      inputText: '',
      isBusy: true,
      dhEmotion: 'think',
      scrollToViewId: userMsgId,
    });

    if (qaMode === 'stream') {
      this.executeStreamQa(query, sessionId);
    } else {
      this.executeStandardQa(query, sessionId);
    }
  },

  executeStreamQa(query: string, sessionId: string) {
    this.setData({
      isStreaming: true,
      partialAnswer: '',
      dhEmotion: 'explain',
      isSpeaking: true,
    });

    const streamTask = visitorApi.askQuestionStream(query, sessionId, {
      onToken: (token: string) => {
        this.setData({
          partialAnswer: this.data.partialAnswer + token,
          scrollToViewId: 'msg-streaming',
        });
      },
      onDone: (answer: QaResponse) => {
        activeStreamAbort = null;
        const assistantMsgId = `msg-ai-${Date.now()}`;
        const assistantMsg: ChatMessage = {
          id: assistantMsgId,
          role: 'assistant',
          content: answer.answer,
          timestamp: Date.now(),
          answer,
          status: 'success',
        };

        const updated = [...this.data.messages, assistantMsg];
        this.setData({
          messages: updated,
          partialAnswer: '',
          isStreaming: false,
          isBusy: false,
          dhEmotion: (answer.emotion as any) || 'happy',
          isSpeaking: false,
          scrollToViewId: assistantMsgId,
        });

        storageService.saveChatHistory(updated);
      },
      onError: (err) => {
        activeStreamAbort = null;
        console.error('Stream error:', err);
        wx.showToast({
          title: err.error || '问答流中断，请重试',
          icon: 'none',
        });
        this.setData({
          partialAnswer: '',
          isStreaming: false,
          isBusy: false,
          dhEmotion: 'sorry',
          isSpeaking: false,
        });
      },
    });

    activeStreamAbort = streamTask.abort;
  },

  async executeStandardQa(query: string, sessionId: string) {
    this.setData({
      dhEmotion: 'think',
      isSpeaking: false,
    });

    try {
      const answer = await visitorApi.askQuestion(query, sessionId);
      const assistantMsgId = `msg-ai-${Date.now()}`;
      const assistantMsg: ChatMessage = {
        id: assistantMsgId,
        role: 'assistant',
        content: answer.answer,
        timestamp: Date.now(),
        answer,
        status: 'success',
      };

      const updated = [...this.data.messages, assistantMsg];
      this.setData({
        messages: updated,
        isBusy: false,
        dhEmotion: (answer.emotion as any) || 'happy',
        scrollToViewId: assistantMsgId,
      });

      storageService.saveChatHistory(updated);
    } catch (e: any) {
      console.error('Standard QA failed:', e);
      wx.showToast({
        title: e.error || '请求失败，请稍后重试',
        icon: 'none',
      });
      this.setData({
        isBusy: false,
        dhEmotion: 'sorry',
      });
    }
  },

  // 查看依据抽屉
  viewEvidence(e: WechatMiniprogram.CustomEvent) {
    const answer = e.currentTarget.dataset.answer as QaResponse;
    if (!answer) return;
    this.setData({
      selectedEvidenceAnswer: answer,
      showEvidenceDrawer: true,
    });
  },

  closeEvidenceDrawer() {
    this.setData({
      showEvidenceDrawer: false,
      selectedEvidenceAnswer: null,
    });
  },

  // 评价反馈
  openFeedback(e: WechatMiniprogram.CustomEvent) {
    const conversationId = e.currentTarget.dataset.id as string;
    this.setData({
      feedbackModalVisible: true,
      feedbackConversationId: conversationId,
      feedbackRating: 5,
      feedbackComment: '',
    });
  },

  closeFeedback() {
    this.setData({ feedbackModalVisible: false });
  },

  setRating(e: WechatMiniprogram.CustomEvent) {
    const score = Number(e.currentTarget.dataset.score);
    this.setData({ feedbackRating: score });
  },

  onFeedbackCommentInput(e: WechatMiniprogram.Input) {
    this.setData({ feedbackComment: e.detail.value });
  },

  async submitFeedback() {
    const { sessionId, feedbackConversationId, feedbackRating, feedbackComment } = this.data;
    if (!feedbackConversationId || this.data.feedbackSubmitting) return;

    this.setData({ feedbackSubmitting: true });
    try {
      await visitorApi.submitFeedback({
        session_id: sessionId,
        conversation_id: feedbackConversationId,
        rating: feedbackRating,
        comment: feedbackComment,
      });

      wx.showToast({
        title: '感谢您的真实评价',
        icon: 'success',
      });

      this.setData({
        ratedIds: [...this.data.ratedIds, feedbackConversationId],
        feedbackModalVisible: false,
        feedbackSubmitting: false,
      });
    } catch (e: any) {
      wx.showToast({
        title: e.error || '反馈提交失败',
        icon: 'none',
      });
      this.setData({ feedbackSubmitting: false });
    }
  },

  // 语音播报 / 停止播报
  toggleSpeakMessage(e: WechatMiniprogram.CustomEvent) {
    const msgId = e.currentTarget.dataset.id as string;
    const text = e.currentTarget.dataset.text as string;

    if (!msgId || !text) return;

    if (this.data.speakingMsgId === msgId) {
      // 停止播报
      voiceService.stopAudio();
      this.setData({
        speakingMsgId: '',
        isSpeaking: false,
        dhEmotion: 'idle',
      });
      wx.showToast({
        title: '已停止语音播报',
        icon: 'none',
      });
      return;
    }

    // 开始播报
    voiceService.stopAudio();
    this.setData({
      speakingMsgId: msgId,
      isSpeaking: true,
      dhEmotion: 'explain',
    });

    voiceService.speakText(
      text,
      () => {
        // 播报结束
        if (this.data.speakingMsgId === msgId) {
          this.setData({
            speakingMsgId: '',
            isSpeaking: false,
            dhEmotion: 'idle',
          });
        }
      },
      () => {
        // 播报异常
        if (this.data.speakingMsgId === msgId) {
          this.setData({
            speakingMsgId: '',
            isSpeaking: false,
            dhEmotion: 'idle',
          });
        }
      }
    );
  },

  startVoiceRecord() {
    if (!this.data.isRecording) {
      this.toggleVoiceRecord();
    }
  },

  stopVoiceRecord() {
    if (this.data.isRecording) {
      this.toggleVoiceRecord();
    }
  },

  takePhotoToRecognize() {
    this.handleVision();
  },

  queryNearby() {
    this.handleNearby();
  },

  // 多模态工具：语音录制
  async toggleVoiceRecord() {
    if (this.data.isRecording) {
      voiceService.stopRecording();
      clearInterval(this.data.recordTimer);
      this.setData({ isRecording: false, recordSeconds: 0 });
      return;
    }

    const started = await voiceService.startRecording(
      (res) => {
        clearInterval(this.data.recordTimer);
        this.setData({ isRecording: false, recordSeconds: 0 });
        wx.showModal({
          title: '语音录制完成',
          content: `已录制语音（${res.duration}秒）。是否将此提问发送给灵小禅？`,
          confirmText: '发送提问',
          cancelText: '取消',
          success: (mRes) => {
            if (mRes.confirm) {
              wx.showToast({
                title: '请在输入框确认或修改问题后发送',
                icon: 'none',
              });
            }
          },
        });
      },
      (err) => {
        clearInterval(this.data.recordTimer);
        this.setData({ isRecording: false, recordSeconds: 0 });
        wx.showToast({
          title: err.message || '录音启动失败',
          icon: 'none',
        });
      }
    );

    if (started) {
      const timer = setInterval(() => {
        this.setData({ recordSeconds: this.data.recordSeconds + 1 });
      }, 1000);
      this.setData({
        isRecording: true,
        recordTimer: timer,
        recordSeconds: 0,
      });
    }
  },

  // 多模态工具：拍照识景
  async handleVision() {
    wx.showLoading({ title: '正在识别景点…' });
    const result = await visionService.captureAndRecognize(['camera', 'album']);
    wx.hideLoading();

    if (!result.success) {
      wx.showModal({
        title: '识景提示',
        content: result.errorMessage || '识景未成功，请重新拍摄',
        showCancel: false,
      });
      return;
    }

    const data = result.data;
    if (data?.matched && data.spot_name) {
      wx.showModal({
        title: '识别成功',
        content: `画面识别到灵山胜境：【${data.spot_name}】。是否立即由灵小禅为您详细讲解？`,
        confirmText: '立即讲解',
        cancelText: '暂不需要',
        success: (mRes) => {
          if (mRes.confirm) {
            this.sendMessage(`请介绍${data.spot_name}`);
          }
        },
      });
    } else {
      wx.showModal({
        title: '未识别到特定景观',
        content: data?.description || '未能识别到景区对应景点，建议拍摄殿堂或造像正面清晰画面。',
        showCancel: false,
      });
    }
  },

  // 多模态工具：查看附近
  async handleNearby() {
    wx.showLoading({ title: '正在定位与检索…' });
    try {
      const locRes = await locationService.getCurrentLocationAndNearby();
      wx.hideLoading();

      const combined = [
        ...locRes.nearbySpots.slice(0, 5),
        ...locRes.nearbyFacilities.slice(0, 5),
      ];

      this.setData({
        nearbyList: combined,
        nearbyNotice: locRes.notice,
        nearbyModalVisible: true,
      });
    } catch (e: any) {
      wx.hideLoading();
      wx.showToast({
        title: e.message || '获取定位失败',
        icon: 'none',
      });
    }
  },

  closeNearbyModal() {
    this.setData({ nearbyModalVisible: false });
  },

  navigateLocation(e: WechatMiniprogram.CustomEvent) {
    const item = e.currentTarget.dataset.item;
    if (item && item.lat && item.lng) {
      locationService.openNavigation({
        name: item.name,
        lat: item.lat,
        lng: item.lng,
        description: item.description || item.type,
      });
    }
  },

  askAboutSpot(e: WechatMiniprogram.CustomEvent) {
    const name = e.currentTarget.dataset.name;
    this.closeNearbyModal();
    if (name) {
      this.sendMessage(`请介绍${name}`);
    }
  },
});
