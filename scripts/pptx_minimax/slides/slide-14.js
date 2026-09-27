const { ASSETS, theme, addText, addRect, addImage, addMetric, addPageNumber, notes, standalone } = require('../common');

function createSlide(pres) {
  const slide = pres.addSlide();
  slide.background = { color: theme.primary };
  addImage(slide, ASSETS.cover, 0, 0, 10, 5.625, 'cover', 5);
  slide.addShape('rect', { x: 0, y: 0, w: 10, h: 5.625, fill: { color: theme.primary, transparency: 13 }, line: { color: theme.primary, transparency: 100 } });
  addRect(slide, 0, 0, 10, 0.08, theme.accent);
  addText(slide, '让 AI 尊重物理世界', { x: 0.92, y: 0.72, w: 8.16, h: 0.64, fontSize: 30, bold: true, color: theme.light, align: 'center', charSpacing: 1.2 });
  addText(slide, '让每一次推荐，都能真的走完', { x: 1.20, y: 1.45, w: 7.60, h: 0.46, fontSize: 19, bold: true, color: theme.accent, align: 'center' });
  addRect(slide, 1.06, 2.22, 7.88, 1.55, theme.primary, theme.light, 0.08);
  addMetric(slide, '96.0%', '事实问答正式基线', 1.35, 2.49, 1.80, true, theme.accent);
  addMetric(slide, '40 / 40', '场景槽位测试', 4.10, 2.49, 1.80, true, theme.secondary);
  addMetric(slide, '60 / 60', '路线合规 · 硬违规 0', 6.85, 2.49, 1.80, true, theme.accent);
  addText(slide, '听懂游客', { x: 1.24, y: 4.16, w: 1.95, h: 0.34, fontSize: 14, bold: true, color: theme.light, align: 'center' });
  addText(slide, '＋', { x: 3.33, y: 4.16, w: 0.36, h: 0.34, fontSize: 17, bold: true, color: theme.accent, align: 'center' });
  addText(slide, '查准事实', { x: 4.02, y: 4.16, w: 1.95, h: 0.34, fontSize: 14, bold: true, color: theme.light, align: 'center' });
  addText(slide, '＋', { x: 6.11, y: 4.16, w: 0.36, h: 0.34, fontSize: 17, bold: true, color: theme.accent, align: 'center' });
  addText(slide, '算对路线', { x: 6.80, y: 4.16, w: 1.95, h: 0.34, fontSize: 14, bold: true, color: theme.light, align: 'center' });
  addText(slide, '谢谢聆听 · 欢迎现场验证', { x: 2.42, y: 4.82, w: 5.16, h: 0.32, fontSize: 11.8, bold: true, color: theme.accent, align: 'center' });
  addPageNumber(slide, 14, true);
  notes(slide, '灵小禅最终要解决的不是如何生成一段更漂亮的话，而是让 AI 尊重物理世界，让每一次推荐都能被复核、能被执行、能真的走完。谢谢各位评委，欢迎现场验证。');
  return slide;
}

module.exports = { createSlide };
if (require.main === module) standalone(createSlide, 'slide-14.pptx');
