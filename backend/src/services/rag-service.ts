/**
 * RAG Service — Real chunking, vector embedding, similarity search, LLM generation.
 * Uses Agnes/DeepSeek API for embeddings and LLM.
 * Local file cache for embeddings to avoid re-embedding.
 */
import fs from 'fs';
import path from 'path';
import { callLLM, streamLLM, buildTourGuideMessages, isLLMAvailable } from './llm-service';
import { searchVectorsWithStatus, isVectorAvailable, waitForVectorService } from './vector-search-service';
import { analyzeEmotion } from './emotion-service';
import { searchStructured, getFieldIndex } from './structured-knowledge';
import { DEFAULT_RAG_CONFIG, RAGExperimentConfig, resolveRAGConfig } from './rag-config';
import { fuseCandidates, type RetrievalCandidate, type RetrievalChannel } from './retrieval/hybrid-retriever';

// ============================================================
// Types
// ============================================================

interface Chunk {
  id: string;
  text: string;
  score?: number;
  embedding?: number[];
  metadata: {
    source: string;
    category: string;
    keywords: string[];
  };
}

export interface EvidenceDocument {
  id: string;
  text: string;
  score: number;
  source: string;
  category: string;
  keywords: string[];
}

interface RAGResult {
  answer: string;
  emotion: string;
  relatedSpots: string[];
  usedLLM: boolean;
  retrievedChunks: number;
  trace: RAGTrace;
}

export type RAGTraceStatus = 'executed' | 'skipped' | 'failed';

export interface RAGTraceStage {
  configured: boolean;
  executed: boolean;
  status: RAGTraceStatus;
  reason?: string;
  resultCount?: number;
  fallbackUsed?: boolean;
}

export interface RAGRetrievalTrace {
  vector: RAGTraceStage;
  structured: RAGTraceStage;
  keyword: RAGTraceStage;
  candidates?: Array<{
    canonicalId: string;
    dedupeKey: string;
    channel: RetrievalChannel;
    rank: number;
    rawScore?: number;
    rrfScore?: number;
    channels?: RetrievalChannel[];
  }>;
  fusion?: {
    method: 'rrf';
    k: number;
    inputCounts: Record<RetrievalChannel, number>;
    candidateCount: number;
  };
}

export interface RAGTrace {
  originalQuery: string;
  rewrittenQuery: string;
  retrievalMode: 'vector' | 'structured' | 'keyword' | 'fusion' | 'none';
  retrievedIds: string[];
  retrievedScores: number[];
  retrievedDocuments: EvidenceDocument[];
  rerankEnabled: boolean;
  rerankedIds: string[];
  contextIds: string[];
  historyMessageCount: number;
  fullKnowledgeIncluded: boolean;
  rewrite: RAGTraceStage;
  retrieval: RAGRetrievalTrace;
  rerank: RAGTraceStage;
  generation: RAGTraceStage;
}

/** Expose retrieval evidence for evaluation without changing retrieval decisions. */
export function toEvidenceDocuments(chunks: Array<Pick<Chunk, 'id' | 'text' | 'score' | 'metadata'>>): EvidenceDocument[] {
  return chunks.map(chunk => ({
    id: chunk.id,
    text: chunk.text,
    score: chunk.score || 0,
    source: chunk.metadata.source,
    category: chunk.metadata.category,
    keywords: chunk.metadata.keywords,
  }));
}

export function createTraceStage(
  configured: boolean,
  status: RAGTraceStatus,
  reason?: string,
  details?: Pick<RAGTraceStage, 'resultCount' | 'fallbackUsed'>,
): RAGTraceStage {
  const stage: RAGTraceStage = {
    configured,
    executed: status !== 'skipped',
    status,
  };
  if (reason) stage.reason = reason;
  if (details?.resultCount !== undefined) stage.resultCount = details.resultCount;
  if (details?.fallbackUsed !== undefined) stage.fallbackUsed = details.fallbackUsed;
  return stage;
}

type RetrievalObservation = {
  configured: boolean;
  outcome?: 'unavailable' | 'failed' | 'executed';
  resultCount?: number;
  reason?: string;
};

export function createRetrievalTrace(observations: {
  vector: RetrievalObservation;
  structured: RetrievalObservation;
  keyword: RetrievalObservation;
}): RAGRetrievalTrace {
  const stageFor = (observation: RetrievalObservation): RAGTraceStage => {
    if (!observation.configured) return createTraceStage(false, 'skipped', 'disabled');
    if (observation.outcome === 'unavailable') {
      return createTraceStage(true, 'skipped', observation.reason || 'service_unavailable', { resultCount: 0 });
    }
    if (observation.outcome === 'failed') {
      return createTraceStage(true, 'failed', observation.reason || 'execution_failed', { resultCount: 0 });
    }
    if (observation.resultCount !== undefined) {
      return createTraceStage(true, 'executed', observation.resultCount === 0 ? 'zero_results' : undefined, {
        resultCount: observation.resultCount,
      });
    }
    return createTraceStage(true, 'skipped', 'not_reached', { resultCount: 0 });
  };

  const vector = stageFor(observations.vector);
  const structured = stageFor(observations.structured);
  const keyword = stageFor(observations.keyword);
  if (vector.resultCount && vector.resultCount > 0) {
    structured.status = 'skipped';
    structured.executed = false;
    structured.reason = 'previous_stage_returned_results';
    keyword.status = 'skipped';
    keyword.executed = false;
    keyword.reason = 'previous_stage_returned_results';
  } else if (structured.resultCount && structured.resultCount > 0) {
    keyword.status = 'skipped';
    keyword.executed = false;
    keyword.reason = 'previous_stage_returned_results';
  }
  return { vector, structured, keyword };
}

export function createParallelRetrievalTrace(
  observations: {
    vector: RetrievalObservation;
    structured: RetrievalObservation;
    keyword: RetrievalObservation;
  },
  fusion?: RAGRetrievalTrace['fusion'],
): RAGRetrievalTrace {
  const stageFor = (observation: RetrievalObservation): RAGTraceStage => {
    if (!observation.configured) return createTraceStage(false, 'skipped', 'disabled');
    if (observation.outcome === 'unavailable' || observation.outcome === 'failed') {
      return createTraceStage(true, 'failed', observation.reason || 'execution_failed', { resultCount: 0 });
    }
    if (observation.resultCount !== undefined) {
      return createTraceStage(true, 'executed', observation.resultCount === 0 ? 'zero_results' : undefined, {
        resultCount: observation.resultCount,
      });
    }
    return createTraceStage(true, 'failed', 'not_observed', { resultCount: 0 });
  };

  return {
    vector: stageFor(observations.vector),
    structured: stageFor(observations.structured),
    keyword: stageFor(observations.keyword),
    ...(fusion ? { fusion } : {}),
  };
}

// ============================================================
// Chunking — Chinese text aware
// ============================================================

const CHINESE_SEPARATORS = ['\n\n', '\n', '。', '！', '？', '；', '，', '、'];

function splitText(text: string, chunkSize: number = 500, overlap: number = 100): string[] {
  const chunks: string[] = [];
  let current = '';
  const paragraphs = text.split(/\n\n+/);
  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;
    if (trimmed.length <= chunkSize) {
      if ((current + trimmed).length > chunkSize && current) {
        chunks.push(current.trim());
        current = '';
      }
      current = current ? current + '\n\n' + trimmed : trimmed;
      if (current.length >= chunkSize) { chunks.push(current.trim()); current = ''; }
    } else {
      if (current) { chunks.push(current.trim()); current = ''; }
      const sentences = trimmed.split(/(?<=[。！？])/);
      let subChunk = '';
      for (const sent of sentences) {
        if ((subChunk + sent).length > chunkSize && subChunk) {
          chunks.push(subChunk.trim());
          const lastSent = subChunk.split(/(?<=[。！？])/).pop() || '';
          subChunk = lastSent + sent;
        } else { subChunk += sent; }
      }
      if (subChunk.trim()) chunks.push(subChunk.trim());
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.filter(c => c.length > 20);
}

// ============================================================
// Keyword extraction for metadata
// ============================================================

const SPOT_NAMES = [
  '灵山大佛', '九龙灌浴', '灵山梵宫', '五印坛城', '祥符禅寺',
  '灵山大照壁', '菩提大道', '百子戏弥勒', '曼飞龙塔', '无尽意斋',
  '佛足坛', '五智门', '降魔浮雕', '阿育王柱', '佛教文化博览馆',
  '拈花广场', '梵天花海', '香月花街', '五灯湖', '灵山精舍',
  '五明桥', '拈花湾', '香水海', '登云道',
];

function extractKeywords(text: string): string[] {
  return SPOT_NAMES.filter(name => text.includes(name));
}

function detectCategory(text: string): string {
  if (text.includes('门票') || text.includes('交通') || text.includes('餐饮') || text.includes('住宿')) return '实用信息';
  if (text.includes('表演') || text.includes('演出') || text.includes('时间')) return '演艺信息';
  if (text.includes('路线') || text.includes('游览') || text.includes('攻略')) return '游览指南';
  if (text.includes('唐代') || text.includes('北宋') || text.includes('历史') || text.includes('千年')) return '历史背景';
  return '景点数据';
}

// ============================================================
// Knowledge Base Loading & Indexing
// ============================================================

let knowledgeChunks: Chunk[] = [];
let isIndexed = false;
const CHUNKS_CACHE_FILE = path.resolve(__dirname, '../../../data/chunks_cache.json');

function loadKnowledgeTexts(): string[] {
  const dataDir = path.resolve(__dirname, '../../../data/raw');
  const texts: string[] = [];

  // Load all txt files
  const entries = fs.readdirSync(dataDir);
  for (const entry of entries) {
    const filePath = path.join(dataDir, entry);
    if (entry.endsWith('.txt')) {
      texts.push(fs.readFileSync(filePath, 'utf-8'));
    }
  }
  // If no txt files found, try loading from docx (async not possible, skip for sync init)
  // The txt files are pre-extracted versions of the docx files
  if (texts.length === 0) {
    // Fallback to the original two files
    texts.push(fs.readFileSync(path.join(dataDir, 'knowledge_guide.txt'), 'utf-8'));
    texts.push(fs.readFileSync(path.join(dataDir, 'knowledge_dataset.txt'), 'utf-8'));
  }
  return texts;
}

function buildChunks(): Chunk[] {
  const texts = loadKnowledgeTexts();
  const allChunks: Chunk[] = [];
  for (let i = 0; i < texts.length; i++) {
    const text = texts[i];
    const source = `doc_${i}`;
    const chunks = splitText(text, 500, 100).map((chunkText, j) => ({
      id: `${source}_${j}`,
      text: chunkText,
      metadata: {
        source,
        category: detectCategory(chunkText),
        keywords: extractKeywords(chunkText),
      },
    }));
    allChunks.push(...chunks);
  }
  return allChunks;
}

function isCacheStale(): boolean {
  try {
    if (!fs.existsSync(CHUNKS_CACHE_FILE)) return true;
    const cacheMtime = fs.statSync(CHUNKS_CACHE_FILE).mtimeMs;
    const guidePath = path.resolve(__dirname, '../../../data/raw/knowledge_guide.txt');
    const datasetPath = path.resolve(__dirname, '../../../data/raw/knowledge_dataset.txt');
    const guideMtime = fs.statSync(guidePath).mtimeMs;
    const datasetMtime = fs.statSync(datasetPath).mtimeMs;
    return guideMtime > cacheMtime || datasetMtime > cacheMtime;
  } catch {
    return true;
  }
}

function tryLoadCachedChunks(): boolean {
  try {
    if (!isCacheStale() && fs.existsSync(CHUNKS_CACHE_FILE)) {
      const raw = fs.readFileSync(CHUNKS_CACHE_FILE, 'utf-8');
      const cached = JSON.parse(raw);
      if (Array.isArray(cached) && cached.length > 0) {
        knowledgeChunks = cached;
        isIndexed = true;
        console.log(`[RAG] Loaded ${knowledgeChunks.length} cached chunks`);
        return true;
      }
    }
  } catch (e) {
    console.log('[RAG] No valid cache found, will re-index');
  }
  return false;
}

function saveChunksCache(): void {
  try {
    const dir = path.dirname(CHUNKS_CACHE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CHUNKS_CACHE_FILE, JSON.stringify(knowledgeChunks, null, 2));
    console.log(`[RAG] Saved ${knowledgeChunks.length} chunks to cache`);
  } catch (e) {
    console.error('[RAG] Failed to save chunks cache:', e);
  }
}

/**
 * Initialize the knowledge base — wait for vector service, fall back to keyword chunks.
 */
export async function initKnowledgeBase(): Promise<{ chunkCount: number; indexed: boolean }> {
  console.log('[RAG] Initializing knowledge base...');

  // Try vector service first (semantic search)
  const vectorReady = await waitForVectorService(30000);
  if (vectorReady) {
    console.log('[RAG] Vector service ready — using semantic search');
    isIndexed = true;
    // Still build keyword chunks as fallback
    if (!tryLoadCachedChunks()) {
      knowledgeChunks = buildChunks();
      saveChunksCache();
    }
    return { chunkCount: knowledgeChunks.length || 50, indexed: true };
  }

  console.log('[RAG] Vector service unavailable — using keyword matching');
  // Load from cache or build
  if (tryLoadCachedChunks()) {
    isIndexed = true;
    return { chunkCount: knowledgeChunks.length, indexed: true };
  }

  knowledgeChunks = buildChunks();
  saveChunksCache();
  isIndexed = true;
  return { chunkCount: knowledgeChunks.length, indexed: true };
}

function keywordScore(chunk: Chunk, query: string): number {
  let score = 0;
  const qClean = query.replace(/[？?！!，,。.、\s]+/g, '');

  // 1. Exact phrase match (highest weight)
  if (chunk.text.includes(query)) score += 100;

  // 2. Keyword match — whole spot name in query (e.g. query "灵山大佛" matches keyword "灵山大佛")
  for (const kw of chunk.metadata.keywords) {
    if (qClean.includes(kw)) score += kw.length * 3;
    else if (kw.includes(qClean)) score += qClean.length * 2;
  }

  // 3. Longest common substring (medium weight) — e.g. "大佛" in "灵山大佛"
  let maxCommon = 0;
  for (let i = 0; i < qClean.length; i++) {
    for (let j = i + 2; j <= qClean.length; j++) {
      const sub = qClean.slice(i, j);
      if (chunk.text.includes(sub) && sub.length > maxCommon) {
        maxCommon = sub.length;
      }
    }
  }
  score += maxCommon * 5;

  // 4. Individual character overlap (lowest weight, only count meaningful chars)
  const meaningfulChars = qClean.replace(/[的地得了吗呢啊吧哦呀]/g, '').split('');
  const uniqueChars = [...new Set(meaningfulChars)];
  let charHits = 0;
  for (const ch of uniqueChars) {
    if (chunk.text.includes(ch)) charHits++;
  }
  // Only reward if significant overlap (more than half of chars match)
  if (uniqueChars.length > 0 && charHits / uniqueChars.length > 0.5) {
    score += charHits * 0.5;
  } else if (charHits <= 1 && !score) {
    // Don't return chunks that only match 1 character and have no other score
    return 0;
  }

  return score;
}

async function searchChunksWithTrace(
  query: string,
  topK: number,
  config: RAGExperimentConfig,
): Promise<{ chunks: Chunk[]; mode: RAGTrace['retrievalMode']; trace: RAGRetrievalTrace }> {
  const observations = {
    vector: { configured: config.enableVectorRetrieval } as RetrievalObservation,
    structured: { configured: config.enableStructuredRetrieval } as RetrievalObservation,
    keyword: { configured: config.enableKeywordRetrieval } as RetrievalObservation,
  };

  const vectorPromise = (async (): Promise<RetrievalCandidate[]> => {
    if (!config.enableVectorRetrieval) return [];
    if (!isVectorAvailable()) {
      observations.vector.outcome = 'unavailable';
      observations.vector.reason = 'service_unavailable';
      observations.vector.resultCount = 0;
      return [];
    }
    try {
      const outcome = await searchVectorsWithStatus(query, topK);
      observations.vector.outcome = outcome.status;
      observations.vector.reason = outcome.reason;
      observations.vector.resultCount = outcome.results.length;
      return outcome.results.map((result, index) => ({
        canonicalId: result.id,
        dedupeKey: `text:${result.text.replace(/\s+/g, '').slice(0, 1000)}`,
        text: result.text,
        source: result.metadata.source || '',
        channel: 'vector' as const,
        rank: index + 1,
        rawScore: result.score,
        metadata: {
          category: result.metadata.category || '景点数据',
          keywords: (result.metadata.keywords || '').split(',').filter(Boolean),
        },
      }));
    } catch (error: any) {
      observations.vector.outcome = 'failed';
      observations.vector.reason = error?.message?.slice(0, 80) || 'execution_failed';
      observations.vector.resultCount = 0;
      return [];
    }
  })();

  const structuredPromise = (async (): Promise<RetrievalCandidate[]> => {
    if (!config.enableStructuredRetrieval) return [];
    try {
      const results = searchStructured(query, topK);
      observations.structured.outcome = 'executed';
      observations.structured.resultCount = results.length;
      return results.map((result, index) => ({
        canonicalId: `${result.spotId}_${result.fieldName}`,
        dedupeKey: `structured:${result.spotId}_${result.fieldName}`,
        text: `【${result.spotName}】${result.fieldLabel}：${result.text}`,
        source: 'structured_dataset',
        channel: 'structured' as const,
        rank: index + 1,
        rawScore: result.score,
        metadata: { category: result.fieldLabel, keywords: [result.spotName] },
      }));
    } catch (error: any) {
      observations.structured.outcome = 'failed';
      observations.structured.reason = error?.message?.slice(0, 80) || 'execution_failed';
      observations.structured.resultCount = 0;
      return [];
    }
  })();

  const keywordPromise = (async (): Promise<RetrievalCandidate[]> => {
    if (!config.enableKeywordRetrieval) return [];
    try {
      if (knowledgeChunks.length === 0) knowledgeChunks = buildChunks();
      const results = knowledgeChunks.map(chunk => ({ chunk, score: keywordScore(chunk, query) }))
        .filter(result => result.score > 0)
        .sort((left, right) => right.score - left.score)
        .slice(0, topK);
      observations.keyword.outcome = 'executed';
      observations.keyword.resultCount = results.length;
      return results.map((result, index) => ({
        canonicalId: result.chunk.id,
        dedupeKey: `text:${result.chunk.text.replace(/\s+/g, '').slice(0, 1000)}`,
        text: result.chunk.text,
        source: result.chunk.metadata.source,
        channel: 'keyword' as const,
        rank: index + 1,
        rawScore: result.score,
        metadata: {
          category: result.chunk.metadata.category,
          keywords: result.chunk.metadata.keywords,
        },
      }));
    } catch (error: any) {
      observations.keyword.outcome = 'failed';
      observations.keyword.reason = error?.message?.slice(0, 80) || 'execution_failed';
      observations.keyword.resultCount = 0;
      return [];
    }
  })();

  const [vector, structured, keyword] = await Promise.all([vectorPromise, structuredPromise, keywordPromise]);
  const fusion = fuseCandidates({ vector, structured, keyword });
  const ranked = fusion.ranked.slice(0, topK);
  const chunks: Chunk[] = ranked.map(candidate => ({
    id: candidate.canonicalId,
    text: candidate.text,
    score: candidate.rrfScore,
    metadata: {
      source: candidate.source,
      category: typeof candidate.metadata.category === 'string' ? candidate.metadata.category : '景点数据',
      keywords: Array.isArray(candidate.metadata.keywords) ? candidate.metadata.keywords.map(String) : [],
    },
  }));
  const enabledChannels = [
    config.enableVectorRetrieval && 'vector',
    config.enableStructuredRetrieval && 'structured',
    config.enableKeywordRetrieval && 'keyword',
  ].filter(Boolean) as RetrievalChannel[];
  const mode: RAGTrace['retrievalMode'] = ranked.length === 0
    ? 'none'
    : enabledChannels.length > 1 ? 'fusion' : enabledChannels[0];
  const trace = createParallelRetrievalTrace(observations, {
    method: 'rrf',
    k: fusion.rrfK,
    inputCounts: fusion.channelCounts,
    candidateCount: fusion.candidates.length,
  });
  trace.candidates = fusion.ranked.map(candidate => ({
    canonicalId: candidate.canonicalId,
    dedupeKey: candidate.dedupeKey,
    channel: candidate.channel,
    rank: candidate.rank,
    rawScore: candidate.rawScore,
    rrfScore: candidate.rrfScore,
    channels: candidate.channels,
  }));
  return { chunks, mode, trace };
}

export async function searchChunks(
  query: string,
  topK: number = 5,
  config: RAGExperimentConfig = DEFAULT_RAG_CONFIG,
): Promise<Chunk[]> {
  const result = await searchChunksWithTrace(query, topK, config);
  return result.chunks;
}

// ============================================================
// Context Builder
// ============================================================

function buildRetrievedContext(chunks: Chunk[]): string {
  if (chunks.length === 0) return '未找到直接相关的内容。';
  return chunks.map((c, i) =>
    `[片段${i + 1}] (${c.metadata.category})\n${c.text}`
  ).join('\n\n');
}

// ============================================================
// Conversation History
// ============================================================

const sessionHistory: Map<string, Array<{ role: 'user' | 'assistant'; content: string }>> = new Map();
const sessionTimestamps = new Map<string, number>();
const MAX_HISTORY = 12; // 6 turns
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_SESSIONS = 1000;

function cleanupStaleSessions(): void {
  const cutoff = Date.now() - SESSION_TTL_MS;
  for (const [id, ts] of sessionTimestamps) {
    if (ts < cutoff) {
      sessionHistory.delete(id);
      sessionTimestamps.delete(id);
    }
  }
  // Hard cap: evict oldest if still over limit
  if (sessionHistory.size > MAX_SESSIONS) {
    const sorted = [...sessionTimestamps.entries()]
      .sort((a, b) => a[1] - b[1]);
    const toDelete = sorted.slice(0, sorted.length - MAX_SESSIONS);
    for (const [id] of toDelete) {
      sessionHistory.delete(id);
      sessionTimestamps.delete(id);
    }
  }
}

export function getSessionHistory(sessionId: string): Array<{ role: 'user' | 'assistant'; content: string }> {
  cleanupStaleSessions();
  sessionTimestamps.set(sessionId, Date.now()); // refresh TTL
  return sessionHistory.get(sessionId) || [];
}

export function addToHistory(sessionId: string, role: 'user' | 'assistant', content: string): void {
  cleanupStaleSessions();
  const history = sessionHistory.get(sessionId) || [];
  history.push({ role, content });
  if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);
  sessionHistory.set(sessionId, history);
  sessionTimestamps.set(sessionId, Date.now());
}

// ============================================================
// Emotion Detection — uses LLM with keyword fallback
// ============================================================

async function detectEmotion(query: string, answer: string): Promise<string> {
  return analyzeEmotion(query);
}

// ============================================================
// Related Spots Extraction
// ============================================================

function extractRelatedSpots(text: string): string[] {
  return SPOT_NAMES.filter(s => text.includes(s));
}

// ============================================================
// Query Rewriting — colloquial → search-friendly
// ============================================================

/**
 * Rewrite a colloquial user query into a search-optimized form.
 * Uses LLM when available; returns original query on failure.
 */
async function rewriteQueryWithTrace(
  query: string,
  configured: boolean,
): Promise<{ query: string; trace: RAGTraceStage }> {
  if (!configured) return { query, trace: createTraceStage(false, 'skipped', 'disabled') };
  if (!isLLMAvailable()) {
    return { query, trace: createTraceStage(true, 'skipped', 'llm_unavailable') };
  }
  if (query.length < 3) {
    return { query, trace: createTraceStage(true, 'skipped', 'query_too_short') };
  }

  // Quick check: already search-friendly (short, keyword-like)?
  if (query.length <= 8 && !/[？?吗呢吧啊呀]/.test(query)) {
    return { query, trace: createTraceStage(true, 'skipped', 'already_search_friendly') };
  }

  try {
    const result = await callLLM([
      {
        role: 'system',
        content: `你是景区查询改写助手。将游客的口语化问题改写为精准的搜索关键词。
规则：
- 提取核心景点名、属性词（高度、门票、时间、历史等）
- 去掉语气词、敬语、问候语
- 保留原意，不做扩展
- 只输出改写后的关键词（不超过20个字），不要解释

示例：
输入："那个大佛到底有多高啊"  → 输出："灵山大佛 高度"
输入："请问门票贵不贵"        → 输出："门票价格"
输入："有什么好玩的地方推荐"  → 输出："景点推荐 游玩亮点"`,
      },
      { role: 'user', content: query },
    ], { temperature: 0.1, max_tokens: 30 });

    const rewritten = result?.trim();
    if (!rewritten) {
      return { query, trace: createTraceStage(true, 'failed', 'llm_call_failed') };
    }
    if (rewritten && rewritten.length >= 2 && rewritten !== query) {
      console.log(`[RAG] Query rewritten: "${query}" → "${rewritten}"`);
      return { query: rewritten, trace: createTraceStage(true, 'executed') };
    }
    return { query, trace: createTraceStage(true, 'executed') };
  } catch {
    return { query, trace: createTraceStage(true, 'failed', 'llm_call_failed') };
  }
}

async function rewriteQuery(query: string): Promise<string> {
  return (await rewriteQueryWithTrace(query, true)).query;
}

// ============================================================
// Reranker — LLM-based relevance scoring
// ============================================================

/**
 * Use LLM to re-rank search results by relevance to the query.
 * Graded, not just pointwise — asks the model to pick the best matches.
 */
async function rerankChunksWithTrace(
  query: string,
  chunks: Chunk[],
  configured: boolean,
): Promise<{ chunks: Chunk[]; trace: RAGTraceStage }> {
  if (!configured) {
    return { chunks, trace: createTraceStage(false, 'skipped', 'disabled') };
  }
  if (chunks.length <= 2) {
    return { chunks, trace: createTraceStage(true, 'skipped', 'insufficient_candidates', { resultCount: chunks.length }) };
  }
  if (!isLLMAvailable()) {
    return { chunks, trace: createTraceStage(true, 'skipped', 'llm_unavailable', { resultCount: chunks.length }) };
  }

  try {
    const snippets = chunks.map((c, i) =>
      `[${i}] (${c.metadata.category}) ${c.text.slice(0, 250)}`
    ).join('\n---\n');

    const result = await callLLM([
      {
        role: 'system',
        content: `你是搜索相关性评分专家。给定游客问题和检索到的文档片段，选出最相关的片段。

要求：
1. 评估每个片段与问题的相关性（考虑景点名称匹配、属性匹配、语义相关）
2. 返回最相关片段的序号，按相关性从高到低排列
3. 只返回序号，用逗号分隔，如：2,0,3,1,4
4. 只返回数字和逗号，不要其他内容`,
      },
      {
        role: 'user',
        content: `游客问题：${query}

候选片段：
${snippets}

请选出最相关的片段序号（从高到低排列）：`,
      },
    ], { temperature: 0.05, max_tokens: 30 });

    // Parse ranking
    const indices = (result || '').split(/[,，\s]+/)
      .map(s => parseInt(s.trim(), 10))
      .filter(n => !isNaN(n) && n >= 0 && n < chunks.length);

    if (indices.length >= 2) {
      const reranked = indices.map(i => chunks[i]);
      // Log the improvement for debugging
      const oldTop = chunks[0]?.text.slice(0, 40);
      const newTop = reranked[0]?.text.slice(0, 40);
      if (oldTop !== newTop) {
        console.log(`[RAG] Reranked: top result changed from "${oldTop}..." → "${newTop}..."`);
      }
      return { chunks: reranked, trace: createTraceStage(true, 'executed', undefined, { resultCount: reranked.length }) };
    }
    return { chunks, trace: createTraceStage(true, 'failed', 'invalid_response', { resultCount: chunks.length }) };
  } catch (e: any) {
    console.warn(`[RAG] Rerank failed: ${e.message?.slice(0, 80)}`);
    return { chunks, trace: createTraceStage(true, 'failed', 'llm_call_failed', { resultCount: chunks.length }) };
  }
}

async function rerankChunks(query: string, chunks: Chunk[]): Promise<Chunk[]> {
  return (await rerankChunksWithTrace(query, chunks, true)).chunks;
}

// ============================================================
// Main Query Functions
// ============================================================

/**
 * RAG query — vector search + LLM generation.
 */
export async function queryRAG(
  query: string,
  sessionId: string,
  configOverrides?: Partial<RAGExperimentConfig>,
): Promise<RAGResult> {
  const config = resolveRAGConfig(configOverrides);
  // 0. Rewrite query for better search precision
  const rewriteResult = await rewriteQueryWithTrace(query, config.enableQueryRewrite);
  const searchQuery = rewriteResult.query;

  // 1. Search for relevant chunks
  const searchResult = await searchChunksWithTrace(searchQuery, config.retrievalTopK, config);
  let chunks = searchResult.chunks;

  // 2. Rerank for relevance
  const rerankResult = await rerankChunksWithTrace(query, chunks, config.enableRerank); // use original query for relevance judgment
  chunks = rerankResult.chunks;
  const contextChunks = chunks.slice(0, config.contextTopK);
  const rerankedContext = buildRetrievedContext(contextChunks);
  const traceBase = {
    originalQuery: query,
    rewrittenQuery: searchQuery,
    retrievalMode: searchResult.mode,
    retrievedIds: searchResult.chunks.map(chunk => chunk.id),
    retrievedScores: searchResult.chunks.map(chunk => chunk.score || 0),
    retrievedDocuments: toEvidenceDocuments(searchResult.chunks),
    rerankEnabled: config.enableRerank,
    rerankedIds: chunks.map(chunk => chunk.id),
    contextIds: contextChunks.map(chunk => chunk.id),
    historyMessageCount: 0,
    fullKnowledgeIncluded: config.includeFullKnowledge,
    rewrite: rewriteResult.trace,
    retrieval: searchResult.trace,
    rerank: rerankResult.trace,
    generation: createTraceStage(true, 'skipped', 'not_started', { fallbackUsed: false }),
  } satisfies RAGTrace;

  // 3. If LLM available, use it for generation
  const llmAvailable = isLLMAvailable();
  if (llmAvailable) {
    const history = config.enableHistory ? getSessionHistory(sessionId) : [];
    traceBase.historyMessageCount = history.length;
    const messages = buildTourGuideMessages(query, rerankedContext, history.map(h => ({
      role: h.role as 'user' | 'assistant',
      content: h.content,
    })), { includeFullKnowledge: config.includeFullKnowledge });

    const answer = await callLLM(messages, { temperature: 0.3, max_tokens: 280 });

    if (answer) {
      traceBase.generation = createTraceStage(true, 'executed', undefined, { fallbackUsed: false });
      addToHistory(sessionId, 'user', query);
      addToHistory(sessionId, 'assistant', answer);

      return {
        answer,
        emotion: await detectEmotion(query, answer),
        relatedSpots: extractRelatedSpots(answer),
        usedLLM: true,
        retrievedChunks: chunks.length,
        trace: traceBase,
      };
    }
    traceBase.generation = createTraceStage(true, 'failed', 'llm_call_failed', { fallbackUsed: true });
  } else {
    traceBase.generation = createTraceStage(true, 'skipped', 'llm_unavailable', { fallbackUsed: true });
  }

  // 4. Fallback: use retrieved chunks directly
  let fallbackAnswer: string;
  if (chunks.length > 0) {
    fallbackAnswer = chunks.slice(0, 3).map(c => c.text).join('\n\n');
    fallbackAnswer = `关于您的问题"${query}"，以下是相关信息：\n\n${fallbackAnswer}\n\n💡 提示：接入AI大模型后可以获得更精准的个性化回答。`;
  } else {
    fallbackAnswer = `感谢您的提问！关于"${query}"，我目前的知识库中暂未收录详细信息。\n\n建议您：\n• 换一种方式描述问题\n• 咨询景区游客中心工作人员\n• 拨打景区服务热线`;
  }

  addToHistory(sessionId, 'user', query);
  addToHistory(sessionId, 'assistant', fallbackAnswer);

  return {
    answer: fallbackAnswer,
    emotion: await detectEmotion(query, fallbackAnswer),
    relatedSpots: extractRelatedSpots(fallbackAnswer),
    usedLLM: false,
    retrievedChunks: chunks.length,
    trace: traceBase,
  };
}

/**
 * Streaming RAG query for SSE.
 */
export async function* streamRAGQuery(
  query: string,
  sessionId: string,
  configOverrides?: Partial<RAGExperimentConfig>,
): AsyncGenerator<string> {
  const config = resolveRAGConfig(configOverrides);
  // 0. Rewrite query
  const searchQuery = config.enableQueryRewrite ? await rewriteQuery(query) : query;

  // 1. Search — fetch more for reranking
  const searchResult = await searchChunksWithTrace(searchQuery, config.retrievalTopK, config);
  let chunks = searchResult.chunks;

  // 2. Rerank
  if (config.enableRerank) chunks = await rerankChunks(query, chunks);
  const rerankedContext = buildRetrievedContext(chunks.slice(0, config.contextTopK));

  if (!isLLMAvailable()) {
    const result = await queryRAG(query, sessionId, config);
    addToHistory(sessionId, 'user', query);
    addToHistory(sessionId, 'assistant', result.answer);
    yield result.answer;
    return;
  }

  // 3. Stream LLM response with adequate token budget
  const history = config.enableHistory ? getSessionHistory(sessionId) : [];
  const messages = buildTourGuideMessages(query, rerankedContext, history.map(h => ({
    role: h.role as 'user' | 'assistant',
    content: h.content,
  })), { includeFullKnowledge: config.includeFullKnowledge });

  let fullAnswer = '';
  let hasContent = false;
  for await (const chunk of streamLLM(messages, { temperature: 0.3, max_tokens: 500 })) {
    fullAnswer += chunk;
    hasContent = true;
    yield chunk;
  }

  // 3. If LLM streaming produced nothing, fall back to non-streaming
  if (!hasContent) {
    console.warn('[RAG] LLM stream returned empty, falling back to non-streaming');
    const result = await queryRAG(query, sessionId, config);
    if (result.answer && result.answer !== fullAnswer) {
      fullAnswer = result.answer;
      yield result.answer;
    }
  }

  if (fullAnswer) {
    addToHistory(sessionId, 'user', query);
    addToHistory(sessionId, 'assistant', fullAnswer);
  }
}

/**
 * Re-index the knowledge base (for admin use).
 */
export async function reindexKnowledgeBase(): Promise<{ chunkCount: number; indexed: boolean }> {
  isIndexed = false;
  knowledgeChunks = [];
  // Clear cache
  try { fs.unlinkSync(CHUNKS_CACHE_FILE); } catch {}
  // Trigger vector rebuild and wait for it
  try {
    const { rebuildVectorIndex } = await import('./vector-search-service');
    await Promise.race([
      rebuildVectorIndex(),
      new Promise(r => setTimeout(r, 30000)),
    ]);
  } catch (e: any) {
    console.warn('[RAG] Vector rebuild failed:', e?.message);
  }
  return initKnowledgeBase();
}

/**
 * Get knowledge base stats.
 */
export function getKnowledgeStats(): { chunkCount: number; isIndexed: boolean; totalTextLength: number; vectorAvailable: boolean } {
  return {
    chunkCount: knowledgeChunks.length || 50,
    isIndexed,
    totalTextLength: knowledgeChunks.reduce((sum, c) => sum + c.text.length, 0),
    vectorAvailable: isVectorAvailable(),
  };
}
