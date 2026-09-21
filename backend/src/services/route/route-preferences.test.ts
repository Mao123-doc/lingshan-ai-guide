import assert from 'node:assert/strict';
import test from 'node:test';
import type { SceneState } from '../scene/scene-state';
import {
  getVisitMinutes,
  normalizeRoutePreferences,
  preferenceScore,
} from './route-preferences';

function scene(overrides: Partial<SceneState> = {}): SceneState {
  return {
    mobility: 'normal',
    interests: ['nature', 'culture', 'nature'],
    mustVisitSpotIds: [],
    preferredPerformanceIds: [],
    visitedSpotIds: [],
    missingCriticalFields: [],
    pace: 'normal',
    ...overrides,
  };
}

test('normalizes interests as a stable set without inferring mobility from party type', () => {
  const normalized = normalizeRoutePreferences(scene({ partyType: 'with_elderly' }));
  const reordered = normalizeRoutePreferences(scene({ interests: ['culture', 'nature'] }));

  assert.deepEqual(normalized.interests, ['culture', 'nature']);
  assert.deepEqual(normalized.interests, reordered.interests);
  assert.equal(normalized.pace, reordered.pace);
  assert.equal(normalized.mobility, 'normal');
  assert.equal(normalized.partyType, 'with_elderly');
});

test('applies pace only to suggested visit minutes', () => {
  assert.equal(getVisitMinutes(25, 'slow'), 30);
  assert.equal(getVisitMinutes(25, 'normal'), 25);
  assert.equal(getVisitMinutes(25, 'fast'), 22);
  assert.equal(getVisitMinutes(8, 'fast'), 10);
});

test('caps combined interest preference score and preserves party-only soft preference', () => {
  const spot = {
    id: 'LS-013',
    name: '灵山梵宫',
    lat: 31.43065,
    lng: 120.09756,
    visit_minutes: 60,
    mobility: { wheelchair_accessible: true },
    opening_windows: ['08:00-18:00'],
    source: 'test',
    confidence: 'verified' as const,
  };

  const manyInterests = normalizeRoutePreferences(scene({
    interests: ['history', 'culture', 'nature', 'architecture', 'family', 'prayer'],
  }));
  const couple = normalizeRoutePreferences(scene({ partyType: 'couple', interests: [] }));

  assert.equal(preferenceScore(spot, manyInterests), 60);
  assert.equal(preferenceScore({ ...spot, name: '五灯湖' }, couple), 40);
});
