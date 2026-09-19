import assert from 'node:assert/strict';
import type { RouteGraph } from './route-contract';
import { findPath } from './pathfinding';

const graph: RouteGraph = {
  spots: [
    { id: 'A', name: '起点', lat: 0, lng: 0, visit_minutes: 0, mobility: { wheelchair_accessible: true }, opening_windows: ['08:00-18:00'], source: 'test', confidence: 'verified' },
    { id: 'B', name: '中间点', lat: 0, lng: 0, visit_minutes: 10, mobility: { wheelchair_accessible: true }, opening_windows: ['08:00-18:00'], source: 'test', confidence: 'verified' },
    { id: 'C', name: '终点', lat: 0, lng: 0, visit_minutes: 10, mobility: { wheelchair_accessible: true }, opening_windows: ['08:00-18:00'], source: 'test', confidence: 'verified' },
  ],
  edges: [
    { from: 'A', to: 'B', walk_minutes: 5, distance_m: 100, accessible: true, source: 'test', confidence: 'verified' },
    { from: 'B', to: 'C', walk_minutes: 7, distance_m: 140, accessible: true, source: 'test', confidence: 'verified' },
    { from: 'A', to: 'C', walk_minutes: 3, distance_m: 60, accessible: false, source: 'test', confidence: 'verified' },
  ],
  performances: [],
  facilities: [],
};

const normal = findPath(graph, 'A', 'C', 'normal');
assert.deepEqual(normal?.spotIds, ['A', 'C']);
assert.equal(normal?.walkMinutes, 3);

const accessible = findPath(graph, 'A', 'C', 'limited');
assert.deepEqual(accessible?.spotIds, ['A', 'B', 'C']);
assert.equal(accessible?.walkMinutes, 12);

assert.equal(findPath(graph, 'A', 'missing', 'normal'), undefined);

console.log('Pathfinding tests passed');
