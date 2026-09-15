import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

export const RouteSpotSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  lat: z.number(),
  lng: z.number(),
  visit_minutes: z.number().int().nonnegative(),
  mobility: z.object({ wheelchair_accessible: z.boolean() }),
  opening_windows: z.array(z.string().regex(/^\d{2}:\d{2}-\d{2}:\d{2}$/)).min(1),
  source: z.string().min(1),
  confidence: z.enum(['verified', 'estimated']),
});

export const RouteEdgeSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  walk_minutes: z.number().int().nonnegative(),
  distance_m: z.number().nonnegative(),
  accessible: z.boolean(),
  source: z.string().min(1),
  confidence: z.enum(['verified', 'estimated']),
});

export const PerformanceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  location_id: z.string().min(1),
  start_times: z.array(z.string().regex(/^\d{2}:\d{2}$/)).min(1),
  duration_minutes: z.number().int().positive(),
  source: z.string().min(1),
  valid_date: z.string().min(1),
});

export const FacilitySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  location_id: z.string().min(1),
  accessible: z.boolean(),
  source: z.string().min(1),
  confidence: z.enum(['verified', 'estimated']),
});

export const RouteGraphSchema = z.object({
  spots: z.array(RouteSpotSchema),
  edges: z.array(RouteEdgeSchema),
  performances: z.array(PerformanceSchema),
  facilities: z.array(FacilitySchema),
});

export type RouteSpot = z.infer<typeof RouteSpotSchema>;
export type RouteEdge = z.infer<typeof RouteEdgeSchema>;
export type Performance = z.infer<typeof PerformanceSchema>;
export type Facility = z.infer<typeof FacilitySchema>;
export type RouteGraph = z.infer<typeof RouteGraphSchema>;

export function validateRouteGraph(graph: RouteGraph): string[] {
  const spotIds = new Set(graph.spots.map(spot => spot.id));
  const errors: string[] = [];
  for (const edge of graph.edges) {
    if (!spotIds.has(edge.from)) errors.push(`edge.from unknown: ${edge.from}`);
    if (!spotIds.has(edge.to)) errors.push(`edge.to unknown: ${edge.to}`);
  }
  for (const performance of graph.performances) {
    if (!spotIds.has(performance.location_id)) errors.push(`performance.location_id unknown: ${performance.location_id}`);
  }
  for (const facility of graph.facilities) {
    if (!spotIds.has(facility.location_id)) errors.push(`facility.location_id unknown: ${facility.location_id}`);
  }
  return errors;
}

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
