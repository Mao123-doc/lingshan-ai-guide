import assert from 'node:assert/strict';
import {
  createTraceStage,
  createRetrievalTrace,
  createParallelRetrievalTrace,
  toEvidenceDocuments,
} from './rag-service';

assert.deepEqual(toEvidenceDocuments([
  {
    id: 'chunk_1',
    text: '证据文本',
    score: 0.9,
    metadata: { source: 'knowledge_dataset.txt', category: '景点数据', keywords: ['灵山大佛'] },
  },
]), [{
  id: 'chunk_1',
  text: '证据文本',
  score: 0.9,
  source: 'knowledge_dataset.txt',
  category: '景点数据',
  keywords: ['灵山大佛'],
}]);

const skippedRerank = createTraceStage(true, 'skipped', 'llm_unavailable');
assert.deepEqual(skippedRerank, {
  configured: true,
  executed: false,
  status: 'skipped',
  reason: 'llm_unavailable',
});

const disabledRerank = createTraceStage(false, 'skipped', 'disabled');
assert.deepEqual(disabledRerank, {
  configured: false,
  executed: false,
  status: 'skipped',
  reason: 'disabled',
});

const failedRetrieval = createTraceStage(true, 'failed', 'request_failed');
assert.equal(failedRetrieval.executed, true);
assert.equal(failedRetrieval.status, 'failed');

const modelIdentity = createTraceStage(true, 'executed', undefined, {
  modelIdentity: {
    status: 'mismatch',
    requestedModel: 'deepseek-chat',
    providerModel: 'deepseek-flash',
  },
});
assert.equal(modelIdentity.modelIdentity?.status, 'mismatch');
assert.equal(modelIdentity.modelIdentity?.providerModel, 'deepseek-flash');

const structuredFallback = createRetrievalTrace({
  vector: { configured: true, outcome: 'unavailable' },
  structured: { configured: true, resultCount: 5 },
  keyword: { configured: true },
});
assert.equal(structuredFallback.vector.status, 'skipped');
assert.equal(structuredFallback.vector.executed, false);
assert.equal(structuredFallback.vector.reason, 'service_unavailable');
assert.equal(structuredFallback.structured.status, 'executed');
assert.equal(structuredFallback.structured.executed, true);
assert.equal(structuredFallback.structured.resultCount, 5);
assert.equal(structuredFallback.keyword.status, 'skipped');
assert.equal(structuredFallback.keyword.reason, 'previous_stage_returned_results');

const keywordFallback = createRetrievalTrace({
  vector: { configured: true, outcome: 'unavailable' },
  structured: { configured: true, resultCount: 0 },
  keyword: { configured: true, resultCount: 3 },
});
assert.equal(keywordFallback.structured.status, 'executed');
assert.equal(keywordFallback.structured.executed, true);
assert.equal(keywordFallback.structured.resultCount, 0);
assert.equal(keywordFallback.keyword.status, 'executed');
assert.equal(keywordFallback.keyword.executed, true);
assert.equal(keywordFallback.keyword.resultCount, 3);

const parallelRetrieval = createParallelRetrievalTrace({
  vector: { configured: true, outcome: 'executed', resultCount: 2 },
  structured: { configured: true, outcome: 'executed', resultCount: 3 },
  keyword: { configured: true, outcome: 'executed', resultCount: 1 },
}, {
  method: 'rrf',
  k: 60,
  inputCounts: { vector: 2, structured: 3, keyword: 1 },
  candidateCount: 5,
});
assert.equal(parallelRetrieval.vector.status, 'executed');
assert.equal(parallelRetrieval.vector.executed, true);
assert.equal(parallelRetrieval.structured.status, 'executed');
assert.equal(parallelRetrieval.structured.executed, true);
assert.equal(parallelRetrieval.keyword.status, 'executed');
assert.equal(parallelRetrieval.keyword.executed, true);
assert.deepEqual(parallelRetrieval.fusion, {
  method: 'rrf',
  k: 60,
  inputCounts: { vector: 2, structured: 3, keyword: 1 },
  candidateCount: 5,
});

const unavailableParallelRetrieval = createParallelRetrievalTrace({
  vector: { configured: true, outcome: 'unavailable', reason: 'service_unavailable' },
  structured: { configured: true, outcome: 'executed', resultCount: 0 },
  keyword: { configured: false },
});
assert.equal(unavailableParallelRetrieval.vector.status, 'failed');
assert.equal(unavailableParallelRetrieval.vector.executed, true);
assert.equal(unavailableParallelRetrieval.vector.reason, 'service_unavailable');
assert.equal(unavailableParallelRetrieval.structured.status, 'executed');
assert.equal(unavailableParallelRetrieval.keyword.status, 'skipped');

console.log('RAG trace tests passed');
