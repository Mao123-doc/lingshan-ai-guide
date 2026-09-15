import assert from 'node:assert/strict';
import {
  SceneStateSchema,
  extractSceneState,
  PERFORMANCE_IDS,
} from './scene-state';

const canonical = extractSceneState(
  '我带腿脚不方便的妈妈，现在在景区入口，只有三小时，还想看两点的《吉祥颂》，应该怎么走？',
);

assert.equal(canonical.currentLocation, 'south_gate');
assert.equal(canonical.remainingMinutes, 180);
assert.equal(canonical.partyType, 'with_elderly');
assert.equal(canonical.mobility, 'limited');
assert.deepEqual(canonical.preferredPerformanceIds, [PERFORMANCE_IDS.JIXIANGSONG]);
assert.equal(canonical.preferredPerformanceTimes?.[PERFORMANCE_IDS.JIXIANGSONG], '14:00');
assert.deepEqual(canonical.missingCriticalFields, ['currentTime']);

const wheelchair = extractSceneState('我坐轮椅，从南门进入，只有90分钟，想去灵山梵宫。');
assert.equal(wheelchair.currentLocation, 'south_gate');
assert.equal(wheelchair.mobility, 'wheelchair');
assert.equal(wheelchair.remainingMinutes, 90);
assert.deepEqual(wheelchair.mustVisitSpotIds, ['LS-013']);
assert.deepEqual(wheelchair.missingCriticalFields, []);

const continuity = extractSceneState('我现在在灵山梵宫，已经看过灵山大佛和祥符禅寺，还剩45分钟。');
assert.equal(continuity.currentLocation, 'LS-013');
assert.deepEqual(continuity.visitedSpotIds, ['LS-011', 'LS-010']);
assert.equal(continuity.remainingMinutes, 45);

const missing = extractSceneState('帮我推荐一条文化路线。');
assert.deepEqual(missing.missingCriticalFields, ['currentLocation', 'remainingMinutes']);
assert.equal(missing.mobility, 'unknown');

const validated = SceneStateSchema.parse(canonical);
assert.deepEqual(validated, canonical);
assert.throws(() => SceneStateSchema.parse({ mobility: 'teleport' }));

console.log('Scene state tests passed');
