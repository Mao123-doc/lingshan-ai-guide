import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { startTestServer } from '../helpers/api-fixtures';

test('wechat miniprogram core visitor api flows work seamlessly', async () => {
  const server = await startTestServer();
  try {
    // 写入模拟路网与景点数据到隔离测试目录
    fs.mkdirSync(path.join(server.dataRoot, 'route'), { recursive: true });
    fs.writeFileSync(
      path.join(server.dataRoot, 'route', 'spots.json'),
      JSON.stringify([
        {
          id: 'south_gate',
          name: '景区南门',
          lat: 31.42190,
          lng: 120.09720,
          visit_minutes: 0,
          mobility: { wheelchair_accessible: true },
          confidence: 'verified',
        },
        {
          id: 'LS-011',
          name: '灵山大佛',
          lat: 31.43205,
          lng: 120.09151,
          visit_minutes: 60,
          mobility: { wheelchair_accessible: true },
          confidence: 'verified',
        },
      ])
    );
    fs.writeFileSync(
      path.join(server.dataRoot, 'route', 'facilities.json'),
      JSON.stringify([
        {
          id: 'fac-1',
          name: '南门服务中心',
          location_id: 'south_gate',
          lat: 31.42190,
          lng: 120.09720,
          confidence: 'verified',
        },
      ])
    );

    // 1. 小程序会话初始化
    const sessionRes = await server.request('/api/v1/visitor/session/init', { method: 'POST' });
    assert.equal(sessionRes.status, 200);
    assert.ok(sessionRes.body.session_id);
    assert.ok(sessionRes.body.welcome_message);
    const sessionId = sessionRes.body.session_id;

    // 2. 小程序标准 JSON 问答
    const qaRes = await server.request('/api/v1/visitor/qa', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        query: '灵山大佛有多高？',
        session_id: sessionId,
      }),
    });
    assert.equal(qaRes.status, 200);
    assert.ok(qaRes.body.answer);
    assert.ok(qaRes.body.conversation_id);
    assert.ok(typeof qaRes.body.response_time_ms === 'number');

    // 3. 小程序评价反馈流
    const feedbackRes = await server.request('/api/v1/visitor/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        conversation_id: qaRes.body.conversation_id,
        rating: 5,
        comment: '小程序端回答迅速且包含准确依据',
      }),
    });
    assert.equal(feedbackRes.status, 200);
    assert.equal(feedbackRes.body.success, true);

    // 4. 小程序多约束路线规划 - 结构化参数
    const routePlanRes = await server.request('/api/v1/visitor/route/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scene_state: {
          currentLocation: 'south_gate',
          currentTime: '09:00',
          remainingMinutes: 180,
          mobility: 'limited',
          partyType: '带长辈',
          interests: ['文化'],
          returnToExit: true,
          exitSpotId: 'south_gate',
        },
      }),
    });
    assert.equal(routePlanRes.status, 200);
    assert.ok(routePlanRes.body.outcome);
    assert.ok(routePlanRes.body.route);

    // 5. 小程序景点与周边设施查询
    const spotsRes = await server.request('/api/v1/visitor/spots', { method: 'GET' });
    assert.equal(spotsRes.status, 200);
    assert.ok(Array.isArray(spotsRes.body));
    assert.equal(spotsRes.body.length, 2);

    // 6. 附近景点与设施查询 (GPS 坐标)
    const nearbySpots = await server.request('/api/v1/visitor/nearby?lat=31.4219&lng=120.0972', { method: 'GET' });
    assert.equal(nearbySpots.status, 200);
    assert.ok(Array.isArray(nearbySpots.body));
    assert.equal(nearbySpots.body[0].id, 'south_gate');
    assert.equal(nearbySpots.body[0].distance_m, 0);
    assert.equal(nearbySpots.body[0].distance_type, 'straight_line');

    const nearbyFacilities = await server.request('/api/v1/visitor/nearby-facilities?lat=31.4219&lng=120.0972', { method: 'GET' });
    assert.equal(nearbyFacilities.status, 200);
    assert.ok(Array.isArray(nearbyFacilities.body));
    assert.equal(nearbyFacilities.body[0].id, 'fac-1');

    // 7. 数字人形象配置接口
    const dhRes = await server.request('/api/v1/visitor/dh-config', { method: 'GET' });
    assert.equal(dhRes.status, 200);
    assert.ok(dhRes.body.style_preset || dhRes.body.appearance?.style_preset);

    // 8. 视觉识景安全降级 (未配置视觉模型时返回 503)
    const visionRes = await server.request('/api/v1/visitor/vision/recognize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_base64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      }),
    });
    assert.ok([200, 502, 503].includes(visionRes.status));

    // 9. 状态检查
    const statusRes = await server.request('/api/v1/visitor/status', { method: 'GET' });
    assert.equal(statusRes.status, 200);
    assert.ok(typeof statusRes.body.knowledge_chunks === 'number');
  } finally {
    await server.close();
  }
});
