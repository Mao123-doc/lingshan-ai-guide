const { theme, applyLight, addTitle, addText, addRect, addArrow, addPill, addPageNumber, addSource, notes, standalone } = require('../common');

function layer(slide, y, n, label, detail, fill, color) {
  addRect(slide, 1.14, y, 7.73, 0.62, fill, fill, 0.06);
  addRect(slide, 1.14, y, 0.62, 0.62, color);
  addText(slide, n, { x: 1.14, y, w: 0.62, h: 0.62, fontSize: 14, bold: true, color: fill, align: 'center' });
  addText(slide, label, { x: 1.94, y: y + 0.09, w: 1.55, h: 0.26, fontSize: 11.3, bold: true, color });
  addText(slide, detail, { x: 3.36, y: y + 0.10, w: 5.15, h: 0.25, fontSize: 8.9, color, align: 'right' });
}

function createSlide(pres) {
  const slide = pres.addSlide();
  applyLight(slide);
  addTitle(slide, '03 / ARCHITECTURE', '五层解耦，把“能说”变成“能交付”');
  layer(slide, 1.27, '5', '表现层', '双屏 UI · 证据追溯抽屉 · 实景导航 · Live2D', theme.primary, theme.light);
  layer(slide, 2.01, '4', '规划层', 'Dijkstra · Beam Search(24) · 时间窗与动态纠偏', theme.secondary, theme.light);
  layer(slide, 2.75, '3', '知识层', '三路并行检索 · RRF(k=60) · Cross-Encoder', theme.light, theme.primary);
  layer(slide, 3.49, '2', '状态层', '13 维画像 · 置信度门禁 ≥ 0.75 · 倒排时空推演', theme.light, theme.secondary);
  layer(slide, 4.23, '1', '底座层', '23 景点 · 31 道路 · 14 项守恒 · 全链路 Trace', theme.accent, theme.primary);
  slide.addShape('line', {
    x: 0.76, y: 1.58, w: 0, h: 3.12,
    line: { color: theme.secondary, width: 2.5, beginArrowType: 'triangle', endArrowType: 'none' },
  });
  addText(slide, '可信度向上累积', { x: 0.20, y: 2.58, w: 0.45, h: 1.25, fontSize: 8, bold: true, color: theme.secondary, vert: 'vert270', align: 'center' });
  addPill(slide, '生成 ≠ 裁决', 7.79, 1.02, 1.06, theme.accent, theme.primary, 8.2);
  addSource(slide, '当前系统架构以代码实现为准：表现、规划、知识、状态、底座五层解耦。');
  addPageNumber(slide, 4);
  notes(slide, '整套系统按五层拆开。底座层负责数据契约和形式化验证，状态层提取约束，知识层提供证据，规划层只做硬计算，表现层把结果交给游客。每一层都可以独立测试和替换。');
  return slide;
}

module.exports = { createSlide };
if (require.main === module) standalone(createSlide, 'slide-04.pptx');
