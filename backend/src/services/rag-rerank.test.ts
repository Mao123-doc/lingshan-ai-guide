import assert from 'node:assert/strict';
import { parseRerankOrder } from './rag-service';

assert.deepEqual(parseRerankOrder('7', 8), {
  indices: [7, 0, 1, 2, 3, 4, 5, 6],
  validCount: 1,
});
assert.deepEqual(parseRerankOrder('7,7,100,2', 8), {
  indices: [7, 2, 0, 1, 3, 4, 5, 6],
  validCount: 2,
});
assert.deepEqual(parseRerankOrder('0,2,1', 3), {
  indices: [0, 2, 1],
  validCount: 3,
});
assert.deepEqual(parseRerankOrder('not a ranking', 8), {
  indices: [0, 1, 2, 3, 4, 5, 6, 7],
  validCount: 0,
});

console.log('RAG rerank parsing tests passed');
