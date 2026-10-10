import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { jsonBody, startTestServer, waitForFile } from './helpers/api-fixtures';

test('core question answering persists only in the isolated DATA_ROOT', async () => {
  const formalRoot = path.resolve(__dirname, '../../data');
  const names = ['conversations.json', 'feedback.json', 'daily_stats.json', 'dh_config.json'];
  const snapshot = (name: string) => fs.existsSync(path.join(formalRoot, name)) ? fs.readFileSync(path.join(formalRoot, name)) : undefined;
  const before = names.map(snapshot);
  const server = await startTestServer();
  try {
    const answer = await server.request('/api/v1/visitor/qa', jsonBody({ query: '灵山大佛有多高？', session_id: 'isolated' }));
    assert.equal(answer.status, 200);
    const file = path.join(server.dataRoot, 'conversations.json');
    await waitForFile(file);
    const records = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(records.length, 1);
    assert.equal(records[0].session_id, 'isolated');
    assert.equal(records[0].answer, answer.body.answer);
    for (const retired of names.slice(1)) assert.equal(fs.existsSync(path.join(server.dataRoot, retired)), false);
  } finally { await server.close(); }
  assert.deepEqual(names.map(snapshot), before);
});
