import fs from 'node:fs';
import path from 'node:path';
import { RouteGraphSchema, validateRouteGraph, type RouteGraph } from './route-types';
export * from './route-types';

export function loadRouteGraph(dataRoot = path.resolve(__dirname, '../../../../data/route')): RouteGraph {
  const graph = RouteGraphSchema.parse({
    spots: JSON.parse(fs.readFileSync(path.join(dataRoot, 'spots.json'), 'utf8')),
    edges: JSON.parse(fs.readFileSync(path.join(dataRoot, 'edges.json'), 'utf8')),
    performances: JSON.parse(fs.readFileSync(path.join(dataRoot, 'performances.json'), 'utf8')),
    facilities: JSON.parse(fs.readFileSync(path.join(dataRoot, 'facilities.json'), 'utf8')),
  });
  const errors = validateRouteGraph(graph);
  if (errors.length > 0) throw new Error(`Invalid route graph: ${errors.join('; ')}`);
  return graph;
}
