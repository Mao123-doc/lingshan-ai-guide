import { createServer, type Server } from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export type TestServer = {
  dataRoot: string;
  baseUrl: string;
  request: (endpoint: string, init?: RequestInit) => Promise<{ status: number; headers: Headers; body: any; rawBody: Uint8Array }>;
  close: () => Promise<void>;
};

export async function startTestServer(): Promise<TestServer> {
  const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lingshan-api-test-'));
  process.env.DATA_ROOT = dataRoot;
  const rawRoot = path.join(dataRoot, 'raw');
  fs.mkdirSync(rawRoot, { recursive: true });
  fs.writeFileSync(path.join(rawRoot, 'knowledge_guide.txt'), '灵山胜境测试知识库。灵山大佛位于无锡，测试内容用于隔离索引重建。');
  fs.writeFileSync(path.join(rawRoot, 'knowledge_dataset.txt'), '景点：灵山大佛；高度：88米；区域：灵山胜境。');
  delete process.env.DEEPSEEK_API_KEY;
  delete process.env.AGNES_API_KEY;

  const vectorStub = createServer((request, response) => {
    response.setHeader('Content-Type', 'application/json');
    response.setHeader('Connection', 'close');
    if (request.url === '/health') {
      response.end(JSON.stringify({ status: 'ok', chunks: 1, model: 'test-vector' }));
      return;
    }
    if (request.url === '/rebuild') {
      response.end(JSON.stringify({ status: 'ok', chunks: 1 }));
      return;
    }
    response.end(JSON.stringify({ results: [], query: '', count: 0 }));
  });
  await new Promise<void>(resolve => vectorStub.listen(0, '127.0.0.1', () => resolve()));
  const vectorAddress = vectorStub.address();
  if (!vectorAddress || typeof vectorAddress === 'string') throw new Error('vector stub did not expose a port');
  process.env.VECTOR_SERVICE_URL = `http://127.0.0.1:${vectorAddress.port}`;

  const { createApp } = await import('../../src/app');
  const server: Server = createServer(createApp());
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('test server did not expose a port');
  const baseUrl = `http://127.0.0.1:${address.port}`;

  return {
    dataRoot,
    baseUrl,
    request: async (endpoint, init = {}) => {
      const headers = new Headers(init.headers);
      headers.set('Connection', 'close');
      const response = await fetch(`${baseUrl}${endpoint}`, { ...init, headers });
      const contentType = response.headers.get('content-type') || '';
      const rawBody = new Uint8Array(await response.arrayBuffer());
      const body = contentType.includes('application/json')
        ? JSON.parse(new TextDecoder().decode(rawBody))
        : new TextDecoder().decode(rawBody);
      return { status: response.status, headers: response.headers, body, rawBody };
    },
    close: async () => {
      server.closeAllConnections?.();
      vectorStub.closeAllConnections?.();
      await new Promise<void>(resolve => server.close(() => resolve()));
      await new Promise<void>(resolve => vectorStub.close(() => resolve()));
      fs.rmSync(dataRoot, { recursive: true, force: true });
      delete process.env.DATA_ROOT;
      delete process.env.VECTOR_SERVICE_URL;
    },
  };
}

export function jsonBody(value: unknown): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  };
}

export async function waitForFile(filePath: string): Promise<void> {
  const deadline = Date.now() + 2_000;
  while (Date.now() < deadline) {
    if (fs.existsSync(filePath)) return;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  throw new Error(`Timed out waiting for ${filePath}`);
}
