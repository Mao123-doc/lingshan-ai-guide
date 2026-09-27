const { ASSETS, theme, addText, addRect, addImage, addPill, notes, standalone } = require('../common');

function createSlide(pres) {
  const slide = pres.addSlide();
  slide.background = { color: theme.primary };
  addImage(slide, ASSETS.cover, 0, 0, 10, 5.625, 'cover');
  slide.addShape('rect', { x: 0, y: 0, w: 10, h: 5.625, fill: { color: theme.primary, transparency: 18 }, line: { color: theme.primary, transparency: 100 } });
  slide.addShape('rect', { x: 0, y: 0, w: 5.9, h: 5.625, fill: { color: theme.primary, transparency: 2 }, line: { color: theme.primary, transparency: 100 } });
  addRect(slide, 0.58, 0.50, 0.07, 3.95, theme.accent);
  addPill(slide, 'AIC · AI+场景创新赛道', 0.85, 0.56, 2.25, theme.secondary, theme.light, 8.2);
  addText(slide, '灵小禅', { x: 0.84, y: 1.26, w: 3.4, h: 0.72, fontSize: 36, bold: true, color: theme.light, charSpacing: 3 });
  addText(slide, '可信文旅决策智能体', { x: 0.86, y: 1.98, w: 4.2, h: 0.48, fontSize: 22, bold: true, color: theme.accent });
  addText(slide, '从“会回答”到“算得对、走得通”', { x: 0.86, y: 2.58, w: 4.55, h: 0.44, fontSize: 16, bold: true, color: theme.light });
  addText(slide, '面向真实景区的物理时空多约束规划\n软理解 × 硬计算 × 可追溯证据', { x: 0.86, y: 3.18, w: 4.65, h: 0.75, fontSize: 11, color: theme.light, breakLine: true, valign: 'top', breakLineOnTextOverflow: false });
  addImage(slide, ASSETS.avatar, 6.02, 0.46, 3.52, 4.82, 'contain');
  addText(slide, '第八届全球校园人工智能算法精英大赛', { x: 0.86, y: 4.72, w: 5.7, h: 0.28, fontSize: 8.3, color: theme.light });
  addText(slide, '灵山胜境 · 可信决策 · 低成本落地', { x: 0.86, y: 5.02, w: 5.2, h: 0.24, fontSize: 7.5, color: theme.accent, bold: true });
  notes(slide, '各位评委好，我们带来的不是又一个景区问答机器人，而是一套面向真实景区的可信决策智能体。它不仅要听懂游客，还要在真实道路、时间窗与人群约束下，算出确实走得通的方案。');
  return slide;
}

module.exports = { createSlide };
if (require.main === module) standalone(createSlide, 'slide-01.pptx');
