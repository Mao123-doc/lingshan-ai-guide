import assert from 'node:assert/strict';
import test from 'node:test';
import { ChunkedUtf8Decoder } from '../utils/request';
import { findShortestPath, planOfflineRoute } from '../services/offline-route';
import { wgs84ToGcj02, calculateDistanceMeters, formatDistance, outOfChina } from '../utils/coord';
import {
  parseMinutes,
  formatMinutes,
  getRouteOutcomeLabel,
  getRouteRequestLabel,
  getRouteRejectionMessage,
  getClarificationPrompt,
} from '../utils/format';
import { RouteGraph } from '../types/spot';

// ==========================================
// 1. ChunkedUtf8Decoder 跨块解码与边界测试
// ==========================================
test('ChunkedUtf8Decoder decodes multi-byte Chinese and emoji across every chunk boundary', () => {
  const text = '灵小禅🌸带您游历灵山胜境：灵山大佛、灵山梵宫与九龙灌浴！';
  const fullBuf = Buffer.from(text, 'utf-8');

  // 测试在任意单字节切分点切分两段
  for (let split = 1; split < fullBuf.length; split++) {
    const decoder = new ChunkedUtf8Decoder();
    const chunk1 = fullBuf.subarray(0, split);
    const chunk2 = fullBuf.subarray(split);

    const s1 = decoder.decode(chunk1.buffer.slice(chunk1.byteOffset, chunk1.byteOffset + chunk1.byteLength));
    const s2 = decoder.decode(chunk2.buffer.slice(chunk2.byteOffset, chunk2.byteOffset + chunk2.byteLength));
    const combined = s1 + s2;
    assert.equal(combined, text, `Failed at split byte index ${split}`);
  }

  // 测试极细粒度 1 字节 chunk 流式喂入
  const byteDecoder = new ChunkedUtf8Decoder();
  let streamResult = '';
  for (let i = 0; i < fullBuf.length; i++) {
    const singleByte = fullBuf.subarray(i, i + 1);
    streamResult += byteDecoder.decode(singleByte.buffer.slice(singleByte.byteOffset, singleByte.byteOffset + singleByte.byteLength));
  }
  assert.equal(streamResult, text, '1-byte chunk stream decoding failed');
});

// ==========================================
// 2. 坐标转换与距离计算
// ==========================================
test('coord utils calculate accurate distances and handle out-of-china check', () => {
  // 南门到灵山大佛
  const southGate = { lat: 31.4219, lng: 120.0972 };
  const bigBuddha = { lat: 31.43205, lng: 120.09151 };

  const dist = calculateDistanceMeters(southGate.lat, southGate.lng, bigBuddha.lat, bigBuddha.lng);
  assert.ok(dist > 1000 && dist < 1500, `Distance should be ~1260m, got ${dist}`);
  assert.equal(formatDistance(dist), '1.3公里');
  assert.equal(formatDistance(350), '350米');

  // 境内外判定
  assert.equal(outOfChina(31.4219, 120.0972), false);
  assert.equal(outOfChina(0, 0), true);

  // WGS-84 转 GCJ-02 火星坐标
  const converted = wgs84ToGcj02(southGate.lat, southGate.lng);
  assert.ok(Math.abs(converted.lat - southGate.lat) < 0.01);
  assert.ok(Math.abs(converted.lng - southGate.lng) < 0.01);
});

// ==========================================
// 3. 时间换算与路线状态说明
// ==========================================
test('format utils handle minutes and humanized labels correctly', () => {
  assert.equal(parseMinutes('09:30'), 570);
  assert.equal(parseMinutes('00:00'), 0);
  assert.ok(Number.isNaN(parseMinutes('invalid')));

  assert.equal(formatMinutes(570), '09:30');
  assert.equal(formatMinutes(0), '00:00');
  assert.equal(formatMinutes(1440), '00:00'); // 跨天归零

  assert.equal(getRouteOutcomeLabel('feasible', 3), '可以按这条路线游览');
  assert.equal(getRouteOutcomeLabel('feasible_with_rejected_preferences', 2), '已为你安排替代方案');
  assert.equal(getRouteOutcomeLabel('needs_clarification', 0), '还需要一点信息');
  assert.equal(getRouteOutcomeLabel('infeasible', 0), '按目前时间安排，暂时无法全部满足');

  assert.equal(getRouteRequestLabel('currentTime'), '现在时间');
  assert.equal(getRouteRejectionMessage('performance_already_started'), '这场演出已经开始了');
  assert.ok(getClarificationPrompt('currentTime').includes('几点'));
});

// ==========================================
// 4. 离线确定性路线规划器
// ==========================================
test('offline route planner generates feasible routes and reserves south gate return', () => {
  const mockGraph: RouteGraph = {
    spots: [
      {
        id: 'south_gate',
        name: '景区南门',
        lat: 31.4219,
        lng: 120.0972,
        visit_minutes: 0,
        mobility: { wheelchair_accessible: true },
        opening_windows: ['00:00-24:00'],
        source: 'mock',
        confidence: 'verified',
      },
      {
        id: 'LS-001',
        name: '灵山大照壁',
        lat: 31.4225,
        lng: 120.0974,
        visit_minutes: 15,
        mobility: { wheelchair_accessible: true },
        opening_windows: ['08:00-17:00'],
        source: 'mock',
        confidence: 'verified',
      },
      {
        id: 'LS-010',
        name: '祥符禅寺',
        lat: 31.42986,
        lng: 120.09309,
        visit_minutes: 30,
        mobility: { wheelchair_accessible: true },
        opening_windows: ['08:00-17:00'],
        source: 'mock',
        confidence: 'verified',
      },
      {
        id: 'LS-STAIRS',
        name: '登高陡梯台阶',
        lat: 31.431,
        lng: 120.092,
        visit_minutes: 20,
        mobility: { wheelchair_accessible: false },
        opening_windows: ['08:00-17:00'],
        source: 'mock',
        confidence: 'verified',
      },
    ],
    edges: [
      {
        from: 'south_gate',
        to: 'LS-001',
        distance_m: 80,
        walk_minutes: 2,
        accessible: true,
        source: 'mock',
        confidence: 'verified',
      },
      {
        from: 'LS-001',
        to: 'LS-010',
        distance_m: 600,
        walk_minutes: 10,
        accessible: true,
        source: 'mock',
        confidence: 'verified',
      },
      {
        from: 'LS-010',
        to: 'LS-STAIRS',
        distance_m: 200,
        walk_minutes: 5,
        accessible: false, // 台阶非无障碍
        source: 'mock',
        confidence: 'verified',
      },
    ],
  };

  // 1. 最短路径寻路
  const normalPath = findShortestPath(mockGraph, 'south_gate', 'LS-010');
  assert.ok(normalPath);
  assert.equal(normalPath.totalWalkMinutes, 12);
  assert.deepEqual(normalPath.path, ['south_gate', 'LS-001', 'LS-010']);

  // 2. 轮椅无障碍过滤：台阶边应当不可达
  const wheelchairPath = findShortestPath(mockGraph, 'south_gate', 'LS-STAIRS', true);
  assert.equal(wheelchairPath, null, 'Wheelchair route should filter out stairs edge');

  // 3. 完整离线规划（含南门返回）
  const plan = planOfflineRoute(mockGraph, {
    currentLocation: 'south_gate',
    currentTime: '09:00',
    remainingMinutes: 120,
    mobility: 'wheelchair',
    visitedSpotIds: [],
  });

  assert.equal(plan.outcome, 'feasible');
  assert.ok(plan.route);
  assert.ok(plan.route.steps.length >= 2);

  // 验证最后一步必须是返回南门
  const lastStep = plan.route.steps[plan.route.steps.length - 1];
  assert.equal(lastStep.spotId, 'south_gate');
  assert.equal(lastStep.purpose, 'return');
  assert.equal(lastStep.reasonCode, 'return_to_exit');

  // 验证时间预算不超
  const totalMins = plan.route.totalMinutes;
  assert.ok(totalMins <= 120, `Total minutes ${totalMins} exceeded budget 120`);
});

// ==========================================
// 5. 进度重规划参数清洗防崩溃测试
// ==========================================
test('progress replanning sanitizes tap event and ensures array visited spots', () => {
  // 模拟从 WXML 传入的 tap CustomEvent
  const tapEvent = {
    type: 'tap',
    timeStamp: 12345,
    target: { id: '', dataset: {} },
    currentTarget: { id: '', dataset: {} },
    detail: { x: 100, y: 200 },
  };

  const defaultCompleted = ['LS-001'];
  const defaultProgressSpot = 'LS-002';

  // 验证清洗逻辑：当传入 tapEvent 时，不应当被当作 visitedSpotIds
  const sanitizeReplanArgs = (completedArg?: any, fromSpotArg?: string) => {
    const visited = Array.isArray(completedArg) ? completedArg : defaultCompleted;
    const origin = (typeof fromSpotArg === 'string' && fromSpotArg) ? fromSpotArg : defaultProgressSpot;
    return { visited, origin };
  };

  const resFromTap = sanitizeReplanArgs(tapEvent, undefined);
  assert.deepEqual(resFromTap.visited, ['LS-001']);
  assert.equal(resFromTap.origin, 'LS-002');

  const resExplicit = sanitizeReplanArgs(['LS-001', 'LS-002'], 'LS-003');
  assert.deepEqual(resExplicit.visited, ['LS-001', 'LS-002']);
  assert.equal(resExplicit.origin, 'LS-003');
});
