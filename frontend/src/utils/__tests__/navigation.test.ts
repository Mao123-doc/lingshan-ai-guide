import { expect, it } from 'vitest';
import { buildAmapDirectionUrl, buildBaiduDirectionUrl } from '../navigation';

it('opens pedestrian navigation rather than driving through the park', () => {
  const url = new URL(buildBaiduDirectionUrl({lat:31.43,lng:120.09}, '灵山大佛'));
  expect(url.searchParams.get('mode')).toBe('walking');
});
it('encodes names and enables native Amap walking navigation', () => {
  const url = new URL(buildAmapDirectionUrl({lat:31.43,lng:120.09}, '梵宫 & 演出'));
  expect(url.searchParams.get('mode')).toBe('walk');
  expect(url.searchParams.get('callnative')).toBe('1');
  expect(url.searchParams.get('to')).toContain('梵宫 & 演出');
});
