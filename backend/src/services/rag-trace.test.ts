import assert from 'node:assert/strict';
import {
  createTraceStage,
  createRetrievalTrace,
} from './rag-service';

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

console.log('RAG trace tests passed');
