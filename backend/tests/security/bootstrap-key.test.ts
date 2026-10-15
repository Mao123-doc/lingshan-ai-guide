import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import jwt from 'jsonwebtoken';
import { createServer } from 'node:net';

test('production bootstrap loads the .env signing key before importing authentication', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lingshan-bootstrap-'));
  const project = path.resolve(__dirname, '../..');
  fs.cpSync(path.join(project, 'src'), path.join(root, 'backend/src'), { recursive: true });
  fs.mkdirSync(path.join(root, 'data'), { recursive: true });
  fs.writeFileSync(path.join(root, '.env'), 'SECRET_KEY=public-regression-key\nADMIN_PASSWORD=public-regression-password\n');
  fs.symlinkSync(path.join(project, 'node_modules'), path.join(root, 'backend/node_modules'), 'junction');
  const probe = createServer();
  await new Promise<void>(resolve => probe.listen(0, '127.0.0.1', resolve));
  const address = probe.address();
  assert.ok(address && typeof address !== 'string');
  const selectedPort = address.port;
  await new Promise<void>(resolve => probe.close(() => resolve()));
  const env = { ...process.env, PORT: String(selectedPort), VECTOR_SERVICE_URL: 'http://127.0.0.1:1', DATA_ROOT: path.join(root, 'data'), ADMIN_USERNAME: 'admin' };
  delete env.SECRET_KEY;
  delete env.ADMIN_PASSWORD;
  delete env.DEEPSEEK_API_KEY;
  delete env.AGNES_API_KEY;
  const child = spawn(process.execPath, [path.join(project, 'node_modules/tsx/dist/cli.mjs'), path.join(root, 'backend/src/index.ts')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    const port = await new Promise<number>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('bootstrap did not expose a port')), 10000);
      let output = '';
      child.stdout.on('data', data => {
        output += String(data);
        const match = output.match(/http:\/\/localhost:(\d+)/);
        if (match && Number(match[1]) > 0) { clearTimeout(timer); resolve(Number(match[1])); }
      });
      child.once('exit', () => { clearTimeout(timer); reject(new Error('bootstrap exited before ready')); });
    });
    const response = await fetch(`http://127.0.0.1:${port}/api/v1/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'public-regression-password' }),
    });
    assert.equal(response.status, 200);
    const result = await response.json() as { access_token: string };
    assert.doesNotThrow(() => jwt.verify(result.access_token, 'public-regression-key'));
    assert.throws(() => jwt.verify(result.access_token, 'SUBMISSION_SECRET_PLACEHOLDER'));
  } finally {
    child.kill();
    await new Promise<void>(resolve => child.exitCode !== null ? resolve() : child.once('exit', () => resolve()));
    fs.unlinkSync(path.join(root, 'backend/node_modules'));
    fs.rmSync(root, { recursive: true, force: true });
  }
});
