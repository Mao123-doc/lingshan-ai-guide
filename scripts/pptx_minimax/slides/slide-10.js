const { theme, applyLight, addTitle, addText, addRect, addMetric, addPill, addPageNumber, addSource, notes, standalone } = require('../common');

function createSlide(pres) {
  const slide = pres.addSlide();
  applyLight(slide);
  addTitle(slide, '09 / VERIFICATION', '三类基准，把“可信”落实到可复现证据');
  addRect(slide, 0.56, 1.30, 2.74, 3.22, theme.primary, theme.primary, 0.10);
  addText(slide, '事实问答', { x: 0.82, y: 1.60, w: 2.22, h: 0.34, fontSize: 14, bold: true, color: theme.light, align: 'center' });
  addMetric(slide, '96.0%', '50 题 Fact Contract\n48 / 50', 0.82, 2.08, 2.22, true, theme.accent);
  addPill(slide, '权威基线', 1.34, 3.38, 1.18, theme.accent, theme.primary, 8.5);
  addText(slide, '平均时延 3027.64 ms', { x: 0.82, y: 4.00, w: 2.22, h: 0.24, fontSize: 7.7, color: theme.light, align: 'center' });
  addRect(slide, 3.63, 1.30, 2.74, 3.22, theme.secondary, theme.secondary, 0.10);
  addText(slide, '状态理解', { x: 3.89, y: 1.60, w: 2.22, h: 0.34, fontSize: 14, bold: true, color: theme.light, align: 'center' });
  addMetric(slide, '40 / 40', '槽位准确率 100%\n关键缺失识别 100%', 3.89, 2.08, 2.22, true, theme.accent);
  addPill(slide, '13 维画像', 4.41, 3.38, 1.18, theme.light, theme.primary, 8.5);
  addText(slide, '低置信度触发交互追问', { x: 3.89, y: 4.00, w: 2.22, h: 0.24, fontSize: 7.7, color: theme.light, align: 'center' });
  addRect(slide, 6.70, 1.30, 2.74, 3.22, theme.light, theme.secondary, 0.10);
  addText(slide, '路线守恒', { x: 6.96, y: 1.60, w: 2.22, h: 0.34, fontSize: 14, bold: true, color: theme.primary, align: 'center' });
  addMetric(slide, '60 / 60', '形式化合规 100%\n物理硬违规 0 次', 6.96, 2.08, 2.22, false, theme.secondary);
  addPill(slide, '14 项仲裁', 7.48, 3.38, 1.18, theme.primary, theme.light, 8.5);
  addText(slide, '边界路线测试全部通过', { x: 6.96, y: 4.00, w: 2.22, h: 0.24, fontSize: 7.7, color: theme.primary, align: 'center' });
  addText(slide, '不是展示“看起来合理”，而是交付“每一步都能复核”。', { x: 1.30, y: 4.73, w: 7.40, h: 0.30, fontSize: 12, bold: true, color: theme.secondary, align: 'center' });
  addSource(slide, '证据：evaluation/results/baseline_20260917_020000、scene_benchmark_v1.json、route_validator_v1.json。');
  addPageNumber(slide, 10);
  notes(slide, '我们用三类基准覆盖从知识到决策的全链路。事实问答正式基线 96%，状态槽位 40 比 40，边界路线 60 比 60，物理硬违规为零。这里每一个数字都对应仓库中的可复现实验文件。');
  return slide;
}

module.exports = { createSlide };
if (require.main === module) standalone(createSlide, 'slide-10.pptx');
