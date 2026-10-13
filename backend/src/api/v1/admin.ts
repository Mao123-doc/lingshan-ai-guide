import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import { reindexKnowledgeBase, getKnowledgeStats } from '../../services/rag-service';
import { resolveDataPath } from '../../config/paths';

const adminRouter = Router();

// ============================================================
// Upload & Doc Processing
// ============================================================
function getUploadDir(): string {
  const dir = resolveDataPath('uploads');
  try { fs.mkdirSync(dir, { recursive: true }); } catch {}
  return dir;
}

function getKbDocsDir(): string {
  const dir = resolveDataPath('kb_docs');
  try { fs.mkdirSync(dir, { recursive: true }); } catch {}
  return dir;
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, getUploadDir()),
  filename: (_req, file, cb) => {
    const id = uuidv4();
    const ext = path.extname(file.originalname);
    cb(null, `${id}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (['.txt', '.docx', '.xlsx', '.xls'].includes(extension)) {
      cb(null, true);
      return;
    }
    const error = new Error('不支持的文件类型') as Error & { status?: number };
    error.status = 400;
    cb(error);
  },
});

/** Parse uploaded docx and extract text for knowledge base */
async function parseDocument(filePath: string, ext: string): Promise<string> {
  // Try mammoth for docx
  if (ext === '.docx') {
    try {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value;
    } catch (e) {
      console.error('Mammoth parse error:', e);
    }
  }
  // Try xlsx for Excel files
  if (ext === '.xlsx' || ext === '.xls') {
    try {
      const XLSX = await import('xlsx');
      const workbook = XLSX.readFile(filePath);
      let text = '';
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        text += XLSX.utils.sheet_to_csv(sheet) + '\n';
      }
      return text;
    } catch (e) {
      console.error('XLSX parse error:', e);
    }
  }
  // Plain text
  if (ext === '.txt') {
    return fs.readFileSync(filePath, 'utf-8');
  }
  return '';
}

// ============ Knowledge Base Management ============

adminRouter.post('/knowledge/documents', upload.single('file'), async (req: Request, res: Response) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: '请上传文件' });

  const ext = path.extname(file.originalname).toLowerCase();
  let text = '';
  let status = 'uploaded';
  let docId = '';

  // Try to parse and index immediately
  try {
    text = await parseDocument(file.path, ext);
    if (text && text.length > 50) {
      // Save parsed text to kb_docs for re-indexing
      docId = uuidv4();
      const docPath = path.join(getKbDocsDir(), `${docId}.txt`);
      fs.writeFileSync(docPath, text);
      status = 'indexed';
    }
  } catch (e) {
    console.error('Document parsing error:', e);
    status = 'parse_failed';
  }

  res.json({
    id: file.filename,
    title: file.originalname,
    filename: file.filename,
    size: file.size,
    docId,
    status,
    text_length: text.length,
    message: status === 'indexed'
      ? '文档已解析并加入知识库。点击"重建索引"使其生效。'
      : status === 'parse_failed'
        ? '文档解析失败，请确认文件格式正确。'
        : '文件已上传，但内容较短未自动索引。',
  });
});

adminRouter.get('/knowledge/documents', (_req: Request, res: Response) => {
  const docs: Array<{ id: string; name: string; size: number; date: string; status: string }> = [];
  try {
    // 1. Source knowledge files (data/raw/)
    const rawDir = resolveDataPath('raw');
    if (fs.existsSync(rawDir)) {
      const rawEntries = fs.readdirSync(rawDir);
      for (const entry of rawEntries) {
        if (entry.startsWith('.')) continue;
        if (!entry.endsWith('.txt') && !entry.endsWith('.docx') && !entry.endsWith('.xlsx')) continue;
        const stat = fs.statSync(path.join(rawDir, entry));
        docs.push({
          id: entry,
          name: entry,
          size: stat.size,
          date: stat.mtime.toISOString().split('T')[0],
          status: 'indexed',
        });
      }
    }
    // 2. Uploaded files
    const uploadDir = getUploadDir();
    if (fs.existsSync(uploadDir)) {
      const entries = fs.readdirSync(uploadDir);
      for (const entry of entries) {
        if (entry.startsWith('.')) continue;
        const stat = fs.statSync(path.join(uploadDir, entry));
        docs.push({
          id: entry,
          name: entry,
          size: stat.size,
          date: stat.mtime.toISOString().split('T')[0],
          status: 'uploaded',
        });
      }
    }
    // 3. Parsed KB docs
    const kbDocsDir = getKbDocsDir();
    if (fs.existsSync(kbDocsDir)) {
      const kbEntries = fs.readdirSync(kbDocsDir);
      for (const entry of kbEntries) {
        if (entry.startsWith('.')) continue;
        const stat = fs.statSync(path.join(kbDocsDir, entry));
        if (!docs.find(d => d.name === entry)) {
          docs.push({
            id: entry,
            name: entry,
            size: stat.size,
            date: stat.mtime.toISOString().split('T')[0],
            status: 'indexed',
          });
        }
      }
    }
  } catch {}
  res.json(docs);
});

adminRouter.delete('/knowledge/documents/:id', (req: Request, res: Response) => {
  const id = req.params.id as string;
  if (!id || id === '.' || id === '..' || id !== path.basename(id) || path.isAbsolute(id)) {
    res.status(404).json({ error: '文档不存在' });
    return;
  }
  let deleted = false;
  try {
    const p1 = path.join(getUploadDir(), id);
    const p2 = path.join(getKbDocsDir(), id);
    if (fs.existsSync(p1)) { fs.unlinkSync(p1); deleted = true; }
    if (fs.existsSync(p2)) { fs.unlinkSync(p2); deleted = true; }
  } catch {}
  if (deleted) {
    res.json({ status: 'ok', message: '文档已删除。请重建索引使变更生效。' });
  } else {
    res.status(404).json({ error: '文档不存在' });
  }
});

adminRouter.post('/knowledge/refresh-index', async (_req: Request, res: Response) => {
  try {
    const result = await reindexKnowledgeBase();
    res.json({
      status: 'ok',
      message: `索引重建完成：${result.chunkCount} 个分块`,
      ...result,
    });
  } catch (e: any) {
    res.status(500).json({ error: '索引刷新失败', detail: e.message });
  }
});

adminRouter.get('/knowledge/stats', (_req: Request, res: Response) => {
  res.json(getKnowledgeStats());
});

adminRouter.get('/knowledge/test-qa', async (req: Request, res: Response) => {
  const query = (req.query.query as string) || '';
  if (!query.trim()) {
    return res.json({ query: '', results: [], hint: '请输入测试问题' });
  }
  try {
    const { searchStructured } = await import('../../services/structured-knowledge');
    const results = searchStructured(query, 5);
    res.json({
      query,
      retrieved_chunks: results.length,
      results: results.map(r => ({
        id: r.spotId,
        spot: r.spotName,
        field: r.fieldLabel,
        text: r.text,
        score: r.score,
      })),
    });
  } catch (e: any) {
    res.json({ query, error: '检索失败：' + (e.message || '未知错误') });
  }
});

export { adminRouter };
