const fs = require('fs');
const path = require('path');
const PptxGenJS = require('pptxgenjs');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, '竞赛汇报与文档材料包', '01_汇报PPT与导出版');
const OUTPUT = path.join(OUT_DIR, '灵小禅_竞赛汇报PPT_MiniMax原生版.pptx');
const PREVIEW_DIR = path.join(__dirname, 'preview');

const ASSET_ROOT = path.join(ROOT, '竞赛汇报与文档材料包', '02_图片与视觉素材');
const ASSETS = {
  cover: path.join(ASSET_ROOT, '国风数智_灵山胜境概念大图(封面推荐).jpg'),
  avatar: path.join(ASSET_ROOT, '数字人灵小禅立绘_透明底.png'),
  hero: path.join(ASSET_ROOT, '国风数智_游客多约束决策全景概念图.jpg'),
  migration: path.join(ASSET_ROOT, '国风数智_跨文旅空间数智迁移拓扑图.jpg'),
  pain1: path.join(ASSET_ROOT, 'AI生图候选库', '03_痛点场景候选', '痛点候选_01_老人面对陡峭天梯长阶.jpg'),
  pain2: path.join(ASSET_ROOT, 'AI生图候选库', '03_痛点场景候选', '痛点候选_02_演艺时间冲突赶场焦虑.png'),
  pain3: path.join(ASSET_ROOT, 'AI生图候选库', '03_痛点场景候选', '痛点候选_03_轮椅与行动不便面对无障碍盲区.png'),
};

// MiniMax skill requires these exact five theme keys.
const theme = {
  primary: '0F172A',
  secondary: '0D9488',
  accent: 'D4AF37',
  light: 'F8FAFC',
  bg: 'FFFFFF',
};

const FONT = 'Microsoft YaHei';
const W = 10;
const H = 5.625;

function newPresentation() {
  const pres = new PptxGenJS();
  pres.author = '灵小禅项目组';
  pres.company = '第八届全球校园人工智能算法精英大赛';
  pres.subject = '可信文旅决策智能体竞赛汇报';
  pres.title = '灵小禅｜可信文旅决策智能体';
  pres.lang = 'zh-CN';
  pres.theme = {
    headFontFace: FONT,
    bodyFontFace: FONT,
    lang: 'zh-CN',
  };
  pres.defineLayout({ name: 'LINGSHAN', width: W, height: H });
  pres.layout = 'LINGSHAN';
  return pres;
}

function addText(slide, text, options = {}) {
  slide.addText(text, {
    fontFace: FONT,
    color: theme.primary,
    margin: 0,
    breakLine: false,
    valign: 'mid',
    fit: 'shrink',
    ...options,
  });
}

function addRect(slide, x, y, w, h, fill, line = fill, radius = 0) {
  const type = radius ? 'roundRect' : 'rect';
  slide.addShape(type, {
    x, y, w, h,
    rectRadius: radius,
    fill: { color: fill },
    line: { color: line, transparency: line === fill ? 100 : 0, width: 0.8 },
  });
}

function addLine(slide, x, y, w, h, color = theme.secondary, width = 1.5, dash = 'solid') {
  const x0 = w < 0 ? x + w : x;
  const y0 = h < 0 ? y + h : y;
  slide.addShape('line', {
    x: x0, y: y0, w: Math.abs(w), h: Math.abs(h),
    flipH: (w < 0) !== (h < 0),
    line: { color, width, dashType: dash, beginArrowType: 'none', endArrowType: 'none' },
  });
}

function addArrow(slide, x, y, w, h, color = theme.secondary, width = 2) {
  slide.addShape('line', {
    x, y, w, h,
    line: { color, width, beginArrowType: 'none', endArrowType: 'triangle' },
  });
}

function addImage(slide, imagePath, x, y, w, h, mode = 'cover', transparency = 0) {
  if (!fs.existsSync(imagePath)) throw new Error(`Missing image: ${imagePath}`);
  slide.addImage({
    path: imagePath,
    x, y, w, h,
    sizing: { type: mode, x, y, w, h },
    transparency,
  });
}

function applyLight(slide) {
  slide.background = { color: theme.bg };
  addRect(slide, 0, 0, W, 0.08, theme.secondary);
}

function applyDark(slide) {
  slide.background = { color: theme.primary };
  addRect(slide, 0, 0, W, 0.08, theme.accent);
}

function addTitle(slide, kicker, title, dark = false) {
  const main = dark ? theme.light : theme.primary;
  addText(slide, kicker.toUpperCase(), {
    x: 0.56, y: 0.25, w: 2.7, h: 0.25,
    fontSize: 9.5, bold: true, charSpacing: 1.4,
    color: dark ? theme.accent : theme.secondary,
  });
  addText(slide, title, {
    x: 0.56, y: 0.50, w: 8.8, h: 0.48,
    fontSize: 22, bold: true, color: main,
  });
  addLine(slide, 0.56, 1.02, 0.55, 0, dark ? theme.accent : theme.secondary, 3);
}

function addPageNumber(slide, n, dark = false) {
  addRect(slide, 9.25, 5.16, 0.42, 0.26, dark ? theme.light : theme.primary);
  addText(slide, String(n).padStart(2, '0'), {
    x: 9.25, y: 5.16, w: 0.42, h: 0.26,
    fontSize: 8, bold: true, align: 'center',
    color: dark ? theme.primary : theme.light,
  });
}

function addSource(slide, text, dark = false) {
  addText(slide, text, {
    x: 0.56, y: 5.18, w: 8.3, h: 0.18,
    fontSize: 6.6,
    color: dark ? theme.light : theme.primary,
    transparency: 34,
  });
}

function addPill(slide, text, x, y, w, fill = theme.light, color = theme.primary, fontSize = 8.5) {
  addRect(slide, x, y, w, 0.30, fill, fill, 0.08);
  addText(slide, text, { x, y, w, h: 0.30, fontSize, bold: true, color, align: 'center' });
}

function addCard(slide, { x, y, w, h, title, body, dark = false, accent = theme.secondary, number = '' }) {
  addRect(slide, x, y, w, h, dark ? theme.primary : theme.light, accent, 0.08);
  addRect(slide, x, y, 0.08, h, accent);
  if (number) addText(slide, number, { x: x + 0.18, y: y + 0.16, w: 0.45, h: 0.30, fontSize: 17, bold: true, color: accent });
  const tx = x + (number ? 0.72 : 0.22);
  addText(slide, title, { x: tx, y: y + 0.14, w: w - (tx - x) - 0.18, h: 0.30, fontSize: 12, bold: true, color: dark ? theme.light : theme.primary });
  addText(slide, body, { x: x + 0.22, y: y + 0.54, w: w - 0.42, h: h - 0.68, fontSize: 9.2, breakLine: true, valign: 'top', color: dark ? theme.light : theme.primary, paraSpaceAfterPt: 4, breakLineOnTextOverflow: false });
}

function addMetric(slide, value, label, x, y, w, dark = false, accent = theme.secondary) {
  addText(slide, value, { x, y, w, h: 0.50, fontSize: 25, bold: true, color: accent, align: 'center' });
  addText(slide, label, { x, y: y + 0.48, w, h: 0.35, fontSize: 8.5, color: dark ? theme.light : theme.primary, align: 'center', breakLine: true });
}

function addNode(slide, label, x, y, w = 1.15, h = 0.46, fill = theme.light, line = theme.secondary, color = theme.primary, size = 8.5) {
  addRect(slide, x, y, w, h, fill, line, 0.06);
  addText(slide, label, { x: x + 0.05, y, w: w - 0.1, h, fontSize: size, bold: true, color, align: 'center' });
}

function notes(slide, text) {
  slide.addNotes(text);
}

function ensureOutputDirs() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(PREVIEW_DIR, { recursive: true });
}

async function standalone(createSlide, fileName) {
  const pres = newPresentation();
  createSlide(pres, theme);
  ensureOutputDirs();
  await pres.writeFile({ fileName: path.join(PREVIEW_DIR, fileName) });
}

module.exports = {
  PptxGenJS, ROOT, OUTPUT, OUT_DIR, PREVIEW_DIR, ASSETS, theme, FONT, W, H,
  newPresentation, addText, addRect, addLine, addArrow, addImage,
  applyLight, applyDark, addTitle, addPageNumber, addSource, addPill,
  addCard, addMetric, addNode, notes, ensureOutputDirs, standalone,
};
