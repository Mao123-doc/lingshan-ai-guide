const { theme, applyLight, addTitle, addText, addRect, addLine, addPageNumber, addSource, notes, standalone } = require('../common');

const DATA = [
  ['Structured only', 66],
  ['Full w/o Rerank', 90],
  ['Vector only', 94],
  ['Vector + Rerank', 94],
  ['Keyword only', 96],
  ['Full w/o Rewrite', 98],
  ['Full retrieval', 98],
];

function createSlide(pres) {
  const slide = pres.addSlide();
  applyLight(slide);
  addTitle(slide, '06 / EVIDENCE', '消融实证：融合不是装饰，重排也不是可有可无');
  addRect(slide, 0.56, 1.28, 6.66, 3.66, theme.light, theme.light, 0.06);
  DATA.forEach(([name, value], i) => {
    const y = 1.48 + i * 0.45;
    const highlight = name === 'Full retrieval';
    addText(slide, name, { x: 0.74, y, w: 1.43, h: 0.27, fontSize: 7.8, bold: highlight, color: theme.primary, align: 'right' });
    addRect(slide, 2.32, y + 0.03, 4.40, 0.22, theme.bg, theme.bg);
    addRect(slide, 2.32, y + 0.03, 4.40 * value / 100, 0.22, highlight ? theme.accent : theme.secondary);
    addText(slide, `${value}.0%`, { x: 6.78, y, w: 0.45, h: 0.27, fontSize: 8.2, bold: true, color: highlight ? theme.accent : theme.primary, align: 'right' });
  });
  addLine(slide, 2.32, 4.69, 4.40, 0, theme.primary, 0.8);
  [0, 25, 50, 75, 100].forEach((v) => addText(slide, `${v}`, { x: 2.22 + 4.40 * v / 100, y: 4.72, w: 0.22, h: 0.18, fontSize: 6.5, color: theme.primary, align: 'center' }));
  addRect(slide, 7.53, 1.28, 1.91, 1.55, theme.primary, theme.primary, 0.08);
  addText(slide, '98.0%', { x: 7.67, y: 1.55, w: 1.63, h: 0.55, fontSize: 28, bold: true, color: theme.accent, align: 'center' });
  addText(slide, '受控消融运行\n完整方案观察值', { x: 7.67, y: 2.18, w: 1.63, h: 0.42, fontSize: 8.4, color: theme.light, align: 'center', breakLine: true });
  addRect(slide, 7.53, 3.05, 1.91, 1.55, theme.light, theme.secondary, 0.08);
  addText(slide, '96.0%', { x: 7.67, y: 3.31, w: 1.63, h: 0.55, fontSize: 28, bold: true, color: theme.secondary, align: 'center' });
  addText(slide, '50 题正式基线\n48 / 50', { x: 7.67, y: 3.94, w: 1.63, h: 0.42, fontSize: 8.4, color: theme.primary, align: 'center', breakLine: true });
  addSource(slide, '证据：docs/ablation_report.md；正式基线与受控消融为不同运行口径，禁止混写。');
  addPageNumber(slide, 7);
  notes(slide, '这页必须区分两套口径：50 题正式基线是 96%，即 48 比 50；七组受控消融中，完整方案的观察值是 98%。关闭重排后降到 90%，说明融合与重排确实在控制风险。');
  return slide;
}

module.exports = { createSlide };
if (require.main === module) standalone(createSlide, 'slide-07.pptx');
