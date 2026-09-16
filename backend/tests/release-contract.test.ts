import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

test('release evidence contracts are versioned and sanitized', () => {
  const root = path.resolve(__dirname, '../..');
  const runtimeDoc = path.join(root, 'docs', 'testing', 'runtime-smoke.md');
  const gateConfig = path.join(root, 'evaluation', 'retrieval', 'retrieval_gate_config.json');

  assert.equal(fs.existsSync(runtimeDoc), true);
  assert.equal(fs.existsSync(gateConfig), true);
  assert.match(fs.readFileSync(runtimeDoc, 'utf8'), /require-no-fallback/);
  assert.equal(JSON.parse(fs.readFileSync(gateConfig, 'utf8')).schema_version, 1);
});
