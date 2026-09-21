import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeSceneStateInput, SceneStateSchema } from './scene-state';

test('normalizes structured Chinese form values to canonical scene values', () => {
  const normalized = normalizeSceneStateInput({
    mobility: '行动不便',
    pace: '轻松',
    interests: ['文化', '自然', '文化'],
    partyType: '带长辈',
    mustVisitSpotIds: [],
    preferredPerformanceIds: [],
    visitedSpotIds: [],
    missingCriticalFields: [],
  });

  assert.deepEqual(normalized, {
    mobility: 'limited',
    pace: 'slow',
    interests: ['culture', 'nature'],
    partyType: 'with_elderly',
    mustVisitSpotIds: [],
    preferredPerformanceIds: [],
    visitedSpotIds: [],
    missingCriticalFields: [],
  });
});

test('keeps contract validation strict for unsupported route values', () => {
  assert.throws(() => SceneStateSchema.parse({
    mobility: 'teleport',
    interests: [],
    mustVisitSpotIds: [],
    preferredPerformanceIds: [],
    visitedSpotIds: [],
    missingCriticalFields: [],
  }));
});
