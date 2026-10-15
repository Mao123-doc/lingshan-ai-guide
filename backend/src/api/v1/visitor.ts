import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { queryRAG, getKnowledgeStats } from '../../services/rag-service';
import type { RAGExperimentConfig } from '../../services/rag-config';
import { isLLMAvailable, getActiveModelName } from '../../services/llm-service';
import { planRouteRequest, RoutePlanningInputError, type RoutePlanningRequest } from '../../services/route/route-planning-service';
import { saveConversation } from '../../db/store';
import { loadRouteGraph } from '../../services/route/route-contract';

const visitorRouter = Router();
visitorRouter.get('/route/graph', (_req, res) => {
  res.json({ ...loadRouteGraph(), coordinate_reference: 'existing_dataset', notice: '路网属性含估算值；坐标未声明为现场测绘。' });
});

// ============ Q&A (with SSE streaming) ============

visitorRouter.post('/qa', async (req: Request, res: Response) => {
  try {
    const { query, session_id, evaluation_config } = req.body;
    if (typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({ error: '请输入问题' });
    }

    const sessionId = session_id || uuidv4();
    const startTime = Date.now();

    const conversationId = uuidv4();
    const acceptSSE = req.headers.accept?.includes('text/event-stream');
    if (acceptSSE) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();
      res.write(`data: ${JSON.stringify({ type: 'session', session_id: sessionId })}\n\n`);
    }
    const result = await queryRAG(query, sessionId, evaluation_config as Partial<RAGExperimentConfig> | undefined,
      acceptSSE ? (content) => { if (!res.destroyed) res.write(`data: ${JSON.stringify({ type: 'chunk', content })}\n\n`); } : undefined);
    const elapsed = Date.now() - startTime;
    await saveConversation({
      id: conversationId, session_id: sessionId, timestamp: new Date().toISOString(),
      query, answer: result.answer, emotion: result.emotion,
      used_llm: result.usedLLM, response_time_ms: elapsed,
    });
    const payload = {
      answer: result.answer, conversation_id: conversationId, session_id: sessionId,
      emotion: result.emotion, related_spots: result.relatedSpots, used_llm: result.usedLLM,
      model: getActiveModelName(), retrieved_chunks: result.retrievedChunks,
      response_time_ms: elapsed, evaluation_trace: result.trace,
    };
    if (res.destroyed) return;
    if (acceptSSE) {
      res.write(`data: ${JSON.stringify({ type: 'done', ...payload })}\n\n`);
      res.end();
    } else res.json(payload);
  } catch (error: any) {
    console.error('QA error:', error);
    if (res.headersSent) {
      if (!res.destroyed) res.end(`data: ${JSON.stringify({ type: 'error', error: '问答处理失败，请重试' })}\n\n`);
    } else res.status(500).json({ error: '问答处理失败' });
  }
});

// ============ Session ============

visitorRouter.post('/session/init', (_req: Request, res: Response) => {
  const sessionId = uuidv4();
  res.json({
    session_id: sessionId,
    welcome_message: '您好！我是灵山胜境的可信文旅助手「灵小禅」🌸\n\n我可以为您讲解景区历史、推荐游览路线、回答各种问题。\n请问有什么可以帮您的？',
    llm_available: isLLMAvailable(),
    model: getActiveModelName(),
  });
});

async function handleRoutePlan(request: RoutePlanningRequest, res: Response): Promise<void> {
  try {
    const result = await planRouteRequest(request);
    res.json({
      ...result,
      scene_extraction: result.scene_extraction,
    });
  } catch (error: unknown) {
    if (error instanceof RoutePlanningInputError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('Route planning error:', error);
    res.status(400).json({ error: '路线需求无法解析', detail: 'invalid_request' });
  }
}

visitorRouter.post('/route/plan', async (req: Request, res: Response) => {
  await handleRoutePlan(req.body || {}, res);
});

visitorRouter.post('/recommend', async (req: Request, res: Response) => {
  res.setHeader('Deprecation', 'true');
  const body = req.body || {};
  const interests = Array.isArray(body.interests) && body.interests.length > 0 ? body.interests : ['文化'];
  const duration = typeof body.duration === 'number' ? body.duration : undefined;
  const sceneState = {
    ...(typeof body.currentLocation === 'string' ? { currentLocation: body.currentLocation } : {}),
    ...(typeof body.currentTime === 'string' ? { currentTime: body.currentTime } : {}),
    ...(duration !== undefined ? { remainingMinutes: Math.round(duration * 60) } : {}),
    ...(body.mobility !== undefined ? { mobility: body.mobility } : {}),
    ...(body.pace !== undefined ? { pace: body.pace } : {}),
    ...(body.travelType !== undefined ? { partyType: body.travelType } : {}),
    interests,
    mustVisitSpotIds: Array.isArray(body.mustVisitSpotIds) ? body.mustVisitSpotIds : [],
    preferredPerformanceIds: Array.isArray(body.preferredPerformanceIds) ? body.preferredPerformanceIds : [],
    visitedSpotIds: Array.isArray(body.visitedSpotIds) ? body.visitedSpotIds : [],
    missingCriticalFields: [],
  };
  await handleRoutePlan({
    scene_state: sceneState as RoutePlanningRequest['scene_state'],
    advisory_profile: {
      ...(body.ageGroup ? { ageGroup: body.ageGroup } : {}),
      ...(body.budget ? { budget: body.budget } : {}),
    },
  }, res);
});

visitorRouter.get('/status', (_req: Request, res: Response) => {
  const kb = getKnowledgeStats();
  res.json({ llm_available: isLLMAvailable(), model: getActiveModelName(), knowledge_chunks: kb.chunkCount, knowledge_indexed: kb.isIndexed });
});

export { visitorRouter };
