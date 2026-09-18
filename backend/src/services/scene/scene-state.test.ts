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
assert.equal(canonical.currentTime, '11:00');
assert.equal(canonical.partyType, 'with_elderly');
assert.equal(canonical.mobility, 'limited');
assert.deepEqual(canonical.preferredPerformanceIds, [PERFORMANCE_IDS.JIXIANGSONG]);
assert.equal(canonical.preferredPerformanceTimes?.[PERFORMANCE_IDS.JIXIANGSONG], '14:00');
assert.deepEqual(canonical.missingCriticalFields, []);

const separatedTimes = extractSceneState(
  '我带腿脚不方便的妈妈，现在在景区入口，只有三小时，还想看两点的《吉祥颂》，应该怎么走？现在上午10点',
);
assert.equal(separatedTimes.currentTime, '10:00');
assert.equal(separatedTimes.preferredPerformanceTimes?.[PERFORMANCE_IDS.JIXIANGSONG], '14:00');

const numericPerformanceTime = extractSceneState('现在是10:00，想看14:00的《吉祥颂》，还剩5小时。');
assert.equal(numericPerformanceTime.currentTime, '10:00');
assert.equal(numericPerformanceTime.preferredPerformanceTimes?.[PERFORMANCE_IDS.JIXIANGSONG], '14:00');

const halfHourPerformanceTime = extractSceneState('现在下午1点，想看下午两点半的《吉祥颂》，还剩3小时。');
assert.equal(halfHourPerformanceTime.currentTime, '13:00');
assert.equal(halfHourPerformanceTime.preferredPerformanceTimes?.[PERFORMANCE_IDS.JIXIANGSONG], '14:30');

const currentTimeOnly = extractSceneState('现在上午10点，想看《吉祥颂》，还剩5小时。');
assert.equal(currentTimeOnly.currentTime, '10:00');
assert.equal(currentTimeOnly.preferredPerformanceTimes, undefined);

const noonDigital = extractSceneState('现在中午12点，我在景区入口，想看《吉祥颂》，还剩3小时。');
assert.equal(noonDigital.currentTime, '12:00');
assert.deepEqual(noonDigital.missingCriticalFields, []);

const noonChinese = extractSceneState('当前中午十二点，我在景区入口，想看《吉祥颂》，还剩3小时。');
assert.equal(noonChinese.currentTime, '12:00');
assert.deepEqual(noonChinese.missingCriticalFields, []);

const halfHourCurrentTime = extractSceneState('现在下午一点半，我在景区入口，想看《吉祥颂》，还剩3小时。');
assert.equal(halfHourCurrentTime.currentTime, '13:30');
assert.deepEqual(halfHourCurrentTime.missingCriticalFields, []);

const intervalBudget = extractSceneState(
  '我和我女朋友来这里玩，我们从早上10点玩到晚上五点，你需要考虑我们中午在哪里吃饭，然后帮我设计一条符合情侣出游的游玩路线，景区入口',
);
assert.equal(intervalBudget.currentTime, '10:00');
assert.equal(intervalBudget.remainingMinutes, 420);
assert.equal(intervalBudget.partyType, 'couple');
assert.equal(intervalBudget.currentLocation, 'south_gate');
assert.deepEqual(intervalBudget.missingCriticalFields, []);

const girlfriendOnly = extractSceneState('我和我女朋友来这里玩，景区入口，从早上10点到晚上5点。');
assert.equal(girlfriendOnly.partyType, 'couple');

const lunchRequest = extractSceneState('我们中午想找地方吃饭，景区入口，还有5小时。');
assert.equal(lunchRequest.mealRequested, true);

const inferredCurrentTime = extractSceneState(
  '我带腿脚不方便的妈妈，现在在景区入口，只有三小时，还想看两点的《吉祥颂》，应该怎么走？',
);
assert.equal(inferredCurrentTime.currentTime, '11:00');
assert.equal(inferredCurrentTime.remainingMinutes, 180);
assert.deepEqual(inferredCurrentTime.missingCriticalFields, []);

const inferredFromRemaining = extractSceneState(
  '现在在景区入口，还有两小时，想看下午4点的《吉祥颂》。',
);
assert.equal(inferredFromRemaining.currentTime, '14:00');
assert.deepEqual(inferredFromRemaining.missingCriticalFields, []);

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
