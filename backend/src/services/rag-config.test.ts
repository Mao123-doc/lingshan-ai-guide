import assert from 'node:assert/strict';
import { DEFAULT_RAG_CONFIG, resolveRAGConfig } from './rag-config';
import { buildTourGuideMessages } from './llm-service';

const defaults = resolveRAGConfig();
assert.deepEqual(defaults, DEFAULT_RAG_CONFIG);
assert.equal(defaults.enableQueryRewrite, true);
assert.equal(defaults.enableHistory, true);
assert.equal(defaults.includeFullKnowledge, true);
assert.equal(defaults.retrievalTopK, 8);
assert.equal(defaults.contextTopK, 5);

const ablation = resolveRAGConfig({
  enableVectorRetrieval: false,
  enableRerank: false,
  enableHistory: false,
  includeFullKnowledge: false,
  retrievalTopK: 3,
  contextTopK: 2,
});
assert.equal(ablation.enableVectorRetrieval, false);
assert.equal(ablation.enableRerank, false);
assert.equal(ablation.enableHistory, false);
assert.equal(ablation.includeFullKnowledge, false);
assert.equal(ablation.retrievalTopK, 3);
assert.equal(ablation.contextTopK, 2);
assert.equal(ablation.enableStructuredRetrieval, true);
assert.equal(ablation.enableKeywordRetrieval, true);

assert.throws(() => resolveRAGConfig({ retrievalTopK: 0 }), /retrievalTopK/);
assert.throws(() => resolveRAGConfig({ contextTopK: -1 }), /contextTopK/);

const retrievalOnlyMessages = buildTourGuideMessages(
  '测试问题',
  '[片段1] 检索内容',
  [],
  { includeFullKnowledge: false },
);
assert.equal(retrievalOnlyMessages.length, 2);
assert.equal(retrievalOnlyMessages[0].content.includes('景区指南'), false);
assert.equal(retrievalOnlyMessages[0].content.includes('[片段1] 检索内容'), true);

console.log('RAG config tests passed');
