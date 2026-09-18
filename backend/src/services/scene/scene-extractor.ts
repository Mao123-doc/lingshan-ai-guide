import { isDeepStrictEqual } from 'node:util';
import {
  SceneState,
  SceneStateSchema,
} from './scene-state';

export { extractSceneState } from './scene-state';

export type SceneExtractionSource = 'llm' | 'rules' | 'fallback' | 'merged';
export type SceneExtractionStatus = 'success' | 'fallback' | 'failed' | 'skipped';

export interface SceneExtractionResult {
  state: SceneState;
  source: SceneExtractionSource;
  confidence: Record<string, number>;
  missingFields: string[];
  conflicts: string[];
  trace: {
    configured: boolean;
    executed: boolean;
    status: SceneExtractionStatus;
    model?: string;
    latencyMs?: number;
    fallbackUsed: boolean;
    reason?: string;
  };
}

export type SceneStateValidationResult =
  | { success: true; state: SceneState }
  | { success: false; errors: string[] };

export interface SceneMergeMetadata {
  confidence: Record<string, number>;
  trace: SceneExtractionResult['trace'];
  source?: SceneExtractionSource;
  computedState?: Partial<SceneState>;
  unambiguousComputedFields?: string[];
}

const SCENE_FIELDS = [
  'currentLocation',
  'currentTime',
  'remainingMinutes',
  'partyType',
  'mobility',
  'mealRequested',
  'interests',
  'mustVisitSpotIds',
  'preferredPerformanceIds',
  'preferredPerformanceTimes',
  'visitedSpotIds',
  'budget',
  'pace',
  'missingCriticalFields',
] as const satisfies ReadonlyArray<keyof SceneState>;

const CRITICAL_FIELDS = new Set<keyof SceneState>([
  'currentLocation',
  'currentTime',
  'remainingMinutes',
  'preferredPerformanceTimes',
]);

const FORBIDDEN_LLM_FIELDS = [
  'steps',
  'walkingMinutes',
  'totalMinutes',
  'feasible',
  'outcome',
] as const;

export function validateSceneState(state: unknown): SceneStateValidationResult {
  const parsed = SceneStateSchema.safeParse(state);
  if (parsed.success) return { success: true, state: parsed.data };

  return {
    success: false,
    errors: parsed.error.issues.map(issue => {
      const path = issue.path.length > 0 ? issue.path.join('.') : 'state';
      return `${path}: ${issue.message}`;
    }),
  };
}

export function mergeSceneStates(
  ruleState: SceneState,
  llmState: Record<string, unknown>,
  metadata: SceneMergeMetadata,
): SceneExtractionResult {
  for (const field of FORBIDDEN_LLM_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(llmState, field)) {
      throw new Error(`forbidden LLM field: ${field}`);
    }
  }

  const merged: Partial<SceneState> = {};
  const conflicts: string[] = [];
  const unambiguousComputedFields = new Set(metadata.unambiguousComputedFields ?? []);
  let acceptedLlmField = false;
  let acceptedComputedField = false;

  for (const field of SCENE_FIELDS) {
    const ruleValue = ruleState[field];
    const llmValue = llmState[field];
    const hasRuleValue = ruleValue !== undefined;
    const hasLlmValue = llmValue !== undefined && llmValue !== null;

    if (hasLlmValue && hasRuleValue && !isDeepStrictEqual(llmValue, ruleValue) && CRITICAL_FIELDS.has(field)) {
      conflicts.push(field);
      assignField(merged, field, ruleValue);
      continue;
    }

    if (hasLlmValue) {
      assignField(merged, field, llmValue);
      acceptedLlmField = true;
      continue;
    }

    if (hasRuleValue) {
      assignField(merged, field, ruleValue);
      continue;
    }

    const computedValue = metadata.computedState?.[field];
    if (computedValue !== undefined && unambiguousComputedFields.has(field)) {
      assignField(merged, field, computedValue);
      acceptedComputedField = true;
    }
  }

  const validation = validateSceneState(merged);
  if (!validation.success) {
    throw new Error(`invalid merged scene state: ${validation.errors.join('; ')}`);
  }

  const missingFields = SCENE_FIELDS.filter(field => validation.state[field] === undefined);
  const source = metadata.source
    ?? (acceptedLlmField || acceptedComputedField ? 'merged' : 'rules');

  return {
    state: validation.state,
    source,
    confidence: { ...metadata.confidence },
    missingFields,
    conflicts,
    trace: { ...metadata.trace },
  };
}

function assignField(
  target: Partial<SceneState>,
  field: keyof SceneState,
  value: unknown,
): void {
  (target as Record<keyof SceneState, unknown>)[field] = value;
}
