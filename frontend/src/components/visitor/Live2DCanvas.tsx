/**
 * Live2DCanvas — WebGL-powered Live2D Cubism model renderer.
 *
 * Uses pixi-live2d-display + Cubism 4 Core SDK to render the hibiki model.
 * Drives mouth shape (ParamMouthOpenY) from viseme IDs and blends
 * expressions (.exp.json) from emotion state.
 *
 * Gracefully degrades: if WebGL or model loading fails, calls onError()
 * so the parent can show the static PNG fallback.
 */
import { useEffect, useRef } from 'react';

// ---- viseme → mouth-open mapping -------------------------------------------
// Viseme IDs: 0=rest, 1=aa(wide), 2=e(half), 3=i(spread), 4=o(round), 5=u(pout), 6=cd(closed)
const VISEME_MOUTH: number[] = [0, 0.9, 0.4, 0.2, 0.65, 0.25, 0];

function visemeToMouth(id: number): number {
  return VISEME_MOUTH[id] ?? 0;
}

// ---- emotion → expression index (hibiki model has 6 exp files) ------------
const EMOTION_EXP: Record<string, number> = {
  greet: 0,    // f01 — warm smile
  happy: 1,    // f02 — delighted
  think: 2,    // f03 — curious
  explain: 4,  // f05 — attentive / speaking
  farewell: 5, // f06 — gentle
  sorry: 3,    // f04 — apologetic
  idle: 0,
};

function hasCubism2Runtime(): boolean {
  return typeof window !== 'undefined'
    && Boolean((window as Window & { Live2D?: unknown }).Live2D);
}

// ---- types -----------------------------------------------------------------
interface Props {
  width: number;
  height: number;
  emotion?: string;
  isSpeaking?: boolean;
  visemeId?: number;
  onLoaded?: () => void;
  onError?: () => void;
}

interface CoreModelLike {
  getParameterCount: () => number;
  getParameterId: (index: number) => string;
  setParameterValueById: (index: number, value: number, weight: number) => void;
}

interface Live2DModelLike {
  width: number;
  height: number;
  x: number;
  y: number;
  scale: { set: (value: number) => void };
  anchor: { set: (x: number, y: number) => void };
  internalModel?: { coreModel?: CoreModelLike; destroy?: () => void };
  expression?: (index: number) => unknown;
  motion?: (group: string, index: number) => Promise<unknown>;
}

interface PixiAppLike {
  view: unknown;
  stage: { addChild: (child: unknown) => void };
  ticker: { add: (callback: () => void) => void };
  destroy: (...args: unknown[]) => void;
}

// ---- component -------------------------------------------------------------
export default function Live2DCanvas({
  width,
  height,
  emotion = 'idle',
  isSpeaking = false,
  visemeId = 0,
  onLoaded,
  onError,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PixiAppLike | null>(null);
  const modelRef = useRef<Live2DModelLike | null>(null);
  const mouthIdxRef = useRef<number>(-1);
  const loadedRef = useRef(false);
  const targetMouth = useRef(0);
  const currentMouth = useRef(0);
  const lastExpRef = useRef<number>(-1);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onLoadedRef = useRef(onLoaded);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onLoadedRef.current = onLoaded;
    onErrorRef.current = onError;
  }, [onError, onLoaded]);

  // ---- viseme → smooth mouth target ----------------------------------------
  useEffect(() => {
    targetMouth.current = isSpeaking ? visemeToMouth(visemeId) : 0;
  }, [visemeId, isSpeaking]);

  // ---- emotion → expression -------------------------------------------------
  useEffect(() => {
    const expIdx = EMOTION_EXP[emotion] ?? 0;
    if (expIdx === lastExpRef.current || !loadedRef.current) return;
    lastExpRef.current = expIdx;
    try {
      modelRef.current?.expression?.(expIdx);
    } catch { /* expression may not exist */ }
  }, [emotion]);

  // ---- mount: create PIXI app + load Live2D model --------------------------
  useEffect(() => {
    let cancelled = false;

    (async () => {
      // The current hibiki asset is Cubism 2. Avoid importing the plugin when
      // its required global runtime is absent; the parent then renders the
      // existing static portrait fallback without an uncaught page error.
      if (!hasCubism2Runtime()) {
        if (!cancelled) onErrorRef.current?.();
        return;
      }

      // Dynamic imports to avoid bundling issues if Live2D isn't available
      const [PIXI, { Live2DModel }] = await Promise.all([
        import('pixi.js'),
        import('pixi-live2d-display'),
      ]);

      if (cancelled) return;

      // ---- PIXI Application ------------------------------------------------
      const app = new PIXI.Application({
        width,
        height,
        backgroundAlpha: 0,
        antialias: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        autoDensity: true,
      });

      const container = containerRef.current;
      if (!container || cancelled) { app.destroy(true); return; }
      container.appendChild(app.view as HTMLCanvasElement);
      appRef.current = app as unknown as PixiAppLike;

      // ---- Load Live2D model ------------------------------------------------
      try {
        // pixi-live2d-display types are incomplete — use the local adapter types above.
        const model = await Live2DModel.from('/models/hibiki/hibiki.model.json', {
          autoUpdate: true,
          autoHitTest: false,
        }) as unknown as Live2DModelLike;
        if (cancelled) { app.destroy(true); return; }

        // Scale & position — fit nicely in the container
        const modelW = model.width || 300;
        const modelH = model.height || 400;
        const scale = Math.min(width / modelW, height / modelH) * 0.85;
        model.scale.set(scale);
        model.x = width / 2;
        model.y = height * 0.65;
        model.anchor.set(0.5, 0.5);

        app.stage.addChild(model as unknown as Parameters<typeof app.stage.addChild>[0]);
        modelRef.current = model;

        // ---- Locate mouth-open parameter -----------------------------------
        try {
          const cm = model.internalModel?.coreModel;
          if (cm && typeof cm.getParameterCount === 'function') {
            const count = cm.getParameterCount();
            for (let i = 0; i < count; i++) {
              const id = cm.getParameterId(i);
              if (id === 'ParamMouthOpenY') {
                mouthIdxRef.current = i;
                break;
              }
            }
          }
        } catch {
          // mouth sync won't work, but model still renders fine
        }

        // ---- Ticker: smooth mouth animation + idle cycle -------------------
        app.ticker.add(() => {
          const m = modelRef.current;
          if (!m) return;

          // Smooth mouth interpolation
          const target = targetMouth.current;
          const current = currentMouth.current;
          const next = current + (target - current) * 0.15; // smooth lerp
          currentMouth.current = next;

          // Apply mouth parameter if found
          const mi = mouthIdxRef.current;
          if (mi >= 0) {
            try {
              const cm = m.internalModel?.coreModel;
              if (cm?.setParameterValueById) {
                cm.setParameterValueById(mi, next, 0.8);
              }
            } catch { /* ignore */ }
          }
        });

        loadedRef.current = true;
        onLoadedRef.current?.();

        // ---- Start idle motion cycle ---------------------------------------
        const playIdle = () => {
          if (!modelRef.current || cancelled || !loadedRef.current) return;
          try {
            const idleCount = 4; // hibiki has 4 idle motions
            const idx = Math.floor(Math.random() * idleCount);
            const motionPromise = modelRef.current.motion?.('idle', idx);
            const handleDone = () => {
              if (!cancelled && loadedRef.current) {
                idleTimerRef.current = setTimeout(playIdle, 2000 + Math.random() * 3000);
              }
            };
            if (motionPromise && typeof motionPromise.then === 'function') {
              motionPromise.then(handleDone).catch(() => {
                if (!cancelled && loadedRef.current) {
                  idleTimerRef.current = setTimeout(playIdle, 3000);
                }
              });
            } else {
              handleDone();
            }
          } catch {
            if (!cancelled && loadedRef.current) {
              idleTimerRef.current = setTimeout(playIdle, 4000);
            }
          }
        };
        setTimeout(playIdle, 1500);

      } catch (err) {
        console.warn('[Live2D] Model load failed, falling back to static:', err);
        if (!cancelled) {
          app.destroy(true);
          onErrorRef.current?.();
        }
      }
    })();

    // ---- cleanup -----------------------------------------------------------
    return () => {
      cancelled = true;
      loadedRef.current = false;
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      try {
        const m = modelRef.current;
        if (m?.internalModel) m.internalModel.destroy?.();
        appRef.current?.destroy?.(true, { children: true, texture: true });
      } catch { /* ignore destroy errors */ }
      appRef.current = null;
      modelRef.current = null;
    };
  }, [width, height]); // intentionally narrow deps — mount once per size

  return <div ref={containerRef} className="dh-char__live2d" />;
}
