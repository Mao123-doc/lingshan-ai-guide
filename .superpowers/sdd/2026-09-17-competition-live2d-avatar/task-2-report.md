# Task 2 Report — Deterministic Avatar Controller

## Outcome

Implemented the pure deterministic avatar controller on branch
`codex/digital-human-design`. The controller consumes the Task 1 avatar types,
contains no browser, React, PIXI, AudioContext, network, or random-number
dependencies, and does not change any later-task integration surface.

## TDD evidence

### RED

After adding only
`frontend/src/components/visitor/avatar/avatar-controller.test.ts`, ran:

```text
npm run test:unit -- --run src/components/visitor/avatar/avatar-controller.test.ts
```

Result: exit code `1`, as required. Vitest failed before collecting tests because
the production module did not exist:

```text
FAIL  src/components/visitor/avatar/avatar-controller.test.ts
Error: Failed to resolve import "./avatar-controller" from
"src/components/visitor/avatar/avatar-controller.test.ts". Does the file exist?

Test Files  1 failed (1)
Tests       no tests
```

This was the expected RED condition: the controller exports were absent, rather
than a syntax, fixture, or assertion error.

### GREEN

After adding the minimal controller implementation, reran the same focused
command:

```text
npm run test:unit -- --run src/components/visitor/avatar/avatar-controller.test.ts
```

Result: exit code `0`.

```text
Test Files  1 passed (1)
Tests       9 passed (9)
Duration    917ms
```

The focused tests cover:

- the required greeting → thinking → route speaking → interrupted sequence;
- the exact speaking selector mapping, including route direction and culture
  story sequence alternation;
- request failure apology and session farewell;
- warning/serious expression safety;
- identical seed/event replay determinism;
- stale playback-ended and playback-interrupted token rejection;
- `ANSWER_READY` scene/emphasis motion selection without speaking;
- listening transitions and safe playback completion;
- sequence increments for accepted events only.

## Proportionate frontend verification

### Complete frontend unit suite

Command:

```text
npm run test:unit
```

Result: exit code `0`.

```text
Test Files  6 passed (6)
Tests       26 passed (26)
Duration    5.14s
```

### TypeScript and production build

Command:

```text
npm run build
```

Result: exit code `0`; `tsc -b` and Vite both completed successfully.

```text
vite v8.0.16 building client environment for production...
✓ 4144 modules transformed.
✓ built in 1.33s
```

### Focused lint and dependency boundary

Command:

```text
.\node_modules\.bin\eslint.cmd src/components/visitor/avatar/avatar-controller.ts src/components/visitor/avatar/avatar-controller.test.ts
```

Result: exit code `0`, with no findings.

A source scan found no use of `Math.random`, browser globals, React, PIXI,
`AudioContext`, `fetch`, Axios, or WebSocket in the controller.

## Implementation notes

- `sessionSeed` is retained as the initial sequence value. Sequence parity
  deterministically selects `idle_a`/`idle_b` and the required culture-story
  motion variant.
- Every accepted event increments sequence exactly once.
- A stale `PLAYBACK_ENDED` or `PLAYBACK_INTERRUPTED` returns the original state
  object unchanged, including sequence and active playback token.
- `ANSWER_READY` has no `emphasis` storage field in the Task 1 render-state
  contract, so its emphasis is represented by the deterministic selected
  motion while `speaking` remains `false`.
- Scene expressions are table-driven; warning always selects `serious`, never
  `smile`.

## Files changed

- `frontend/src/components/visitor/avatar/avatar-controller.ts` — pure selector,
  initial state, and reducer.
- `frontend/src/components/visitor/avatar/avatar-controller.test.ts` — controller
  regression suite.
- `.superpowers/sdd/2026-09-17-competition-live2d-avatar/task-2-report.md` — this
  evidence report (force-added because `.superpowers/sdd/.gitignore` ignores SDD
  working files by default).

No RAG, LLM, Prompt, Retrieval, route planning, QAPage, renderer, backend,
knowledge-base, model-parameter, evaluation, feature-flag, or asset file was
modified.

## Concerns

The production build emits Vite's existing warning that some generated chunks
exceed 500 kB after minification. The build still exits successfully, and this
controller adds no runtime dependency or bundle-heavy import. There are no
Task 2 implementation concerns.
