const { theme, applyLight, addTitle, addText, addRect, addPill, addPageNumber, addSource, notes, standalone } = require('../common');

function cell(slide, x, y, w, h, text, fill, color, bold = false) {
  addRect(slide, x, y, w, h, fill, theme.bg);
  addText(slide, text, { x: x + 0.08, y, w: w - 0.16, h, fontSize: 9.1, bold, color, align: 'center', breakLine: true, breakLineOnTextOverflow: false });
}

function createSlide(pres) {
  const slide = pres.addSlide();
  applyLight(slide);
  addTitle(slide, '05 / COMPLEMENTARITY', '不是三选一：三种检索各自守住一类风险');
  const xs = [0.72, 2.90, 5.08, 7.26];
  cell(slide, xs[0], 1.30, 2.18, 0.56, '查询类型', theme.primary, theme.light, true);
  cell(slide, xs[1], 1.30, 2.18, 0.56, '向量检索', theme.secondary, theme.light, true);
  cell(slide, xs[2], 1.30, 2.18, 0.56, '结构化检索', theme.secondary, theme.light, true);
  cell(slide, xs[3], 1.30, 2.02, 0.56, '关键词检索', theme.secondary, theme.light, true);
  const rows = [
    ['“带老人半天怎么玩？”', '理解语义与表达变体', '补齐人群 / 时长约束', '识别景点原词'],
    ['“几点闭园、票价多少？”', '相关但可能混入近义', '数字字段精确命中', '专名与规则兜底'],
    ['“九龙灌浴今天能看吗？”', '召回上下文', '对齐演出时间窗', '锁定专名与原句'],
  ];
  rows.forEach((row, r) => {
    const y = 1.92 + r * 0.83;
    cell(slide, xs[0], y, 2.18, 0.74, row[0], theme.light, theme.primary, true);
    cell(slide, xs[1], y, 2.18, 0.74, row[1], r === 0 ? theme.accent : theme.light, theme.primary);
    cell(slide, xs[2], y, 2.18, 0.74, row[2], r === 1 ? theme.accent : theme.light, theme.primary);
    cell(slide, xs[3], y, 2.02, 0.74, row[3], r === 2 ? theme.accent : theme.light, theme.primary);
  });
  addPill(slide, 'RRF 统一排序', 2.05, 4.60, 1.42, theme.primary, theme.light, 9);
  addPill(slide, '重排压低伪相关', 4.29, 4.60, 1.58, theme.secondary, theme.light, 9);
  addPill(slide, '官方信源最终裁决', 6.70, 4.60, 1.75, theme.accent, theme.primary, 9);
  addText(slide, '+', { x: 3.68, y: 4.60, w: 0.32, h: 0.30, fontSize: 15, bold: true, color: theme.primary, align: 'center' });
  addText(slide, '+', { x: 6.10, y: 4.60, w: 0.32, h: 0.30, fontSize: 15, bold: true, color: theme.primary, align: 'center' });
  addSource(slide, '职责对照基于当前混合检索实现；不使用历史串行回退链表述。');
  addPageNumber(slide, 6);
  notes(slide, '三路检索不是重复建设。向量负责语义，结构化负责数字与规则，关键词负责专名和原词。RRF 把它们统一到同一排序空间，再用重排与官方信源裁决，降低单一路径的盲区。');
  return slide;
}

module.exports = { createSlide };
if (require.main === module) standalone(createSlide, 'slide-06.pptx');
