# Scene Constraint Repair Design

## Objective

Make ordinary visitor language reliably produce a truthful route outcome. The system must distinguish current time, requested performance time, remaining time, hard constraints and soft preferences; it must never label an empty route as executable.

## Scope

In scope:

- deterministic extraction and normalization of time expressions;
- association of a time expression with its semantic role;
- explicit constraint priority and provenance;
- alternative planning after an optional preference is rejected;
- route outcome states and user-facing explanation;
- regression tests from extraction through API/UI state.

Out of scope:

- RAG retrieval, knowledge content, prompts, models, Top-K and evaluation Gold data;
- real-time traffic, GPS navigation and official operation-data claims;
- a general-purpose Chinese NLP framework.

## Normalized contract

Scene extraction will continue to return the existing `SceneState` fields, but time and request interpretation must preserve role-specific information before the planner consumes it. Each recognized temporal value must have a role, normalized value, source phrase and confidence. At minimum the roles are `current_time`, `remaining_duration` and `performance_time`.

Examples:

```text
现在上午10点
  current_time = 10:00

还想看两点的《吉祥颂》
  performance_time(performance_lingshan_jixiangsong) = 14:00

只有三小时
  remaining_duration = 180
```

The performance parser must associate a time with the nearby performance expression instead of selecting the last clock expression in the whole query. If a material ambiguity remains, the API returns `needs_clarification`; it does not silently guess.

## Constraint priority

- Hard: explicit `必须/一定要`, time budget, current location/time requirements, mobility accessibility, opening windows and route continuity.
- Soft: `想看/还想看/最好`, interest preferences and optional performance preferences.

An explicit performance request is not automatically hard unless the language marks it as mandatory. A rejected soft preference must be reported with a reason while preserving the hard constraints.

## Planner outcomes

The route response will expose a truthful outcome:

- `feasible`: non-empty valid route satisfies hard constraints and requested priorities;
- `feasible_with_rejected_preferences`: non-empty valid alternative route exists, but one or more soft preferences were rejected;
- `needs_clarification`: a key value is missing or materially ambiguous;
- `infeasible`: hard constraints cannot be satisfied or no valid route exists.

An empty `steps` array can never be returned with a successful/feasible outcome. If a preferred performance is outside the time budget, the planner first attempts a route without that soft preference. It returns `performance_outside_time_budget` with the computed deadline and requested start time. If no alternative exists, it returns `infeasible`.

## API and UI behavior

`POST /api/v1/visitor/route/plan` remains backward compatible. The response adds the outcome and structured rejection details while retaining existing `scene_state`, `route`, `feasibility`, `explanation` and `evidence` fields where possible.

The recommendation page renders from the outcome and route steps:

- executable timeline for non-empty valid routes;
- an adjustment notice for alternative routes;
- a conflict explanation and next action for infeasible requests;
- a clarification prompt for missing/ambiguous fields;
- never “路线可执行” for zero steps.

## Verification matrix

Tests must cover:

1. `现在上午10点，还想看两点的《吉祥颂》` → current `10:00`, performance `14:00`.
2. Numeric, Chinese, morning/afternoon/evening and half-hour forms.
3. Time-expression order changes and multiple times in one sentence.
4. `必须看` versus `想看/还想看` outcome differences.
5. 10:00 plus 180 minutes versus a 14:00 performance.
6. An optional-performance rejection with a valid alternative route.
7. No alternative route returns `infeasible`, never empty feasible.
8. API response and UI state agree on outcome, steps and rejection reason.

Acceptance requires the existing backend tests, new scene/planner/API tests, frontend mapping/build checks, `git diff --check`, and a live smoke of the user sentence. No RAG or LLM evaluation is rerun for this bounded route-contract change.

## Review notes

- The design avoids choosing a new NLP dependency.
- It preserves the existing route graph and deterministic planner boundary.
- It makes uncertainty visible instead of increasing apparent accuracy through guessing.
