import assert from 'node:assert/strict';
import { DEFAULT_RAG_CONFIG, resolveRAGConfig } from './rag-config';
import { buildTourGuideMessages } from './llm-service';
import { buildRetrievedContext, orderContextBySourceAuthority, selectContextChunks } from './rag-service';

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
assert.equal(retrievalOnlyMessages[0].content.includes('灵山胜境坐落于江苏省无锡市'), false);
assert.equal(retrievalOnlyMessages[0].content.includes('[片段1] 检索内容'), true);
assert.equal(retrievalOnlyMessages[0].content.includes('不同来源并且存在冲突'), true);
assert.equal(retrievalOnlyMessages[0].content.includes('knowledge_guide.txt'), true);

const evidenceContext = buildRetrievedContext([{
  id: 'guide-1',
  text: '总高27.5米，青铜重量260吨。',
  score: 1,
  metadata: { source: 'knowledge_guide.txt', category: '建筑参数', keywords: [] },
}]);
assert.equal(evidenceContext.includes('id=guide-1'), true);
assert.equal(evidenceContext.includes('source=knowledge_guide.txt'), true);

const orderedEvidence = orderContextBySourceAuthority([
  { id: 'structured-1', text: '结构化补充', score: 1, metadata: { source: 'structured_dataset', category: '参数', keywords: [] } },
  { id: 'guide-1', text: '指南事实', score: 1, metadata: { source: 'knowledge_guide.txt', category: '参数', keywords: [] } },
  { id: 'dataset-1', text: '数据集补充', score: 1, metadata: { source: 'knowledge_dataset.txt', category: '参数', keywords: [] } },
]);
assert.deepEqual(orderedEvidence.map(chunk => chunk.id), ['guide-1', 'dataset-1', 'structured-1']);

const contextWithReservedGuide = selectContextChunks([
  { id: 'dataset-1', text: '数据集事实', score: 1, metadata: { source: 'knowledge_dataset.txt', category: '参数', keywords: [] } },
  { id: 'structured-1', text: '结构化事实', score: 1, metadata: { source: 'structured_dataset', category: '参数', keywords: [] } },
  { id: 'guide-history', text: '灵山胜境历史背景', score: 1, metadata: { source: 'knowledge_guide.txt', category: '历史', keywords: [] } },
  { id: 'guide-1', text: '灵山胜境占地面积约30万平方米', score: 1, metadata: { source: 'knowledge_guide.txt', category: '概况', keywords: [] } },
], 2, '灵山胜境 占地面积');
assert.deepEqual(contextWithReservedGuide.map(chunk => chunk.id), ['guide-1', 'dataset-1']);

console.log('RAG config tests passed');
