import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

async function waitForFile(filePath: string): Promise<void> {
  const deadline = Date.now() + 2_000;
  while (Date.now() < deadline) {
    if (fs.existsSync(filePath)) return;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  throw new Error(`Timed out waiting for ${filePath}`);
}

test('createApp can run against DATA_ROOT without modifying formal data', async () => {
  const formalDataRoot = path.resolve(__dirname, '../../data');
  const formalFiles = ['conversations.json', 'feedback.json', 'daily_stats.json', 'dh_config.json'];
  const formalSnapshots = new Map(formalFiles.map(name => {
    const filePath = path.join(formalDataRoot, name);
    return [name, fs.existsSync(filePath) ? fs.readFileSync(filePath) : undefined] as const;
  }));
  const temporaryDataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lingshan-test-'));
  process.env.DATA_ROOT = temporaryDataRoot;
  fs.writeFileSync(path.join(temporaryDataRoot, 'dh_config.json'), JSON.stringify({
    style_preset: 'isolated_test',
    voice_id: 'isolated-voice',
  }));

  let server: ReturnType<typeof createServer> | undefined;
  try {
    const { createApp } = await import('../src/app');
    const app = createApp();
    server = createServer(app);

    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()));
    const address = server.address();
    assert.ok(address && typeof address === 'object');

    const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/visitor/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: 'isolation-session', rating: 5, comment: 'isolated' }),
    });
    assert.equal(response.status, 200);

    const feedbackPath = path.join(temporaryDataRoot, 'feedback.json');
    await waitForFile(feedbackPath);
    const feedback = JSON.parse(fs.readFileSync(feedbackPath, 'utf8')) as Array<{ session_id: string }>;
    assert.equal(feedback.length, 1);
    assert.equal(feedback[0].session_id, 'isolation-session');

    const dhResponse = await fetch(`http://127.0.0.1:${address.port}/api/v1/visitor/dh-config`);
    assert.equal(dhResponse.status, 200);
    assert.deepEqual(await dhResponse.json(), {
      style_preset: 'isolated_test',
      voice_id: 'isolated-voice',
    });

  } finally {
    if (server) await new Promise<void>(resolve => server?.close(() => resolve()));
    delete process.env.DATA_ROOT;
    fs.rmSync(temporaryDataRoot, { recursive: true, force: true });
  }

  for (const [name, snapshot] of formalSnapshots) {
    const filePath = path.join(formalDataRoot, name);
    const current = fs.existsSync(filePath) ? fs.readFileSync(filePath) : undefined;
    assert.deepEqual(current, snapshot, `${name} changed during isolated test`);
  }
});
