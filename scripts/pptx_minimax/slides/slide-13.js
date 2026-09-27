const { ASSETS, theme, applyDark, addTitle, addText, addRect, addImage, addArrow, addPill, addPageNumber, addSource, notes, standalone } = require('../common');

function phase(slide, x, week, title, body, fill, color) {
  addRect(slide, x, 3.07, 2.15, 1.16, fill, fill, 0.08);
  addText(slide, week, { x: x + 0.16, y: 3.22, w: 0.52, h: 0.30, fontSize: 14, bold: true, color });
  addText(slide, title, { x: x + 0.74, y: 3.20, w: 1.22, h: 0.27, fontSize: 9.8, bold: true, color });
  addText(slide, body, { x: x + 0.18, y: 3.63, w: 1.79, h: 0.37, fontSize: 7.4, color, breakLine: true, align: 'center' });
}

function createSlide(pres) {
  const slide = pres.addSlide();
  applyDark(slide);
  addImage(slide, ASSETS.migration, 0, 0, 10, 5.625, 'cover', 12);
  slide.addShape('rect', { x: 0, y: 0, w: 10, h: 5.625, fill: { color: theme.primary, transparency: 20 }, line: { color: theme.primary, transparency: 100 } });
  addTitle(slide, '12 / VALUE', '从单景区验证，到可复制的文旅决策基础设施', true);
  addPill(slide, '年综合成本 < 1.5 万元', 0.58, 1.30, 2.08, theme.accent, theme.primary, 9);
  addPill(slide, '预计 3–6 个月收回 ROI', 2.82, 1.30, 2.15, theme.secondary, theme.light, 9);
  addRect(slide, 0.58, 1.91, 4.39, 0.72, theme.primary, theme.light, 0.06);
  addText(slide, '同一套“状态—证据—规划—验证”框架，可迁移到博物馆、古镇、主题乐园与大型会展。', { x: 0.84, y: 2.07, w: 3.87, h: 0.36, fontSize: 9.7, bold: true, color: theme.light, align: 'center' });
  phase(slide, 0.58, '1周', '数据接入', '景点 / 路网 / 指南\n完成基础契约', theme.light, theme.primary);
  addArrow(slide, 2.80, 3.64, 0.38, 0, theme.accent, 2);
  phase(slide, 3.22, '2周', '场景适配', '状态槽位 / 规则门禁\n完成联合验证', theme.secondary, theme.light);
  addArrow(slide, 5.44, 3.64, 0.38, 0, theme.accent, 2);
  phase(slide, 5.86, '4周', '上线运营', '双屏产品 / Trace\n灰度部署迭代', theme.accent, theme.primary);
  addRect(slide, 8.20, 3.07, 1.22, 1.16, theme.primary, theme.light, 0.08);
  addText(slide, '可复制', { x: 8.32, y: 3.31, w: 0.98, h: 0.31, fontSize: 15, bold: true, color: theme.accent, align: 'center' });
  addText(slide, '低算力\n轻交付\n快回本', { x: 8.38, y: 3.69, w: 0.86, h: 0.42, fontSize: 7.3, color: theme.light, align: 'center', breakLine: true });
  addText(slide, '技术壁垒不是模型参数，而是可沉淀、可复现、可迁移的决策协议。', { x: 1.10, y: 4.66, w: 7.80, h: 0.34, fontSize: 11.5, bold: true, color: theme.light, align: 'center' });
  addSource(slide, '推广路径与成本口径：三阶轻量落地 1 / 2 / 4 周；年综合成本 < 1.5 万元。', true);
  addPageNumber(slide, 13, true);
  notes(slide, '落地不是大拆大建。第一周完成数据契约，第二周适配场景规则，第四周即可进入灰度运营。四核边缘节点加轻量服务让年综合成本低于 1.5 万元，预计 3 到 6 个月收回成本。');
  return slide;
}

module.exports = { createSlide };
if (require.main === module) standalone(createSlide, 'slide-13.pptx');
