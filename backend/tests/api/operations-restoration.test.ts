import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { startTestServer, jsonBody } from '../helpers/api-fixtures';
test('restored operations persist linked feedback, validate config and use isolated nearby data', async () => {
    const server = await startTestServer();
    try {
        const record = {
            id: 'answer-1',
            session_id: 'session-1',
            timestamp: new Date().toISOString(),
            query: '票价多少',
            answer: '见证据',
            emotion: 'think',
            used_llm: false,
            response_time_ms: 2
        };
        fs.writeFileSync(path.join(server.dataRoot, 'conversations.json'), JSON.stringify([record]));
        assert.equal((await server.request('/api/v1/visitor/feedback', jsonBody({
            session_id: 'wrong',
            conversation_id: 'answer-1',
            rating: 5
        }))).status, 404);
        const feedback = await server.request('/api/v1/visitor/feedback', jsonBody({
            session_id: 'session-1',
            conversation_id: 'answer-1',
            rating: 2,
            comment: '需要完善'
        }));
        assert.equal(feedback.status, 200);
        assert.equal((await server.request('/api/v1/visitor/feedback', jsonBody({
            session_id: 'session-1',
            conversation_id: 'answer-1',
            rating: 4
        }))).status, 409);
        assert.equal(JSON.parse(fs.readFileSync(path.join(server.dataRoot, 'feedback.json'), 'utf8'))[0].conversation_id, 'answer-1');
        assert.equal((await server.request('/api/v1/admin/dashboard/summary')).status, 401);
        const login = await server.request('/api/v1/auth/login', jsonBody({
            username: 'admin',
            password: 'public-api-test-password'
        }));
        const headers = {
            Authorization: `Bearer ${login.body.access_token || login.body.token}`
        };
        const dashboard = await server.request('/api/v1/admin/dashboard/summary', {
            headers
        });
        assert.equal(dashboard.status, 200);
        assert.equal(dashboard.body.today_queries, 1);
        assert.equal(dashboard.body.avg_satisfaction, 40);
        const report = await server.request('/api/v1/admin/reports/sentiment', {
            headers
        });
        assert.equal(report.body.sentiment_distribution.negative, 100);
        assert.equal(report.body.feedback_count, 1);
        const list = await server.request('/api/v1/admin/conversations?keyword=票价&pageSize=1', {
            headers
        });
        assert.equal(list.body.total, 1);
        assert.equal(list.body.items[0].feedback, 'unhelpful');
        assert.equal((await server.request('/api/v1/admin/digital-human/appearance', {
            ...jsonBody({
                style_preset: 'invalid'
            }),
            method: 'PUT',
            headers: {
                ...headers,
                'Content-Type': 'application/json'
            }
        })).status, 400);
        const cfg = await server.request('/api/v1/admin/digital-human/appearance', {
            ...jsonBody({
                style_preset: 'ink_wash'
            }),
            method: 'PUT',
            headers: {
                ...headers,
                'Content-Type': 'application/json'
            }
        });
        assert.equal(cfg.status, 200);
        assert.equal((await server.request('/api/v1/visitor/dh-config')).body.style_preset, 'ink_wash');
        assert.equal((await server.request('/api/v1/visitor/nearby?lat=999&lng=120')).status, 400);
        assert.deepEqual((await server.request('/api/v1/visitor/spots')).body, []);
        delete process.env.VISION_BASE_URL;
        delete process.env.VISION_API_KEY;
        delete process.env.VISION_MODEL;
        assert.equal((await server.request('/api/v1/visitor/vision/recognize', jsonBody({
            image_base64: 'data:image/png;base64,aGVsbG8='
        }))).status, 503);
    }
    finally {
        await server.close();
    }
});
test('nearby preserves provenance and computes distances; invalid images fail explicitly', async () => {
    const server = await startTestServer();
    try {
        fs.mkdirSync(path.join(server.dataRoot, 'route'));
        fs.writeFileSync(path.join(server.dataRoot, 'route', 'spots.json'), JSON.stringify([{
                id: 'node',
                name: '实测节点',
                lat: 31,
                lng: 120,
                confidence: 'estimated',
                source: 'test fixture'
            }]));
        fs.writeFileSync(path.join(server.dataRoot, 'route', 'facilities.json'), JSON.stringify([{
                id: 'facility',
                name: '设施',
                location_id: 'node',
                confidence: 'estimated',
                source: 'test fixture'
            }]));
        const nearby = await server.request('/api/v1/visitor/nearby?lat=31&lng=120');
        assert.equal(nearby.status, 200);
        assert.equal(nearby.body[0].distance_m, 0);
        assert.equal(nearby.body[0].distance_type, 'straight_line');
        const facilities = await server.request('/api/v1/visitor/nearby-facilities?lat=31&lng=120');
        assert.equal(facilities.body[0].requires_on_site_verification, true);
        assert.equal(facilities.body[0].coordinate_source, 'associated_route_node');
        process.env.VISION_BASE_URL = 'http://127.0.0.1:1';
        process.env.VISION_API_KEY = 'test';
        process.env.VISION_MODEL = 'test';
        assert.equal((await server.request('/api/v1/visitor/vision/recognize', jsonBody({
            image_base64: 'aGVsbG8='
        }))).status, 400);
        assert.equal((await server.request('/api/v1/visitor/vision/recognize', jsonBody({
            image_base64: 'iVBORw0KGgo='
        }))).status, 502);
    }
    finally {
        delete process.env.VISION_BASE_URL;
        delete process.env.VISION_API_KEY;
        delete process.env.VISION_MODEL;
        await server.close();
    }
});
test('vision uses configured provider and matches only known scene entities', async () => {
    const { createServer } = await import('node:http');
    let requestBody: any;
    const provider = createServer((request, response) => {
        let body = '';
        request.on('data', chunk => body += chunk);
        request.on('end', () => {
            requestBody = JSON.parse(body);
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({
                choices: [{
                        message: {
                            content: JSON.stringify({
                                spot_name: '真实景点',
                                confidence: 0.9,
                                description: '图片识别描述'
                            })
                        }
                    }]
            }));
        });
    });
    await new Promise<void>(resolve => provider.listen(0, '127.0.0.1', resolve));
    const address = provider.address();
    if (!address || typeof address === 'string')
        throw new Error('Missing provider address');
    const server = await startTestServer();
    try {
        fs.mkdirSync(path.join(server.dataRoot, 'route'));
        fs.writeFileSync(path.join(server.dataRoot, 'route', 'spots.json'), JSON.stringify([{
                id: 'known',
                name: '真实景点',
                lat: 31,
                lng: 120
            }]));
        process.env.VISION_BASE_URL = `http://127.0.0.1:${address.port}/v1`;
        process.env.VISION_API_KEY = 'test-secret';
        process.env.VISION_MODEL = 'configured-model';
        const result = await server.request('/api/v1/visitor/vision/recognize', jsonBody({
            image_base64: 'iVBORw0KGgo='
        }));
        assert.equal(result.status, 200);
        assert.equal(result.body.spot_id, 'known');
        assert.equal(result.body.matched, true);
        assert.equal(requestBody.model, 'configured-model');
        assert.match(requestBody.messages[1].content[1].image_url.url, /^data:image\/png;base64,/);
    }
    finally {
        delete process.env.VISION_BASE_URL;
        delete process.env.VISION_API_KEY;
        delete process.env.VISION_MODEL;
        await server.close();
        provider.closeAllConnections();
        await new Promise<void>(resolve => provider.close(() => resolve()));
    }
});
