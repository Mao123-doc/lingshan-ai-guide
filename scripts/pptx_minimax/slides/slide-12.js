const { theme, applyLight, addTitle, addText, addRect, addLine, addPill, addPageNumber, addSource, notes, standalone } = require('../common');

function phone(slide, x) {
  addRect(slide, x, 1.40, 2.16, 3.37, theme.primary, theme.primary, 0.16);
  addRect(slide, x + 0.10, 1.56, 1.96, 3.02, theme.bg, theme.bg, 0.10);
  addText(slide, '灵小禅 · 问答', { x: x + 0.24, y: 1.76, w: 1.68, h: 0.24, fontSize: 9.2, bold: true, color: theme.primary });
  addRect(slide, x + 0.24, 2.20, 1.39, 0.54, theme.light, theme.light, 0.08);
  addText(slide, '梵宫几点闭馆？', { x: x + 0.37, y: 2.32, w: 1.15, h: 0.25, fontSize: 7.4, color: theme.primary });
  addRect(slide, x + 0.50, 2.90, 1.42, 0.86, theme.secondary, theme.secondary, 0.08);
  addText(slide, '基于官方指南回答\n可展开查看证据', { x: x + 0.64, y: 3.07, w: 1.14, h: 0.46, fontSize: 7.5, color: theme.light, align: 'center', breakLine: true });
  addRect(slide, x + 0.24, 3.97, 1.68, 0.42, theme.light, theme.secondary, 0.05);
  addText(slide, '证据追溯：出处 · 相似度 · 时延', { x: x + 0.34, y: 4.07, w: 1.48, h: 0.20, fontSize: 6.1, bold: true, color: theme.primary, align: 'center' });
}

function dashboard(slide, x) {
  addRect(slide, x, 1.40, 4.72, 3.37, theme.primary, theme.primary, 0.08);
  addRect(slide, x + 0.12, 1.60, 4.48, 2.99, theme.bg, theme.bg, 0.04);
  addText(slide, '多约束规划看板', { x: x + 0.30, y: 1.79, w: 1.50, h: 0.26, fontSize: 10, bold: true, color: theme.primary });
  addRect(slide, x + 0.30, 2.17, 1.48, 1.84, theme.light, theme.light, 0.05);
  addText(slide, '11:00 入口\n11:50 九龙灌浴\n14:05 梵宫\n15:45 出口', { x: x + 0.48, y: 2.41, w: 1.12, h: 1.26, fontSize: 8.2, color: theme.primary, breakLine: true, valign: 'top' });
  addRect(slide, x + 1.98, 2.17, 2.32, 1.84, theme.light, theme.secondary, 0.05);
  addLine(slide, x + 2.22, 3.60, 1.70, -0.90, theme.secondary, 3);
  slide.addShape('ellipse', { x: x + 2.12, y: 3.50, w: 0.22, h: 0.22, fill: { color: theme.accent }, line: { color: theme.accent } });
  slide.addShape('ellipse', { x: x + 3.82, y: 2.60, w: 0.22, h: 0.22, fill: { color: theme.secondary }, line: { color: theme.secondary } });
  addPill(slide, '调起高德 / 百度实景导航', x + 2.16, 4.16, 1.94, theme.secondary, theme.light, 6.8);
}

function createSlide(pres) {
  const slide = pres.addSlide();
  applyLight(slide);
  addTitle(slide, '11 / PRODUCT', '不是算法演示，而是一套端到端可交付产品');
  phone(slide, 0.72);
  dashboard(slide, 3.13);
  addRect(slide, 8.12, 1.40, 1.20, 3.37, theme.light, theme.accent, 0.08);
  addText(slide, '4 核', { x: 8.25, y: 1.80, w: 0.94, h: 0.42, fontSize: 22, bold: true, color: theme.secondary, align: 'center' });
  addText(slide, '边缘节点', { x: 8.25, y: 2.28, w: 0.94, h: 0.24, fontSize: 8.2, color: theme.primary, align: 'center' });
  addText(slide, '200 QPS级', { x: 8.21, y: 2.89, w: 1.02, h: 0.34, fontSize: 14, bold: true, color: theme.accent, align: 'center' });
  addText(slide, '拓扑求解', { x: 8.25, y: 3.27, w: 0.94, h: 0.22, fontSize: 7.7, color: theme.primary, align: 'center' });
  addText(slide, '双屏分流\nQAPage\nRecommendPage', { x: 8.17, y: 3.82, w: 1.10, h: 0.62, fontSize: 6.2, bold: true, color: theme.secondary, align: 'center', breakLine: true, wrap: false });
  addText(slide, '可问、可看、可追溯、可导航、可部署', { x: 1.12, y: 4.89, w: 7.76, h: 0.28, fontSize: 11.5, bold: true, color: theme.secondary, align: 'center' });
  addSource(slide, '产品能力：QAPage / RecommendPage、证据追溯抽屉、Live2D 情绪驱动、实景导航调起。');
  addPageNumber(slide, 12);
  notes(slide, '工程交付上，我们把事实问答和路线规划分成两个清晰入口。用户既可以展开证据抽屉，也可以把规划结果直接调起到实景导航。核心拓扑求解可在四核边缘节点达到 200 QPS 级。');
  return slide;
}

module.exports = { createSlide };
if (require.main === module) standalone(createSlide, 'slide-12.pptx');
