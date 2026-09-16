import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { apiRouter } from './api/v1/router';
import { getKnowledgeStats } from './services/rag-service';
import { isLLMAvailable, getActiveModelName } from './services/llm-service';
import { getIndexStats } from './services/structured-knowledge';
import { resolveDataPath } from './config/paths';

export function createApp(): Express {
  const app = express();

  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));
  app.use(cors());
  app.use(morgan('dev'));
  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.use('/uploads', express.static(resolveDataPath('uploads')));
  app.use(express.static(path.resolve(__dirname, '../../frontend/dist')));
  app.use('/api/v1', apiRouter);

  app.get('/health', (_req, res) => {
    const kb = getKnowledgeStats();
    const structured = getIndexStats();
    res.json({
      status: 'ok',
      service: '灵山胜境 AI 数字人导游',
      version: '2.2.0',
      llm: isLLMAvailable() ? getActiveModelName() : 'offline',
      knowledge_chunks: kb.chunkCount,
      knowledge_indexed: kb.isIndexed,
      vector_search: kb.vectorAvailable,
      structured_spots: structured.spotCount,
      structured_fields: structured.fieldDocCount,
    });
  });

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) return next();
    res.sendFile(path.resolve(__dirname, '../../frontend/dist/index.html'));
  });

  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: '服务器内部错误', detail: err.message });
  });

  return app;
}

export const app = createApp();
