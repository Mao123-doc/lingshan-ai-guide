import assert from 'node:assert/strict';
import { searchStructured } from './structured-knowledge';

const architectureResults = searchStructured('五智门 建筑特点', 5);
assert.equal(
  architectureResults.some(result => result.spotId === 'LS-004' && result.fieldName === 'params'),
  true,
  '建筑特点问题必须召回目标景点的建筑/景观参数字段',
);

const architectureFacts = architectureResults
  .filter(result => result.spotId === 'LS-004')
  .map(result => result.text)
  .join('\n');
assert.equal(architectureFacts.includes('五方五佛'), true);

console.log('Structured knowledge tests passed');
