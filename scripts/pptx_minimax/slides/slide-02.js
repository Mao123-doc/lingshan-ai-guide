const { ASSETS, theme, applyLight, addTitle, addText, addRect, addImage, addPageNumber, addSource, notes, standalone } = require('../common');

function painCard(slide, x, image, index, title, body) {
  addRect(slide, x, 1.28, 2.82, 3.52, theme.light, theme.secondary, 0.08);
  addImage(slide, image, x, 1.28, 2.82, 1.68, 'cover');
  addRect(slide, x + 0.18, 2.73, 0.48, 0.48, theme.accent);
  addText(slide, index, { x: x + 0.18, y: 2.73, w: 0.48, h: 0.48, fontSize: 15, bold: true, color: theme.primary, align: 'center' });
  addText(slide, title, { x: x + 0.22, y: 3.23, w: 2.38, h: 0.40, fontSize: 13, bold: true, color: theme.primary });
  addText(slide, body, { x: x + 0.22, y: 3.72, w: 2.38, h: 0.78, fontSize: 9.2, color: theme.primary, valign: 'top', breakLine: true, breakLineOnTextOverflow: false });
}

function createSlide(pres) {
  const slide = pres.addSlide();
  applyLight(slide);
  addTitle(slide, '01 / WHY', '景区真正缺的，不是更多答案，而是更少“决策翻车”');
  painCard(slide, 0.56, ASSETS.pain1, '01', '物理常识盲区', '老人、儿童、轮椅用户被推荐到陡坡与台阶；文字正确，路线却走不动。');
  painCard(slide, 3.59, ASSETS.pain2, '02', '时效错配', '演出时间窗、排队缓冲与离园死线相互冲突；赶到现场，节目已经结束。');
  painCard(slide, 6.62, ASSETS.pain3, '03', '事实口误', '票价、开放时间与设施信息缺少来源；一句口误，就会破坏整段行程。');
  addText(slide, '传统生成式问答把“答案像不像”当终点；真实景区要求“决策能不能执行”。', { x: 0.56, y: 4.87, w: 8.25, h: 0.31, fontSize: 11.2, bold: true, color: theme.secondary });
  addSource(slide, '问题归纳基于项目需求分析与 50 题 Fact Contract；场景图为概念视觉，不作为统计证据。');
  addPageNumber(slide, 2);
  notes(slide, '我们聚焦三个会直接破坏游客体验的问题：物理不可达、时间窗错配、事实口误。它们共同说明，文旅智能体的终点不能只是生成答案，而必须把答案变成可执行、可验证的决策。');
  return slide;
}

module.exports = { createSlide };
if (require.main === module) standalone(createSlide, 'slide-02.pptx');
