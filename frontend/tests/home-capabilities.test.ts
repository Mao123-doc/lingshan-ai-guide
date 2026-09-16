import assert from 'node:assert/strict';
import test from 'node:test';
import { getCapabilityRoute } from '../src/pages/visitor/home-capabilities.ts';

test('maps each home capability card to its visitor experience', () => {
  assert.equal(getCapabilityRoute('智能问答'), '/qa');
  assert.equal(getCapabilityRoute('多模态交互'), '/qa');
  assert.equal(getCapabilityRoute('个性化推荐'), '/recommend');
  assert.equal(getCapabilityRoute('情感互动'), '/qa');
});
