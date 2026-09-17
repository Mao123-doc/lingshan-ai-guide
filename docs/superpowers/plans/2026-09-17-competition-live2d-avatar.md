# Competition Live2D Avatar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a competition-grade, scene-aware Cubism 4 digital human that performs deterministic gestures and expressions, synchronizes mouth motion with TTS, supports interruption and fallback, and produces reproducible test and performance evidence.

**Architecture:** A pure Avatar Controller maps bounded UI/API events to render state. A Cubism 4 renderer consumes only validated manifest IDs, while a Speech Timeline uses the Web Audio clock for mouth cues. Backend presentation policy adds a bounded scene hint after answer generation and never participates in RAG or route decisions.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Vitest 5, PixiJS 7, `pixi-live2d-display/cubism4`, Live2D Cubism 4 Core, Web Audio API, Express, Node test runner, Python `edge-tts`, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-17-competition-live2d-avatar-design.md`

## Global Constraints

- Use one licensed Cubism 4 `lingxiaochan-v1` model; do not extend Hibiki for the competition build.
- Do not alter RAG retrieval, query rewrite, rerank, context construction, LLM generation, route planning, Fact Contract, or Evaluation behavior.
- LLM output must never select raw motion names, expression indices, model paths, or renderer parameters.
- Only IDs declared in `LINGXIAOCHAN_MANIFEST` may reach the renderer.
- State-to-action response must be at most 200ms; playback interruption to closed mouth and stopped major motion must be at most 300ms.
- Desktop FPS P5 must be at least 50 FPS; agreed mobile test device FPS P5 must be at least 30 FPS.
- Mouth/audio P95 drift must be at most 150ms; silence longer than 250ms must close the mouth.
- `prefers-reduced-motion: reduce` disables major body gestures and particles while preserving state and low-amplitude mouth feedback.
- Static fallback is allowed only with an explicit renderer status and reason; it must never be reported as Live2D ready.
- All new behavior is implemented with RED → GREEN tests and independently reviewable commits.

## Required External Asset Gate

Before Task 3 can pass, an authorized Live2D artist or licensed supplier must deliver:

```text
frontend/public/models/lingxiaochan/
  lingxiaochan.model3.json
  lingxiaochan.moc3
  lingxiaochan.physics3.json
  textures/
  expressions/
  motions/
  LICENSE.md
```

The asset must expose the 13 motions, 6 expressions, and parameter IDs listed in the spec. Codex validates and integrates the asset; it must not fabricate a `.moc3` binary or claim that static art is a custom Live2D model.

## Planned File Structure

```text
frontend/src/components/visitor/avatar/
  avatar-types.ts             # Public scene/state/event/render contracts
  avatar-manifest.ts          # lingxiaochan-v1 motion/expression manifest
  avatar-manifest.test.ts     # Manifest contract tests
  avatar-controller.ts        # Pure deterministic reducer
  avatar-controller.test.ts   # Transition, priority and interruption tests
  speech-timeline.ts          # Web Audio clock to mouth cue selection
  speech-timeline.test.ts     # Cue, pause and reset tests
  live2d-adapter.ts           # Narrow wrapper over pixi-live2d-display
  live2d-adapter.test.ts      # Motion/expression validation tests
frontend/src/components/visitor/
  Live2DCanvas.tsx            # Renderer lifecycle and parameter updates
  DigitalHuman.tsx            # Ready/fallback shell and diagnostics attributes
  DigitalHuman.test.tsx       # Component fallback/ready/reduced-motion tests
frontend/src/pages/visitor/
  QAPage.tsx                  # Dispatch controller events; no renderer decisions
  __tests__/QAPage.test.tsx   # End-to-end state transition component tests
frontend/src/pages/admin/
  DigitalHumanPage.tsx        # Action/expression/diagnostic preview
backend/src/services/
  avatar-presentation.ts      # Deterministic presentation policy
backend/tests/presentation/
  avatar-presentation.test.ts # Policy contract tests
backend/python/
  tts_alignment.py            # Edge TTS audio and boundary timeline generation
backend/python/tools/
  test_tts_alignment.py       # Pure alignment regression tests
frontend/scripts/
  validate-avatar-assets.mjs  # Model file, manifest and size gate
frontend/e2e/
  avatar-journeys.spec.ts     # Ten competition journeys
docs/competition/
  digital-human-evidence.md   # Model/version/device/results evidence
```

---

### Task 1: Freeze the Avatar Contracts and Asset Gate

**Files:**
- Create: `frontend/src/components/visitor/avatar/avatar-types.ts`
- Create: `frontend/src/components/visitor/avatar/avatar-manifest.ts`
- Create: `frontend/src/components/visitor/avatar/avatar-manifest.test.ts`
- Create: `frontend/scripts/validate-avatar-assets.mjs`
- Modify: `frontend/package.json`

**Interfaces:**
- Produces: `AvatarMotionId`, `AvatarExpressionId`, `AvatarScene`, `AvatarState`, `AvatarEvent`, `AvatarRenderState`, `AvatarModelManifest`, `LINGXIAOCHAN_MANIFEST`, `assertValidAvatarManifest()`.
- Consumes: No feature interfaces; this task is the dependency root.

- [ ] **Step 1: Write the failing manifest tests**

Create `avatar-manifest.test.ts` with these cases:

```ts
import { describe, expect, it } from 'vitest';
import { assertValidAvatarManifest, LINGXIAOCHAN_MANIFEST } from './avatar-manifest';

describe('LINGXIAOCHAN_MANIFEST', () => {
  it('contains every competition motion and expression', () => {
    expect(() => assertValidAvatarManifest(LINGXIAOCHAN_MANIFEST)).not.toThrow();
    expect(Object.keys(LINGXIAOCHAN_MANIFEST.motions)).toHaveLength(13);
    expect(Object.keys(LINGXIAOCHAN_MANIFEST.expressions)).toHaveLength(6);
  });

  it('rejects an undeclared or duplicate renderer target', () => {
    const broken = {
      ...LINGXIAOCHAN_MANIFEST,
      motions: { ...LINGXIAOCHAN_MANIFEST.motions, warning: { group: '', index: -1 } },
    };
    expect(() => assertValidAvatarManifest(broken)).toThrow(/warning/);
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
cd frontend
npm run test:unit -- --run src/components/visitor/avatar/avatar-manifest.test.ts
```

Expected: FAIL because `avatar-manifest.ts` and exported contracts do not exist.

- [ ] **Step 3: Add the exact contract types**

Implement the unions and interfaces exactly as defined in Sections 4.1–4.3 of the spec. Add the presentation emphasis type:

```ts
export interface PresentationHint {
  avatar_scene: AvatarScene;
  emphasis?: 'left' | 'right' | 'none';
}
```

- [ ] **Step 4: Implement and validate the production manifest**

Use these stable keys:

```ts
export const LINGXIAOCHAN_MANIFEST: AvatarModelManifest = {
  id: 'lingxiaochan-v1',
  modelUrl: '/models/lingxiaochan/lingxiaochan.model3.json',
  fallbackImageUrl: '/images/lingxiaochan-fallback.png',
  motions: {
    idle_a: { group: 'Idle', index: 0 },
    idle_b: { group: 'Idle', index: 1 },
    greeting_wave: { group: 'Greeting', index: 0 },
    listening_focus: { group: 'Listening', index: 0 },
    thinking: { group: 'Thinking', index: 0 },
    explain_a: { group: 'Explain', index: 0 },
    explain_b: { group: 'Explain', index: 1 },
    point_left: { group: 'Point', index: 0 },
    point_right: { group: 'Point', index: 1 },
    affirm_nod: { group: 'Affirm', index: 0 },
    warning: { group: 'Warning', index: 0 },
    apology: { group: 'Apology', index: 0 },
    farewell: { group: 'Farewell', index: 0 },
  },
  expressions: {
    neutral: 0,
    smile: 1,
    focused: 2,
    thinking: 3,
    serious: 4,
    sorry: 5,
  },
};
```

`assertValidAvatarManifest()` must reject empty group names, negative indices, missing expected keys, model URLs outside `/models/lingxiaochan/`, and duplicate `{group,index}` targets.

- [ ] **Step 5: Add the filesystem asset validator**

`validate-avatar-assets.mjs` must:

1. read `public/models/lingxiaochan/manifest.json` and `lingxiaochan.model3.json`;
2. assert every path referenced by `model3.json` exists;
3. assert `LICENSE.md` exists and is non-empty;
4. assert no individual file exceeds 100MB;
5. exit non-zero with a path-specific message on failure.

Add to `frontend/package.json`:

```json
"validate:avatar": "node scripts/validate-avatar-assets.mjs"
```

- [ ] **Step 6: Run GREEN and static checks**

Run:

```bash
cd frontend
npm run test:unit -- --run src/components/visitor/avatar/avatar-manifest.test.ts
npm run build
```

Expected: manifest tests PASS and build exits 0. `npm run validate:avatar` is allowed to remain blocked only until the external asset gate is supplied; it cannot be waived for Task 3 or final acceptance.

- [ ] **Step 7: Commit the contracts**

```bash
git add frontend/src/components/visitor/avatar frontend/scripts/validate-avatar-assets.mjs frontend/package.json
git commit -m "feat(avatar): define model and action contracts"
```

---

### Task 2: Implement the Deterministic Avatar Controller

**Files:**
- Create: `frontend/src/components/visitor/avatar/avatar-controller.ts`
- Create: `frontend/src/components/visitor/avatar/avatar-controller.test.ts`

**Interfaces:**
- Consumes: `AvatarEvent`, `AvatarRenderState`, `AvatarScene` from Task 1.
- Produces: `initialAvatarState(sessionSeed: number): AvatarRenderState`, `reduceAvatarState(state, event): AvatarRenderState`, `selectSpeakingMotion(scene, emphasis, sequence): AvatarMotionId`.

- [ ] **Step 1: Write transition and priority tests**

Cover this exact sequence:

```ts
const initial = initialAvatarState(7);
const greeting = reduceAvatarState(initial, { type: 'SESSION_STARTED' });
expect(greeting.motion).toBe('greeting_wave');

const thinking = reduceAvatarState(greeting, { type: 'REQUEST_STARTED' });
expect(thinking).toMatchObject({ state: 'thinking', motion: 'thinking', speaking: false });

const speaking = reduceAvatarState(thinking, {
  type: 'PLAYBACK_STARTED',
  scene: 'route_guidance',
  emphasis: 'right',
  playbackToken: 'message-1',
});
expect(speaking).toMatchObject({ state: 'speaking', motion: 'point_right', expression: 'focused', speaking: true });

const interrupted = reduceAvatarState(speaking, { type: 'PLAYBACK_INTERRUPTED', playbackToken: 'message-1' });
expect(interrupted).toMatchObject({ state: 'interrupted', speaking: false, expression: 'neutral' });
```

Also test `REQUEST_FAILED → apology`, `SESSION_ENDED → farewell`, warning never maps to smile, and identical seed/event sequences produce identical motions.

- [ ] **Step 2: Run RED**

```bash
cd frontend
npm run test:unit -- --run src/components/visitor/avatar/avatar-controller.test.ts
```

Expected: FAIL because controller exports do not exist.

- [ ] **Step 3: Implement the pure reducer**

Use a table-driven mapping. Do not call `Math.random()`, browser APIs, React hooks, PIXI, or AudioContext. Increment `sequence` for every accepted event. Ignore stale `PLAYBACK_ENDED` and `PLAYBACK_INTERRUPTED` events unless their required `playbackToken` equals the active render-state token.

The speaking selector must implement:

```ts
if (scene === 'route_guidance') return emphasis === 'left' ? 'point_left' : 'point_right';
if (scene === 'warning') return 'warning';
if (scene === 'apology') return 'apology';
if (scene === 'recommendation') return 'affirm_nod';
if (scene === 'culture_story') return sequence % 2 === 0 ? 'explain_a' : 'explain_b';
return 'explain_a';
```

- [ ] **Step 4: Run GREEN**

```bash
cd frontend
npm run test:unit -- --run src/components/visitor/avatar/avatar-controller.test.ts
```

Expected: all controller cases PASS.

- [ ] **Step 5: Commit the controller**

```bash
git add frontend/src/components/visitor/avatar/avatar-controller.ts frontend/src/components/visitor/avatar/avatar-controller.test.ts
git commit -m "feat(avatar): add deterministic action controller"
```

---

### Task 3: Integrate the Licensed Cubism 4 Model and Renderer Adapter

**Files:**
- Create: `frontend/src/components/visitor/avatar/live2d-adapter.ts`
- Create: `frontend/src/components/visitor/avatar/live2d-adapter.test.ts`
- Modify: `frontend/src/components/visitor/Live2DCanvas.tsx:1-269`
- Modify: `frontend/src/components/visitor/DigitalHuman.tsx:1-171`
- Create: `frontend/src/components/visitor/DigitalHuman.test.tsx`
- Modify: `frontend/src/components/visitor/DigitalHuman.css`
- Add authorized assets under: `frontend/public/models/lingxiaochan/`
- Add fallback image: `frontend/public/images/lingxiaochan-fallback.png`

**Interfaces:**
- Consumes: `LINGXIAOCHAN_MANIFEST`, `AvatarRenderState`.
- Produces: `Live2DAdapter`, `RendererStatus`, `RendererFailureReason`; `DigitalHuman` props become `{ renderState, mouth, reducedMotion }`.

- [ ] **Step 1: Import and verify the external asset**

Place the delivered files at the exact paths from the spec, add the supplier license text to `LICENSE.md`, and create `manifest.json` matching `LINGXIAOCHAN_MANIFEST`.

Run:

```bash
cd frontend
npm run validate:avatar
```

Expected: exit 0 with model ID, 13 motions, 6 expressions, and maximum file size printed. If the asset is missing or unauthorized, stop this task; do not substitute Hibiki or a static image.

- [ ] **Step 2: Write adapter and component RED tests**

Mock the renderer adapter and verify:

```ts
expect(adapter.playMotion).toHaveBeenCalledWith('Point', 1);
expect(adapter.setExpression).toHaveBeenCalledWith(2);
expect(adapter.setMouth).toHaveBeenCalledWith({ open: 0.7, form: -0.2 });
```

Component cases must assert:

- ready status hides fallback image;
- `model_fetch_failed` displays fallback and emits the reason;
- unmount calls `destroy()` once;
- reduced-motion suppresses `playMotion` but retains `setExpression` and `setMouth`.

- [ ] **Step 3: Run RED**

```bash
cd frontend
npm run test:unit -- --run src/components/visitor/avatar/live2d-adapter.test.ts src/components/visitor/DigitalHuman.test.tsx
```

Expected: FAIL because the adapter and new props do not exist.

- [ ] **Step 4: Implement the narrow adapter**

Import only the Cubism 4 package:

```ts
const [{ Application }, { Live2DModel }] = await Promise.all([
  import('pixi.js'),
  import('pixi-live2d-display/cubism4'),
]);
```

The adapter public surface must be:

```ts
export interface Live2DAdapter {
  load(container: HTMLElement, modelUrl: string, width: number, height: number): Promise<void>;
  playMotion(group: string, index: number): Promise<void>;
  setExpression(index: number): void;
  setMouth(shape: { open: number; form: number }): void;
  getFps(): number;
  destroy(): void;
}
```

All package-specific types remain inside `live2d-adapter.ts`.

- [ ] **Step 5: Refactor the renderer shell**

`Live2DCanvas` receives validated IDs, resolves them through the manifest, and reports:

```ts
type RendererStatus = 'loading' | 'ready' | 'fallback' | 'failed';
type RendererFailureReason =
  | 'webgl_unavailable'
  | 'runtime_missing'
  | 'model_fetch_failed'
  | 'model_contract_invalid'
  | 'renderer_init_failed';
```

Add stable DOM diagnostics to `DigitalHuman`:

```tsx
<div
  data-avatar-state={renderState.state}
  data-avatar-scene={renderState.scene}
  data-avatar-motion={renderState.motion}
  data-avatar-renderer={rendererStatus}
  data-avatar-fallback-reason={fallbackReason || ''}
>
```

Remove the four-picture-to-one-model appearance illusion from the visitor renderer. Keep one branded fallback image. Admin voice selection may remain.

- [ ] **Step 6: Run GREEN, build and asset validation**

```bash
cd frontend
npm run validate:avatar
npm run test:unit -- --run src/components/visitor/avatar/live2d-adapter.test.ts src/components/visitor/DigitalHuman.test.tsx
npm run build
```

Expected: all commands exit 0; normal test path reports `ready`, explicit failure path reports `fallback` with reason.

- [ ] **Step 7: Commit renderer and licensed assets**

```bash
git add frontend/src/components/visitor frontend/public/models/lingxiaochan frontend/public/images/lingxiaochan-fallback.png
git commit -m "feat(avatar): integrate licensed Lingxiaochan Live2D model"
```

---

### Task 4: Add the Bounded Backend Presentation Policy

**Files:**
- Create: `backend/src/services/avatar-presentation.ts`
- Create: `backend/tests/presentation/avatar-presentation.test.ts`
- Modify: `backend/src/api/v1/visitor.ts:124-228`
- Modify: `backend/tests/api/visitor.test.ts`
- Modify: `frontend/e2e/fixtures.ts`

**Interfaces:**
- Consumes: query, answer, existing emotion, and optional structured route outcome.
- Produces: `derivePresentationHint(input): PresentationHint`; QA SSE `done.presentation`; non-streaming QA `presentation`.

- [ ] **Step 1: Write policy RED tests**

Use deterministic cases:

```ts
assert.deepEqual(derivePresentationHint({ query: '你好', answer: '您好', emotion: 'greet' }), {
  avatar_scene: 'greeting', emphasis: 'none',
});
assert.equal(derivePresentationHint({ query: '介绍灵山的历史文化', answer: '灵山有深厚的佛教文化底蕴。', emotion: 'explain' }).avatar_scene, 'culture_story');
assert.equal(derivePresentationHint({ query: '应该怎么走？', answer: '请从景区入口前往灵山大照壁。', emotion: 'explain' }).avatar_scene, 'route_guidance');
assert.equal(derivePresentationHint({ query: '这个安排来不及', answer: '无法满足', emotion: 'sorry' }).avatar_scene, 'warning');
assert.equal(derivePresentationHint({ query: '再见', answer: '再见', emotion: 'farewell' }).avatar_scene, 'farewell');
```

Also assert every returned scene belongs to the finite allowlist.

- [ ] **Step 2: Run RED**

```bash
cd backend
npx tsx --test tests/presentation/avatar-presentation.test.ts
```

Expected: FAIL because `derivePresentationHint` does not exist.

- [ ] **Step 3: Implement deterministic priority rules**

Priority order:

1. farewell/greet emotion;
2. apology or warning from explicit error/negative outcome;
3. route keywords or route outcome;
4. culture/history keywords;
5. recommendation keywords;
6. fact explanation default.

Do not call the LLM. Export the allowlist for contract tests.

- [ ] **Step 4: Add presentation to both QA response paths**

For streaming, compute after the final answer and include in the existing `done` event. For non-streaming, include the same field in JSON. Do not pass presentation into `queryRAG`, `streamRAGQuery`, prompts, traces, retrieval, or conversation scoring.

Update Playwright fixture SSE:

```text
data: {"type":"done","emotion":"explain","presentation":{"avatar_scene":"fact_explanation","emphasis":"none"}}
```

- [ ] **Step 5: Run GREEN and backend regression**

```bash
cd backend
npx tsx --test tests/presentation/avatar-presentation.test.ts
npm test
npm run build
```

Expected: presentation tests and all backend tests PASS; build exits 0.

- [ ] **Step 6: Commit the presentation contract**

```bash
git add backend/src/services/avatar-presentation.ts backend/tests/presentation/avatar-presentation.test.ts backend/src/api/v1/visitor.ts backend/tests/api/visitor.test.ts frontend/e2e/fixtures.ts
git commit -m "feat(avatar): expose bounded presentation scenes"
```

---

### Task 5: Connect QAPage to the Controller

**Files:**
- Modify: `frontend/src/pages/visitor/QAPage.tsx:16-78,101-212,300-420,555-606`
- Modify: `frontend/src/pages/visitor/__tests__/QAPage.test.tsx`
- Modify: `frontend/src/components/visitor/DigitalHuman.tsx`

**Interfaces:**
- Consumes: backend `PresentationHint`, `reduceAvatarState()`, `DigitalHuman.renderState`.
- Produces: one controller event for each session/listening/request/playback/error transition.

- [ ] **Step 1: Replace the DigitalHuman mock with observable props**

Use this mock in `QAPage.test.tsx`:

```tsx
vi.mock('../../../components/visitor/DigitalHuman', () => ({
  default: ({ renderState }: { renderState: { state: string; scene: string; motion: string } }) => (
    <div
      data-testid="digital-human"
      data-state={renderState.state}
      data-scene={renderState.scene}
      data-motion={renderState.motion}
    />
  ),
}));
```

Add tests for welcome, request thinking, streamed `route_guidance`, playback start, request failure, and stop playback.

- [ ] **Step 2: Run RED**

```bash
cd frontend
npm run test:unit -- --run src/pages/visitor/__tests__/QAPage.test.tsx
```

Expected: FAIL because QAPage still passes `emotion/isSpeaking/visemeId` instead of `renderState`.

- [ ] **Step 3: Introduce one reducer-owned avatar state**

Replace `currentEmotion` and `dhStatus` as renderer authorities with:

```ts
const [avatarState, dispatchAvatar] = useReducer(
  reduceAvatarState,
  sessionSeed,
  initialAvatarState,
);
```

Status text derives from `avatarState.state`. Message emotion remains message metadata but no longer directly controls Live2D.

- [ ] **Step 4: Dispatch events at existing lifecycle boundaries**

Exact mappings:

```text
session init success       → SESSION_STARTED
speech recognition start  → LISTENING_STARTED
speech recognition end    → LISTENING_STOPPED
handleSend start           → REQUEST_STARTED
SSE done                   → ANSWER_READY(scene)
audio source start         → PLAYBACK_STARTED(scene, token)
audio source onended       → PLAYBACK_ENDED(token)
stopPlayback               → PLAYBACK_INTERRUPTED(token)
both QA attempts fail      → REQUEST_FAILED
```

Store the presentation hint on each assistant `ChatMessage` so replaying an older message reproduces its original scene.

- [ ] **Step 5: Render stable diagnostics**

Pass `avatarState` and mouth state to `DigitalHuman`. Keep visitor status copy limited to `待机/聆听中/思考中/讲解中/已暂停`.

- [ ] **Step 6: Run GREEN and full frontend unit tests**

```bash
cd frontend
npm run test:unit -- --run src/pages/visitor/__tests__/QAPage.test.tsx src/components/visitor/avatar/avatar-controller.test.ts
npm run test:unit
```

Expected: focused tests and complete unit suite PASS.

- [ ] **Step 7: Commit the lifecycle integration**

```bash
git add frontend/src/pages/visitor/QAPage.tsx frontend/src/pages/visitor/__tests__/QAPage.test.tsx frontend/src/components/visitor/DigitalHuman.tsx
git commit -m "feat(avatar): drive actions from conversation lifecycle"
```

---

### Task 6: Build a Boundary-Aware Speech Timeline

**Files:**
- Create: `backend/python/tts_alignment.py`
- Create: `backend/python/tools/test_tts_alignment.py`
- Modify: `backend/python/tts_server.py:1-122`
- Modify: `backend/src/services/tts-service.ts:1-45`
- Modify: `backend/src/api/v1/visitor.ts:237-261`
- Create: `frontend/src/components/visitor/avatar/speech-timeline.ts`
- Create: `frontend/src/components/visitor/avatar/speech-timeline.test.ts`
- Modify: `frontend/src/pages/visitor/QAPage.tsx:101-212`

**Interfaces:**
- Consumes: Edge TTS stream events and `AudioContext.currentTime`.
- Produces: `VisemeCue[]` with `duration_ms`, `timing_source: 'boundary' | 'estimated'`; `getMouthShape(cues, elapsedMs, volume)`.

- [ ] **Step 1: Write Python RED tests for boundaries and pauses**

Test a pure function that receives character segments and boundary intervals:

```python
timeline = build_viseme_timeline(
    text="灵山，欢迎你",
    duration_ms=1800,
    boundaries=[
        {"text": "灵山", "offset_ms": 0, "duration_ms": 500},
        {"text": "欢迎你", "offset_ms": 900, "duration_ms": 700},
    ],
)
self.assertEqual(timeline[0]["time_ms"], 0)
self.assertTrue(any(cue["viseme_name"] == "rest" and cue["duration_ms"] >= 250 for cue in timeline))
self.assertEqual(timeline[-1]["time_ms"] + timeline[-1]["duration_ms"], 1800)
```

Also test monotonic cue times, valid IDs 0–5, empty text, and estimated fallback.

- [ ] **Step 2: Run Python RED**

```bash
python backend/python/tools/test_tts_alignment.py
```

Expected: FAIL because `tts_alignment.py` does not exist.

- [ ] **Step 3: Implement Edge TTS streaming with boundary capture**

Use `edge_tts.Communicate(text=text, voice=voice, rate=rate, pitch=pitch).stream()` to collect `audio` chunks and `WordBoundary` events. Convert 100-nanosecond offsets to milliseconds. Build explicit `rest` cues for gaps of 250ms or longer. Return `timing_source='estimated'` only when no boundary event is available.

`tts_server.py` returns:

```json
{
  "audio_base64": "SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU5",
  "duration_ms": 1800,
  "visemes": [
    {"time_ms": 0, "duration_ms": 120, "viseme_id": 3, "viseme_name": "i", "shape": {"w": 0.9, "h": 0.3}}
  ],
  "timing_source": "boundary",
  "voice": "zh-CN-XiaoxiaoNeural"
}
```

- [ ] **Step 4: Write frontend Speech Timeline RED tests**

```ts
expect(getMouthShape(cues, 100, 0.8)).toEqual({ open: 0.8, form: expectedForm });
expect(getMouthShape(cues, 650, 0.8)).toEqual({ open: 0, form: 0 });
expect(getMouthShape(cues, 1900, 0.8)).toEqual({ open: 0, form: 0 });
```

Test that `stop()` resets mouth state immediately and that elapsed time comes from the supplied clock function.

- [ ] **Step 5: Implement the Web Audio clock timeline**

Expose:

```ts
export function getMouthShape(
  cues: VisemeCue[],
  elapsedMs: number,
  volume: number,
): { open: number; form: number };

export function createSpeechTimeline(options: {
  cues: VisemeCue[];
  clockSeconds: () => number;
  readVolume: () => number;
  onMouth: (shape: { open: number; form: number }) => void;
}): { start(atSeconds: number): void; stop(): void };
```

Use `requestAnimationFrame`, not `setInterval`. `stop()` must cancel RAF and emit `{open:0,form:0}` synchronously.

- [ ] **Step 6: Run GREEN across Python and frontend**

```bash
python backend/python/tools/test_tts_alignment.py
cd frontend
npm run test:unit -- --run src/components/visitor/avatar/speech-timeline.test.ts src/pages/visitor/__tests__/QAPage.test.tsx
cd ../backend
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 7: Perform the real timing smoke**

Start the TTS service and synthesize the fixed sentence `您好，我是灵小禅。现在为您介绍灵山胜境。`. Record audio duration, timing source, cue count, monotonicity, and maximum silent gap. Do not print audio base64.

Acceptance: `timing_source=boundary`, cue times are monotonic, final cue end is within 150ms of decoded audio duration, and pauses longer than 250ms contain a `rest` cue.

- [ ] **Step 8: Commit speech synchronization**

```bash
git add backend/python/tts_alignment.py backend/python/tools/test_tts_alignment.py backend/python/tts_server.py backend/src/services/tts-service.ts backend/src/api/v1/visitor.ts frontend/src/components/visitor/avatar/speech-timeline.ts frontend/src/components/visitor/avatar/speech-timeline.test.ts frontend/src/pages/visitor/QAPage.tsx
git commit -m "feat(avatar): synchronize speech timeline and mouth motion"
```

---

### Task 7: Add Admin Preview and Runtime Diagnostics

**Files:**
- Modify: `frontend/src/pages/admin/DigitalHumanPage.tsx:14-252`
- Modify: `frontend/src/pages/admin/DigitalHumanPage.css`
- Modify: `frontend/src/pages/admin/__tests__/AdminFlows.test.tsx`
- Modify: `backend/src/api/v1/admin.ts:442-489`
- Modify: `backend/src/api/v1/visitor.ts:774-785`

**Interfaces:**
- Consumes: Manifest, Avatar Controller, renderer diagnostics.
- Produces: action/expression preview controls and read-only diagnostic panel.

- [ ] **Step 1: Write admin RED tests**

Assert the page renders 13 action buttons and 6 expression buttons from the manifest, rejects a saved motion not in the manifest, and displays renderer status/fallback reason without exposing internal errors to the visitor page.

- [ ] **Step 2: Run RED**

```bash
cd frontend
npm run test:unit -- --run src/pages/admin/__tests__/AdminFlows.test.tsx
```

Expected: FAIL because action preview and diagnostics do not exist.

- [ ] **Step 3: Replace static appearance selection with model diagnostics**

The admin page retains voice selection. Replace the four static appearance choices with:

- model ID/version and license presence;
- motion buttons generated from manifest keys;
- expression buttons generated from manifest keys;
- fixed test sentence for mouth preview;
- renderer status, fallback reason, FPS and model load milliseconds;
- reduced-motion toggle for preview only.

- [ ] **Step 4: Validate saved configuration server-side**

The admin API accepts `model_id: 'lingxiaochan-v1'` and voice settings. Reject any other model ID with HTTP 400. The visitor `/dh-config` response includes model ID and voice, not a static `style_preset` that implies multiple animated models.

- [ ] **Step 5: Run GREEN and builds**

```bash
cd frontend
npm run test:unit -- --run src/pages/admin/__tests__/AdminFlows.test.tsx
npm run build
cd ../backend
npm test
npm run build
```

Expected: all tests and builds exit 0.

- [ ] **Step 6: Commit admin diagnostics**

```bash
git add frontend/src/pages/admin/DigitalHumanPage.tsx frontend/src/pages/admin/DigitalHumanPage.css frontend/src/pages/admin/__tests__/AdminFlows.test.tsx backend/src/api/v1/admin.ts backend/src/api/v1/visitor.ts
git commit -m "feat(admin): add avatar action preview and diagnostics"
```

---

### Task 8: Add Ten Competition Browser Journeys

**Files:**
- Create: `frontend/e2e/avatar-journeys.spec.ts`
- Modify: `frontend/e2e/fixtures.ts`
- Modify: `frontend/e2e/mobile.spec.ts`
- Modify: `frontend/playwright.config.ts`

**Interfaces:**
- Consumes: stable `data-avatar-*` diagnostics and mocked QA/TTS contracts.
- Produces: repeatable desktop/mobile proof of all ten scene transitions.

- [ ] **Step 1: Write the E2E journeys before changing fixtures**

Create one test per acceptance scene:

1. greeting wave;
2. idle recovery;
3. listening focus;
4. thinking;
5. fact explanation;
6. culture story;
7. route direction;
8. warning;
9. request failure/apology;
10. playback interruption.

Each test asserts `data-avatar-state`, `data-avatar-scene`, `data-avatar-motion`, and `data-avatar-renderer`. The normal path must equal `ready`; a separate fallback test intentionally forces renderer failure.

- [ ] **Step 2: Run RED**

```bash
cd frontend
npm run test:e2e -- avatar-journeys.spec.ts --reporter=line
```

Expected: tests fail because fixtures cannot select presentation scenes and mocked renderer readiness.

- [ ] **Step 3: Extend deterministic fixtures**

Route requests by a request header or query text to one of the finite scenes. Add a test-only renderer adapter selected by `VITE_AVATAR_ADAPTER=stub` only when `import.meta.env.MODE !== 'production'`; make a production build fail if the variable is set to `stub`. Configure the Playwright web server with that environment value. Do not add production query parameters that bypass the real renderer.

- [ ] **Step 4: Run desktop and mobile GREEN**

```bash
cd frontend
npm run test:e2e -- avatar-journeys.spec.ts --project=chromium --reporter=line
npm run test:e2e -- avatar-journeys.spec.ts mobile.spec.ts --reporter=line
```

Expected: all ten scene journeys and mobile checks PASS with no uncaught page exceptions.

- [ ] **Step 5: Commit browser acceptance**

```bash
git add frontend/e2e/avatar-journeys.spec.ts frontend/e2e/fixtures.ts frontend/e2e/mobile.spec.ts frontend/playwright.config.ts
git commit -m "test(avatar): cover competition interaction journeys"
```

---

### Task 9: Produce Performance and Competition Evidence

**Files:**
- Create: `frontend/scripts/measure-avatar-performance.mjs`
- Create: `docs/competition/digital-human-evidence.md`
- Modify: `docs/testing/acceptance-gates.md`
- Modify: `docs/competition/demo-script.md`

**Interfaces:**
- Consumes: running frontend/backend/TTS, browser Performance API, renderer diagnostics.
- Produces: machine-readable performance JSON and reviewed competition report.

- [ ] **Step 1: Add a fixed performance collector**

The script must run the same 60-second scenario three times and save an object with this exact interface; every value is collected at runtime:

```ts
interface AvatarPerformanceReport {
  git_sha: string;
  browser: string;
  device: string;
  model_id: 'lingxiaochan-v1';
  model_ready_ms: number;
  fps_p50: number;
  fps_p05: number;
  interrupt_ms: number;
  mouth_drift_p95_ms: number;
  heap_start_mb: number;
  heap_end_mb: number;
  canvas_count_after_20_mounts: number;
}
```

The script exits non-zero if desktop thresholds from the spec fail.

- [ ] **Step 2: Run the collector on the fixed desktop environment**

Run:

```bash
cd frontend
node scripts/measure-avatar-performance.mjs
```

Record exact browser version, CPU, GPU, viewport, device pixel ratio and network profile. Repeat on the agreed physical mobile device or documented remote-device harness; mobile results may not be inferred from desktop viewport emulation.

- [ ] **Step 3: Execute the complete release gate**

```bash
python backend/python/tools/test_tts_alignment.py
cd backend
npm test
npm run build
cd ../frontend
npm run validate:avatar
npm run test:unit
npm run lint
npm run build
npm run test:e2e -- --reporter=line
cd ..
git diff --check
git status --short
```

Expected: every command exits 0 and status contains only the intended evidence/document changes before the final commit.

- [ ] **Step 4: Perform manual visual acceptance**

Use the ten-scene checklist from the spec on Chrome, Edge, Android and iPhone. Verify WebGL-disabled fallback and reduced-motion behavior. Record pass/fail per scene; do not replace failures with edited screenshots.

- [ ] **Step 5: Write the evidence report**

`digital-human-evidence.md` must include:

- Git SHA and model ID;
- asset license location and hash;
- commands and test counts;
- ten-scene result table;
- desktop and physical-mobile performance tables;
- mouth timing source and drift;
- fallback/reduced-motion evidence;
- known limitations;
- links to unedited demo recordings.

Update the competition demo script with the one-minute flow from the design spec.

- [ ] **Step 6: Commit the evidence package**

```bash
git add frontend/scripts/measure-avatar-performance.mjs docs/competition/digital-human-evidence.md docs/testing/acceptance-gates.md docs/competition/demo-script.md
git commit -m "docs(avatar): publish competition acceptance evidence"
```

---

### Task 10: Final Review, PR and Merge Gate

**Files:**
- Review all files changed since `origin/master`.

**Interfaces:**
- Consumes: all preceding task outputs.
- Produces: one reviewable PR with no waived release gate.

- [ ] **Step 1: Audit scope and secrets**

```bash
git diff --stat origin/master...HEAD
git diff --check origin/master...HEAD
git status --short
git diff --name-only origin/master...HEAD
```

Confirm `.env`, API keys, TTS audio base64, generated caches, Playwright traces and unlicensed source art are absent.

- [ ] **Step 2: Request code review**

Review specifically for renderer cleanup, stale playback tokens, action priority, presentation policy isolation, fallback truthfulness, reduced motion, model licensing and test-only seams leaking into production.

- [ ] **Step 3: Run release verification again after review changes**

Repeat Task 9 Step 3 in full. Fresh outputs are required; earlier outputs do not certify post-review changes.

- [ ] **Step 4: Create the PR**

```bash
git push -u origin codex/digital-human-avatar
gh pr create --base master --head codex/digital-human-avatar --title "feat(avatar): deliver scene-aware Live2D guide" --body-file docs/competition/digital-human-evidence.md
```

The PR must not merge until GitHub CI passes and every release gate in the spec is evidenced. The repository's actual primary branch is `master`; do not create a parallel `main` branch.

## Execution Order and Commit Checkpoints

| Order | Deliverable | Commit boundary | May proceed when |
| ---: | --- | --- | --- |
| 1 | Contracts and asset validator | `feat(avatar): define model and action contracts` | Unit tests/build pass |
| 2 | Deterministic controller | `feat(avatar): add deterministic action controller` | Transition matrix passes |
| 3 | Licensed model and Cubism 4 renderer | `feat(avatar): integrate licensed Lingxiaochan Live2D model` | Asset validator, component tests and build pass |
| 4 | Presentation policy | `feat(avatar): expose bounded presentation scenes` | Backend policy/API regression passes |
| 5 | QAPage lifecycle | `feat(avatar): drive actions from conversation lifecycle` | Component and full unit tests pass |
| 6 | Speech timeline | `feat(avatar): synchronize speech timeline and mouth motion` | Python/frontend tests and real TTS smoke pass |
| 7 | Admin diagnostics | `feat(admin): add avatar action preview and diagnostics` | Admin/backend tests and builds pass |
| 8 | Browser journeys | `test(avatar): cover competition interaction journeys` | Desktop/mobile E2E pass |
| 9 | Evidence package | `docs(avatar): publish competition acceptance evidence` | Full release gate and human visual gate pass |
| 10 | PR | no extra code required | Review and GitHub CI pass |

## Stop Conditions

Stop implementation and report instead of bypassing the gate when any of these occurs:

- licensed `.moc3` model or explicit publication license is unavailable;
- the supplied model lacks required motions/parameters;
- normal Chrome/Edge execution still enters static fallback;
- TTS cannot produce boundary timing and measured fallback exceeds the 150ms drift threshold;
- physical mobile frame rate is below 30 FPS after bounded renderer tuning;
- test-only renderer injection is reachable in a production build;
- any change alters RAG, route or evaluation decisions.
