import { Router } from 'express';
import { z } from 'zod';
import * as ops from '../../services/operations-service';
export const experienceRouter = Router();
experienceRouter.get('/dh-config', (_req, res) => res.json(ops.appearance()));
experienceRouter.get('/spots', (_req, res) => res.json(ops.spots()));
experienceRouter.get('/spots/:id', (req, res) => {
    const spot = ops.spots().find(s => s.id === req.params.id);
    res.status(spot ? 200 : 404).json(spot || {
        error: '景点不存在'
    });
});
const coords = z.object({
    lat: z.coerce.number().min(-90).max(90),
    lng: z.coerce.number().min(-180).max(180)
});
function distance(lat: number, lng: number, s: Record<string, any>) {
    const rad = Math.PI / 180, dlat = (s.lat - lat) * rad, dlng = (s.lng - lng) * rad, a = Math.sin(dlat / 2) ** 2 + Math.cos(lat * rad) * Math.cos(s.lat * rad) * Math.sin(dlng / 2) ** 2;
    return Math.round(6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}
experienceRouter.get('/nearby', (req, res) => {
    const input = coords.safeParse(req.query);
    if (!input.success) {
        res.status(400).json({
            error: '需要有效经纬度 lat/lng'
        });
        return;
    }
    res.json(ops.spots().filter(s => Number.isFinite(s.lat) && Number.isFinite(s.lng)).map(s => ({
        ...s,
        distance_m: distance(input.data.lat, input.data.lng, s),
        distance_type: 'straight_line'
    })).sort((a, b) => a.distance_m - b.distance_m));
});
experienceRouter.get('/nearby-facilities', (req, res) => {
    const input = coords.safeParse(req.query);
    if (!input.success) {
        res.status(400).json({
            error: '需要有效经纬度 lat/lng'
        });
        return;
    }
    const spots = ops.spots();
    res.json(ops.readData<Array<Record<string, any>>>('route/facilities.json', []).map(f => {
        const location = spots.find(s => s.id === f.location_id);
        return {
            ...f,
            lat: f.lat ?? location?.lat,
            lng: f.lng ?? location?.lng,
            coordinate_source: f.lat !== undefined ? 'facility' : 'associated_route_node',
            coordinate_confidence: location?.confidence,
            confidence: f.confidence
        };
    }).filter(f => Number.isFinite(f.lat) && Number.isFinite(f.lng)).map(f => ({
        ...f,
        distance_m: distance(input.data.lat, input.data.lng, f),
        distance_type: 'straight_line',
        requires_on_site_verification: f.confidence !== 'verified'
    })).sort((a, b) => a.distance_m - b.distance_m));
});
const feedbackSchema = z.object({
    session_id: z.string().min(1).max(200),
    conversation_id: z.string().min(1).max(200).optional(),
    rating: z.number().int().min(1).max(5),
    comment: z.string().max(2000).optional()
});
experienceRouter.post(['/feedback', '/conversation-feedback'], (req, res, next) => {
    const raw = {
        ...req.body
    };
    if (raw.rating === undefined && ['helpful', 'unhelpful'].includes(raw.feedback))
        raw.rating = raw.feedback === 'helpful' ? 5 : 1;
    const input = feedbackSchema.safeParse(raw);
    if (!input.success) {
        res.status(400).json({
            error: '反馈参数无效'
        });
        return;
    }
    try {
        res.json({
            success: true,
            feedback: ops.submitFeedback(input.data)
        });
    }
    catch (e) {
        const error = e as Error & {
            status?: number;
        };
        if (error.status) {
            res.status(error.status).json({
                error: error.message
            });
            return;
        }
        next(e);
    }
});
experienceRouter.get('/hot-questions', (_req, res) => res.json(ops.hotQuestions(ops.conversations())));
experienceRouter.post('/vision/recognize', async (req, res) => {
    const { VISION_BASE_URL: base, VISION_API_KEY: key, VISION_MODEL: model } = process.env;
    if (!base || !key || !model) {
        res.status(503).json({
            error: '视觉识别未配置',
            code: 'VISION_NOT_CONFIGURED'
        });
        return;
    }
    const parsed = z.object({
        image_base64: z.string().min(1).max(7000000)
    }).safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({
            error: '图片为空或超过 5MB'
        });
        return;
    }
    const data = parsed.data.image_base64;
    const match = /^(?:data:image\/(png|jpeg|webp);base64,)?([A-Za-z0-9+/]+={0,2})$/.exec(data);
    if (!match || Buffer.from(match[2], 'base64').length > 5 * 1024 * 1024) {
        res.status(400).json({
            error: '需要有效 PNG/JPEG/WebP base64 图片，最大5MB'
        });
        return;
    }
    const bytes = Buffer.from(match[2], 'base64');
    const validImage = bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255])) || bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) || (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP');
    if (!validImage) {
        res.status(400).json({
            error: '图片内容与格式无效'
        });
        return;
    }
    const mime = bytes[0] === 255 ? 'jpeg' : bytes[0] === 137 ? 'png' : 'webp';
    try {
        const response = await fetch(`${base.replace(/\/$/, '')}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${key}`
            },
            signal: AbortSignal.timeout(20000),
            body: JSON.stringify({
                model,
                temperature: 0,
                max_tokens: 500,
                messages: [{
                        role: 'system',
                        content: '识别景区图片。仅返回JSON {"spot_name":string|null,"confidence":number,"description":string}。无法判断或非景区图片返回null及低置信度。不得编造票价、开放时间或路线。'
                    }, {
                        role: 'user',
                        content: [{
                                type: 'text',
                                text: '请识别图片景点。'
                            }, {
                                type: 'image_url',
                                image_url: {
                                    url: `data:image/${mime};base64,${match[2]}`
                                }
                            }]
                    }]
            })
        });
        if (!response.ok)
            throw new Error('provider_failed');
        const payload = await response.json() as {
            choices?: Array<{
                message?: {
                    content?: string;
                };
            }>;
        };
        const text = payload.choices?.[0]?.message?.content || '';
        const result = z.object({
            spot_name: z.string().max(100).nullable(),
            confidence: z.number().min(0).max(1),
            description: z.string().max(2000)
        }).parse(JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, '')));
        const spot = result.confidence >= 0.7 ? ops.spots().find(s => s.name === result.spot_name) : undefined;
        res.json({
            ...result,
            matched: !!spot,
            spot: spot || null,
            spot_id: spot?.id || null,
            needs_clarification: !spot,
            source: 'configured_vision_model',
            knowledge_url: spot ? `/api/v1/visitor/spots/${spot.id}` : null
        });
    }
    catch (error) {
        const timeout = error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name);
        res.status(timeout ? 504 : 502).json({
            error: timeout ? '视觉识别超时' : '视觉识别服务返回无效结果',
            code: timeout ? 'VISION_TIMEOUT' : 'VISION_PROVIDER_FAILED'
        });
    }
});
