import type { SceneState } from '../scene/scene-state';
import type { RouteEdge, RouteGraph } from './route-contract';

export interface RoutePath {
  spotIds: string[];
  edges: RouteEdge[];
  walkMinutes: number;
}

interface QueueItem {
  spotId: string;
  distance: number;
  spotIds: string[];
  edges: RouteEdge[];
}

function canUseEdge(edge: RouteEdge, mobility: SceneState['mobility']): boolean {
  return mobility !== 'limited' && mobility !== 'wheelchair' || edge.accessible;
}

function neighbors(graph: RouteGraph, spotId: string, mobility: SceneState['mobility']): Array<{ edge: RouteEdge; next: string }> {
  return graph.edges
    .filter(edge => canUseEdge(edge, mobility) && (edge.from === spotId || edge.to === spotId))
    .map(edge => ({ edge, next: edge.from === spotId ? edge.to : edge.from }))
    .sort((left, right) => left.next.localeCompare(right.next) || left.edge.walk_minutes - right.edge.walk_minutes);
}

function pathKey(spotIds: string[]): string {
  return spotIds.join('\u0000');
}

export function findPath(
  graph: RouteGraph,
  from: string,
  to: string,
  mobility: SceneState['mobility'],
): RoutePath | undefined {
  if (!graph.spots.some(spot => spot.id === from) || !graph.spots.some(spot => spot.id === to)) return undefined;
  if (from === to) return { spotIds: [from], edges: [], walkMinutes: 0 };

  const queue: QueueItem[] = [{ spotId: from, distance: 0, spotIds: [from], edges: [] }];
  const best = new Map<string, { distance: number; key: string }>([[from, { distance: 0, key: pathKey([from]) }]]);

  while (queue.length > 0) {
    queue.sort((left, right) => left.distance - right.distance || pathKey(left.spotIds).localeCompare(pathKey(right.spotIds)));
    const current = queue.shift()!;
    const currentBest = best.get(current.spotId);
    if (!currentBest || current.distance !== currentBest.distance || pathKey(current.spotIds) !== currentBest.key) continue;
    if (current.spotId === to) return { spotIds: current.spotIds, edges: current.edges, walkMinutes: current.distance };

    for (const { edge, next } of neighbors(graph, current.spotId, mobility)) {
      if (current.spotIds.includes(next)) continue;
      const distance = current.distance + edge.walk_minutes;
      const spotIds = [...current.spotIds, next];
      const key = pathKey(spotIds);
      const previous = best.get(next);
      if (previous && (previous.distance < distance || (previous.distance === distance && previous.key <= key))) continue;
      best.set(next, { distance, key });
      queue.push({ spotId: next, distance, spotIds, edges: [...current.edges, edge] });
    }
  }

  return undefined;
}
