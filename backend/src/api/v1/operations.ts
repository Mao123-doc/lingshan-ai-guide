import { Router } from 'express';
import { z } from 'zod';
import { analyzeEmotion } from '../../services/emotion-service';
import * as ops from '../../services/operations-service';
export const operationsRouter = Router();
operationsRouter.get('/dashboard/summary', (_req, res) => res.json(ops.summary()));
function filtered(query: Record<string, unknown>) {
    const feedback = ops.feedbacks();
    return ops.conversations().map(r => ({
        ...r,
        category: ops.category(r.query),
        feedback: feedback.find(f => f.conversation_id === r.id) ? (feedback.find(f => f.conversation_id === r.id)!.rating >= 4 ? 'helpful' : feedback.find(f => f.conversation_id === r.id)!.rating <= 2 ? 'unhelpful' : 'neutral') : undefined
    })).filter(r => (!query.keyword || `${r.query} ${r.answer}`.includes(String(query.keyword))) && (!query.category || r.category === query.category) && (!query.session_id || r.session_id === query.session_id) && (!query.feedback || r.feedback === query.feedback) && (!query.start_date || r.timestamp >= String(query.start_date)) && (!query.end_date || r.timestamp <= `${query.end_date}T23:59:59.999Z`)).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}
operationsRouter.get('/conversations/export', (req, res) => {
    const rows = filtered(req.query);
    const cell = (v: unknown) => `"${String(v ?? '').replace(/^[=+@-]/, "'$&").replace(/"/g, '""')}"`;
    res.type('text/csv').attachment('conversations.csv').send('\uFEFF' + [['id', 'timestamp', 'session_id', 'category', 'query', 'answer', 'feedback'].join(','), ...rows.map(r => [r.id, r.timestamp, r.session_id, r.category, r.query, r.answer, r.feedback].map(cell).join(','))].join('\r\n'));
});
operationsRouter.get('/conversations', (req, res) => {
    const parsed = z.object({
        page: z.coerce.number().int().min(1).max(1000000).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(20)
    }).safeParse(req.query);
    if (!parsed.success) {
        res.status(400).json({
            error: '分页参数无效'
        });
        return;
    }
    const { page, pageSize } = parsed.data, items = filtered(req.query);
    res.json({
        items: items.slice((page - 1) * pageSize, page * pageSize),
        total: items.length,
        page,
        pageSize
    });
});
operationsRouter.get('/top-unsatisfied', (_req, res) => res.json(filtered({
    feedback: 'unhelpful'
}).slice(0, 20)));
operationsRouter.get('/visitor-locations', (_req, res) => res.json([]));
operationsRouter.get('/category-distribution', (_req, res) => {
    const counts: Record<string, number> = {};
    ops.conversations().forEach(r => {
        const c = ops.category(r.query);
        counts[c] = (counts[c] || 0) + 1;
    });
    res.json(counts);
});
operationsRouter.get('/reports/sentiment', (req, res) => {
    const period = String(req.query.period || 'week');
    if (!['day', 'week', 'month'].includes(period)) {
        res.status(400).json({
            error: '周期无效'
        });
        return;
    }
    // Periods follow the dashboard's China local calendar labels.
    const chinaNow = new Date(Date.now() + 8 * 3600000);
    const periodStart = new Date(Date.UTC(chinaNow.getUTCFullYear(), chinaNow.getUTCMonth(), chinaNow.getUTCDate()));
    if (period === 'week') periodStart.setUTCDate(periodStart.getUTCDate() - (periodStart.getUTCDay() + 6) % 7);
    if (period === 'month') periodStart.setUTCDate(1);
    const cutoff = periodStart.getTime() - 8 * 3600000, records = ops.conversations().filter(r => Date.parse(r.timestamp) >= cutoff), feedback = ops.feedbacks().filter(f => records.some(r => r.id === f.conversation_id));
    const counts = {
        positive: 0,
        neutral: 0,
        negative: 0
    };
    records.forEach(r => counts[ops.sentiment(r, feedback)]++);
    const pct = (n: number) => records.length ? Math.round(n / records.length * 1000) / 10 : 0;
    res.json({
        period,
        total_queries: records.length,
        feedback_count: feedback.length,
        avg_sentiment: records.length ? pct(counts.positive + counts.neutral * 0.5) : 0,
        sentiment_distribution: {
            positive: pct(counts.positive),
            neutral: pct(counts.neutral),
            negative: pct(counts.negative)
        },
        hot_questions: ops.hotQuestions(records),
        top_spots: ops.spots().map(s => ({
            name: s.name,
            mention_count: records.filter(r => r.query.includes(s.name)).length
        })).filter(s => s.mention_count > 0).sort((a, b) => b.mention_count - a.mention_count),
        summary: records.length ? `本周期共 ${records.length} 条真实问答、${feedback.length} 条明确反馈。情感分类优先采用评分，其余采用回答审计中的情绪标签；不等同于满意度调查。` : '当前周期没有问答记录。',
        method: 'explicit_feedback_then_recorded_emotion'
    });
});
operationsRouter.post('/reports/analyze-sentiment', async (req, res, next) => {
    const input = z.object({
        text: z.string().trim().min(1).max(4000)
    }).safeParse(req.body);
    if (!input.success) {
        res.status(400).json({
            error: 'text 无效'
        });
        return;
    }
    try {
        res.json({
            emotion: await analyzeEmotion(input.data.text),
            method: 'configured_llm_or_keyword_fallback'
        });
    }
    catch (e) {
        next(e);
    }
});
operationsRouter.get('/digital-human/appearance', (_req, res) => res.json(ops.appearance()));
const appearanceSchema = z.object({
    name: z.string().trim().min(1).max(30).optional(),
    style_preset: z.enum(['zen_red_gold', 'celadon_elegance', 'tang_splendor', 'ink_wash']).optional(),
    voice_id: z.string().trim().min(1).max(300).optional(),
    voice_speed: z.number().min(0.5).max(2).optional(),
    voice_pitch: z.number().min(0.5).max(2).optional()
}).strict().refine(v => Object.keys(v).length > 0);
operationsRouter.put('/digital-human/appearance', (req, res) => {
    const input = appearanceSchema.safeParse(req.body);
    if (!input.success) {
        res.status(400).json({
            error: '数字人配置无效'
        });
        return;
    }
    const config = {
        ...ops.appearance(),
        ...input.data
    };
    ops.writeData('dh_config.json', config);
    ops.operationsEvents.emit('change', {
        type: 'digital_human_updated'
    });
    res.json(config);
});
