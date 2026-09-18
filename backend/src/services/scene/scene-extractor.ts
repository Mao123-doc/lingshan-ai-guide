import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import {
  callLLMWithMetadata,
  isLLMAvailable,
} from '../llm-service';
import {
  extractSceneState,
  SceneState,
  SceneStateSchema,
} from './scene-state';

export { extractSceneState };

export type SceneExtractionSource = 'llm' | 'rules' | 'fallback' | 'merged';
export type SceneExtractionStatus = 'success' | 'fallback' | 'failed' | 'skipped';
export type SceneExtractionState = Omit<SceneState, 'mealRequested'> & {
  mealRequested?: boolean;
};

export interface SceneExtractionResult {
  state: SceneExtractionState;
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
  | { success: true; state: SceneExtractionState }
  | { success: false; errors: string[] };

export interface SceneMergeMetadata {
  confidence: Record<string, number>;
  trace: SceneExtractionResult['trace'];
  source?: SceneExtractionSource;
  computedState?: Partial<SceneExtractionState>;
  unambiguousComputedFields?: string[];
}

const SceneExtractionStateSchema = SceneStateSchema.extend({
  mealRequested: z.boolean().optional(),
});

type SceneField = keyof SceneExtractionState;

const SCENE_FIELDS = ([...new Set([
  ...Object.keys(SceneStateSchema.shape),
  'mealRequested',
])] as SceneField[]).filter(field => field !== 'missingCriticalFields');
const EXTRACTABLE_SCENE_FIELDS = SCENE_FIELDS;

const CRITICAL_FIELDS = new Set<SceneField>([
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

const KNOWN_SPOT_IDS = new Set([
  'LS-001', 'LS-003', 'LS-004', 'LS-005', 'LS-006', 'LS-008', 'LS-009',
  'LS-010', 'LS-011', 'LS-012', 'LS-013', 'LS-014', 'LS-015', 'LS-016',
  'NH-002', 'NH-006',
]);
const KNOWN_LOCATION_IDS = new Set(['south_gate', ...KNOWN_SPOT_IDS]);
const KNOWN_PERFORMANCE_IDS = new Set([
  'performance_lingshan_jixiangsong',
  'performance_jiulong_guanyu',
]);

const CRITICAL_FIELD_CONFIDENCE_THRESHOLD = 0.75;

const LLM_SCENE_EXTRACTION_PROMPT = `Extract only scene facts explicitly stated by the visitor.
Return JSON only, with no markdown or explanation, in this shape:
{"state":{"currentLocation":string|null,"currentTime":"HH:mm"|null,"remainingMinutes":number|null,"partyType":string|null,"mobility":"normal"|"limited"|"wheelchair"|"unknown"|null,"mealRequested":boolean|null,"interests":string[]|null,"mustVisitSpotNames":string[]|null,"mustVisitSpotIds":string[]|null,"preferredPerformanceNames":string[]|null,"preferredPerformanceIds":string[]|null,"preferredPerformanceTimes":{"name-or-id":"HH:mm"}|null,"visitedSpotNames":string[]|null,"visitedSpotIds":string[]|null},"confidence":{"fieldName":number}}
Use null for every unknown scalar or collection. Provide confidence for every semantic field; every confidence value must be between 0 and 1.
Do not guess locations, times, durations, names, IDs, preferences, or mobility. Direct arithmetic from an explicit time range is allowed.
Never include route fields or route decisions such as steps, walkingMinutes, totalMinutes, feasible, or outcome.`;

const nullableTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional();
const nullableStringArray = z.array(z.string()).nullable().optional();

const LLMSceneStateSchema = z.object({
  currentLocation: z.string().min(1).nullable().optional(),
  currentTime: nullableTime,
  remainingMinutes: z.number().int().positive().nullable().optional(),
  partyType: z.string().min(1).nullable().optional(),
  mobility: z.enum(['normal', 'limited', 'wheelchair', 'unknown']).nullable().optional(),
  mealRequested: z.boolean().nullable().optional(),
  interests: nullableStringArray,
  mustVisitSpotNames: nullableStringArray,
  mustVisitSpotIds: nullableStringArray,
  preferredPerformanceNames: nullableStringArray,
  preferredPerformanceIds: nullableStringArray,
  preferredPerformanceTimes: z.record(
    z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  ).nullable().optional(),
  visitedSpotNames: nullableStringArray,
  visitedSpotIds: nullableStringArray,
}).strict();

const LLMSceneExtractionSchema = z.object({
  state: LLMSceneStateSchema,
  confidence: z.record(z.number().min(0).max(1)),
}).strict();

type LLMSceneState = z.infer<typeof LLMSceneStateSchema>;

export function validateSceneState(state: unknown): SceneStateValidationResult {
  const parsed = SceneExtractionStateSchema.safeParse(state);
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
  ruleState: SceneExtractionState,
  llmState: Record<string, unknown>,
  metadata: SceneMergeMetadata,
): SceneExtractionResult {
  for (const field of FORBIDDEN_LLM_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(llmState, field)) {
      throw new Error(`forbidden LLM field: ${field}`);
    }
  }

  const merged: Partial<SceneExtractionState> = {};
  const conflicts: string[] = [];
  const unambiguousComputedFields = new Set(metadata.unambiguousComputedFields ?? []);
  let acceptedLlmField = false;
  let acceptedComputedField = false;

  for (const field of SCENE_FIELDS) {
    const ruleValue = ruleState[field];
    const llmValue = llmState[field];
    const hasRuleValue = ruleValue !== undefined;
    const hasLlmValue = llmValue !== undefined && llmValue !== null;

    if (hasLlmValue && hasRuleValue && !isDeepStrictEqual(llmValue, ruleValue)) {
      conflicts.push(field);
      if (CRITICAL_FIELDS.has(field)) {
        assignField(merged, field, ruleValue);
        continue;
      }
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

  const missingCriticalFields = recomputeMissingCriticalFields(merged, conflicts);
  merged.missingCriticalFields = missingCriticalFields;

  const validation = validateSceneState(merged);
  if (!validation.success) {
    throw new Error(`invalid merged scene state: ${validation.errors.join('; ')}`);
  }

  const missingFields = EXTRACTABLE_SCENE_FIELDS.filter(field =>
    validation.state[field] === undefined
    || (CRITICAL_FIELDS.has(field) && conflicts.includes(field)),
  );
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

export async function extractSceneStateWithLLM(query: string): Promise<SceneExtractionResult> {
  const ruleState = extractSceneState(query) as SceneExtractionState;

  if (!isLLMAvailable()) {
    return buildFallbackResult(ruleState, {
      configured: false,
      executed: false,
      reason: 'llm_unavailable',
    });
  }

  const startedAt = Date.now();
  let response: Awaited<ReturnType<typeof callLLMWithMetadata>>;
  try {
    response = await callLLMWithMetadata(
      [
        { role: 'system', content: LLM_SCENE_EXTRACTION_PROMPT },
        { role: 'user', content: query },
      ],
      { temperature: 0, max_tokens: 500 },
    );
  } catch {
    return buildFallbackResult(ruleState, {
      configured: true,
      executed: true,
      reason: 'llm_call_failed',
      latencyMs: Date.now() - startedAt,
    });
  }

  const traceBase = {
    configured: true,
    executed: true,
    latencyMs: Date.now() - startedAt,
    model: response.modelIdentity.providerModel ?? response.modelIdentity.requestedModel,
  };
  const content = response.content.trim();
  if (!content) {
    return buildFallbackResult(ruleState, {
      ...traceBase,
      reason: 'empty_response',
    });
  }

  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch {
    return buildFallbackResult(ruleState, {
      ...traceBase,
      reason: 'invalid_json',
    });
  }

  if (findForbiddenLLMField(raw)) {
    return buildFallbackResult(ruleState, {
      ...traceBase,
      reason: 'forbidden_route_field',
    });
  }

  const parsed = LLMSceneExtractionSchema.safeParse(raw);
  if (!parsed.success) {
    return buildFallbackResult(ruleState, {
      ...traceBase,
      reason: 'schema_error',
    });
  }

  const llmState = normalizeLLMSceneState(parsed.data.state);
  if (hasLowCriticalFieldConfidence(llmState, parsed.data.confidence)) {
    return buildFallbackResult(ruleState, {
      ...traceBase,
      reason: 'low_critical_field_confidence',
    });
  }

  try {
    return mergeSceneStates(ruleState, llmState, {
      confidence: parsed.data.confidence,
      source: determineSuccessfulSource(ruleState, llmState),
      trace: {
        ...traceBase,
        status: 'success',
        fallbackUsed: false,
      },
    });
  } catch {
    return buildFallbackResult(ruleState, {
      ...traceBase,
      reason: 'schema_error',
    });
  }
}

function buildFallbackResult(
  ruleState: SceneExtractionState,
  details: {
    configured: boolean;
    executed: boolean;
    reason: string;
    model?: string;
    latencyMs?: number;
  },
): SceneExtractionResult {
  return mergeSceneStates(ruleState, {}, {
    confidence: {},
    source: 'fallback',
    trace: {
      ...details,
      status: 'fallback',
      fallbackUsed: true,
    },
  });
}

function findForbiddenLLMField(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = findForbiddenLLMField(item);
      if (nested) return nested;
    }
    return undefined;
  }

  for (const [field, nestedValue] of Object.entries(value)) {
    if ((FORBIDDEN_LLM_FIELDS as readonly string[]).includes(field)) return field;
    const nested = findForbiddenLLMField(nestedValue);
    if (nested) return nested;
  }
  return undefined;
}

function normalizeLLMSceneState(state: LLMSceneState): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  copyKnownValue(normalized, 'currentLocation', mapLocation(state.currentLocation));
  copyKnownValue(normalized, 'currentTime', state.currentTime);
  copyKnownValue(normalized, 'remainingMinutes', state.remainingMinutes);
  copyKnownValue(normalized, 'partyType', state.partyType);
  copyKnownValue(normalized, 'mobility', state.mobility);
  copyKnownValue(normalized, 'mealRequested', state.mealRequested);
  copyKnownValue(normalized, 'interests', state.interests);
  copyKnownValue(
    normalized,
    'mustVisitSpotIds',
    combineMappedIds(
      state.mustVisitSpotIds,
      state.mustVisitSpotNames,
      mapMustVisitSpotName,
      id => KNOWN_SPOT_IDS.has(id),
    ),
  );
  copyKnownValue(
    normalized,
    'preferredPerformanceIds',
    combineMappedIds(
      state.preferredPerformanceIds,
      state.preferredPerformanceNames,
      mapPerformanceName,
      id => KNOWN_PERFORMANCE_IDS.has(id),
    ),
  );
  copyKnownValue(
    normalized,
    'preferredPerformanceTimes',
    mapPerformanceTimes(state.preferredPerformanceTimes),
  );
  copyKnownValue(
    normalized,
    'visitedSpotIds',
    combineMappedIds(
      state.visitedSpotIds,
      state.visitedSpotNames,
      mapVisitedSpotName,
      id => KNOWN_SPOT_IDS.has(id),
    ),
  );
  return normalized;
}

function copyKnownValue(
  target: Record<string, unknown>,
  field: string,
  value: unknown,
): void {
  if (value !== undefined && value !== null) target[field] = value;
}

function mapLocation(location: string | null | undefined): string | undefined {
  if (!location) return undefined;
  if (KNOWN_LOCATION_IDS.has(location)) return location;
  const mapped = extractSceneState(`现在在${location}`).currentLocation;
  return mapped && KNOWN_LOCATION_IDS.has(mapped) ? mapped : undefined;
}

function combineMappedIds(
  ids: string[] | null | undefined,
  names: string[] | null | undefined,
  mapName: (name: string) => string | undefined,
  isKnownId: (id: string) => boolean,
): string[] | undefined {
  if (ids == null && names == null) return undefined;
  const knownIds = (ids ?? []).filter(isKnownId);
  const mappedNames = (names ?? []).map(mapName).filter((id): id is string => id !== undefined);
  const mappedIds = [...new Set([...knownIds, ...mappedNames])];
  if (mappedIds.length > 0) return mappedIds;

  const explicitlyEmpty = (ids ?? []).length === 0 && (names ?? []).length === 0;
  return explicitlyEmpty ? [] : undefined;
}

function mapMustVisitSpotName(name: string): string | undefined {
  const mapped = extractSceneState(`必须去${name}`).mustVisitSpotIds[0];
  return mapped && KNOWN_SPOT_IDS.has(mapped) ? mapped : undefined;
}

function mapVisitedSpotName(name: string): string | undefined {
  const mapped = extractSceneState(`已经去过${name}`).visitedSpotIds[0];
  return mapped && KNOWN_SPOT_IDS.has(mapped) ? mapped : undefined;
}

function mapPerformanceName(name: string): string | undefined {
  if (KNOWN_PERFORMANCE_IDS.has(name)) return name;
  const mapped = extractSceneState(`想看${name}表演`).preferredPerformanceIds[0];
  return mapped && KNOWN_PERFORMANCE_IDS.has(mapped) ? mapped : undefined;
}

function mapPerformanceTimes(
  times: Record<string, string> | null | undefined,
): Record<string, string> | undefined {
  if (times == null) return undefined;
  const mapped = Object.entries(times)
    .map(([nameOrId, time]) => {
      const performanceId = mapPerformanceName(nameOrId);
      return performanceId ? [performanceId, time] as const : undefined;
    })
    .filter((entry): entry is readonly [string, string] => entry !== undefined);
  if (mapped.length > 0) return Object.fromEntries(mapped);
  return Object.keys(times).length === 0 ? {} : undefined;
}

function hasLowCriticalFieldConfidence(
  state: Record<string, unknown>,
  confidence: Record<string, number>,
): boolean {
  for (const field of CRITICAL_FIELDS) {
    const value = state[field];
    const hasValue = value !== undefined
      && value !== null
      && (!Array.isArray(value) || value.length > 0)
      && (typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length > 0);
    if (hasValue && (confidence[field] ?? 0) < CRITICAL_FIELD_CONFIDENCE_THRESHOLD) {
      return true;
    }
  }
  return false;
}

function determineSuccessfulSource(
  ruleState: SceneExtractionState,
  llmState: Record<string, unknown>,
): SceneExtractionSource {
  const ruleContributed = SCENE_FIELDS.some(field =>
    ruleState[field] !== undefined
      && (
        llmState[field] === undefined
        || (CRITICAL_FIELDS.has(field) && !isDeepStrictEqual(ruleState[field], llmState[field]))
      ),
  );
  return ruleContributed ? 'merged' : 'llm';
}

function recomputeMissingCriticalFields(
  state: Partial<SceneExtractionState>,
  conflicts: string[],
): string[] {
  const missing = new Set<string>();
  if (state.currentLocation === undefined) missing.add('currentLocation');
  if (state.remainingMinutes === undefined) missing.add('remainingMinutes');
  if ((state.preferredPerformanceIds?.length ?? 0) > 0 && state.currentTime === undefined) {
    missing.add('currentTime');
  }
  for (const field of conflicts) {
    if (CRITICAL_FIELDS.has(field as SceneField)) missing.add(field);
  }
  return [...missing];
}

function assignField(
  target: Partial<SceneExtractionState>,
  field: SceneField,
  value: unknown,
): void {
  (target as Record<SceneField, unknown>)[field] = value;
}
