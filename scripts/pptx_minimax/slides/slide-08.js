const { theme, applyDark, addTitle, addText, addRect, addArrow, addPill, addPageNumber, addSource, notes, standalone } = require('../common');

const FIELDS = ['同行人群', '行动能力', '当前点位', '入园时间', '离园死线', '必看景点', '必看演出', '节奏偏好', '步行上限', '无障碍需求', '天气状态', '餐饮需求', '实时变更'];

function createSlide(pres) {
  const slide = pres.addSlide();
  applyDark(slide);
  addTitle(slide, '07 / SCENE STATE', '把一句口语，变成可计算的 13 维场景状态', true);
  addRect(slide, 0.56, 1.32, 2.28, 2.68, theme.light, theme.light, 0.10);
  addText(slide, '“我带着老人，下午四点前要走，想看九龙灌浴，别走太累。”', { x: 0.82, y: 1.67, w: 1.76, h: 1.10, fontSize: 15, bold: true, color: theme.primary, breakLine: true, valign: 'mid', breakLineOnTextOverflow: false });
  addText(slide, '自然语言输入', { x: 0.82, y: 3.36, w: 1.76, h: 0.26, fontSize: 8.5, color: theme.secondary, align: 'center' });
  addArrow(slide, 2.95, 2.65, 0.50, 0, theme.accent, 2.2);
  addRect(slide, 3.50, 1.32, 3.64, 2.68, theme.primary, theme.secondary, 0.10);
  FIELDS.forEach((field, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const w = col === 2 ? 1.03 : 1.00;
    addPill(slide, field, 3.74 + col * 1.09, 1.60 + row * 0.43, w, i < 5 ? theme.secondary : theme.light, i < 5 ? theme.light : theme.primary, 7.4);
  });
  addText(slide, '双轨抽取：规则先行 + LLM 补全', { x: 3.76, y: 3.69, w: 3.12, h: 0.22, fontSize: 8.6, bold: true, color: theme.accent, align: 'center' });
  addArrow(slide, 7.25, 2.65, 0.48, 0, theme.accent, 2.2);
  addRect(slide, 7.78, 1.32, 1.66, 2.68, theme.light, theme.accent, 0.10);
  addText(slide, '置信度门禁', { x: 7.96, y: 1.58, w: 1.30, h: 0.32, fontSize: 13, bold: true, color: theme.primary, align: 'center' });
  addText(slide, '≥ 0.75', { x: 7.96, y: 2.03, w: 1.30, h: 0.48, fontSize: 24, bold: true, color: theme.secondary, align: 'center' });
  addText(slide, '通过 → 进入规划\n不足 → 交互追问', { x: 7.96, y: 2.72, w: 1.30, h: 0.62, fontSize: 9, color: theme.primary, align: 'center', breakLine: true });
  addRect(slide, 1.18, 4.35, 7.64, 0.55, theme.primary, theme.accent, 0.06);
  addText(slide, '代码级防越权：FORBIDDEN_LLM_FIELDS = steps / feasible　→　路线步骤与可行性只能由规划器裁决', { x: 1.42, y: 4.47, w: 7.16, h: 0.26, fontSize: 9.2, bold: true, color: theme.light, align: 'center' });
  addSource(slide, '场景槽位测试：40 / 40，关键缺失识别率 100%。', true);
  addPageNumber(slide, 8, true);
  notes(slide, '游客不会填写复杂表单，只会说一句自然语言。系统把它转成 13 维状态，并用 0.75 的置信度门禁决定是否追问。最关键的是，模型没有 steps 和 feasible 的写入权，避免理解模块越权编造路线。');
  return slide;
}

module.exports = { createSlide };
if (require.main === module) standalone(createSlide, 'slide-08.pptx');
