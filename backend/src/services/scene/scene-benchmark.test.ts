import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { extractSceneState } from './scene-state';

type Case = {
  id: string;
  category: string;
  query: string;
  expected: Record<string, unknown>;
};

const fixturePath = path.resolve(__dirname, '../../../../evaluation/scene/scene_gold_v1.json');
const cases = JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as Case[];
assert.equal(cases.length, 40);

const fields = Object.keys(cases[0].expected);
const fieldTotals = new Map<string, { correct: number; total: number }>();
const failures: string[] = [];

for (const item of cases) {
  const actual = extractSceneState(item.query) as Record<string, unknown>;
  for (const field of Object.keys(item.expected)) {
    const expected = item.expected[field];
    const result = fieldTotals.get(field) || { correct: 0, total: 0 };
    result.total += 1;
    if (JSON.stringify(actual[field]) === JSON.stringify(expected)) {
      result.correct += 1;
    } else {
      failures.push(`${item.id}.${field}: expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual[field])}`);
    }
    fieldTotals.set(field, result);
  }
}

assert.deepEqual(failures, [], failures.join('\n'));
const total = [...fieldTotals.values()].reduce((sum, value) => sum + value.total, 0);
const correct = [...fieldTotals.values()].reduce((sum, value) => sum + value.correct, 0);
assert.ok(correct / total >= 0.9, `field accuracy ${(correct / total).toFixed(3)} < 0.9`);
console.log(JSON.stringify({ cases: cases.length, fieldAccuracy: correct / total, fields: Object.fromEntries(fieldTotals) }));
console.log('Scene benchmark passed');
