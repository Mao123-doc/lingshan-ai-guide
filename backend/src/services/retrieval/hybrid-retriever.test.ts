import assert from 'node:assert/strict';
import {
  fuseCandidates,
  type RetrievalCandidate,
} from './hybrid-retriever';

const candidate = (
  id: string,
  channel: RetrievalCandidate['channel'],
  rank: number,
  text = id,
): RetrievalCandidate => ({
  canonicalId: id,
  dedupeKey: `text:${text}`,
  text,
  source: channel,
  channel,
  rank,
  rawScore: 1 / rank,
  metadata: {},
});

const vector = [candidate('shared', 'vector', 1), candidate('vector-2', 'vector', 2)];
const structured = [candidate('shared-structured', 'structured', 1, 'shared'), candidate('structured-2', 'structured', 2)];
const keyword = [candidate('keyword-1', 'keyword', 1)];

const result = fuseCandidates({ vector, structured, keyword });

assert.equal(result.candidates.length, 4);
assert.equal(result.ranked[0].dedupeKey, 'text:shared');
assert.equal(result.ranked[0].channels.includes('vector'), true);
assert.equal(result.ranked[0].channels.includes('structured'), true);
assert.equal(result.ranked[0].rrfScore, 2 / 61);
assert.deepEqual(result.channelCounts, { vector: 2, structured: 2, keyword: 1 });

console.log('Hybrid retrieval fusion tests passed');
