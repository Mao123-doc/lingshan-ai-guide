/**
 * spot.d.ts — 灵山胜境 23 景点与周边设施契约定义
 */

export interface Spot {
  id: string;
  name: string;
  lat: number;
  lng: number;
  visit_minutes: number;
  mobility?: {
    wheelchair_accessible: boolean;
  };
  opening_windows: string[];
  source?: string;
  confidence?: 'verified' | 'estimated' | string;
  area?: string;
  description?: string;
  fields?: {
    description?: string;
    ticket?: string;
    opening_hours?: string;
    highlights?: string;
    tips?: string;
    [key: string]: any;
  };
  distance_m?: number;
  distance_type?: 'straight_line' | string;
  requires_on_site_verification?: boolean;
}

export interface Facility {
  id: string;
  name: string;
  type: 'toilet' | 'dining' | 'service_center' | 'bus_stop' | string;
  location_id?: string;
  lat?: number;
  lng?: number;
  coordinate_source?: string;
  coordinate_confidence?: string;
  confidence?: string;
  distance_m?: number;
  distance_type?: 'straight_line' | string;
  requires_on_site_verification?: boolean;
}

export interface RouteEdge {
  from: string;
  to: string;
  walk_minutes: number;
  distance_m: number;
  accessible: boolean;
  source: string;
  confidence: string;
}

export interface Performance {
  id: string;
  name: string;
  location_id: string;
  start_times: string[];
  duration_minutes: number;
  source?: string;
}

export interface RouteGraph {
  spots: Spot[];
  edges: RouteEdge[];
  performances: Performance[];
  coordinate_reference?: string;
  notice?: string;
}
