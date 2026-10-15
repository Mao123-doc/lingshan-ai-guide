/**
 * route.d.ts — 路线规划契约与状态类型
 */

export type RouteOutcome =
  | 'feasible'
  | 'feasible_with_rejected_preferences'
  | 'needs_clarification'
  | 'infeasible';

export type MobilityType = 'normal' | 'limited' | 'wheelchair' | 'unknown';
export type PaceType = 'slow' | 'normal' | 'fast';

export interface RouteStep {
  purpose?: 'visit' | 'performance' | 'return';
  distanceMeters?: number;
  pathEvidence?: Array<{
    from: string;
    to: string;
    distance_m: number;
    walk_minutes: number;
    source: string;
    confidence: string;
    accessible: boolean;
  }>;
  reasonCode?: string;
  pathSpotIds?: string[];
  start: string;
  end: string;
  spotId: string;
  arrive: string;
  walkMinutes: number;
  visitMinutes: number;
  waitingMinutes?: number;
  performanceId?: string;
  performanceName?: string;
  performanceStartTime?: string;
}

export interface RejectedRequest {
  item: string;
  reasonCode: string;
}

export interface RouteEvidence {
  spot_id?: string;
  name?: string;
  source?: string;
  confidence?: string;
}

export interface SceneStateInput {
  returnToExit?: boolean;
  exitSpotId?: string;
  performanceBufferMinutes?: number;
  currentLocation?: string;
  currentTime?: string;
  remainingMinutes?: number;
  partyType?: string;
  mobility?: MobilityType | '正常' | '行动不便' | '轮椅';
  mealRequested?: boolean;
  interests?: string[];
  mustVisitSpotIds?: string[];
  preferredPerformanceIds?: string[];
  preferredPerformanceTimes?: Record<string, string>;
  visitedSpotIds?: string[];
  pace?: PaceType | '轻松' | '标准' | '紧凑';
  missingCriticalFields?: string[];
  [key: string]: any;
}

export interface AdvisoryProfile {
  ageGroup?: '青年' | '中年' | '老年';
  budget?: '经济型' | '舒适型' | '豪华型';
}

export interface RoutePlanningRequest {
  query?: string;
  scene_state?: SceneStateInput;
  advisory_profile?: AdvisoryProfile;
}

export interface InputEffect {
  field: string;
  kind: 'hard_constraint' | 'soft_preference' | 'advisory';
  applied: boolean;
  summary: string;
}

export interface RoutePlanResponse {
  query?: string;
  outcome?: RouteOutcome;
  feasibility?: boolean;
  clarification?: string;
  scene_state?: SceneStateInput & {
    missingCriticalFields?: string[];
    [key: string]: unknown;
  };
  route?: {
    distanceMeters?: number;
    steps?: RouteStep[];
    totalMinutes?: number;
    walkingMinutes?: number;
    visitingMinutes?: number;
    waitingMinutes?: number;
    rejectedRequests?: RejectedRequest[];
    satisfiedConstraints?: string[];
    violations?: string[];
  };
  explanation?: {
    clarification?: string;
    satisfied_constraints?: string[];
    rejected_requests?: RejectedRequest[];
    violations?: Array<{ code: string; message: string; stepIndex?: number }>;
    input_effects?: InputEffect[];
    route_rationale?: string[];
    consumer_advice?: string[];
  };
  evidence?: RouteEvidence[];
  scene_extraction?: {
    source: string;
    confidence: Record<string, number>;
    missingFields: string[];
    conflicts: string[];
    trace: {
      configured: boolean;
      executed: boolean;
      status: string;
      model?: string;
      latencyMs?: number;
      fallbackUsed: boolean;
      reason?: string;
    };
  };
}
