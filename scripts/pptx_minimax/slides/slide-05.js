const { theme, applyDark, addTitle, addText, addRect, addArrow, addNode, addPageNumber, addSource, notes, standalone } = require('../common');

function createSlide(pres) {
  const slide = pres.addSlide();
  applyDark(slide);
  addTitle(slide, '04 / RETRIEVAL', '一条请求，三路并行：把“找到”升级为“可信命中”', true);
  addNode(slide, '用户问题', 0.60, 2.46, 1.15, 0.54, theme.light, theme.light, theme.primary, 9.5);
  addArrow(slide, 1.78, 2.73, 0.55, 0, theme.accent, 2);
  addRect(slide, 2.35, 1.34, 2.06, 2.77, theme.primary, theme.secondary, 0.08);
  addText(slide, 'Promise.all', { x: 2.62, y: 1.56, w: 1.52, h: 0.34, fontSize: 13, bold: true, color: theme.accent, align: 'center' });
  addNode(slide, '向量检索\n语义相似', 2.72, 2.10, 1.32, 0.55, theme.light, theme.secondary, theme.primary, 8.2);
  addNode(slide, '结构化检索\n数字 / 规则', 2.72, 2.81, 1.32, 0.55, theme.light, theme.secondary, theme.primary, 8.2);
  addNode(slide, '关键词检索\n专名 / 原词', 2.72, 3.52, 1.32, 0.55, theme.light, theme.secondary, theme.primary, 8.2);
  addArrow(slide, 4.43, 2.73, 0.62, 0, theme.accent, 2);
  addNode(slide, 'RRF 融合\nk = 60', 5.08, 2.34, 1.30, 0.78, theme.accent, theme.accent, theme.primary, 10);
  addArrow(slide, 6.41, 2.73, 0.55, 0, theme.accent, 2);
  addNode(slide, 'Cross-Encoder\n重排', 6.99, 2.34, 1.28, 0.78, theme.light, theme.secondary, theme.primary, 9);
  addArrow(slide, 8.30, 2.73, 0.48, 0, theme.accent, 2);
  addNode(slide, '权威答案', 8.81, 2.46, 0.94, 0.54, theme.secondary, theme.secondary, theme.light, 8.8);
  addRect(slide, 5.08, 3.57, 3.20, 0.54, theme.primary, theme.accent, 0.06);
  addText(slide, '信源冲突：官方指南最高优先级置顶裁决', { x: 5.22, y: 3.68, w: 2.92, h: 0.25, fontSize: 8.2, bold: true, color: theme.light, align: 'center' });
  addText(slide, '全链路 Trace：rewrite → vector / structured / keyword → rrf → rerank', { x: 1.26, y: 4.58, w: 7.48, h: 0.30, fontSize: 9.8, color: theme.light, align: 'center' });
  addSource(slide, '实现依据：backend/src/services/rag-service.ts 与 retrieval/hybrid-retriever.ts。', true);
  addPageNumber(slide, 5, true);
  notes(slide, '检索不是串行兜底，而是通过 Promise.all 同时启动向量、结构化和关键词三路。之后用 RRF k 等于 60 融合，再由 Cross-Encoder 重排；遇到信源冲突，官方指南拥有最高优先级。');
  return slide;
}

module.exports = { createSlide };
if (require.main === module) standalone(createSlide, 'slide-05.pptx');
