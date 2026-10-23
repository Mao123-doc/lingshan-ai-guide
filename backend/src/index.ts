import path from 'path';
import dotenv from 'dotenv';
import { WebSocketServer } from 'ws';
import { app } from './app';
import { initKnowledgeBase } from './services/rag-service';
import { isLLMAvailable, getActiveModelName } from './services/llm-service';
import { addClient } from './services/websocket-service';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const PORT = parseInt(process.env.PORT || '8010');
const server = app.listen(PORT, async () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════════════════╗');
  console.log('  ║  🏯 灵山胜境 AI 数字人导游系统  v2.2              ║');
  console.log('  ║                                                  ║');
  console.log(`  ║  游客端:    http://localhost:${PORT}                 ║`);
  console.log(`  ║  管理后台:  http://localhost:${PORT}/admin/login     ║`);
  console.log(`  ║  API:       http://localhost:${PORT}/api/v1          ║`);
  console.log(`  ║  Health:    http://localhost:${PORT}/health          ║`);
  console.log('  ║                                                  ║');
  console.log(`  ║  LLM:       ${isLLMAvailable() ? getActiveModelName() : '离线模式'}  ║`);
  console.log('  ║  默认账号:  admin / lingshan2026                 ║');
  console.log('  ╚══════════════════════════════════════════════════╝');
  console.log('');

  console.log('[Init] 正在初始化知识库...');
  initKnowledgeBase().then(result => {
    console.log(`[Init] 知识库就绪：${result.chunkCount} 个分块，向量索引：${result.indexed ? '✅' : '⚠️ 未启用（使用关键词匹配）'}`);
  }).catch(err => console.error('[Init] 知识库初始化失败:', err));
});

const wss = new WebSocketServer({ server, path: '/ws' });
wss.on('connection', (ws) => {
  const heartbeat = setInterval(() => {
    if (ws.readyState === ws.OPEN) ws.ping();
    else clearInterval(heartbeat);
  }, 30000);

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'subscribe_admin') {
        addClient(ws, 'admin');
        ws.send(JSON.stringify({ type: 'connected', role: 'admin', message: '管理端实时连接已建立' }));
      } else if (msg.type === 'subscribe_visitor') {
        addClient(ws, 'visitor');
        ws.send(JSON.stringify({ type: 'connected', role: 'visitor', message: '游客端连接已建立' }));
      }
    } catch {
      addClient(ws, 'visitor');
      ws.send(JSON.stringify({ type: 'connected', role: 'visitor', message: 'WebSocket 连接成功' }));
    }
  });

  ws.on('close', () => clearInterval(heartbeat));
  ws.on('error', () => clearInterval(heartbeat));
});

process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught exception:', err.message);
  console.error(err.stack);
});
process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled rejection:', reason);
});

export { app, server };
