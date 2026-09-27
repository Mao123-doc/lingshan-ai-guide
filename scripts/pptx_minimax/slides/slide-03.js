const { theme, applyDark, addTitle, addText, addRect, addArrow, addPill, addPageNumber, addSource, notes, standalone } = require('../common');

function createSlide(pres) {
  const slide = pres.addSlide();
  applyDark(slide);
  addTitle(slide, '02 / BREAKTHROUGH', '破局：让大模型与运筹引擎各司其职', true);
  addRect(slide, 0.56, 1.30, 3.45, 3.36, theme.primary, theme.secondary, 0.08);
  addPill(slide, '语义软理解', 0.84, 1.55, 1.38, theme.secondary, theme.light, 9.5);
  addText(slide, '大模型负责“听懂人”', { x: 0.84, y: 2.07, w: 2.65, h: 0.42, fontSize: 18, bold: true, color: theme.light });
  addText(slide, '• 口语意图与多轮追问\n• 13 维游客状态画像\n• 文化内容与情绪表达\n• 输出结构化约束，不生成路线真相', { x: 0.84, y: 2.68, w: 2.72, h: 1.40, fontSize: 10.2, color: theme.light, breakLine: true, valign: 'top', breakLineOnTextOverflow: false });
  addRect(slide, 5.99, 1.30, 3.45, 3.36, theme.primary, theme.accent, 0.08);
  addPill(slide, '时空硬规划', 6.27, 1.55, 1.38, theme.accent, theme.primary, 9.5);
  addText(slide, '运筹引擎负责“算对路”', { x: 6.27, y: 2.07, w: 2.74, h: 0.42, fontSize: 18, bold: true, color: theme.light });
  addText(slide, '• 真实米数、坡度与道路拓扑\n• 演出时间窗与排队缓冲\n• Dijkstra + 24 宽 Beam Search\n• 14 项守恒仲裁与诚实拒绝', { x: 6.27, y: 2.68, w: 2.72, h: 1.40, fontSize: 10.2, color: theme.light, breakLine: true, valign: 'top', breakLineOnTextOverflow: false });
  addArrow(slide, 4.12, 2.72, 1.70, 0, theme.accent, 2.3);
  addRect(slide, 4.24, 2.18, 1.52, 1.08, theme.light, theme.accent, 0.08);
  addText(slide, '可信决策协议', { x: 4.35, y: 2.36, w: 1.30, h: 0.29, fontSize: 10.5, bold: true, color: theme.primary, align: 'center' });
  addText(slide, '约束 / 证据 / 审计', { x: 4.35, y: 2.72, w: 1.30, h: 0.22, fontSize: 7.3, color: theme.secondary, align: 'center' });
  addText(slide, '核心不是“更大的模型”，而是把生成权与裁决权彻底分开。', { x: 1.14, y: 4.84, w: 7.72, h: 0.31, fontSize: 12.2, bold: true, color: theme.accent, align: 'center' });
  addSource(slide, '架构原则：软硬解耦；FORBIDDEN_LLM_FIELDS 禁止大模型直接生成 steps / feasible。', true);
  addPageNumber(slide, 3, true);
  notes(slide, '我们的核心创新是软硬解耦。大模型负责理解语义与提取约束，真正决定路线能否执行的是运筹引擎和形式化验证器。通过代码级字段门禁，模型不能直接编造 steps 和 feasible。');
  return slide;
}

module.exports = { createSlide };
if (require.main === module) standalone(createSlide, 'slide-03.pptx');
