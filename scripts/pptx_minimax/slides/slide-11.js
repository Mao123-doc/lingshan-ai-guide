const { ASSETS, theme, applyDark, addTitle, addText, addRect, addLine, addImage, addPill, addPageNumber, addSource, notes, standalone } = require('../common');

function stop(slide, x, time, name, tag, accent = false) {
  slide.addShape('ellipse', { x: x - 0.12, y: 2.72, w: 0.24, h: 0.24, fill: { color: accent ? theme.accent : theme.secondary }, line: { color: accent ? theme.accent : theme.secondary } });
  addText(slide, time, { x: x - 0.40, y: 2.20, w: 0.80, h: 0.26, fontSize: 9.5, bold: true, color: accent ? theme.accent : theme.light, align: 'center' });
  addText(slide, name, { x: x - 0.58, y: 3.10, w: 1.16, h: 0.40, fontSize: 8.4, bold: true, color: theme.light, align: 'center', breakLine: true });
  addText(slide, tag, { x: x - 0.58, y: 3.57, w: 1.16, h: 0.30, fontSize: 6.7, color: theme.accent, align: 'center', breakLine: true });
}

function createSlide(pres) {
  const slide = pres.addSlide();
  applyDark(slide);
  addImage(slide, ASSETS.hero, 6.96, 1.28, 2.48, 3.58, 'cover', 10);
  slide.addShape('rect', { x: 6.96, y: 1.28, w: 2.48, h: 3.58, fill: { color: theme.primary, transparency: 30 }, line: { color: theme.accent, width: 1.2 } });
  addTitle(slide, '10 / HERO CASE', '英雄案例：带老人半日游，也能在 16:00 前从容离园', true);
  addPill(slide, '老人同行', 0.58, 1.32, 0.96, theme.secondary, theme.light, 8.2);
  addPill(slide, '步行优先少', 1.66, 1.32, 1.08, theme.secondary, theme.light, 8.2);
  addPill(slide, '必看九龙灌浴', 2.86, 1.32, 1.28, theme.accent, theme.primary, 8.2);
  addPill(slide, '16:00 离园', 4.26, 1.32, 1.02, theme.light, theme.primary, 8.2);
  addLine(slide, 0.88, 2.84, 5.46, 0, theme.light, 1.4);
  stop(slide, 1.04, '11:00', '入口', '状态确认');
  stop(slide, 2.32, '11:35', '佛手广场', '低强度游览');
  stop(slide, 3.66, '11:50', '九龙灌浴', '提前 10min 到场', true);
  stop(slide, 5.00, '14:05', '梵宫', '无障碍路径');
  stop(slide, 6.26, '15:45', '出口', '预留 15min');
  addRect(slide, 0.58, 4.28, 5.88, 0.58, theme.primary, theme.accent, 0.06);
  addText(slide, '若只剩 20 分钟：明确拒绝跨区赶场 → 降级为入口周边“微游览”备选', { x: 0.82, y: 4.39, w: 5.42, h: 0.28, fontSize: 9.2, bold: true, color: theme.light, align: 'center' });
  addText(slide, '诚实拒绝', { x: 7.26, y: 4.26, w: 1.88, h: 0.38, fontSize: 16, bold: true, color: theme.accent, align: 'center' });
  addText(slide, '比“硬凑一条不可达路线”更可信', { x: 7.22, y: 4.62, w: 1.96, h: 0.28, fontSize: 7.8, color: theme.light, align: 'center' });
  addSource(slide, '示例用于解释规划与降级机制；实际路线以实时位置、天气、开放状态与路网计算结果为准。', true);
  addPageNumber(slide, 11, true);
  notes(slide, '英雄案例展示系统如何把人群、必看演出和离园死线变成时间轴。演出前主动留出 20 分钟排队缓冲，最后仍保留 15 分钟离园余量。如果游客只剩 20 分钟，系统会拒绝跨区赶场，改成可完成的入口微游览。');
  return slide;
}

module.exports = { createSlide };
if (require.main === module) standalone(createSlide, 'slide-11.pptx');
