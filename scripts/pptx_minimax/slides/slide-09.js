const { theme, applyLight, addTitle, addText, addRect, addLine, addArrow, addNode, addPill, addPageNumber, addSource, notes, standalone } = require('../common');

function dot(slide, label, x, y, fill = theme.light, line = theme.secondary) {
  slide.addShape('ellipse', { x, y, w: 0.58, h: 0.58, fill: { color: fill }, line: { color: line, width: 1.4 } });
  addText(slide, label, { x: x - 0.16, y: y + 0.62, w: 0.90, h: 0.23, fontSize: 6.6, bold: true, color: theme.primary, align: 'center' });
}

function createSlide(pres) {
  const slide = pres.addSlide();
  applyLight(slide);
  addTitle(slide, '08 / OPTIMIZATION', '规划不是写文案：先过滤不可走，再搜索最优时空组合');
  addRect(slide, 0.56, 1.28, 5.15, 3.66, theme.light, theme.light, 0.08);
  addText(slide, '23 景点 × 31 道路数字孪生路网', { x: 0.83, y: 1.51, w: 4.62, h: 0.30, fontSize: 12.5, bold: true, color: theme.primary, align: 'center' });
  const pts = [[1.05,2.35],[2.12,1.98],[3.11,2.47],[4.25,1.95],[4.76,3.08],[3.52,3.48],[2.20,3.30],[1.14,3.75]];
  const edges = [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[0,7],[1,6],[2,5],[2,4]];
  edges.forEach(([a,b], i) => {
    const [x1,y1] = pts[a]; const [x2,y2] = pts[b];
    addLine(slide, x1 + 0.29, y1 + 0.29, x2 - x1, y2 - y1, i === 8 ? theme.accent : theme.secondary, i === 8 ? 3 : 1.2, i === 10 ? 'dash' : 'solid');
  });
  ['入口','佛手广场','九龙灌浴','梵宫','祥符禅寺','五印坛城','出口','无障碍点'].forEach((name,i)=>dot(slide,name,pts[i][0],pts[i][1],i===0||i===6?theme.accent:theme.light,i===0||i===6?theme.accent:theme.secondary));
  addPill(slide, '坡度 / 米数 / 耗时 / 台阶', 1.52, 4.68, 3.18, theme.primary, theme.light, 8.5);
  addRect(slide, 6.02, 1.28, 3.42, 3.66, theme.bg, theme.secondary, 0.08);
  addNode(slide, '① Dijkstra', 6.34, 1.59, 1.16, 0.46, theme.secondary, theme.secondary, theme.light, 10);
  addText(slide, '先剔除台阶、大坡度与无障碍禁边', { x: 7.71, y: 1.62, w: 1.42, h: 0.40, fontSize: 8.7, color: theme.primary, breakLine: true });
  addArrow(slide, 7.02, 2.16, 0, 0.37, theme.accent, 2);
  addNode(slide, '② Beam Search', 6.34, 2.64, 1.33, 0.46, theme.accent, theme.accent, theme.primary, 9.3);
  addText(slide, '宽度 24：景点价值 × 步行负担 × 时间窗', { x: 7.83, y: 2.63, w: 1.30, h: 0.53, fontSize: 8.4, color: theme.primary, breakLine: true });
  addArrow(slide, 7.02, 3.22, 0, 0.36, theme.accent, 2);
  addNode(slide, '③ 守恒仲裁', 6.34, 3.69, 1.33, 0.46, theme.primary, theme.primary, theme.light, 9.3);
  addText(slide, '14 项校验 + 演出前置 15–20 分钟缓冲', { x: 7.83, y: 3.66, w: 1.30, h: 0.56, fontSize: 8.4, color: theme.primary, breakLine: true });
  addText(slide, '超时 > 10 分钟：增量重规划；不可行：诚实拒绝并给出微游览备选', { x: 6.31, y: 4.48, w: 2.84, h: 0.30, fontSize: 8.2, bold: true, color: theme.secondary, align: 'center' });
  addSource(slide, '实现依据：backend/src/services/route-planner.ts 与 route-validator.ts。');
  addPageNumber(slide, 9);
  notes(slide, '规划流程先用 Dijkstra 过滤不可走的边，再用宽度 24 的 Beam Search 搜索景点、体力和演出时间窗之间的最优组合。最后由 14 项形式化守恒仲裁；不可行时必须诚实拒绝，并给出微游览备选。');
  return slide;
}

module.exports = { createSlide };
if (require.main === module) standalone(createSlide, 'slide-09.pptx');
