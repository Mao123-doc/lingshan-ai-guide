import assert from 'node:assert/strict';
import { extractSceneState } from './scene-extractor';

type ExpectedSceneFields = {
  partyType?: string;
  currentLocation?: string;
  currentTime?: string;
  remainingMinutes?: number;
  mealRequested?: boolean;
};

const cases: Array<[query: string, expected: ExpectedSceneFields]> = [
  [
    '我和对象一起，从上午10点玩到下午5点',
    { partyType: 'couple', currentTime: '10:00', remainingMinutes: 420 },
  ],
  [
    '陪家里老人，从景区入口开始，还有3小时',
    { partyType: 'with_elderly', currentLocation: 'south_gate', remainingMinutes: 180 },
  ],
  [
    '现在在入口，还有两小时，想看下午4点的吉祥颂',
    { currentTime: '14:00', remainingMinutes: 120 },
  ],
  [
    '中午想找地方吃饭，还有5小时',
    { mealRequested: true, remainingMinutes: 300 },
  ],
];

for (const [query, expected] of cases) {
  const actual = extractSceneState(query);
  for (const [field, expectedValue] of Object.entries(expected)) {
    assert.deepEqual(
      actual[field as keyof ExpectedSceneFields],
      expectedValue,
      `${query}: expected ${field}=${JSON.stringify(expectedValue)}`,
    );
  }
}

console.log('Scene extractor contract tests passed');
