/**
 * evidence-drawer.ts — 灵小禅回答证据追溯抽屉
 *
 * 核心指标与红线要求：
 * 1. 真实出处展示（知识库片段、官方指南）
 * 2. 真实相关度分数（RRF 倒数排名与重排分，明确标明非准确率）
 * 3. 真实响应耗时（ms）与模型标识
 */

import { QaResponse, RetrievedDocument } from '../../types/chat';

Component({
  properties: {
    visible: {
      type: Boolean,
      value: false,
    },
    answer: {
      type: Object,
      value: null as QaResponse | null,
    },
  },

  methods: {
    handleClose() {
      this.triggerEvent('close');
    },

    noop() {
      // 阻止冒泡
    },
  },
});
