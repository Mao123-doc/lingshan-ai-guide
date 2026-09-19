import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { jsonBody, startTestServer } from '../helpers/api-fixtures';

async function login(server: Awaited<ReturnType<typeof startTestServer>>): Promise<string> {
  const response = await server.request('/api/v1/auth/login', jsonBody({ username: 'admin', password: 'lingshan2026' }));
  assert.equal(response.status, 200);
  return response.body.access_token;
}

test('knowledge documents can be uploaded, listed and deleted in isolated data root', async () => {
  const server = await startTestServer();
  try {
    const token = await login(server);
    const uploadBody = new FormData();
    uploadBody.append('file', new Blob([
      '这是一份足够长度的测试知识文档，用于验证上传、解析、列表和删除的完整数据生命周期。',
      '它包含景点事实、历史背景和服务说明，确保纯文本解析结果满足知识库索引的最小长度要求。',
    ], { type: 'text/plain' }), 'lifecycle.txt');

    const upload = await server.request('/api/v1/admin/knowledge/documents', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: uploadBody,
    });
    assert.equal(upload.status, 200);
    assert.equal(upload.body.status, 'indexed');
    assert.ok(upload.body.id);
    assert.ok(upload.body.docId);

    const listed = await server.request('/api/v1/admin/knowledge/documents', {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(listed.status, 200);
    assert.ok(listed.body.some((document: { id: string }) => document.id === upload.body.id));

    const deleted = await server.request(`/api/v1/admin/knowledge/documents/${upload.body.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(deleted.status, 200);
    assert.equal(fs.existsSync(path.join(server.dataRoot, 'uploads', upload.body.id)), false);
  } finally {
    await server.close();
  }
});

test('knowledge document deletion does not escape the isolated data root', async () => {
  const server = await startTestServer();
  try {
    const token = await login(server);
    const protectedFile = path.join(server.dataRoot, 'conversations.json');
    fs.writeFileSync(protectedFile, '[]', 'utf8');

    const response = await server.request('/api/v1/admin/knowledge/documents/..%2Fconversations.json', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(response.status, 404);
    assert.equal(fs.readFileSync(protectedFile, 'utf8'), '[]');
  } finally {
    await server.close();
  }
});
